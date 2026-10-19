// Radar basin-rain completeness, shared by feeds.js (fetch), app.js (re-ageing a cached view), crest.js (the rain clock)
// and the ledger. Pure and dependency-free. Judged on the rainfall observations themselves, never on the time the file
// was written (external review 2026-10-19; coordinator disposition 1).
'use strict';

const HOUR = 3600000;

/** The rules, frozen. A test pins the page's re-ageing limits to these. */
export const BASIN_RULES = Object.freeze({
  /** The newest observed hour may end at most this long before now. */
  newestHourMaxAgeMs: 3 * HOUR,
  /** Each of this many hours, counted back from the newest observed hour, must be present. */
  completeLastHours: 6,
  /** The window, in hours ending at the newest observed hour, over which coverage is counted. */
  windowHours: 48,
  /** The quiet-rain note needs at least this share of that window. */
  minCoverage: 0.9,
});

/**
 * How current and how complete the radar hours are, judged on the rainfall observations themselves and not on the
 * time the file was written (external review 2026-10-19: a freshly written file with its newest hours missing must
 * not read as current). Pure.
 *   newestHourT     end time of the newest observed hour at or before nowMs, or null
 *   newestFresh     that hour ended no more than 3 h before nowMs
 *   lastSixComplete each of the six hours ending at the newest hour is present (one hour apart)
 *   coverage48      share of the 48 hours ending at the newest hour that are present
 *   current         newestFresh and lastSixComplete (the feed's "ok")
 * @param {{endT:number}[]} hours @param {number} nowMs
 * @returns {{newestHourT:number|null, newestFresh:boolean, lastSixComplete:boolean, coverage48:number, current:boolean}}
 */
export function basinCompleteness(hours, nowMs) {
  const ends = new Set((Array.isArray(hours) ? hours : []).map((h) => h && h.endT).filter((t) => Number.isFinite(t) && t <= nowMs));
  if (!ends.size) return { newestHourT: null, newestFresh: false, lastSixComplete: false, coverage48: 0, current: false };
  const newestHourT = Math.max(...ends);
  const newestFresh = nowMs - newestHourT <= BASIN_RULES.newestHourMaxAgeMs;
  let present6 = 0;
  for (let k = 0; k < BASIN_RULES.completeLastHours; k += 1) if (ends.has(newestHourT - k * HOUR)) present6 += 1;
  const lastSixComplete = present6 === BASIN_RULES.completeLastHours;
  let present48 = 0;
  for (let k = 0; k < BASIN_RULES.windowHours; k += 1) if (ends.has(newestHourT - k * HOUR)) present48 += 1;
  return { newestHourT, newestFresh, lastSixComplete, coverage48: present48 / BASIN_RULES.windowHours, current: newestFresh && lastSixComplete };
}



/** The rain-end rule (CONTRACT.md section 3, amended 2026-10-19 after the second refuting pass). */
export const RAIN_END_RULE = Object.freeze({
  /** An hour counts as solid rain at or above this many mm of basin mean. */
  solidMm: 1,
  /** The rain end is shown once at least this many hours after the last solid hour are present and under solidMm. */
  dryHoursAfter: 1,
});

/**
 * The shown rain end, as the partner study defines it (Q9 part 5, q9.py): the end of the last hour with 1 mm or more,
 * once at least one later hour has been observed under 1 mm. Every hour from the one after it up to the newest hour must
 * be present, so a gap after the last solid hour gives null (rain cannot be shown to have eased). Null when no hour
 * reaches 1 mm or when the newest hour is itself solid.
 * @param {{endT:number, mm:number}[]} hours
 * @returns {number|null} end time (ms) of the last solid hour, or null
 */
export function solidRainEnd(hours) {
  const hs = (Array.isArray(hours) ? hours : []).filter((h) => h && Number.isFinite(h.endT) && Number.isFinite(h.mm))
    .sort((a, b) => a.endT - b.endT);
  let last = -1;
  for (let i = 0; i < hs.length; i += 1) if (hs[i].mm >= RAIN_END_RULE.solidMm) last = i;
  if (last < 0) return null;
  const after = hs.slice(last + 1);
  if (after.length < RAIN_END_RULE.dryHoursAfter) return null;
  for (let k = 0; k < after.length; k += 1) if (after[k].endT !== hs[last].endT + (k + 1) * HOUR) return null;
  return hs[last].endT;
}

/**
 * Does the hour list support a rain end? True only when the hour ending at endT is solid and every hour after it, one
 * hour apart up to the newest observed hour, is present and under 1 mm, and that newest hour is current (no more than 3 h
 * before nowMs). The rain clock needs this complete run, from the rain end to now (coordinator disposition 1).
 * @param {{endT:number, mm:number}[]} hours @param {number} endT @param {number} nowMs
 * @returns {{ok:true}|{ok:false, why:'no_hours'|'not_solid'|'old'|'gap'|'solid_after'|'no_dry_hour'}}
 */
export function rainEndSupported(hours, endT, nowMs) {
  const hs = (Array.isArray(hours) ? hours : []).filter((h) => h && Number.isFinite(h.endT) && Number.isFinite(h.mm) && h.endT <= nowMs)
    .sort((a, b) => a.endT - b.endT);
  if (!hs.length || !Number.isFinite(endT)) return { ok: false, why: 'no_hours' };
  const newest = hs[hs.length - 1];
  if (nowMs - newest.endT > BASIN_RULES.newestHourMaxAgeMs) return { ok: false, why: 'old' };
  const at = hs.find((h) => h.endT === endT);
  if (!at || at.mm < RAIN_END_RULE.solidMm) return { ok: false, why: 'not_solid' };
  const after = hs.filter((h) => h.endT > endT);
  if (after.length < RAIN_END_RULE.dryHoursAfter) return { ok: false, why: 'no_dry_hour' };
  for (let k = 0; k < after.length; k += 1) {
    if (after[k].endT !== endT + (k + 1) * HOUR) return { ok: false, why: 'gap' };
    if (after[k].mm >= RAIN_END_RULE.solidMm) return { ok: false, why: 'solid_after' };
  }
  return { ok: true };
}
