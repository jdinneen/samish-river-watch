/**
 * NOAA's forecast crest, the rain clock after radar rain eases, and the sampling card
 * (CONTRACT.md section 3). Pure functions; times are epoch ms UTC.
 */
import { valueAt, waterYearStartMs } from "./season.js";
import { rainEndSupported } from "./basin.js";

const HOUR_MS = 3600 * 1000;

/** Hours after the called peak that Taylor's own sampling target sits (Taylor Shellfish's stated target, September 2026; Taylor's, not DOH's). */
export const TAYLOR_TARGET_H = 6;
/**
 * The rain clock's reference mark: hours after the shown rain end at which half of past real-time hours still had the
 * peak ahead (partner study Q9 part 5, records.json rain_clock_median_h). It is a past median, not a crest window: the
 * hindsight 2.25 h / 8 h window was withdrawn (refuting review, 2026-10-19), and no "latest" time is shown.
 */
export const RAIN_CLOCK_MEDIAN_H = 6;
/** Basin rain older than this is stale. */
export const BASIN_MAX_AGE_H = 3;
/** The sampling card stays up this long after a peak call. */
export const CALL_VISIBLE_H = 48;
/** Log entry kinds that count as a bay sample toward the season counter. */
export const BAY_SAMPLE_KINDS = Object.freeze(["bay_sample", "bay"]);

/** @typedef {{t:number, cfs:number}} Point */

/**
 * NOAA's forecast crest: the highest point of the raw path, read as the linearly interpolated line
 * (CONTRACT.md section 3, NOAA RAW LINE), from nowMs to 72 h ahead; earliest on ties. The candidates
 * are NOAA's own points inside that span plus the interpolated values at its two ends, so a path that
 * is already falling at nowMs never reports a later, lower point as its crest.
 *
 * A crest needs a turn (external review 2026-10-19, defect 3): the highest point must be followed, inside the path
 * the page reads, by a lower point. A path that is still rising at its last point, or level to it, has no crest in
 * the forecast, and its last point is never called one:
 *   - fallingFromNow: true when the highest value is the interpolated value at nowMs and every later
 *     candidate is lower (NOAA's path is at its highest now and falls after; there is no crest ahead).
 *   - risingAt72h: true when the highest value sits exactly at nowMs + 72 h and NOAA's next point after
 *     that is higher (the crest lies beyond the 72 h the page looks at).
 *   - noTurn: "rising" or "flat" when the path ends (its last point, which is the returned t and cfs) without a lower
 *     point after the highest. No crest time is given; t and cfs name the last point only.
 * The flags are present only when true. Exactly one of them can be set.
 * @param {Point[]} rawPath sorted ascending
 * @param {number} nowMs
 * @returns {{t:number, cfs:number, fallingFromNow?:true, risingAt72h?:true, noTurn?:"rising"|"flat"}|null} null when the path has no point in that span
 */
export function noaaCrest(rawPath, nowMs) {
  const endMs = nowMs + 72 * HOUR_MS;
  const cands = [];
  const atNow = valueAt(rawPath, nowMs);
  if (atNow !== null) cands.push({ t: nowMs, cfs: atNow });
  for (const p of rawPath) if (p.t > nowMs && p.t < endMs) cands.push({ t: p.t, cfs: p.cfs });
  const atEnd = valueAt(rawPath, endMs);
  if (atEnd !== null) cands.push({ t: endMs, cfs: atEnd });
  let best = null;
  for (const c of cands) if (best === null || c.cfs > best.cfs) best = c;
  if (best === null) return null;
  const later = cands.filter((c) => c.t > best.t);
  if (best.t === nowMs && later.length && later.every((c) => c.cfs < best.cfs)) return { t: best.t, cfs: best.cfs, fallingFromNow: true };
  if (best.t === endMs) {
    const next = rawPath.find((p) => p.t > endMs);
    if (next && next.cfs > best.cfs) return { t: best.t, cfs: best.cfs, risingAt72h: true };
  }
  // A turn: some later point of the path is lower than the highest.
  if (later.some((c) => c.cfs < best.cfs)) return { t: best.t, cfs: best.cfs };
  // No turn before the path ends: the last candidate is the path's last point (or its value at 72 h).
  const last = cands[cands.length - 1];
  const before = cands.length > 1 ? cands[cands.length - 2] : null;
  return { t: last.t, cfs: last.cfs, noTurn: before !== null && last.cfs > before.cfs ? "rising" : "flat" };
}

/** @param {string} code @param {string} reason @returns {{withheld:true, code:string, reason:string}} */
function withheld(code, reason) {
  return { withheld: true, code, reason };
}

/**
 * The rain clock: only while an episode is active, the radar basin-rain feed is fresh and rain has eased after the
 * episode began. medianT = rain end + 6 h, the past median from the shown rain end to the peak (real-time count);
 * never a time before the rain has eased, never a crest height, never a "latest" time.
 * The rain end must be backed by the feed's own hours (basin.js rainEndSupported): a solid hour at the end, then a
 * complete run of dry hours up to a newest hour no more than 3 h old.
 * @param {{status?:string, generatedT?:number|null, solidRainEndT?:number|null, hours?:{endT:number, mm:number}[]}|null|undefined} basin parsed basin_rain feed
 * @param {number|null} episodeStartMs episode start from the detector, null when no episode
 * @param {number} nowMs
 * @returns {{easedT:number, medianT:number}|{withheld:true, code:string, reason:string}}
 */
export function ourWindow(basin, episodeStartMs, nowMs) {
  if (!Number.isFinite(episodeStartMs)) return withheld("no_episode", "No rise is under way.");
  if (!basin) return withheld("radar_missing", "Radar rain could not be read.");
  if (basin.status !== undefined && basin.status !== "ok") {
    const text = basin.status === "stale" ? "Radar rain is more than 3 hours old." : "Radar rain could not be read.";
    return withheld(`radar_${basin.status}`, text);
  }
  if (!Number.isFinite(basin.generatedT) || nowMs - basin.generatedT > BASIN_MAX_AGE_H * HOUR_MS) {
    return withheld("radar_stale", "Radar rain is more than 3 hours old.");
  }
  const end = basin.solidRainEndT;
  if (!Number.isFinite(end)) return withheld("rain_not_eased", "Rain over the basin has not eased yet.");
  if (end <= episodeStartMs) return withheld("rain_end_before_rise", "The last rain break came before this rise began.");
  if (end > nowMs) return withheld("rain_end_in_future", "Radar rain end time is not usable.");
  // The rain end must be backed by the hours themselves: a solid hour at the end, then a complete run of dry hours
  // up to a current newest hour (coordinator disposition 1, 2026-10-19).
  const backed = rainEndSupported(basin.hours, end, nowMs);
  if (!backed.ok) {
    if (backed.why === "old") return withheld("radar_stale", "The newest radar hour is more than 3 hours old.");
    if (backed.why === "no_dry_hour" || backed.why === "solid_after") return withheld("rain_not_eased", "Rain over the basin has not eased yet.");
    return withheld("radar_incomplete", "Radar rain hours are missing since the rain eased.");
  }
  return { easedT: end, medianT: end + RAIN_CLOCK_MEDIAN_H * HOUR_MS };
}

/**
 * Whether the sampling card is shown: an episode is active, or a call stands that was
 * confirmed within the last 48 h.
 * @param {boolean} episodeActive
 * @param {{confirmedT:number, premature?:boolean}|null} call
 * @param {number} nowMs
 * @returns {boolean}
 */
export function samplingVisible(episodeActive, call, nowMs) {
  if (episodeActive) return true;
  return Boolean(call) && !call.premature && nowMs - call.confirmedT <= CALL_VISIBLE_H * HOUR_MS;
}

/**
 * Sampling card numbers for a peak call. Hours are counted from the called peak (call.t), the
 * target is Taylor's 6 h after that peak, and the tide shown is the first NOAA prediction
 * (high or low) at or after the target. A premature call (the river rose higher) gives null.
 * The season counter counts log entries of kind "bay_sample" (or "bay") with t from the most
 * recent Oct 1 00:00 Los Angeles time (the water year) up to nowMs.
 * @param {{t:number, premature?:boolean}|null} call detector call
 * @param {Array<{t:number, type:"H"|"L", ft:number}>|{events:Array<{t:number, type:"H"|"L", ft:number}>}|null} tides
 * @param {number} nowMs
 * @param {Array<{t:number, kind?:string, type?:string}>} log
 * @returns {{hoursSinceCall:number, targetT:number, nextTideAfterTarget:{t:number, type:"H"|"L", ft:number}|null, samplesBanked:number}|null}
 */
export function samplingCard(call, tides, nowMs, log) {
  if (!call || call.premature) return null;
  const targetT = call.t + TAYLOR_TARGET_H * HOUR_MS;
  const events = Array.isArray(tides) ? tides : tides && Array.isArray(tides.events) ? tides.events : [];
  let next = null;
  for (const e of events) {
    if (e.t >= targetT && (next === null || e.t < next.t)) next = { t: e.t, type: e.type, ft: e.ft };
  }
  const seasonStart = waterYearStartMs(nowMs);
  const samplesBanked = (log || []).filter(
    (entry) => BAY_SAMPLE_KINDS.includes(entry.kind ?? entry.type) && entry.t >= seasonStart && entry.t <= nowMs,
  ).length;
  return {
    hoursSinceCall: (nowMs - call.t) / HOUR_MS,
    targetT,
    nextTideAfterTarget: next,
    samplesBanked,
  };
}
