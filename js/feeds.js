// Feed fetching, parsing and age/stale rules for Samish River Watch.
// Parsing logic follows the public Samish River Outlook page (data.js) faithfully.
// Rules: CONTRACT.md sections 2 and 3. Every failure is "could_not_read" with no numbers; never a 0.
'use strict';

import { BASIN_RULES, basinCompleteness } from './basin.js';

export { BASIN_RULES, basinCompleteness };

const MIN = 60000;
const HOUR = 3600000;

/** Frozen limits from CONTRACT.md section 3 (AGES) and section 2 (NOAA withhold rule: 48 h old, 24 h reach, 4 points). */
export const LIMITS = Object.freeze({
  gaugeStaleMs: 2 * HOUR,
  noaaWithholdMs: 48 * HOUR,
  noaaMinPointsNext24h: 4,
  noaaMinReachMs: 24 * HOUR,
  noaaLedgerDelayMs: 3 * HOUR,
  tidesStaleMs: 36 * HOUR,
  basinStaleMs: 3 * HOUR,
  basinFutureToleranceMs: 10 * MIN,
  fetchTimeoutMs: 20000,
  maxUsgsPages: 20,
});

export const URLS = Object.freeze({
  usgs: 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items?monitoring_location_id=USGS-12201500&parameter_code=00060&time=P7D&f=json&limit=1000',
  noaa: 'https://api.water.noaa.gov/nwps/v1/gauges/smrw1/stageflow',
  tidesBase: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
  basin: 'data/live/basin_rain.json',
});

const GAUGE_ID = 'USGS-12201500';

/** The only status values a feed may carry. */
export const STATUSES = Object.freeze(['ok', 'stale', 'withheld', 'could_not_read']);

/**
 * Finite number from a number or numeric string; otherwise null (never coerces junk to 0).
 * @param {unknown} v
 * @returns {number|null}
 */
export function parseNumber(v) {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (typeof v === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Strict ISO-8601 timestamp with zone to ms epoch UTC; otherwise null.
 * @param {unknown} v
 * @returns {number|null}
 */
export function parseTime(v) {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > new Date(Date.UTC(+y, +mo, 0)).getUTCDate()
    || +h > 23 || +mi > 59 || +(s || 0) > 59) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Multiplier to cfs for a discharge unit label, or null if not recognised.
 * @param {unknown} unit
 * @returns {number|null}
 */
export function cfsFactor(unit) {
  return new Map([['cfs', 1], ['kcfs', 1000], ['ft3/s', 1], ['ft^3/s', 1]]).get(String(unit).trim().toLowerCase()) ?? null;
}

function sortUnique(rows, label) {
  const sorted = [...rows].sort((a, b) => a.t - b.t);
  if (sorted.some((r, i) => i && r.t === sorted[i - 1].t)) throw new Error(label + ' contains duplicate timestamps');
  return sorted;
}

/**
 * Parse one USGS OGC items page into rows [{t, cfs}] (future-dated rows dropped).
 * @param {object} page parsed JSON
 * @param {number} nowMs
 * @returns {{t:number,cfs:number}[]}
 */
export function parseUsgsPage(page, nowMs) {
  if (!Array.isArray(page?.features)) throw new Error('Gauge response not recognized');
  return page.features.map((f) => f?.properties || {})
    .filter((p) => p.parameter_code === '00060' && p.monitoring_location_id === GAUGE_ID)
    .map((p) => ({ t: parseTime(p.time), q: parseNumber(p.value), scale: cfsFactor(p.unit_of_measure) }))
    .filter((r) => r.t !== null && r.t <= nowMs && r.q !== null && r.q >= 0 && r.scale !== null)
    .map((r) => ({ t: r.t, cfs: r.q * r.scale }))
    .filter((r) => Number.isFinite(r.cfs));
}

/**
 * Merge pages: identical repeated readings collapse, conflicting duplicates throw.
 * @param {{t:number,cfs:number}[][]} pages
 * @returns {{t:number,cfs:number}[]}
 */
export function mergeGaugePages(pages) {
  const byT = new Map();
  for (const row of pages.flat()) {
    const prev = byT.get(row.t);
    if (prev && prev.cfs !== row.cfs) throw new Error('Gauge series contains conflicting duplicate timestamps');
    byT.set(row.t, row);
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/**
 * The `next` link href of an OGC items page, or null.
 * @param {object} page
 * @returns {string|null}
 */
export function nextLink(page) {
  const l = Array.isArray(page?.links) ? page.links.find((x) => x && x.rel === 'next' && typeof x.href === 'string') : null;
  return l ? l.href : null;
}

/**
 * Parse the NWPS stageflow `forecast` object into {issuedT, points:[{t,cfs}]}.
 * The discharge series is the one named "River Discharge" (primary or secondary); kcfs is converted to cfs.
 * @param {object} payload full stageflow JSON
 * @returns {{issuedT:number, points:{t:number,cfs:number}[]}}
 */
export function parseNwpsForecast(payload) {
  const s = payload?.forecast;
  if (!s || !Array.isArray(s.data)) throw new Error('River series missing');
  const key = ['primary', 'secondary'].find((k) => String(s[k + 'Name'] || '').trim().toLowerCase() === 'river discharge' && cfsFactor(s[k + 'Units']) !== null);
  if (!key) throw new Error('Discharge units not recognized');
  const scale = cfsFactor(s[key + 'Units']);
  const issuedT = parseTime(s.issuedTime);
  if (issuedT === null) throw new Error('Forecast issue time unavailable or invalid');
  const rows = s.data
    .map((r) => ({ t: parseTime(r?.validTime), q: parseNumber(r?.[key]) }))
    .filter((r) => r.t !== null && r.q !== null && r.q >= 0)
    .map((r) => ({ t: r.t, cfs: r.q * scale }))
    .filter((r) => Number.isFinite(r.cfs));
  return { issuedT, points: sortUnique(rows, 'River series') };
}

/**
 * CO-OPS hi/lo predictions (requested with time_zone=gmt) into [{t,type,ft}] sorted by time.
 * @param {object} payload
 * @returns {{t:number,type:'H'|'L',ft:number}[]}
 */
export function parseTides(payload) {
  if (!Array.isArray(payload?.predictions)) throw new Error('Tide predictions unavailable');
  return payload.predictions
    .filter((r) => r && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(r.t)))
    .map((r) => ({ t: parseTime(String(r.t).replace(' ', 'T') + ':00Z'), ft: parseNumber(r.v), type: r.type }))
    .filter((r) => r.t !== null && r.ft !== null && (r.type === 'H' || r.type === 'L'))
    .sort((a, b) => a.t - b.t);
}

/**
 * Parse the server-made basin_rain.json. Throws on any malformed field.
 * @param {object} payload
 * @returns {{hours:{endT:number,mm:number}[], solidRainEndT:number|null, generatedT:number}}
 */
export function parseBasin(payload) {
  const generatedT = parseTime(payload?.generated_utc);
  if (generatedT === null) throw new Error('Basin rain generated time invalid');
  if (!Array.isArray(payload.hours)) throw new Error('Basin rain hours missing');
  const hours = payload.hours.map((h) => ({ endT: parseTime(h?.end_utc), mm: parseNumber(h?.mm) }));
  if (hours.some((h) => h.endT === null || h.mm === null || h.mm < 0)) throw new Error('Basin rain hours malformed');
  hours.sort((a, b) => a.endT - b.endT);
  let solidRainEndT = null;
  if (payload.solid_rain_end_utc !== null && payload.solid_rain_end_utc !== undefined) {
    solidRainEndT = parseTime(payload.solid_rain_end_utc);
    if (solidRainEndT === null) throw new Error('Basin solid-rain end time invalid');
  }
  return { hours, solidRainEndT, generatedT };
}

const minutesBetween = (later, earlier) => Math.max(0, Math.round((later - earlier) / MIN));

function couldNot(nowMs, e, empty) {
  return { status: 'could_not_read', readT: nowMs, ageMin: null, reason: String((e && e.message) || e), ...empty };
}

/** Fetch JSON with a timeout; throws on network error, timeout, non-2xx (error.status set) or bad JSON. */
async function getJson(fetchImpl, url) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), LIMITS.fetchTimeoutMs) : null;
  try {
    const res = await fetchImpl(url, { signal: ctl?.signal, cache: 'no-store' });
    if (!res || !res.ok) {
      const err = new Error('HTTP ' + (res ? res.status : 'none'));
      err.status = res ? res.status : null;
      throw err;
    }
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * USGS 15-minute discharge with pagination. Stale when the newest reading is over 2 h old
 * (history is kept). No readings or any page failure -> could_not_read with an empty series.
 * @param {typeof fetch} fetchImpl
 * @param {number} nowMs
 */
export async function fetchGauge(fetchImpl, nowMs) {
  try {
    const pages = [];
    let url = URLS.usgs;
    for (let n = 0; url; n += 1) {
      if (n >= LIMITS.maxUsgsPages) throw new Error('Too many gauge pages');
      const page = await getJson(fetchImpl, url);
      pages.push(parseUsgsPage(page, nowMs));
      url = nextLink(page);
    }
    const series = mergeGaugePages(pages);
    if (!series.length) throw new Error('No valid discharge readings');
    const newestT = series[series.length - 1].t;
    const stale = nowMs - newestT > LIMITS.gaugeStaleMs;
    return { status: stale ? 'stale' : 'ok', readT: nowMs, ageMin: minutesBetween(nowMs, newestT), newestT, series };
  } catch (e) {
    return couldNot(nowMs, e, { newestT: null, series: [] });
  }
}

/**
 * NOAA NWPS forecast. Withheld (no points) when the issue is over 48 h old or in the future, or the path does not
 * reach at least 24 h ahead of now (its last point is before now + 24 h), or fewer than 4 points fall in the next
 * 24 h (CONTRACT.md section 2; NWRFC issues are 6-hourly, so 4 or 5 points is normal). Checked in that order; the
 * reason names the first rule that fails. ledgerUsableT = issue + 3 h (ledger rows only, never display).
 * @param {typeof fetch} fetchImpl
 * @param {number} nowMs
 */
export async function fetchNoaa(fetchImpl, nowMs) {
  try {
    const { issuedT, points } = parseNwpsForecast(await getJson(fetchImpl, URLS.noaa));
    const base = { readT: nowMs, ageMin: minutesBetween(nowMs, issuedT), issuedT, ledgerUsableT: issuedT + LIMITS.noaaLedgerDelayMs };
    if (issuedT > nowMs) return { ...base, status: 'withheld', reason: 'Forecast issue time is in the future', points: [] };
    if (nowMs - issuedT > LIMITS.noaaWithholdMs) return { ...base, status: 'withheld', reason: 'Forecast issue is more than 48 hours old', points: [] };
    const lastT = points.length ? points[points.length - 1].t : -Infinity;
    if (lastT < nowMs + LIMITS.noaaMinReachMs) {
      return { ...base, status: 'withheld', reason: 'Forecast path does not reach 24 hours ahead', points: [] };
    }
    const next24 = points.filter((p) => p.t >= nowMs && p.t <= nowMs + 24 * HOUR).length;
    if (next24 < LIMITS.noaaMinPointsNext24h) {
      return { ...base, status: 'withheld', reason: 'Forecast has fewer than 4 points in the next 24 hours', points: [] };
    }
    return { ...base, status: 'ok', points };
  } catch (e) {
    return couldNot(nowMs, e, { issuedT: null, ledgerUsableT: null, points: [] });
  }
}

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

/**
 * CO-OPS tide predictions URL (GMT times so parsing is unambiguous): UTC dates from 1 day back to 6 days ahead.
 * @param {number} nowMs
 * @returns {string}
 */
export function tidesUrl(nowMs) {
  const q = new URLSearchParams({
    product: 'predictions', station: '9449211', begin_date: ymd(nowMs - 24 * HOUR), end_date: ymd(nowMs + 6 * 24 * HOUR),
    datum: 'MLLW', time_zone: 'gmt', units: 'english', interval: 'hilo', format: 'json', application: 'samish_river_watch',
  });
  return URLS.tidesBase + '?' + q.toString();
}

/**
 * Bellingham tide predictions. ageMin is minutes since the newest prediction event already in the past;
 * stale when that is over 36 h (the predictions stopped covering the present). No events -> could_not_read.
 * @param {typeof fetch} fetchImpl
 * @param {number} nowMs
 */
export async function fetchTides(fetchImpl, nowMs) {
  try {
    const events = parseTides(await getJson(fetchImpl, tidesUrl(nowMs)));
    if (!events.length) throw new Error('No tide predictions');
    const past = events.filter((e) => e.t <= nowMs);
    const refT = past.length ? past[past.length - 1].t : nowMs;
    const stale = nowMs - refT > LIMITS.tidesStaleMs;
    return { status: stale ? 'stale' : 'ok', readT: nowMs, ageMin: minutesBetween(nowMs, refT), events };
  } catch (e) {
    return couldNot(nowMs, e, { events: [] });
  }
}

/**
 * Server-made radar basin rain (relative URL). Missing file (404) -> withheld with a reason;
 * file generated over 3 h ago, newest observed hour ended over 3 h ago, or any of the last six hours missing -> stale
 * (data kept, `problem` "old" or "gaps"); malformed or unreadable -> could_not_read. The age shown is the newest
 * observed hour's end time, not the time the file was written.
 * @param {typeof fetch} fetchImpl
 * @param {number} nowMs
 */
export async function fetchBasin(fetchImpl, nowMs) {
  const empty = { hours: [], solidRainEndT: null, generatedT: null, newestHourT: null, problem: null };
  try {
    const b = parseBasin(await getJson(fetchImpl, URLS.basin));
    if (b.generatedT - nowMs > LIMITS.basinFutureToleranceMs) throw new Error('Basin rain generated time is in the future');
    const c = basinCompleteness(b.hours, nowMs);
    const fileOld = nowMs - b.generatedT > LIMITS.basinStaleMs;
    // Not current when the file is old, when its newest observed hour is old, or when any of the last six hours is
    // missing. "problem" says which, so the page can say it in plain words.
    const problem = fileOld || !c.newestFresh ? 'old' : !c.lastSixComplete ? 'gaps' : null;
    return {
      status: problem ? 'stale' : 'ok', readT: nowMs, ageMin: minutesBetween(nowMs, c.newestHourT ?? b.generatedT),
      problem, newestHourT: c.newestHourT, coverage48: c.coverage48, lastSixComplete: c.lastSixComplete, ...b,
    };
  } catch (e) {
    if (e && e.status === 404) {
      return { status: 'withheld', readT: nowMs, ageMin: null, reason: 'Radar rain file is not available', ...empty };
    }
    return couldNot(nowMs, e, empty);
  }
}

/**
 * Fetch all four sources independently; one failing never blanks another.
 * @param {typeof fetch} fetchImpl injectable fetch
 * @param {number} nowMs current time, ms epoch UTC
 * @returns {Promise<{gauge:object, noaa:object, tides:object, basin:object}>}
 */
export async function fetchAll(fetchImpl, nowMs) {
  const [gauge, noaa, tides, basin] = await Promise.all([
    fetchGauge(fetchImpl, nowMs), fetchNoaa(fetchImpl, nowMs), fetchTides(fetchImpl, nowMs), fetchBasin(fetchImpl, nowMs),
  ]);
  return { gauge, noaa, tides, basin };
}
