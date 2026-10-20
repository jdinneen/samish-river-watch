/**
 * Season line, 24-hour rise and crossing-time computation (CONTRACT.md section 3).
 * Pure functions; times are epoch milliseconds in UTC; flows are cfs.
 * Series are arrays of {t, cfs} sorted ascending by t.
 */

const LA_ZONE = "America/Los_Angeles";
const HOUR_MS = 3600 * 1000;
const RISE_WINDOW_MS = 24 * HOUR_MS;
/** Spacing used to refine crossing times inside long (forecast) segments. */
const REFINE_STEP_MS = 15 * 60 * 1000;

/** @typedef {{t:number, cfs:number}} Point */

let laFormatter = null;

/** @returns {Intl.DateTimeFormat} cached formatter for America/Los_Angeles wall-clock parts. */
function formatter() {
  if (laFormatter === null) {
    laFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: LA_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  }
  return laFormatter;
}

/**
 * Wall-clock parts of an instant in America/Los_Angeles.
 * @param {number} ms epoch milliseconds UTC
 * @returns {{year:number, month:number, day:number, hour:number, minute:number, second:number}} month is 1-12
 */
export function laParts(ms) {
  if (!Number.isFinite(ms)) throw new RangeError("laParts needs a finite time");
  const out = {};
  for (const p of formatter().formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** @param {number} ms @returns {number} Los Angeles offset from UTC in ms (negative in the Americas). */
function laOffsetMs(ms) {
  const p = laParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/**
 * Convert a Los Angeles wall-clock time to epoch ms (handles daylight saving).
 * @param {number} year @param {number} month 1-12 @param {number} day
 * @param {number} [hour] @param {number} [minute]
 * @returns {number}
 */
export function laWallToUtc(year, month, day, hour = 0, minute = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - laOffsetMs(guess);
  return guess - laOffsetMs(first);
}

/**
 * Season line in cfs by local (America/Los_Angeles) month: Nov-Feb 400, Mar-Apr 200, May-Oct 100.
 * @param {number} msUtc epoch milliseconds UTC
 * @returns {400|200|100}
 */
export function seasonLineCfs(msUtc) {
  const month = laParts(msUtc).month;
  if (month >= 11 || month <= 2) return 400;
  if (month <= 4) return 200;
  return 100;
}

/** @param {Point[]} series @param {number} ms @returns {number} index of first point with t >= ms (series.length if none). */
function lowerBound(series, ms) {
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (series[mid].t < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Linearly interpolated flow at an instant; null when the instant lies outside the series.
 * @param {Point[]} series sorted ascending
 * @param {number} ms
 * @returns {number|null}
 */
export function valueAt(series, ms) {
  if (!series.length || ms < series[0].t || ms > series[series.length - 1].t) return null;
  const i = lowerBound(series, ms);
  const b = series[i];
  if (b.t === ms) return b.cfs;
  const a = series[i - 1];
  return a.cfs + ((b.cfs - a.cfs) * (ms - a.t)) / (b.t - a.t);
}

/**
 * 24-hour rise (study definition): flow at t minus the lowest flow in the 24 h ending at t.
 * The lowest flow considers every point in the window plus the interpolated value at the
 * window start. Null when t lies outside the series.
 * @param {Point[]} series sorted ascending
 * @param {number} msUtc
 * @returns {number|null}
 */
export function rise24(series, msUtc) {
  const current = valueAt(series, msUtc);
  if (current === null) return null;
  const start = msUtc - RISE_WINDOW_MS;
  let lowest = current;
  const atStart = valueAt(series, start);
  if (atStart !== null && atStart < lowest) lowest = atStart;
  for (let i = lowerBound(series, start); i < series.length && series[i].t <= msUtc; i++) {
    if (series[i].cfs < lowest) lowest = series[i].cfs;
  }
  return current - lowest;
}

/** @param {Point[]} series @param {number} startMs @returns {number[]} ascending candidate evaluation times. */
function candidateTimes(series, startMs) {
  const times = new Set();
  if (valueAt(series, startMs) !== null) times.add(startMs);
  for (let i = 0; i < series.length; i++) {
    if (series[i].t >= startMs) times.add(series[i].t);
    if (i > 0 && series[i].t - series[i - 1].t > REFINE_STEP_MS) {
      for (let t = series[i - 1].t + REFINE_STEP_MS; t < series[i].t; t += REFINE_STEP_MS) {
        if (t >= startMs) times.add(t);
      }
    }
  }
  return [...times].sort((x, y) => x - y);
}

/**
 * First instant at or after startMs where the 24-h rise reaches the season line for that
 * instant's local month. Evaluated at every series point; segments longer than 15 min
 * (forecast paths) are also checked every 15 min, so a coarse path does not delay the answer.
 * @param {Point[]} series sorted ascending
 * @param {number} startMs
 * @returns {number|null} epoch ms, or null when never crossed
 */
export function firstCrossing(series, startMs) {
  const from = Number.isFinite(startMs) ? startMs : series.length ? series[0].t : 0;
  for (const t of candidateTimes(series, from)) {
    const rise = rise24(series, t);
    if (rise !== null && rise >= seasonLineCfs(t)) return t;
  }
  return null;
}

/**
 * Observed flow for the last 24 h followed by the path points after the latest observation.
 * Returns fresh point objects sorted ascending. With no observations, the sorted path alone.
 * @param {Point[]} observed
 * @param {Point[]} path
 * @returns {Point[]}
 */
export function spliceSeries(observed, path) {
  const byTime = (a, b) => a.t - b.t;
  const copy = (p) => ({ t: p.t, cfs: p.cfs });
  const obs = observed.map(copy).sort(byTime);
  if (!obs.length) return path.map(copy).sort(byTime);
  const latestT = obs[obs.length - 1].t;
  const recent = obs.filter((p) => p.t >= latestT - RISE_WINDOW_MS);
  const ahead = path.filter((p) => p.t > latestT).map(copy).sort(byTime);
  return [...recent, ...ahead];
}
