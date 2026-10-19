/**
 * NOAA-aligned line, high/low case edges from the frozen past-miss table, and crossing times.
 * Pure functions; times are epoch ms UTC; flows are cfs; paths are [{t, cfs}] sorted ascending.
 */
import { firstCrossing, laParts, spliceSeries, valueAt } from "./season.js";

const HOUR_MS = 3600 * 1000;

/** @typedef {{t:number, cfs:number}} Point */
/** @typedef {{low_factor:number, high_factor:number}} Regime factors that multiply the aligned flow (10th and 90th percentile of past observed over aligned) */
/** @typedef {{lead_lo_h:number, lead_hi_h:number, add_cfs:number, rise:Regime, flat:Regime}} Bin */
/**
 * Table v3 (site/data/ratio_table.json). `apply_to` is "flow": the factors multiply the aligned flow itself.
 * @typedef {{apply_to?:string, rise_floor_cfs:number, storm_flow_cfs:number, wet_months?:number[], bins:Bin[]}} RatioTable
 */

/** Wet-season look months when the table carries none (the table's own `wet_months`: Oct-Apr). */
const DEFAULT_WET_MONTHS = Object.freeze([1, 2, 3, 4, 10, 11, 12]);

/**
 * The table bin containing a lead time (lo <= lead < hi; the last bin also includes its upper edge,
 * so a point exactly 72 h out is still drawn and nothing later is).
 * @param {Bin[]} bins
 * @param {number} leadH lead in hours
 * @returns {Bin|null} null when the lead is outside every bin
 */
export function binForLead(bins, leadH) {
  for (let i = 0; i < bins.length; i++) {
    const b = bins[i];
    const last = i === bins.length - 1;
    if (leadH >= b.lead_lo_h && (leadH < b.lead_hi_h || (last && leadH === b.lead_hi_h))) return b;
  }
  return null;
}

/**
 * NOAA's path shifted by a constant so it passes through the latest gauge reading.
 * Offset = latest flow minus the raw path interpolated at the reading time (the path's first
 * point if it starts later, its last point if it ended earlier). Flows are floored at 0.
 * @param {Point[]} rawPath
 * @param {Point} latest latest observed reading
 * @returns {Point[]}
 */
export function alignedPath(rawPath, latest) {
  if (!rawPath.length) return [];
  let base = valueAt(rawPath, latest.t);
  if (base === null) base = latest.t < rawPath[0].t ? rawPath[0].cfs : rawPath[rawPath.length - 1].cfs;
  const offset = latest.cfs - base;
  return rawPath.map((p) => ({ t: p.t, cfs: Math.max(0, p.cfs + offset) }));
}

/**
 * Whether a look time falls in the table's wet season (month in America/Los_Angeles).
 * The high and low cases are drawn only then; the table was built from Oct-Apr look months.
 * @param {{wet_months?:number[]}|null|undefined} table
 * @param {number} lookMs the time the page is being read, epoch ms UTC
 * @returns {boolean}
 */
export function isWetSeason(table, lookMs) {
  const months = table && Array.isArray(table.wet_months) ? table.wet_months : DEFAULT_WET_MONTHS;
  return months.includes(laParts(lookMs).month);
}

/** @param {unknown} x @returns {boolean} */
const finite = (x) => typeof x === "number" && Number.isFinite(x);

/**
 * Throw when a table cannot be applied as written. A bad table must stop the range from being
 * drawn, never be patched silently.
 * @param {RatioTable} table
 */
function assertUsable(table) {
  if (table.apply_to !== undefined && table.apply_to !== "flow") throw new Error("past-miss table apply_to must be \"flow\"");
  if (!finite(table.rise_floor_cfs) || !finite(table.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (const b of table.bins) {
    if (!finite(b.lead_lo_h) || !finite(b.lead_hi_h) || !finite(b.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (const regime of ["rise", "flat"]) {
      const r = b[regime];
      if (!r || !finite(r.low_factor) || !finite(r.high_factor)) throw new Error(`past-miss table bin ${b.lead_lo_h}-${b.lead_hi_h} h needs ${regime} factors`);
    }
  }
}

/**
 * High and low case paths from table v3 (CONTRACT.md section 3). For each aligned point with lead
 * L in (0, last bin end] hours after the latest reading, in the bin with lo <= L < hi:
 *   - aligned flow >= storm_flow_cfs: regime is "rise" when aligned minus the latest reading is at
 *     least rise_floor_cfs, else "flat"; high/low = aligned * the regime's high/low factor.
 *   - aligned flow below storm_flow_cfs: high = aligned + add_cfs, low = max(0, aligned - add_cfs).
 * Nothing is drawn at or before the reading or past the last bin (72 h). Outside the wet season
 * (look-time month, America/Los_Angeles) no edge is drawn and `wetSeason` is false so the page can
 * say why. The result is clamped so high >= aligned >= low even for a table with inverted factors.
 * Throws when the table is missing a field it needs and the season is wet.
 * @param {Point[]} aligned
 * @param {Point} latest latest observed reading
 * @param {RatioTable} table
 * @param {number} [lookMs] time the page is being read; defaults to the latest reading's time
 * @returns {{high: Point[], low: Point[], wetSeason: boolean}}
 */
export function edgePaths(aligned, latest, table, lookMs = latest.t) {
  const high = [];
  const low = [];
  const wetSeason = isWetSeason(table, lookMs);
  if (!wetSeason || !table || !Array.isArray(table.bins) || !table.bins.length) return { high, low, wetSeason };
  assertUsable(table);
  const bins = table.bins;
  const maxLead = bins[bins.length - 1].lead_hi_h;
  for (const p of aligned) {
    const lead = (p.t - latest.t) / HOUR_MS;
    if (lead <= 0 || lead > maxLead) continue;
    const bin = binForLead(bins, lead);
    if (!bin) continue;
    let hi;
    let lo;
    if (p.cfs >= table.storm_flow_cfs) {
      const regime = p.cfs - latest.cfs >= table.rise_floor_cfs ? bin.rise : bin.flat;
      hi = p.cfs * regime.high_factor;
      lo = p.cfs * regime.low_factor;
    } else {
      hi = p.cfs + bin.add_cfs;
      lo = p.cfs - bin.add_cfs;
    }
    high.push({ t: p.t, cfs: Math.max(hi, p.cfs) });
    low.push({ t: p.t, cfs: Math.max(0, Math.min(lo, p.cfs)) });
  }
  return { high, low, wetSeason };
}

/**
 * First season-line crossing time of each forecast line, from the latest observation onward.
 * Each path is spliced onto the last 24 h of observed flow. If the observed rise is already at
 * the line at the latest reading, every drawn line returns that reading's time. A line with no
 * points (not drawn: no forecast, or off season) returns null, never a crossing.
 * @param {Point[]} observed
 * @param {Point[]} rawPath
 * @param {Point[]} aligned
 * @param {Point[]} high
 * @param {Point[]} low
 * @returns {{raw:number|null, aligned:number|null, high:number|null, low:number|null}}
 */
export function crossingSummary(observed, rawPath, aligned, high, low) {
  if (!observed.length) return { raw: null, aligned: null, high: null, low: null };
  const startMs = observed.reduce((m, p) => Math.max(m, p.t), -Infinity);
  const cross = (path) => (path.length ? firstCrossing(spliceSeries(observed, path), startMs) : null);
  return { raw: cross(rawPath), aligned: cross(aligned), high: cross(high), low: cross(low) };
}
