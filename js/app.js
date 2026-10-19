// app.js: bootstrap, refresh loop and state -> one immutable view per refresh -> render.
// Logic lives in feeds.js, season.js, lines.js, detector.js and crest.js (CONTRACT.md section 1); this file only wires them.
// Words live in strings.js; DOM lives in render.js.
'use strict';

import * as S from './strings.js';
import * as render from './render.js';
import { BASIN_RULES, basinCompleteness, solidRainEnd as basinSolidRainEnd } from './basin.js';
import { loadLog, addEntry, removeEntry, clearLog, makeEntry, seasonCount, seasonStartMs, toCsv, csvFileName, LOG_KEY, REPLAY_LOG_KEY } from './log.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const REFRESH_MS = 5 * MIN;
// The cache holds the last good FEEDS (not a built view), so a later display rebuilds every time-dependent part.
const CACHE_KEY = 'srw.cache.v2';
const OLD_VIEW_KEY = 'srw.view.v1';
const MEMORY_KEY = 'srw.detector.v1';
const THEME_KEY = 'srw.theme';
const SEEN_KEY = 'srw.seen.v1';
const TABLE_URL = 'data/ratio_table.json';
const RECORDS_URL = 'data/records.json';
const FIXTURE_DIR = 'data/fixtures/';
const CACHE_MAX_AGE_MS = 7 * 24 * HOUR;

// =============================================================================================
// ADAPTER: module loading with clearly marked fallbacks.
// The logic modules are written in parallel to this file. Each is loaded with a dynamic import so a
// missing or broken module degrades one part of the page instead of blanking it. Fallbacks exist only
// where the contract states the rule in full and it is a few lines (season line, 24-h rise, crossing,
// splice, NOAA crest). Everything else is reported to the page as "not available" rather than guessed.
// Remove the fallbacks once every module ships and its tests pass.
// =============================================================================================

const MODULE_PATHS = Object.freeze({
  feeds: './feeds.js', season: './season.js', lines: './lines.js', detector: './detector.js', crest: './crest.js',
});

const tzMonth = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric' });
/** Local (America/Los_Angeles) month 1-12. @param {number} ms @returns {number} */
export function localMonth(ms) {
  return Number(tzMonth.format(ms));
}

/** ADAPTER fallback: season line by local month (CONTRACT.md section 3). */
function fbSeasonLineCfs(ms) {
  const m = localMonth(ms);
  if (m === 11 || m === 12 || m === 1 || m === 2) return 400;
  if (m === 3 || m === 4) return 200;
  return 100;
}
/** ADAPTER fallback: rise = cfs at t minus the lowest cfs in the 24 h ending at t. */
function fbRise24(series, t) {
  let at = null;
  let low = Infinity;
  for (const p of series) {
    if (p.t > t) break;
    if (p.t >= t - 24 * HOUR) low = Math.min(low, p.cfs);
    if (p.t === t) at = p.cfs;
  }
  if (at === null) {
    const before = series.filter((p) => p.t <= t);
    if (!before.length) return null;
    at = before[before.length - 1].cfs;
    if (t - before[before.length - 1].t > HOUR) return null;
  }
  return Number.isFinite(low) ? at - low : null;
}
/** ADAPTER fallback: first t >= startMs where rise24 >= the season line at t. */
function fbFirstCrossing(series, startMs) {
  for (const p of series) {
    if (p.t < startMs) continue;
    const r = fbRise24(series, p.t);
    if (r !== null && r >= fbSeasonLineCfs(p.t)) return p.t;
  }
  return null;
}
/** ADAPTER fallback: observed last 24 h then path points after the latest observation. */
function fbSpliceSeries(observed, path) {
  if (!observed.length) return [...path];
  const last = observed[observed.length - 1].t;
  return [...observed.filter((p) => p.t >= last - 24 * HOUR), ...path.filter((p) => p.t > last)];
}
/** ADAPTER fallback: NOAA crest = max of the raw path within 72 h of now. */
function fbNoaaCrest(rawPath, nowMs) {
  let best = null;
  for (const p of rawPath) if (p.t >= nowMs && p.t <= nowMs + 72 * HOUR && (!best || p.cfs > best.cfs)) best = p;
  return best ? { t: best.t, cfs: best.cfs } : null;
}

const FALLBACKS = Object.freeze({
  season: { seasonLineCfs: fbSeasonLineCfs, rise24: fbRise24, firstCrossing: fbFirstCrossing, spliceSeries: fbSpliceSeries },
  crest: { noaaCrest: fbNoaaCrest },
});

const REQUIRED = Object.freeze({
  feeds: ['fetchAll'],
  season: ['seasonLineCfs', 'rise24', 'firstCrossing', 'spliceSeries'],
  lines: ['alignedPath', 'edgePaths', 'crossingSummary'],
  detector: ['peakState'],
  crest: ['noaaCrest', 'ourWindow', 'samplingCard', 'samplingVisible'],
});

/**
 * Merge loaded modules with fallbacks. A function that is neither loaded nor has a fallback is null,
 * and the view marks that part "not available".
 * @param {Record<string, object|null>} loaded
 * @returns {{mods: Record<string, Record<string, Function|null>>, missing: string[]}}
 */
export function withAdapters(loaded) {
  const mods = {};
  const missing = [];
  for (const [name, fns] of Object.entries(REQUIRED)) {
    mods[name] = {};
    for (const fn of fns) {
      const real = loaded[name] && typeof loaded[name][fn] === 'function' ? loaded[name][fn] : null;
      const fb = FALLBACKS[name] && FALLBACKS[name][fn] ? FALLBACKS[name][fn] : null;
      if (!real) missing.push(`${name}.${fn}${fb ? ' (fallback)' : ''}`);
      mods[name][fn] = real || fb;
    }
  }
  return { mods, missing };
}

async function loadModules() {
  const loaded = {};
  await Promise.all(Object.entries(MODULE_PATHS).map(async ([name, path]) => {
    try { loaded[name] = await import(path); } catch (err) { loaded[name] = null; console.warn(`[srw] ${path} not loaded`, err); }
  }));
  const res = withAdapters(loaded);
  if (res.missing.length) console.warn('[srw] adapter in use for:', res.missing.join(', '));
  return res.mods;
}
// ======================= END ADAPTER =========================================================

// ---------------------------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------------------------

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** Deep-freeze a plain object graph. @template T @param {T} o @returns {T} */
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Call a module function, returning `fallback` when it is missing or throws (the page never blanks). */
function guarded(fn, args, fallback, label) {
  if (typeof fn !== 'function') return fallback;
  try {
    const out = fn(...args);
    return out === undefined ? fallback : out;
  } catch (err) {
    console.warn(`[srw] ${label} failed`, err);
    return fallback;
  }
}

/** Clean, sorted [{t,cfs}] series. @param {any} s @returns {{t:number,cfs:number}[]} */
export function cleanSeries(s) {
  if (!Array.isArray(s)) return [];
  return s
    .filter((p) => p && isNum(p.t) && isNum(p.cfs))
    .map((p) => ({ t: p.t, cfs: p.cfs }))
    .sort((a, b) => a.t - b.t)
    .filter((p, i, a) => i === 0 || p.t !== a[i - 1].t);
}

/**
 * Feed summary kept in the view (no bulky data). dataT is the time the age refers to: the newest gauge reading,
 * NOAA's issue time, the radar file's generated time, or the tide read time.
 * @param {'gauge'|'noaa'|'tides'|'basin'} key @param {object} f feed from feeds.fetchAll @param {number} nowMs
 * @returns {{status:string, readT:number|null, dataT:number|null, ageMin:number|null, issuedT?:number}}
 */
export function feedSummary(key, f, nowMs) {
  const status = f && typeof f.status === 'string' ? f.status : 'could_not_read';
  const readT = f && isNum(f.readT) ? f.readT : null;
  // Radar: the age is the newest OBSERVED hour's end time, not the time the file was written (external review 2026-10-19).
  const own = { gauge: f && f.newestT, noaa: f && f.issuedT, basin: f && (isNum(f.newestHourT) ? f.newestHourT : f.generatedT), tides: readT }[key];
  let dataT = isNum(own) ? own : null;
  if (dataT === null && key === 'gauge' && f && Array.isArray(f.series) && f.series.length) {
    const last = f.series[f.series.length - 1];
    if (last && isNum(last.t)) dataT = last.t;
  }
  if (dataT === null && readT !== null && f && isNum(f.ageMin) && key !== 'tides') dataT = readT - f.ageMin * MIN;
  const out = { status, readT, dataT, ageMin: dataT !== null ? Math.max(0, (nowMs - dataT) / MIN) : null };
  if (f && isNum(f.issuedT)) out.issuedT = f.issuedT;
  // Radar only: why a stale file is stale, 'old' (file or newest hour too old) or 'gaps' (a missing hour in the last six).
  if (key === 'basin' && f && (f.problem === 'old' || f.problem === 'gaps')) out.problem = f.problem;
  // Machine reason or code from feeds.js (e.g. why NOAA is withheld). strings.js maps it to plain words; it is never shown raw.
  const why = f && typeof f.code === 'string' ? f.code : f && typeof f.reason === 'string' ? f.reason : '';
  if (why) out.reason = why.slice(0, 200);
  return out;
}

/**
 * The table facts the page shows in OUR BASIS, copied (never recomputed) from the frozen table. Reads table v3
 * (coverage under coverage_leave_one_water_year_out, factors under bins[].rise / bins[].flat, fizzle counts) and
 * still accepts the v1 top-level pooled_coverage. Missing parts come back null or empty, never invented.
 * @param {object|null} table parsed past-miss table
 * @returns {{version:number|null, storm_flow_cfs:number|null, rise_floor_cfs:number|null,
 *   pooled_coverage:{inside:number,n:number,share:number|null}|null,
 *   coverage:{pooled:object|null, rise:object|null, flat:object|null, rise_ge_200:object|null, rise_bins:{bin:string, share:number}[]},
 *   coverage_by_age:{age_h:number, share:number}[],
 *   factors:{lead_lo_h:number, lead_hi_h:number, add_cfs:number|null, rise:{low:number,high:number}|null, flat:{low:number,high:number}|null}[],
 *   fizzle:{bin:string, n_points:number, no_higher:number, never_rose:number}[],
 *   training_issue_span:string[], bins:{n_days:number|null}[]}|null}
 */
export function summarizeTable(table) {
  if (!table || typeof table !== 'object') return null;
  const cov = table.coverage_leave_one_water_year_out;
  const covObj = cov && typeof cov === 'object' && !Array.isArray(cov) ? cov : {};
  const share = (c) => (c && isNum(c.inside) && isNum(c.n) ? { inside: c.inside, n: c.n, share: isNum(c.share) ? c.share : null } : null);
  const pc = share(table.pooled_coverage || covObj.pooled || null);
  const pair = (r) => (r && isNum(r.low_factor) && isNum(r.high_factor) ? { low: r.low_factor, high: r.high_factor } : null);
  const bins = Array.isArray(table.bins) ? table.bins : [];
  return {
    version: isNum(table.version) ? table.version : null,
    storm_flow_cfs: isNum(table.storm_flow_cfs) ? table.storm_flow_cfs : null,
    rise_floor_cfs: isNum(table.rise_floor_cfs) ? table.rise_floor_cfs : null,
    pooled_coverage: pc,
    coverage: {
      pooled: pc,
      rise: share(covObj.rise_regime),
      flat: share(covObj.flat_regime),
      rise_ge_200: share(covObj.forecast_rise_ge_200),
      rise_bins: (Array.isArray(covObj.by_bin_rise) ? covObj.by_bin_rise : [])
        .filter((x) => x && typeof x.bin === 'string' && isNum(x.share)).map((x) => ({ bin: x.bin, share: x.share })),
    },
    coverage_by_age: (Array.isArray(table.coverage_by_forecast_age) ? table.coverage_by_forecast_age : [])
      .filter((x) => x && isNum(x.age_h) && isNum(x.share)).map((x) => ({ age_h: x.age_h, share: x.share })),
    factors: bins.filter((x) => x && isNum(x.lead_lo_h) && isNum(x.lead_hi_h)).map((x) => ({
      lead_lo_h: x.lead_lo_h, lead_hi_h: x.lead_hi_h, add_cfs: isNum(x.add_cfs) ? x.add_cfs : null, rise: pair(x.rise), flat: pair(x.flat),
    })),
    fizzle: (Array.isArray(table.fizzle) ? table.fizzle : [])
      .filter((x) => x && typeof x.bin === 'string' && isNum(x.n_points) && isNum(x.pointwise_no_higher_share) && isNum(x.never_rose_share))
      .map((x) => ({ bin: x.bin, n_points: x.n_points, no_higher: x.pointwise_no_higher_share, never_rose: x.never_rose_share })),
    training_issue_span: Array.isArray(table.training_issue_span) ? table.training_issue_span.slice(0, 2) : [],
    bins: bins.map((x) => {
      const d = isNum(x && x.n_days) ? x.n_days : x && x.rise && isNum(x.rise.n_days) ? x.rise.n_days : null;
      return { n_days: d };
    }),
  };
}

/**
 * Radar quiet test for the feed panel and the rain clock: the basin-file hours in the 48 h before nowMs, and
 * whether any reached solid rain (>= 1 mm, the threshold of the contract's rain-end rule).
 * Quiet (no solid hour) is different from stale (an old file) and from missing (no file).
 * @param {{status?:string, hours?:{endT:number, mm:number}[]}|null|undefined} basin parsed feed
 * @param {number} nowMs
 * @returns {{hours:number, quiet:boolean, lastSolidT:number|null, coverage48:number}|null} null when the feed is not current
 */
export function radarSummary(basin, nowMs) {
  if (!basin || basin.status !== 'ok' || !Array.isArray(basin.hours)) return null;
  const recent = basin.hours.filter((h) => h && isNum(h.endT) && isNum(h.mm) && h.endT <= nowMs && h.endT > nowMs - 48 * HOUR);
  if (!recent.length) return { hours: 0, quiet: false, lastSolidT: null, coverage48: 0 };
  const solid = recent.filter((h) => h.mm >= 1);
  const c = basinCompleteness(basin.hours, nowMs);
  // "Quiet" says nothing fell, so it needs the observations to back it: a current newest hour and at least 90% of the
  // 48 hours ending at it. With holes in the record, no solid hour found is not the same as none fell.
  const quiet = solid.length === 0 && c.newestFresh && c.coverage48 >= BASIN_RULES.minCoverage;
  return { hours: recent.length, quiet, lastSolidT: solid.length ? solid[solid.length - 1].endT : null, coverage48: c.coverage48 };
}

/**
 * Map an edgePaths reason (lines.js, table v3) to the page's edge state. Unknown reasons become 'unavailable'.
 * @param {string|undefined} reason @returns {string}
 */
export function edgeReasonState(reason) {
  const r = String(reason || '').toLowerCase();
  if (/season|wet|month|dry/.test(r)) return 'off_season';
  if (/table|bin/.test(r)) return 'no_table';
  if (/stale/.test(r)) return 'gauge_stale';
  if (/gauge|latest|observ/.test(r)) return 'gauge_missing';
  return 'unavailable';
}

/**
 * Decide whether the high and low cases are drawn, and why not. Reasons in order: NOAA's forecast, the gauge,
 * the table, then the table's wet-season rule. lines.edgePaths(aligned, latest, table, lookMs) reports
 * {high, low, wetSeason, reason?}; for an older lines.js without wetSeason the page uses the table's wet_months
 * (`wet`). A partial range is never drawn.
 * @param {object} a
 * @param {'ok'|'withheld'|'could_not_read'} a.forecastStatus
 * @param {{t:number,cfs:number}|null} a.latest
 * @param {boolean} a.gaugeFresh
 * @param {object|null} a.table
 * @param {boolean} a.wet look-time month is in the table's wet months (fallback only)
 * @param {string} a.alignedState
 * @param {{t:number,cfs:number}[]} a.aligned
 * @param {Function|null|undefined} a.edgePaths lines.edgePaths
 * @param {number} a.nowMs look time
 * @returns {{edges:'shown'|'noaa_withheld'|'noaa_could_not_read'|'gauge_missing'|'gauge_stale'|'no_table'|'off_season'|'unavailable',
 *   high:{t:number,cfs:number}[], low:{t:number,cfs:number}[]}}
 */
export function decideEdges(a) {
  const none = (edges) => ({ edges, high: [], low: [] });
  if (a.forecastStatus === 'could_not_read') return none('noaa_could_not_read');
  if (a.forecastStatus !== 'ok') return none('noaa_withheld');
  if (!a.latest) return none('gauge_missing');
  if (!a.gaugeFresh) return none('gauge_stale');
  if (!a.table || !Array.isArray(a.table.bins) || !a.table.bins.length) return none('no_table');
  if (a.alignedState !== 'shown' || typeof a.edgePaths !== 'function') return none('unavailable');
  const e = guarded(a.edgePaths, [a.aligned, a.latest, a.table, a.nowMs], null, 'edgePaths');
  if (!e || typeof e !== 'object') return none('unavailable');
  const wetSeason = typeof e.wetSeason === 'boolean' ? e.wetSeason : a.wet;
  if (!wetSeason) return none('off_season');
  const high = cleanSeries(e.high);
  const low = cleanSeries(e.low);
  // A partial range (any point without a finite flow) is never drawn: it would make a crossing look absent.
  const complete = Array.isArray(e.high) && Array.isArray(e.low) && high.length === e.high.length && low.length === e.low.length;
  if (complete && high.length && low.length) return { edges: 'shown', high, low };
  return none(e.reason ? edgeReasonState(e.reason) : 'unavailable');
}

/**
 * Season-line step points across a span (hourly sampling, change points only).
 * @param {(ms:number)=>number} lineFn @param {number} a @param {number} b @returns {{t:number,cfs:number}[]}
 */
export function seasonSteps(lineFn, a, b) {
  const out = [];
  for (let t = Math.floor(a / HOUR) * HOUR; t <= b; t += HOUR) {
    const v = lineFn(t);
    if (!out.length || out[out.length - 1].cfs !== v) out.push({ t, cfs: v });
  }
  return out;
}

/**
 * Insert linearly interpolated points every stepMs between a path's own points (CONTRACT.md section 2: interpolate
 * linearly for drawing and for crossing times). The path's own points are kept exactly.
 * @param {{t:number,cfs:number}[]} path sorted @param {number} [stepMs] @returns {{t:number,cfs:number}[]}
 */
export function densify(path, stepMs = 15 * MIN) {
  if (!Array.isArray(path) || path.length < 2) return Array.isArray(path) ? path.slice() : [];
  const out = [path[0]];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    for (let t = Math.floor(a.t / stepMs) * stepMs + stepMs; t < b.t; t += stepMs) {
      if (t > a.t) out.push({ t, cfs: a.cfs + ((b.cfs - a.cfs) * (t - a.t)) / (b.t - a.t) });
    }
    out.push(b);
  }
  return out;
}

/**
 * The aligned line as drawn: from the latest gauge reading forward only. NOAA's path shifted to the gauge has no
 * meaning before that reading, so points before it are dropped; when the path spans the reading, the line starts
 * exactly at the reading (where it equals the reading's flow by construction).
 * @param {{t:number,cfs:number}[]} aligned sorted @param {{t:number,cfs:number}|null} latest @param {number} endMs
 * @returns {{t:number,cfs:number}[]}
 */
export function alignedForChart(aligned, latest, endMs) {
  if (!latest || !Array.isArray(aligned) || !aligned.length) return [];
  const ahead = aligned.filter((p) => p.t >= latest.t && p.t <= endMs);
  const spans = aligned[0].t < latest.t && aligned[aligned.length - 1].t > latest.t;
  if (spans && (!ahead.length || ahead[0].t !== latest.t)) {
    let i = 1;
    while (aligned[i].t < latest.t) i += 1;
    const a = aligned[i - 1];
    const b = aligned[i];
    ahead.unshift({ t: latest.t, cfs: a.cfs + ((b.cfs - a.cfs) * (latest.t - a.t)) / (b.t - a.t) });
  }
  return ahead;
}

function riseCurve(rise24, series, points) {
  const out = [];
  for (const p of points) {
    const r = rise24(series, p.t);
    if (isNum(r)) out.push({ t: p.t, cfs: Math.max(0, r) });
  }
  return out;
}

function extreme(series, a, b, pick) {
  let best = null;
  for (const p of series) if (p.t >= a && p.t <= b && (!best || pick(p.cfs, best.cfs))) best = p;
  return best;
}

// ---------------------------------------------------------------------------------------------
// The view: one immutable object per refresh
// ---------------------------------------------------------------------------------------------

/**
 * Build the view from the feeds and the logic modules. Pure apart from the module calls.
 * @param {object} input
 * @param {number} input.nowMs
 * @param {{gauge:object, noaa:object, tides:object, basin:object}} input.feeds
 * @param {object} input.mods merged modules (withAdapters)
 * @param {object|null} input.table parsed ratio_table.json
 * @param {object|null} input.records parsed records.json
 * @param {'ok'|'could_not_read'} input.recordsStatus
 * @param {{available:boolean, entries:any[]}} input.log
 * @param {object|null} input.memory detector memory from the previous refresh
 * @param {'live'|'replay'} input.mode
 * @param {string|null} [input.fixtureName]
 * @param {{syntheticTides?:boolean}|null} [input.fixtureNotes]
 * @returns {{view:object, memory:object|null}}
 */
export function buildView(input) {
  const { nowMs, feeds, mods, table, records, recordsStatus, log, memory, mode, fixtureName, fixtureNotes } = input;
  const { season, lines, detector, crest } = mods;
  const F = {
    gauge: feeds && feeds.gauge ? feeds.gauge : { status: 'could_not_read' },
    noaa: feeds && feeds.noaa ? feeds.noaa : { status: 'could_not_read' },
    tides: feeds && feeds.tides ? feeds.tides : { status: 'could_not_read' },
    basin: feeds && feeds.basin ? feeds.basin : { status: 'could_not_read' },
  };

  // --- season
  const lineCfs = guarded(season.seasonLineCfs, [nowMs], null, 'seasonLineCfs');
  const wetMonths = table && Array.isArray(table.wet_months) ? table.wet_months : [1, 2, 3, 4, 10, 11, 12];
  const wet = wetMonths.includes(localMonth(nowMs));

  // --- observed (history is kept when stale; only a failed read drops it)
  const gaugeReadable = F.gauge.status === 'ok' || F.gauge.status === 'stale';
  const series = gaugeReadable ? cleanSeries(F.gauge.series).filter((p) => p.t <= nowMs) : [];
  const latest = series.length ? series[series.length - 1] : null;
  const gaugeFresh = F.gauge.status === 'ok' && latest !== null;
  const riseCfs = latest ? guarded(season.rise24, [series, latest.t], null, 'rise24') : null;
  const lineAtLatest = latest ? guarded(season.seasonLineCfs, [latest.t], lineCfs, 'seasonLineCfs') : lineCfs;
  const overLine = isNum(riseCfs) && isNum(lineAtLatest) && riseCfs >= lineAtLatest;
  let crossT = latest ? guarded(season.firstCrossing, [series, nowMs - 72 * HOUR], null, 'firstCrossing') : null;
  if (!isNum(crossT) || crossT > (latest ? latest.t : nowMs)) crossT = null;

  // --- forecast
  const noaaOk = F.noaa.status === 'ok';
  const raw = noaaOk ? cleanSeries(F.noaa.points) : [];
  const forecastStatus = noaaOk && raw.length ? 'ok' : F.noaa.status === 'could_not_read' ? 'could_not_read' : 'withheld';
  let aligned = [];
  let alignedState = 'unavailable';
  if (forecastStatus !== 'ok') alignedState = 'no_forecast';
  else if (!latest) alignedState = 'gauge_missing';
  else if (!gaugeFresh) alignedState = 'gauge_stale';
  else if (typeof lines.alignedPath === 'function') {
    aligned = cleanSeries(guarded(lines.alignedPath, [raw, latest], [], 'alignedPath'));
    alignedState = aligned.length ? 'shown' : 'unavailable';
  }
  const { edges, high, low } = decideEdges({
    forecastStatus, latest, gaugeFresh, table, wet, alignedState, aligned, edgePaths: lines.edgePaths, nowMs,
  });
  const crossings = { raw: null, aligned: null, high: null, low: null };
  if (forecastStatus === 'ok' && series.length) {
    // Paths are densified to 15 min so crossing times are read off the linearly interpolated lines, not only at
    // NOAA's 6-hourly points.
    const c = guarded(lines.crossingSummary, [series, densify(raw), densify(aligned), densify(high), densify(low)], null, 'crossingSummary');
    if (c && typeof c === 'object') {
      crossings.raw = isNum(c.raw) ? c.raw : null;
      crossings.aligned = alignedState === 'shown' && isNum(c.aligned) ? c.aligned : null;
      crossings.high = edges === 'shown' && isNum(c.high) ? c.high : null;
      crossings.low = edges === 'shown' && isNum(c.low) ? c.low : null;
    } else if (typeof lines.crossingSummary !== 'function' && typeof season.firstCrossing === 'function') {
      // ADAPTER: lines.js missing; NOAA's raw crossing from the season fallback only.
      const sp = guarded(season.spliceSeries, [series, raw], [], 'spliceSeries');
      crossings.raw = latest ? guarded(season.firstCrossing, [cleanSeries(sp), latest.t], null, 'firstCrossing') : null;
    }
  }
  const noaaCrest = forecastStatus === 'ok' ? guarded(crest.noaaCrest, [raw, nowMs], null, 'noaaCrest') : null;

  // --- peak call
  let peak = { episode: false, episodeStart: null, state: 'none', high: null, call: null };
  let nextMemory = memory || null;
  if (typeof detector.peakState !== 'function') {
    peak = { ...peak, unavailable: true };
  } else if (series.length) {
    const p = guarded(detector.peakState, [series, nowMs, memory || null], null, 'peakState');
    if (p && typeof p === 'object') {
      peak = {
        episode: Boolean(p.episode),
        episodeStart: isNum(p.episodeStart) ? p.episodeStart : null,
        state: ['none', 'rising', 'called'].includes(p.state) ? p.state : 'none',
        high: p.high && isNum(p.high.t) && isNum(p.high.cfs) ? { t: p.high.t, cfs: p.high.cfs } : null,
        call: p.call && isNum(p.call.peakT) ? {
          t: isNum(p.call.t) ? p.call.t : null,
          peakT: p.call.peakT,
          peakCfs: isNum(p.call.peakCfs) ? p.call.peakCfs : null,
          confirmedT: isNum(p.call.confirmedT) ? p.call.confirmedT : (isNum(p.call.t) ? p.call.t : null),
          premature: Boolean(p.call.premature),
          secondPeak: Boolean(p.call.secondPeak),
        } : null,
      };
      nextMemory = p.memory && typeof p.memory === 'object' ? p.memory : nextMemory;
    } else {
      peak = { ...peak, unavailable: true };
    }
  }

  // --- the rain clock (only during an episode, with a fresh radar file)
  let crestWin = null;
  if (peak.episode && F.basin.status === 'ok') {
    if (typeof crest.ourWindow !== 'function') crestWin = { withheld: true, reason: 'unavailable' };
    else {
      const w = guarded(crest.ourWindow, [F.basin, peak.episodeStart, nowMs], { withheld: true, reason: 'unavailable' }, 'ourWindow');
      crestWin = w && !w.withheld && isNum(w.easedT) && isNum(w.medianT) && w.easedT <= nowMs
        ? { easedT: w.easedT, medianT: w.medianT }
        : { withheld: true, reason: w && typeof w.code === 'string' ? w.code : w && typeof w.reason === 'string' ? w.reason : '' };
    }
  }

  // --- sampling card
  const call = peak.call;
  const callT = call ? (call.confirmedT ?? call.t ?? call.peakT) : null;
  const recentCall = call && !call.premature && isNum(callT) && nowMs - callT <= 48 * HOUR && nowMs >= callT;
  // A silent gauge cannot show that a rise is still under way, so only a fresh gauge keeps the card up by episode;
  // a call confirmed in the last 48 h keeps it up either way (CONTRACT.md section 3, SAMPLING CARD).
  const episodeLive = peak.episode && gaugeFresh;
  const samplingVisible = typeof crest.samplingVisible === 'function'
    ? Boolean(guarded(crest.samplingVisible, [episodeLive, call, nowMs], episodeLive || recentCall, 'samplingVisible'))
    : Boolean(episodeLive || recentCall);
  const tideEvents = F.tides.status === 'ok' && Array.isArray(F.tides.events) ? F.tides.events : [];
  let card = null;
  if (samplingVisible && call) {
    // Hours since and Taylor's 6-h target count from the PEAK time (CONTRACT.md section 3), so t is set to peakT here.
    const c = guarded(crest.samplingCard, [{ ...call, t: call.peakT }, tideEvents, nowMs, log.entries], null, 'samplingCard');
    if (c && typeof c === 'object') {
      const n = c.nextTideAfterTarget;
      card = {
        hoursSinceCall: isNum(c.hoursSinceCall) ? c.hoursSinceCall : null,
        peakT: call.peakT,
        targetT: isNum(c.targetT) ? c.targetT : null,
        nextTideAfterTarget: n && isNum(n.t) ? { t: n.t, type: n.type === 'L' ? 'L' : 'H', ft: isNum(n.ft) ? n.ft : null } : null,
      };
    }
  }

  // --- chart spec (past 72 h, next 72 h)
  const startMs = nowMs - 72 * HOUR;
  const endMs = nowMs + 72 * HOUR;
  const chartObs = series.filter((p) => p.t >= startMs - HOUR);
  const rise24 = season.rise24 || fbRise24;
  const splice = (path) => cleanSeries(guarded(season.spliceSeries, [series, path], [], 'spliceSeries'));
  const pathRise = (path) => {
    if (!path.length || !series.length) return [];
    const dense = densify(path);
    return riseCurve(rise24, splice(dense), dense.filter((p) => p.t > latest.t));
  };
  const chart = {
    nowMs,
    startMs,
    endMs,
    observed: chartObs,
    raw: raw.filter((p) => p.t >= startMs && p.t <= endMs),
    aligned: alignedForChart(aligned, latest, endMs),
    high,
    low,
    rise: {
      observed: riseCurve(rise24, series, chartObs),
      raw: pathRise(raw),
      aligned: pathRise(aligned),
      high: pathRise(high),
      low: pathRise(low),
    },
    seasonLine: typeof season.seasonLineCfs === 'function' ? seasonSteps(season.seasonLineCfs, startMs - 24 * HOUR, endMs) : [],
    crossings,
    forecastNote: forecastStatus === 'could_not_read' ? S.chartForecastNote('could_not_read') : forecastStatus === 'withheld' ? S.chartForecastNote('withheld') : '',
    obsMax: extreme(series, startMs, nowMs, (a, b) => a > b),
    obsMin: extreme(series, startMs, nowMs, (a, b) => a < b),
    rangeAtEnd: high.length && low.length ? { high: high[high.length - 1].cfs, low: low[low.length - 1].cfs } : null,
  };

  const entries = Array.isArray(log.entries) ? log.entries : [];
  const view = {
    mode,
    fixtureName: fixtureName || null,
    fixtureNotes: fixtureNotes || null,
    nowMs,
    builtMs: nowMs,
    loading: false,
    fromCache: false,
    feeds: {
      gauge: feedSummary('gauge', F.gauge, nowMs),
      noaa: feedSummary('noaa', F.noaa, nowMs),
      tides: feedSummary('tides', F.tides, nowMs),
      basin: feedSummary('basin', F.basin, nowMs),
    },
    season: { lineCfs, wet },
    observed: { latest, riseCfs: isNum(riseCfs) ? riseCfs : null, lineAtLatest, overLine, crossT },
    forecast: { status: forecastStatus, aligned: alignedState, edges, crossings, noaaCrest, issuedT: isNum(F.noaa.issuedT) ? F.noaa.issuedT : null },
    peak,
    crest: { window: crestWin },
    radar: radarSummary(F.basin, nowMs),
    sampling: { visible: samplingVisible, card },
    log: {
      available: Boolean(log.available),
      replay: mode === 'replay',
      entries,
      seasonCount: seasonCount(entries, nowMs),
      seasonStartMs: seasonStartMs(nowMs),
    },
    records: records || null,
    recordsStatus,
    table: summarizeTable(table),
    chart,
  };
  return { view: deepFreeze(view), memory: nextMemory };
}

/**
 * Feed age rules re-applied to cached feeds. The same values as feeds.js LIMITS (CONTRACT.md sections 2 and 3);
 * tests/integration.test.mjs pins the match.
 */
export const REAGE_LIMITS = Object.freeze({
  gaugeStaleMs: 2 * HOUR, noaaWithholdMs: 48 * HOUR, noaaMinReachMs: 24 * HOUR, noaaMinPointsNext24h: 4,
  tidesStaleMs: 36 * HOUR, basinStaleMs: 3 * HOUR,
});
// The radar hours' own rules (newest hour no older than 3 h, last six hours present) come from basin.js, the module
// feeds.js shares, so there is one copy; tests/integration.test.mjs checks the cached path against a fresh read.

/**
 * Re-apply the feed age rules to feeds read at an earlier time, for display at renderMs. The data are kept (the gauge
 * history stays on the chart); statuses and ages follow the clock, and a NOAA forecast that no longer passes a
 * withhold rule loses its points, exactly as feeds.js would treat it if it were fetched at renderMs.
 * @param {{gauge?:object, noaa?:object, tides?:object, basin?:object}|null} feeds feeds as feeds.fetchAll returned them
 * @param {number} renderMs
 * @param {typeof REAGE_LIMITS} [limits]
 * @returns {{gauge:object, noaa:object, tides:object, basin:object}}
 */
export function reageFeeds(feeds, renderMs, limits = REAGE_LIMITS) {
  const f = feeds && typeof feeds === 'object' ? feeds : {};
  const failed = { status: 'could_not_read', readT: null, ageMin: null };
  const copy = (x) => (x && typeof x === 'object' ? { ...x } : { ...failed });
  const ageMin = (t) => Math.max(0, (renderMs - t) / MIN);
  const out = { gauge: copy(f.gauge), noaa: copy(f.noaa), tides: copy(f.tides), basin: copy(f.basin) };

  const g = out.gauge;
  const series = Array.isArray(g.series) ? cleanSeries(g.series) : [];
  if ((g.status === 'ok' || g.status === 'stale') && series.length) {
    const newestT = series[series.length - 1].t;
    out.gauge = { ...g, newestT, ageMin: ageMin(newestT), status: renderMs - newestT > limits.gaugeStaleMs ? 'stale' : 'ok' };
  }

  const n = out.noaa;
  if (n.status === 'ok' && isNum(n.issuedT)) {
    const pts = cleanSeries(n.points);
    const lastT = pts.length ? pts[pts.length - 1].t : -Infinity;
    const next24 = pts.filter((p) => p.t >= renderMs && p.t <= renderMs + 24 * HOUR).length;
    let reason = '';
    if (renderMs - n.issuedT > limits.noaaWithholdMs) reason = 'Forecast issue is more than 48 hours old';
    else if (lastT < renderMs + limits.noaaMinReachMs) reason = 'Forecast path does not reach 24 hours ahead';
    else if (next24 < limits.noaaMinPointsNext24h) reason = 'Forecast has fewer than 4 points in the next 24 hours';
    out.noaa = reason
      ? { ...n, ageMin: ageMin(n.issuedT), status: 'withheld', reason, points: [] }
      : { ...n, ageMin: ageMin(n.issuedT), points: pts };
  }

  const t = out.tides;
  if (t.status === 'ok' && Array.isArray(t.events) && t.events.length) {
    const past = t.events.filter((e) => e && isNum(e.t) && e.t <= renderMs).map((e) => e.t);
    const refT = past.length ? Math.max(...past) : renderMs;
    out.tides = { ...t, ageMin: ageMin(refT), status: renderMs - refT > limits.tidesStaleMs ? 'stale' : 'ok' };
  }

  const b = out.basin;
  if (b.status === 'ok' && isNum(b.generatedT)) {
    // Same three tests as feeds.fetchBasin: file written over 3 h ago, newest observed hour over 3 h old, or a missing
    // hour among the last six. The age shown is the newest observed hour's, never the file's.
    const c = basinCompleteness(b.hours, renderMs);
    const problem = renderMs - b.generatedT > limits.basinStaleMs || !c.newestFresh ? 'old' : !c.lastSixComplete ? 'gaps' : null;
    out.basin = {
      ...b, ageMin: ageMin(c.newestHourT ?? b.generatedT), problem, newestHourT: c.newestHourT, coverage48: c.coverage48,
      lastSixComplete: c.lastSixComplete, status: problem ? 'stale' : 'ok',
    };
  }
  return out;
}

/**
 * The cached feeds when they are no more than 7 days old at atMs and not from the future; otherwise null (the page then
 * shows nothing from the cache, rather than a week-old reading). Exactly 7 days is too old.
 * @param {{builtMs:number, feeds:object}|null} cached from cacheEntry @param {number} atMs
 * @returns {{builtMs:number, feeds:object}|null}
 */
export function usableCache(cached, atMs) {
  if (!cached || !isNum(cached.builtMs) || !isNum(atMs)) return null;
  return atMs - cached.builtMs >= CACHE_MAX_AGE_MS || atMs < cached.builtMs ? null : cached;
}

/**
 * Saved detector memory, if it was saved less than 7 days before nowMs. Memory is a cache only (detector.js checks it
 * against the readings), so an old one is simply dropped.
 * @param {{savedMs:number, memory:object}|null} saved @param {number} nowMs @returns {object|null}
 */
export function usableMemory(saved, nowMs) {
  return saved && isNum(saved.savedMs) && nowMs - saved.savedMs < CACHE_MAX_AGE_MS ? saved.memory || null : null;
}

/**
 * A usable cache entry ({builtMs, feeds}) or null.
 * @param {unknown} c @returns {{builtMs:number, feeds:object}|null}
 */
export function cacheEntry(c) {
  return c && typeof c === 'object' && isNum(c.builtMs) && c.feeds && typeof c.feeds === 'object' ? { builtMs: c.builtMs, feeds: c.feeds } : null;
}

/**
 * Rebuild the last good snapshot for display at a later time (a refresh failed, or the page just opened). The cached
 * feeds are re-aged with the contract's rules and the whole view is built again at renderMs, so every part that depends
 * on the clock (hours since the peak, the target's tense, card visibility, crossing times, forecast lines, the rain
 * clock) follows the clock, and anything that depends on a feed that is now too old is withheld with its reason.
 * @param {{builtMs:number, feeds:object}} cached from cacheEntry
 * @param {number} renderMs
 * @param {{mods:object, table:object|null, records:object|null, recordsStatus:string, log:{available:boolean, entries:any[]}, memory:object|null}} ctx
 * @returns {object} frozen view with fromCache, builtMs (the snapshot time), renderMs and cacheAgeMin
 */
export function reageCachedView(cached, renderMs, ctx) {
  const feeds = reageFeeds(cached.feeds, renderMs);
  const { view } = buildView({ ...ctx, nowMs: renderMs, feeds, mode: 'live', fixtureName: null, fixtureNotes: null });
  return deepFreeze({ ...view, builtMs: cached.builtMs, fromCache: true, renderMs, cacheAgeMin: (renderMs - cached.builtMs) / MIN });
}

// ---------------------------------------------------------------------------------------------
// Fixture replay: ?fixture=<name>&at=<ISO time>
// The fixture replaces the four feeds; nowMs = at. Nothing after `at` is shown.
// ---------------------------------------------------------------------------------------------

const pickT = (o) => {
  const v = o.t ?? o.time ?? o.ts ?? o.t_utc ?? o.ts_utc ?? o.validTime ?? o.valid_utc ?? o.valid ?? o.end_utc ?? o.endT ?? o.end;
  if (isNum(v)) return v;
  const p = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(p) ? p : null;
};
const pickCfs = (o) => {
  const v = o.cfs ?? o.value ?? o.flow ?? o.q ?? o.discharge_cfs ?? o.forecast_discharge_cfs ?? o.flow_cfs;
  const n = typeof v === 'string' ? Number(v) : v;
  return isNum(n) ? n : null;
};
const toSeries = (arr) => cleanSeries((Array.isArray(arr) ? arr : []).map((o) => ({ t: pickT(o || {}), cfs: pickCfs(o || {}) })));
const firstArray = (...c) => c.find((x) => Array.isArray(x)) || [];

/**
 * Normalise a replay fixture into plain series, whatever key names the extractor chose.
 * @param {object} fx @returns {{gauge:{t:number,cfs:number}[], issues:{issuedT:number, points:{t:number,cfs:number}[]}[], tides:{t:number,type:string,ft:number}[], basinHours:{endT:number, mm:number}[], hasBasin:boolean, hasTides:boolean, defaultAt:number|null}}
 */
export function normalizeFixture(fx) {
  const g = fx.gauge || fx.usgs || {};
  const gauge = toSeries(firstArray(g.series, g.points, g.readings, Array.isArray(fx.gauge) ? fx.gauge : null, fx.observed));
  const n = fx.noaa || fx.nwps || {};
  const rawIssues = firstArray(n.issues, fx.noaa_issues, fx.issues, n.issuedT || n.issued ? [n] : null);
  const issues = rawIssues
    .map((i) => ({
      issuedT: pickT({ t: i.issuedT ?? i.issued ?? i.issued_utc ?? i.issue_utc ?? i.issuedTime ?? i.forecast_issue_time }),
      points: toSeries(firstArray(i.points, i.path, i.forecast, i.data)),
    }))
    .filter((i) => isNum(i.issuedT) && i.points.length)
    .sort((a, b) => a.issuedT - b.issuedT);
  const td = fx.tides || {};
  const tides = firstArray(td.events, td.predictions, Array.isArray(fx.tides) ? fx.tides : null)
    .map((e) => ({ t: pickT(e), type: String(e.type || '').toUpperCase().startsWith('L') ? 'L' : 'H', ft: Number(e.ft ?? e.v ?? e.value) }))
    .filter((e) => isNum(e.t) && isNum(e.ft));
  const b = fx.basin || fx.basin_rain || fx.mrms || {};
  const basinHours = firstArray(b.hours, Array.isArray(fx.basin) ? fx.basin : null)
    .map((hr) => ({ endT: pickT({ t: hr.endT ?? hr.end_utc ?? hr.end ?? hr.t }), mm: Number(hr.mm ?? hr.value) }))
    .filter((hr) => isNum(hr.endT) && isNum(hr.mm))
    .sort((a, c) => a.endT - c.endT);
  const da = fx.at ?? fx.default_at ?? fx.defaultAt ?? null;
  return {
    gauge, issues, tides, basinHours,
    hasBasin: basinHours.length > 0,
    hasTides: tides.length > 0,
    syntheticTides: Boolean(td && td.synthetic),
    defaultAt: typeof da === 'string' ? Date.parse(da) : isNum(da) ? da : null,
  };
}

/**
 * Solid-rain end as the contract states it for basin_rain.json (the partner study's shown rain end): the last hour of
 * 1 mm or more, once at least one later hour under 1 mm has been observed. Used only to make the replay's stand-in
 * for the server file; the rule itself lives in basin.js so the page, the job's tests and the ledger share it.
 * @param {{endT:number, mm:number}[]} hours sorted @returns {number|null}
 */
export function solidRainEnd(hours) {
  return basinSolidRainEnd(hours);
}

const iso = (ms) => new Date(ms).toISOString();
const isoNoMs = (ms) => iso(ms).replace('.000Z', 'Z');

/** Tide time as feeds.js requests it (time_zone=gmt): "YYYY-MM-DD HH:MM" in UTC. */
function tideGmt(ms) {
  return iso(ms).slice(0, 16).replace('T', ' ');
}

/**
 * Real-shaped payloads for the four sources at time `at`, built from a normalised fixture.
 * Feeds.js then parses them with its own rules, so replay uses the same stale and withheld logic as live.
 * @param {ReturnType<typeof normalizeFixture>} nf @param {number} at
 * @returns {{gauge:object, noaa:object|null, tides:object|null, basin:object|null}}
 */
export function fixturePayloads(nf, at) {
  const obs = nf.gauge.filter((p) => p.t <= at && p.t >= at - 7 * 24 * HOUR);
  const gauge = {
    type: 'FeatureCollection',
    features: obs.map((p) => ({
      type: 'Feature',
      properties: { time: isoNoMs(p.t), value: String(p.cfs), unit_of_measure: 'ft^3/s', parameter_code: '00060', monitoring_location_id: 'USGS-12201500', approval_status: 'Provisional' },
    })),
    numberReturned: obs.length,
    links: [],
  };
  const issue = [...nf.issues].reverse().find((i) => i.issuedT <= at) || null;
  const toNwps = (p) => ({ validTime: isoNoMs(p.t), generatedTime: isoNoMs(at), primary: -999, secondary: p.cfs / 1000 });
  const noaa = {
    observed: { issuedTime: isoNoMs(at), primaryName: 'Stage', primaryUnits: 'ft', secondaryName: 'River Discharge', secondaryUnits: 'kcfs', data: obs.slice(-200).map(toNwps) },
    forecast: issue
      ? { issuedTime: isoNoMs(issue.issuedT), primaryName: 'Stage', primaryUnits: 'ft', secondaryName: 'River Discharge', secondaryUnits: 'kcfs', data: issue.points.map(toNwps) }
      : { issuedTime: null, primaryName: 'Stage', primaryUnits: 'ft', secondaryName: 'River Discharge', secondaryUnits: 'kcfs', data: [] },
  };
  const tides = nf.hasTides
    ? { predictions: nf.tides.map((e) => ({ t: tideGmt(e.t), v: e.ft.toFixed(3), type: e.type })) }
    : null;
  let basin = null;
  if (nf.hasBasin) {
    const gen = Math.floor(at / HOUR) * HOUR;
    const hrs = nf.basinHours.filter((h) => h.endT <= gen);
    const end = solidRainEnd(hrs);
    basin = {
      generated_utc: isoNoMs(gen),
      source: 'MRMS RadarOnly_QPE_01H',
      hours: hrs.map((h) => ({ end_utc: isoNoMs(h.endT), mm: h.mm })),
      solid_rain_end_utc: end === null ? null : isoNoMs(end),
      rule: 'last hour >= 1 mm followed by >= 1 hour < 1 mm',
    };
  }
  return { gauge, noaa, tides, basin };
}

/**
 * A fetch stand-in that serves fixture payloads by URL and 404s everything else.
 * @param {{gauge:object|null, noaa:object|null, tides:object|null, basin:object|null}} payloads
 * @returns {(url:string)=>Promise<Response>}
 */
export function fixtureFetch(payloads) {
  return async (input) => {
    const url = String(typeof input === 'string' ? input : input && input.url);
    let body = null;
    if (url.includes('waterdata.usgs.gov')) body = payloads.gauge;
    else if (url.includes('api.water.noaa.gov')) body = payloads.noaa;
    else if (url.includes('tidesandcurrents.noaa.gov')) body = payloads.tides;
    else if (url.includes('basin_rain')) body = payloads.basin;
    if (body === null || body === undefined) return new Response('not in fixture', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

/**
 * ADAPTER: feeds built straight from a normalised fixture, used only when feeds.js is not loaded.
 * Applies the contract's age limits (gauge 2 h, NOAA 48 h, tides 36 h, radar 3 h).
 * @param {ReturnType<typeof normalizeFixture>} nf @param {number} at @returns {object}
 */
export function fixtureFeedsDirect(nf, at) {
  const ageOf = (t) => (isNum(t) ? (at - t) / MIN : null);
  const obs = nf.gauge.filter((p) => p.t <= at && p.t >= at - 7 * 24 * HOUR);
  const gT = obs.length ? obs[obs.length - 1].t : null;
  const gauge = obs.length
    ? { status: ageOf(gT) > 120 ? 'stale' : 'ok', readT: at, newestT: gT, ageMin: ageOf(gT), series: obs }
    : { status: 'could_not_read', readT: null, ageMin: null };
  const issue = [...nf.issues].reverse().find((i) => i.issuedT <= at) || null;
  let noaa = { status: 'could_not_read', readT: null, ageMin: null };
  if (issue) {
    // CONTRACT.md section 2: withhold when the issue is over 48 h old, the path ends before now + 24 h,
    // or fewer than 4 points fall in the next 24 h.
    const ahead = issue.points.filter((p) => p.t >= at && p.t <= at + 24 * HOUR).length;
    const old = ageOf(issue.issuedT) > 48 * 60;
    const short = issue.points[issue.points.length - 1].t < at + 24 * HOUR;
    const code = old ? 'issue_over_48h' : short ? 'path_short_of_24h' : ahead < 4 ? 'too_few_points_24h' : '';
    noaa = { status: code ? 'withheld' : 'ok', readT: at, ageMin: ageOf(issue.issuedT), issuedT: issue.issuedT, points: code ? [] : issue.points };
    if (code) noaa.code = code;
  }
  const tides = nf.hasTides ? { status: 'ok', readT: at, ageMin: 0, events: nf.tides } : { status: 'could_not_read', readT: null, ageMin: null };
  let basin = { status: 'could_not_read', readT: null, ageMin: null };
  if (nf.hasBasin) {
    const gen = Math.floor(at / HOUR) * HOUR;
    const hrs = nf.basinHours.filter((h) => h.endT <= gen);
    basin = { status: 'ok', readT: at, generatedT: gen, ageMin: ageOf(gen), hours: hrs, solidRainEndT: solidRainEnd(hrs) };
  }
  return { gauge, noaa, tides, basin };
}

/**
 * Parse the query string for replay mode. Fixture names are restricted to a plain file-name alphabet.
 * @param {string} search location.search
 * @returns {{fixture:string|null, at:number|null, explainer:boolean|null}}
 */
export function parseParams(search) {
  const q = new URLSearchParams(search || '');
  const name = q.get('fixture');
  const fixture = name && /^[A-Za-z0-9_.-]{1,80}$/.test(name) && !name.includes('..') ? name : null;
  const atRaw = q.get('at');
  const at = atRaw ? Date.parse(atRaw) : NaN;
  const ex = q.get('explainer');
  return { fixture, at: Number.isFinite(at) ? at : null, explainer: ex === null ? null : ex !== '0' };
}

// ---------------------------------------------------------------------------------------------
// Browser runtime (not run under node tests)
// ---------------------------------------------------------------------------------------------

function storageOrNull() {
  try {
    const s = window.localStorage;
    const k = '__srw_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

function readJson(storage, key) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function getJson(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const COULD_NOT_READ = Object.freeze({ status: 'could_not_read', readT: null, ageMin: null });
const ALL_FAILED = Object.freeze({ gauge: COULD_NOT_READ, noaa: COULD_NOT_READ, tides: COULD_NOT_READ, basin: COULD_NOT_READ });

async function start() {
  const storage = storageOrNull();
  const params = parseParams(window.location.search);
  const replay = params.fixture !== null;
  const logKey = replay ? REPLAY_LOG_KEY : LOG_KEY;

  const state = {
    view: null,
    mods: null,
    table: null,
    records: null,
    recordsStatus: 'could_not_read',
    fixture: null,
    busy: false,
    lastRefresh: 0,
    timer: 0,
    theme: readJson(storage, THEME_KEY) || 'auto',
  };

  const applyTheme = (t) => {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  };
  applyTheme(state.theme);

  const ui = render.renderStatic(document, {
    onRefresh: () => refresh(true),
    onTheme: () => {
      state.theme = state.theme === 'auto' ? 'light' : state.theme === 'light' ? 'dark' : 'auto';
      applyTheme(state.theme);
      writeJson(storage, THEME_KEY, state.theme);
      render.renderTheme(ui, state.theme);
    },
    onTap: (kind) => tap(kind),
    onUndo: (id) => undo(id),
    onExport: () => exportCsv(),
    onClear: () => clearAll(),
    replay,
  });
  render.renderTheme(ui, state.theme);

  /** A cached view carries the log as it was; show the log as it is now. */
  const withFreshLog = (v) => {
    const log = loadLog(storage, logKey);
    return deepFreeze({ ...v, log: { ...v.log, available: log.available, entries: log.entries, seasonCount: seasonCount(log.entries, v.nowMs), seasonStartMs: seasonStartMs(v.nowMs) } });
  };

  /** Detector memory saved by an earlier refresh, if recent enough to use. */
  const savedMemory = (nowMs) => {
    return usableMemory(replay ? null : readJson(storage, MEMORY_KEY), nowMs);
  };
  /** The last good feeds, rebuilt for display at `at` (null when there is no usable cache). */
  const cachedView = (at) => {
    const cached = usableCache(cacheEntry(readJson(storage, CACHE_KEY)), at);
    if (!cached) return null;
    return withFreshLog(reageCachedView(cached, at, {
      mods: state.mods, table: state.table, records: state.records, recordsStatus: state.recordsStatus,
      log: loadLog(storage, logKey), memory: savedMemory(at),
    }));
  };

  // Show the last good reading at once while the first refresh runs (live mode only).
  render.renderLoading(ui);
  if (!replay) {
    if (storage) { try { storage.removeItem(OLD_VIEW_KEY); } catch { /* storage refused: nothing to tidy */ } }
    if (cacheEntry(readJson(storage, CACHE_KEY))) {
      try {
        await ensureStatic();
        const v = cachedView(Date.now());
        if (v) { state.view = v; render.renderView(ui, v, { refreshing: true }); }
      } catch (err) {
        console.warn('[srw] cached reading not shown', err);
      }
    }
  }

  async function ensureStatic() {
    if (!state.mods) state.mods = await loadModules();
    if (!state.table) state.table = await getJson(TABLE_URL);
    const rec = await getJson(RECORDS_URL);
    state.records = rec;
    state.recordsStatus = rec ? 'ok' : 'could_not_read';
  }

  async function loadFixture() {
    if (!state.fixture) {
      const fx = await getJson(`${FIXTURE_DIR}${params.fixture}.json`);
      let nf = null;
      try { nf = fx ? normalizeFixture(fx) : null; } catch (err) { console.warn('[srw] fixture not usable', err); }
      state.fixture = nf || { error: true };
    }
    return state.fixture;
  }

  async function currentFeeds(nowMs) {
    if (replay) {
      if ((await loadFixture()).error) return null;
      if (typeof state.mods.feeds.fetchAll === 'function') {
        return state.mods.feeds.fetchAll(fixtureFetch(fixturePayloads(state.fixture, nowMs)), nowMs);
      }
      return fixtureFeedsDirect(state.fixture, nowMs);
    }
    if (typeof state.mods.feeds.fetchAll !== 'function') return ALL_FAILED;
    return state.mods.feeds.fetchAll(window.fetch.bind(window), nowMs);
  }

  function replayNow() {
    if (params.at !== null) return params.at;
    if (state.fixture && !state.fixture.error) {
      if (isNum(state.fixture.defaultAt)) return state.fixture.defaultAt;
      const g = state.fixture.gauge;
      if (g.length) return g[g.length - 1].t;
    }
    return Date.now();
  }

  async function refresh(byUser) {
    if (state.busy) return;
    state.busy = true;
    render.renderBusy(ui, true);
    try {
      await ensureStatic();
      let feeds;
      let nowMs = Date.now();
      try {
        if (replay) {
          await loadFixture();
          nowMs = replayNow();
        }
        feeds = await currentFeeds(nowMs);
      } catch (err) {
        console.warn('[srw] feeds failed', err);
        feeds = ALL_FAILED;
      }
      if (replay && feeds === null) {
        render.renderView(ui, deepFreeze({ mode: 'fixture_error', loading: false, nowMs, feeds: ALL_FAILED, observed: {}, forecast: {}, peak: {}, crest: {}, sampling: {}, log: { entries: [] }, chart: null }), {});
        return;
      }
      const log = loadLog(storage, logKey);
      const memory = savedMemory(nowMs);
      const { view, memory: nextMemory } = buildView({
        nowMs, feeds: feeds || ALL_FAILED, mods: state.mods, table: state.table, records: state.records,
        recordsStatus: state.recordsStatus, log, memory, mode: replay ? 'replay' : 'live', fixtureName: params.fixture,
        fixtureNotes: replay && state.fixture && !state.fixture.error ? { syntheticTides: state.fixture.syntheticTides } : null,
      });
      if (!replay) {
        if (nextMemory) writeJson(storage, MEMORY_KEY, { savedMs: nowMs, memory: nextMemory });
        if (view.feeds.gauge.status === 'ok') writeJson(storage, CACHE_KEY, { builtMs: nowMs, feeds });
        else if (view.feeds.gauge.status === 'could_not_read') {
          const v = cachedView(nowMs);
          if (v) {
            state.view = v;
            render.renderView(ui, v, {});
            return;
          }
        }
      }
      state.view = view;
      render.renderView(ui, view, { focusStatus: byUser === true });
      maybeExplain();
    } finally {
      state.busy = false;
      state.lastRefresh = Date.now();
      render.renderBusy(ui, false);
      schedule();
    }
  }

  function schedule() {
    clearTimeout(state.timer);
    if (replay) return;
    state.timer = setTimeout(() => {
      if (document.visibilityState === 'visible') refresh(false); else schedule();
    }, REFRESH_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (!replay && document.visibilityState === 'visible' && Date.now() - state.lastRefresh >= REFRESH_MS) refresh(false);
  });

  function maybeExplain() {
    const want = params.explainer === null ? !replay : params.explainer;
    if (!want) return;
    if (params.explainer !== true && readJson(storage, SEEN_KEY)) return;
    render.showExplainer(ui, () => writeJson(storage, SEEN_KEY, true));
  }

  function snapshotFor(v) {
    return {
      status: S.statusSentence(v),
      gaugeCfs: v.observed && v.observed.latest ? v.observed.latest.cfs : null,
      riseCfs: v.observed ? v.observed.riseCfs : null,
      lineCfs: v.observed ? v.observed.lineAtLatest : null,
      peakCallT: v.peak && v.peak.call ? v.peak.call.peakT : null,
      noaaIssuedT: v.forecast ? v.forecast.issuedT : null,
      mode: replay ? 'replay' : 'live',
    };
  }

  function rerenderLog(message) {
    if (!state.view || !state.view.log) return;
    const log = loadLog(storage, logKey);
    const nowMs = state.view.nowMs;
    const next = deepFreeze({
      ...state.view,
      log: { ...state.view.log, available: log.available, entries: log.entries, seasonCount: seasonCount(log.entries, nowMs), seasonStartMs: seasonStartMs(nowMs) },
    });
    state.view = next;
    render.renderLogOnly(ui, next, message);
  }

  function tap(kind) {
    const v = state.view;
    if (!v || !v.log) return;
    const t = replay ? v.nowMs : Date.now();
    const cur = loadLog(storage, logKey);
    const entry = makeEntry(kind, t, snapshotFor(v), cur.entries);
    const res = storage ? addEntry(storage, entry, logKey) : { ok: false };
    if (!res.ok) { render.showToast(ui, S.logMessage('failed'), null); rerenderLog(); return; }
    rerenderLog();
    render.showToast(ui, S.tapLogged(kind, t, v.nowMs), entry.id);
  }

  function undo(id) {
    if (!storage) return;
    const res = removeEntry(storage, id, logKey);
    rerenderLog();
    render.showToast(ui, res.ok ? S.tapUndone() : S.logMessage('failed'), null);
  }

  function exportCsv() {
    const log = loadLog(storage, logKey);
    if (!log.entries.length) { render.showToast(ui, S.logMessage('nothing'), null); return; }
    const blob = new Blob([`﻿${toCsv(log.entries)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(state.view ? state.view.nowMs : Date.now());
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    render.showToast(ui, S.logMessage('exported', log.entries.length), null);
  }

  function clearAll() {
    const ok = storage ? clearLog(storage, logKey) : false;
    rerenderLog();
    render.showToast(ui, S.logMessage(ok ? 'cleared' : 'failed'), null);
  }

  await refresh(false);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  start().catch((err) => {
    console.error('[srw] start failed', err);
  });
}
