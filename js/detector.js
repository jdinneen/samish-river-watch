/**
 * Observed peak call, episode arming and second-peak handling (CONTRACT.md section 3).
 *
 * The call rule is the partner study's (q1b.py), selected setting d = 2 %, m = 90 min:
 *   within an armed episode track the running high; CALL when flow <= high * (1 - 2/100)
 *   and the high is at least 90 min old; then disarm until flow > called peak * 1.05 and
 *   re-arm with that point as the new running high. If the re-arm comes within 12 h of the
 *   call (the call's confirmation time, as the study measures from the call index) the earlier
 *   call is PREMATURE; after 12 h it is a SECOND PEAK.
 *
 * The rise-episode rule is the live, pre-stated arming rule (it differs from the study's
 * offline event list): the episode arms at the first reading with flow >= 150 cfs and
 * flow >= 1.5 x the lowest flow in the 72 h up to and including that reading (never reaching
 * back before the end of the previous episode). Its start is the latest time of that lowest
 * flow; the running high starts as the highest flow since then. It ends when flow falls below
 * 50 % of the called peak, or 72 h after the last call with no new high.
 *
 * Running high: it moves only to a STRICTLY greater reading, so a flat top keeps the FIRST reading
 * that reached it (the study's `if q15[i] > q15[cur]`). The call's peakT is that first reading, the
 * 90-min age is counted from it, and the replay fixture's expected values depend on this tie rule.
 *
 * Episode arming reads CONTRACT.md section 3: the episode arms at the first reading whose flow is
 * >= 150 cfs and >= 1.5 x the lowest flow in the 72 h up to it. The lowest flow ignores anything
 * before the end of the previous episode (otherwise the recession tail of one storm re-arms as
 * the next; LIMITS.md states this addition). "No new high" after a call means no reading above
 * 1.05 x the called peak (the re-arm rule); a smaller exceedance neither re-arms nor extends it.
 *
 * Readings are processed one at a time in time order. `memory` is the whole state of that pass
 * (plain data that survives JSON.stringify and parse), so evaluating a growing series with the
 * returned memory gives exactly the state a from-scratch pass over the same readings gives.
 *
 * Memory is a CACHE ONLY (external review 2026-10-19, defect 2). USGS readings are provisional and are revised or
 * withdrawn, so a saved pass can describe readings that no longer exist. Every call checks the memory against the
 * series it is given: the readings from the memory's first to its last processed time must be exactly the ones it
 * processed (same count, same times, same values, by a fingerprint chained over them). If one differs, one is missing
 * or one has appeared inside that range, the memory is thrown away and the whole fetched window is processed from
 * scratch, so a corrected history can never leave an obsolete call or episode standing. The result is always equal to a
 * from-scratch pass over the same readings.
 */

const MIN_MS = 60 * 1000;
const HOUR_MS = 3600 * 1000;

/** The frozen rule constants. */
export const RULE = Object.freeze({
  /** call when flow <= high * DIP_FACTOR (same expression as the study: 1 - d/100 with d = 2) */
  dipFactor: 1 - 2 / 100,
  minHighAgeMs: 90 * MIN_MS,
  rearmFactor: 1.05,
  prematureWindowMs: 12 * HOUR_MS,
  episodeMinCfs: 150,
  episodeRiseFactor: 1.5,
  lookbackMs: 72 * HOUR_MS,
  endFraction: 0.5,
  endAfterCallMs: 72 * HOUR_MS,
});

const MEMORY_VERSION = 2;
const HISTORY_LIMIT = 50;

/**
 * @typedef {{t:number, cfs:number}} Point
 * @typedef {{t:number, peakT:number, peakCfs:number, confirmedT:number, premature:boolean, secondPeak:boolean}} Call
 *   t is the time of the called peak (the "Peak call made at ..." time); confirmedT is when the rule fired.
 * @typedef {object} Memory plain-data state of the detector pass (survives a JSON round trip); treat as opaque.
 * @typedef {{episode:boolean, episodeStart:number|null, state:"none"|"rising"|"called",
 *   high:Point|null, call:Call|null, memory:Memory}} PeakState
 */

/** @returns {Memory} */
function freshMemory() {
  return { v: MEMORY_VERSION, firstT: null, lastT: null, n: 0, fp: FP_SEED, buf: [], armFloorT: null, ep: null, current: null, history: [] };
}

/** Fingerprint seed and chain: a 53-bit string hash (cyrb53) over the previous value and one reading. */
const FP_SEED = 0x1f3a5c;
function chain(fp, p) {
  const str = `${fp}|${p.t}|${p.cfs}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Try to start an episode at reading p. Mutates m.
 * @param {Memory} m @param {Point} p @returns {boolean} true when an episode is now active
 */
function tryArm(m, p) {
  if (p.cfs < RULE.episodeMinCfs) return false;
  const floor = Math.max(p.t - RULE.lookbackMs, m.armFloorT === null ? -Infinity : m.armFloorT);
  const window = m.buf.filter((q) => q.t >= floor);
  let low = Infinity;
  let lowT = p.t;
  for (const q of window) {
    if (q.cfs <= low) {
      low = q.cfs;
      lowT = q.t;
    }
  }
  if (!(p.cfs >= RULE.episodeRiseFactor * low)) return false;
  // Strictly greater, in time order: a flat top keeps the first reading that reached it.
  let high = null;
  for (const q of window) {
    if (q.t >= lowT && (high === null || q.cfs > high.cfs)) high = { t: q.t, cfs: q.cfs };
  }
  if (m.current) {
    m.history.push(m.current);
    if (m.history.length > HISTORY_LIMIT) m.history.shift();
    m.current = null;
  }
  m.ep = { startT: lowT, high, armed: true, calledMax: null, lastCallT: null };
  return true;
}

/**
 * Advance an active episode by reading p. Mutates m.
 * @param {Memory} m @param {Point} p
 */
function advance(m, p) {
  const ep = m.ep;
  if (ep.armed) {
    // Strictly greater: a reading equal to the running high leaves the high at its first reading.
    if (p.cfs > ep.high.cfs) ep.high = { t: p.t, cfs: p.cfs };
    if (p.cfs <= ep.high.cfs * RULE.dipFactor && p.t - ep.high.t >= RULE.minHighAgeMs) {
      if (m.current) {
        m.history.push(m.current);
        if (m.history.length > HISTORY_LIMIT) m.history.shift();
      }
      m.current = {
        t: ep.high.t,
        peakT: ep.high.t,
        peakCfs: ep.high.cfs,
        confirmedT: p.t,
        premature: false,
        secondPeak: false,
      };
      ep.armed = false;
      ep.calledMax = ep.high.cfs;
      ep.lastCallT = p.t;
    }
    return;
  }
  if (p.cfs > ep.calledMax * RULE.rearmFactor) {
    if (p.t - m.current.confirmedT <= RULE.prematureWindowMs) m.current.premature = true;
    else m.current.secondPeak = true;
    ep.armed = true;
    ep.high = { t: p.t, cfs: p.cfs };
    return;
  }
  if (p.cfs < RULE.endFraction * ep.calledMax || p.t - ep.lastCallT >= RULE.endAfterCallMs) {
    m.ep = null;
    m.armFloorT = p.t;
  }
}

/**
 * Process one reading. Mutates m.
 * @param {Memory} m @param {Point} p
 */
function step(m, p) {
  if (m.firstT === null) m.firstT = p.t;
  m.n += 1;
  m.fp = chain(m.fp, p);
  m.buf.push(p);
  while (m.buf.length && m.buf[0].t < p.t - RULE.lookbackMs) m.buf.shift();
  m.lastT = p.t;
  if (!m.ep && !tryArm(m, p)) return;
  advance(m, p);
}

/**
 * Whether a saved memory may be continued: right version, not newer than nowMs, and the readings of this series from the
 * memory's first to its last processed time are exactly the ones it processed (count and fingerprint). Anything else
 * (a revised value, a withdrawn reading, a reading added inside the range, a window that no longer reaches back to the
 * memory's first reading) makes it unusable and the caller starts over.
 * @param {Memory|undefined|null} memory @param {Point[]} readings sorted, one per timestamp @param {number} nowMs
 * @returns {boolean}
 */
function cacheStillValid(memory, readings, nowMs) {
  if (!memory || memory.v !== MEMORY_VERSION || !Number.isFinite(memory.lastT) || !Number.isFinite(memory.firstT)) return false;
  if (memory.lastT > nowMs || !(memory.n > 0)) return false;
  let fp = FP_SEED;
  let n = 0;
  for (const r of readings) {
    if (r.t < memory.firstT) continue;
    if (r.t > memory.lastT) break;
    fp = chain(fp, r);
    n += 1;
  }
  return n === memory.n && fp === memory.fp;
}

/**
 * Evaluate the peak-call state of an observed flow series as of nowMs.
 *
 * state: "none" (no episode), "rising" (episode armed, no standing call), "called" (a call
 * stands). `call` is the most recent call of the current episode, or of the last episode when
 * none is active, and null before any call. While state is "rising", a non-null call with
 * `premature` or `secondPeak` true is the earlier call that the river has since exceeded.
 * Apps decide how old a call may be before they stop showing it.
 *
 * Pure: the input memory is not modified. Pass the returned `memory` back with a longer series
 * to continue the same pass; readings at or before the memory's last time are skipped when the memory still matches the
 * series (see cacheStillValid). A memory newer than nowMs, of another version, or not matching the readings it processed
 * is discarded and the pass starts over.
 * @param {Point[]} series observed flow, any order; readings after nowMs and non-finite readings are ignored; of two
 *   readings with one timestamp the later in the array is kept
 * @param {number} nowMs
 * @param {Memory} [memory]
 * @returns {PeakState}
 */
export function peakState(series, nowMs, memory) {
  // Readings in time order, one per timestamp. Two readings with the same time are one reading that was revised: the
  // later one in the input order is kept (the sort is stable), so the answer never depends on a stale copy.
  const readings = [];
  for (const r of series
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.cfs) && p.t <= nowMs)
    .sort((a, b) => a.t - b.t)) {
    if (readings.length && r.t === readings[readings.length - 1].t) readings.pop();
    readings.push({ t: r.t, cfs: r.cfs });
  }
  const m = cacheStillValid(memory, readings, nowMs) ? structuredClone(memory) : freshMemory();
  for (const r of readings) {
    if (m.lastT !== null && r.t <= m.lastT) continue;
    step(m, r);
  }
  const ep = m.ep;
  return {
    episode: ep !== null,
    episodeStart: ep ? ep.startT : null,
    state: !ep ? "none" : ep.armed ? "rising" : "called",
    high: ep ? { ...ep.high } : null,
    call: m.current ? { ...m.current } : null,
    memory: m,
  };
}
