// log.js: the local sample log (browser storage only; nothing leaves the browser).
// Pure helpers with an injectable storage object so they run in node tests and in the page alike.
'use strict';

import { CSV_HEADER, TAP_KINDS, dayKey, clock } from './strings.js';

/** Storage key for the live season log. */
export const LOG_KEY = 'srw.log.v1';
/** Storage key for the replay log (fixture mode), kept apart from the season log. */
export const REPLAY_LOG_KEY = 'srw.log.replay.v1';
/** Storm-response bay-sample target per water year (CONTRACT.md section 3). */
export const SEASON_TARGET = 15;
const MAX_ENTRIES = 2000;
const KINDS = Object.freeze(Object.keys(TAP_KINDS));

/**
 * @typedef {object} LogEntry
 * @property {string} id
 * @property {number} t           tap time, ms epoch UTC
 * @property {'bay'|'county'|'call50'|'call80'} kind
 * @property {string} status      the status sentence frozen at the tap
 * @property {number|null} gaugeCfs
 * @property {number|null} riseCfs
 * @property {number|null} lineCfs
 * @property {number|null} peakCallT
 * @property {number|null} noaaIssuedT
 * @property {'live'|'replay'} mode
 */

const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Coerce one stored object into a clean entry, or null when it is not a usable entry.
 * @param {any} x @returns {LogEntry|null}
 */
export function cleanEntry(x) {
  if (!x || typeof x !== 'object') return null;
  const t = finiteOrNull(x.t);
  if (t === null || !KINDS.includes(x.kind)) return null;
  return Object.freeze({
    id: typeof x.id === 'string' && x.id ? x.id.slice(0, 64) : `e${t}`,
    t,
    kind: x.kind,
    status: typeof x.status === 'string' ? x.status.slice(0, 600) : '',
    gaugeCfs: finiteOrNull(x.gaugeCfs),
    riseCfs: finiteOrNull(x.riseCfs),
    lineCfs: finiteOrNull(x.lineCfs),
    peakCallT: finiteOrNull(x.peakCallT),
    noaaIssuedT: finiteOrNull(x.noaaIssuedT),
    mode: x.mode === 'replay' ? 'replay' : 'live',
  });
}

/**
 * Read the log. Never throws: storage that is blocked or holds bad JSON returns available:false or an empty list.
 * @param {Storage|null|undefined} storage
 * @param {string} [key]
 * @returns {{available:boolean, entries:LogEntry[]}}
 */
export function loadLog(storage, key = LOG_KEY) {
  if (!storage) return { available: false, entries: [] };
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { available: true, entries: [] };
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.entries) ? parsed.entries : [];
    const entries = list.map(cleanEntry).filter(Boolean).sort((a, b) => a.t - b.t);
    return { available: true, entries };
  } catch {
    return { available: false, entries: [] };
  }
}

function save(storage, key, entries) {
  try {
    storage.setItem(key, JSON.stringify({ v: 1, entries: entries.slice(-MAX_ENTRIES) }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Make a new entry id that is unique within the list.
 * @param {number} t @param {LogEntry[]} entries @returns {string}
 */
export function newId(t, entries) {
  const base = `e${Math.round(t)}`;
  let id = base;
  let k = 1;
  const ids = new Set(entries.map((e) => e.id));
  while (ids.has(id)) id = `${base}-${k++}`;
  return id;
}

/**
 * Build an entry from a tap and the current view (the status sentence is frozen into it).
 * @param {'bay'|'county'|'call50'|'call80'} kind
 * @param {number} t
 * @param {object} snapshot {status, gaugeCfs, riseCfs, lineCfs, peakCallT, noaaIssuedT, mode}
 * @param {LogEntry[]} entries existing entries, for a unique id
 * @returns {LogEntry|null}
 */
export function makeEntry(kind, t, snapshot, entries) {
  return cleanEntry({ ...snapshot, kind, t, id: newId(t, entries) });
}

/**
 * Append an entry and persist. Returns the new list, or ok:false when the browser refused to store it.
 * @param {Storage} storage @param {LogEntry} entry @param {string} [key]
 * @returns {{ok:boolean, entries:LogEntry[]}}
 */
export function addEntry(storage, entry, key = LOG_KEY) {
  const cur = loadLog(storage, key);
  if (!cur.available || !entry) return { ok: false, entries: cur.entries };
  const entries = [...cur.entries, entry].sort((a, b) => a.t - b.t);
  return save(storage, key, entries) ? { ok: true, entries } : { ok: false, entries: cur.entries };
}

/**
 * Remove one entry by id and persist.
 * @param {Storage} storage @param {string} id @param {string} [key]
 * @returns {{ok:boolean, entries:LogEntry[]}}
 */
export function removeEntry(storage, id, key = LOG_KEY) {
  const cur = loadLog(storage, key);
  if (!cur.available) return { ok: false, entries: cur.entries };
  const entries = cur.entries.filter((e) => e.id !== id);
  return save(storage, key, entries) ? { ok: true, entries } : { ok: false, entries: cur.entries };
}

/**
 * Clear the whole log (the caller confirms first).
 * @param {Storage} storage @param {string} [key]
 * @returns {boolean}
 */
export function clearLog(storage, key = LOG_KEY) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Start of the current water year: the most recent Oct 1, 00:00 America/Los_Angeles, at or before nowMs
 * (CONTRACT.md section 3). The first-flush storms of October count toward the new water year.
 * The name is kept for callers; "season" here means the sampling water year.
 * @param {number} nowMs @returns {number}
 */
export function seasonStartMs(nowMs) {
  const [y, m] = dayKey(nowMs).split('-').map(Number);
  const year = m >= 10 ? y : y - 1;
  return localMidnight(year, 10, 1);
}

/** Alias of seasonStartMs with the contract's name. @param {number} nowMs @returns {number} */
export const waterYearStartMs = seasonStartMs;

/**
 * Epoch ms of 00:00 America/Los_Angeles on a calendar date (handles PST and PDT).
 * @param {number} y @param {number} m 1-12 @param {number} d @returns {number}
 */
export function localMidnight(y, m, d) {
  // Try both possible offsets (PST -8 h, PDT -7 h) and keep the one that lands on local 00:00 of that date.
  for (const off of [8, 7]) {
    const t = Date.UTC(y, m - 1, d, off, 0, 0);
    if (clock(t) === '00:00' && dayKey(t) === `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`) return t;
  }
  return Date.UTC(y, m - 1, d, 8, 0, 0);
}

/**
 * Bay-sample taps this water year (from the most recent Oct 1, 00:00 PT, up to a minute past nowMs).
 * @param {LogEntry[]} entries @param {number} nowMs @returns {number}
 */
export function seasonCount(entries, nowMs) {
  const start = seasonStartMs(nowMs);
  return entries.filter((e) => e.kind === 'bay' && e.t >= start && e.t <= nowMs + 60_000).length;
}

/**
 * One CSV cell: quoted, doubled quotes, and a leading apostrophe on text that a spreadsheet would run as a formula.
 * @param {unknown} v @returns {string}
 */
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== String(v) ? `"${s.replace(/"/g, '""')}"` : s;
}

const isoOrEmpty = (t) => (typeof t === 'number' && Number.isFinite(t) ? new Date(t).toISOString() : '');
const ptOrEmpty = (t) => (typeof t === 'number' && Number.isFinite(t) ? `${dayKey(t)} ${clock(t)}` : '');

/**
 * Export the log as CSV text (UTF-8, CRLF rows, header from strings.CSV_HEADER).
 * @param {LogEntry[]} entries @returns {string}
 */
export function toCsv(entries) {
  const rows = [CSV_HEADER.join(',')];
  for (const e of entries) {
    rows.push([
      ptOrEmpty(e.t), isoOrEmpty(e.t), TAP_KINDS[e.kind] || e.kind, e.status,
      e.gaugeCfs, e.riseCfs, e.lineCfs, ptOrEmpty(e.peakCallT), ptOrEmpty(e.noaaIssuedT), e.mode,
    ].map(csvCell).join(','));
  }
  return `${rows.join('\r\n')}\r\n`;
}

/**
 * File name for an export: samish-river-watch-log-YYYY-MM-DD.csv (local date).
 * @param {number} nowMs @returns {string}
 */
export function csvFileName(nowMs) {
  return `samish-river-watch-log-${dayKey(nowMs)}.csv`;
}
