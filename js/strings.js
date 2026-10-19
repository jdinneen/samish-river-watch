// strings.js: every user-facing sentence on Samish River Watch lives here.
// CONTRACT.md section 4 is binding. render.js, chart.js and log.js take words only from this module.
// Pure functions of plain data; no DOM, no globals, no clock reads (the caller passes nowMs).
'use strict';

/**
 * Words and phrases that must never appear on screen or in exports, exactly as CONTRACT.md section 4 lists them.
 * Matching is case-insensitive substring matching (see findForbidden).
 * @type {readonly string[]}
 */
export const FORBIDDEN = [
  'better than NOAA', 'beats NOAA', 'validated', 'calibrated', 'proven', 'accurate', 'reliable', 'safe',
  'all clear', 'closed', 'open', 'harvest', 'reopen', 'probability', '% chance', 'chance of', 'guaranteed',
  'alert', 'scenario', 'band', 'quantile', 'anchored', 'ratio', 'conservative', 'liberal', 'model',
];
Object.freeze(FORBIDDEN);

/**
 * Rule-based bans from CONTRACT.md section 4 that are not single words ("any hours-of-notice claim").
 * @type {readonly RegExp[]}
 */
export const FORBIDDEN_PATTERNS = Object.freeze([
  /hours?\s+of\s+(notice|warning|lead)/i,
  /hours?['’]?\s+notice/i,
  /will\s+not\s+cross/i,
  /!/,
]);

/**
 * Return every forbidden word or pattern found in a text (empty array when clean).
 * @param {string} text
 * @returns {string[]}
 */
export function findForbidden(text) {
  const lower = String(text).toLowerCase();
  const hits = FORBIDDEN.filter((w) => lower.includes(w.toLowerCase()));
  for (const re of FORBIDDEN_PATTERNS) if (re.test(String(text))) hits.push(String(re));
  return hits;
}

// ---------------------------------------------------------------------------------------------
// Formatting (times are America/Los_Angeles on screen, labelled PT; flows are cfs)
// ---------------------------------------------------------------------------------------------

const TZ = 'America/Los_Angeles';
const HM = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const WD = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const MDY = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
const MD = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const isTime = (ms) => typeof ms === 'number' && Number.isFinite(ms);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** Local clock "HH:MM" (24 h) for an epoch-ms time. @param {number} ms @returns {string} */
export function clock(ms) {
  if (!isTime(ms)) return '--:--';
  return HM.format(ms).replace(/^24/, '00');
}

/** Local calendar day key "YYYY-MM-DD". @param {number} ms @returns {string} */
export function dayKey(ms) {
  return isTime(ms) ? DAY.format(ms) : '';
}

/** "Wed 22:00 PT", always with the weekday. @param {number} ms @returns {string} */
export function dayTime(ms) {
  if (!isTime(ms)) return 'time not known';
  return `${WD.format(ms)} ${clock(ms)} PT`;
}

/**
 * "22:00 PT" when on the same local day as nowMs, otherwise "Tue 22:00 PT".
 * @param {number} ms @param {number} nowMs @returns {string}
 */
export function when(ms, nowMs) {
  if (!isTime(ms)) return 'time not known';
  return dayKey(ms) === dayKey(nowMs) ? `${clock(ms)} PT` : dayTime(ms);
}

/** "Oct 19, 2026". @param {number} ms @returns {string} */
export function longDate(ms) {
  return isTime(ms) ? MDY.format(ms) : 'date not known';
}

/** "Tue, Sep 29". @param {number} ms @returns {string} */
export function shortDay(ms) {
  return isTime(ms) ? MD.format(ms) : '';
}

/** Whole number with thousands separators. @param {number} n @returns {string} */
export function num(n) {
  return isNum(n) ? NUM.format(Math.round(n)) : '--';
}

/** "1,240 cfs". @param {number} n @returns {string} */
export function cfs(n) {
  return isNum(n) ? `${num(n)} cfs` : 'no reading';
}

/** "8.1 ft". @param {number} n @returns {string} */
export function feet(n) {
  return isNum(n) ? `${NUM1.format(n)} ft` : '-- ft';
}

/**
 * Plain age: "just now", "4 min ago", "3 h ago", "2 days ago".
 * @param {number} ageMin @returns {string}
 */
export function ago(ageMin) {
  if (!isNum(ageMin)) return 'age not known';
  const m = Math.max(0, Math.round(ageMin));
  if (m < 1) return 'just now';
  if (m < 120) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Hours with one decimal under 10 h, whole hours above: "2.5 h", "14 h". @param {number} h @returns {string} */
export function hours(h) {
  if (!isNum(h)) return '-- h';
  const a = Math.abs(h);
  return a < 10 ? `${NUM1.format(h)} h` : `${num(h)} h`;
}

// ---------------------------------------------------------------------------------------------
// Static labels
// ---------------------------------------------------------------------------------------------

/** Static interface words. */
export const UI = Object.freeze({
  appName: 'Samish River Watch',
  place: 'Samish River at Burlington',
  placeIds: 'USGS 12201500 · NOAA SMRW1',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  themeAuto: 'Theme: auto',
  themeLight: 'Theme: light',
  themeDark: 'Theme: dark',
  themeHint: 'Change color theme',
  about: 'About',
  limits: 'Limits',
  howToRead: 'How to read this',
  close: 'Done',
  skip: 'Skip to the river status',
  statusHeading: 'River status',
  riseHeading: '24-h rise',
  riseStudy: 'study definition',
  crestHeading: 'Peak',
  feedsHeading: 'Feeds',
  feedsHint: 'Show feed ages',
  feedsHide: 'Hide feed ages',
  chartHeading: 'River and forecasts',
  chartRiseHeading: '24-h rise against the season line',
  chartTable: 'Chart values as a table',
  axisFlow: 'Flow, cfs',
  peakCallLabel: 'Peak call',
  basisTableHeading: 'High case and low case',
  sourcesToggle: 'Source files',
  noaaCrestLabel: "NOAA's forecast crest",
  windowLabel: 'Rain clock',
  logListLabel: 'Logged taps, newest first',
  axisRise: '24-h rise, cfs (study definition)',
  crossingHeading: 'Season-line crossing',
  backToLatest: 'Back to latest',
  crestPanelHeading: 'Crest',
  samplingHeading: 'Sampling',
  recordHeading: "NOAA's record",
  basisHeading: 'Our basis',
  logHeading: 'Sample log',
  logExport: 'Export CSV',
  logClear: 'Clear log',
  logClearConfirmTitle: 'Clear the sample log on this phone?',
  logClearConfirmBody: 'This removes every logged tap from this browser. Export a CSV first if you want a copy. It cannot be undone.',
  logClearYes: 'Clear the log',
  logClearNo: 'Keep it',
  undo: 'Undo',
  tapBay: 'Bay sample taken',
  tapCounty: 'County river sample taken',
  tapCall50: 'My call: 50%',
  tapCall80: 'My call: 80%',
  replayBadge: 'Replay',
  basisLink: 'What is this line?',
  gotIt: 'Got it',
  footer: "Private planning view for Taylor Shellfish. Not an official source. Closure status is the Washington State Department of Health's. It sends no messages and claims no forecast skill.",
  colTime: 'Time (PT)',
  colObserved: 'Observed',
  colNoaa: "NOAA's forecast",
  colAligned: 'NOAA aligned',
  colRange: 'Low to high case',
  colRise: '24-h rise',
  colWhat: 'What',
  colStatus: 'Status at the time',
  basisFactorsHeading: 'How far the cases spread',
  basisCoverageHeading: 'How often the river stayed inside',
  basisFizzleHeading: 'When NOAA showed a rise that did not come',
  colLead: 'Hours ahead',
  colRising: 'Rising',
  colLevel: 'Level',
  colBelow: 'Below 150 cfs',
  colNoHigher: 'No higher at that hour',
  colNeverRose: 'Never rose before that hour',
  colPoints: 'Points',
});

/** Names of the four feeds, as shown on the feed dots. */
export const FEED_NAMES = Object.freeze({ gauge: 'Gauge', noaa: 'NOAA', tides: 'Tides', basin: 'Radar' });

/** Longer feed names for the feed-age panel. */
export const FEED_LONG = Object.freeze({
  gauge: 'USGS river gauge 12201500 (provisional)',
  noaa: "NOAA's river forecast for SMRW1",
  tides: 'NOAA predictions at Bellingham 9449211',
  basin: 'Radar rain over the Samish basin (MRMS)',
});

/** Labels for each chart line (also the legend). */
export const LINE_NAMES = Object.freeze({
  observed: 'Observed',
  raw: "NOAA's forecast",
  aligned: 'NOAA aligned to the gauge',
  range: 'High case to low case',
  season: 'Season line',
  now: 'Now',
  latest: 'Latest reading',
});

/** Log tap kinds and their words. */
export const TAP_KINDS = Object.freeze({
  bay: 'Bay sample taken',
  county: 'County river sample taken',
  call50: 'My call: 50%',
  call80: 'My call: 80%',
});

// ---------------------------------------------------------------------------------------------
// Season
// ---------------------------------------------------------------------------------------------

/**
 * Season name for a season-line value.
 * @param {number} lineCfs @returns {string}
 */
export function seasonName(lineCfs) {
  if (lineCfs === 400) return 'Nov–Feb';
  if (lineCfs === 200) return 'Mar–Apr';
  if (lineCfs === 100) return 'May–Oct';
  return 'season not known';
}

/** "Season line 400 cfs (Nov–Feb)". @param {number} lineCfs @returns {string} */
export function seasonLineText(lineCfs) {
  return isNum(lineCfs) ? `Season line ${cfs(lineCfs)} (${seasonName(lineCfs)})` : 'Season line not known';
}

// ---------------------------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------------------------

/**
 * One word for a feed status, shown beside the coloured dot so colour is never the only signal.
 * @param {string} status @returns {string}
 */
export function feedStatusWord(status) {
  switch (status) {
    case 'ok': return 'current';
    case 'stale': return 'old';
    case 'withheld': return 'withheld';
    case 'could_not_read': return 'could not read';
    case 'loading': return 'reading…';
    default: return 'could not read';
  }
}

/**
 * Age line for a feed: "read 22:05 PT (4 min ago)" or "could not read".
 * @param {string} key gauge|noaa|tides|basin
 * @param {{status:string, readT?:number|null, ageMin?:number|null}} feed
 * @param {number} nowMs
 * @returns {string}
 */
export function feedAge(key, feed, nowMs) {
  if (feed && feed.status === 'loading') return 'reading…';
  // A withheld radar feed means the server file is absent (feeds.js maps a 404 to withheld).
  if (feed && feed.status === 'withheld' && key === 'basin') return 'file not available';
  const t = feed ? (isTime(feed.dataT) ? feed.dataT : feed.readT) : null;
  if (!feed || feed.status === 'could_not_read' || !isTime(t)) {
    if (feed && feed.status === 'withheld' && key === 'basin') return 'file not available';
    return 'could not read';
  }
  const verb = key === 'noaa' ? 'issued' : key === 'basin' ? 'newest hour ended' : key === 'tides' ? 'read' : 'reading';
  return `${verb} ${when(t, nowMs)} (${ago(feed.ageMin)})`;
}

/**
 * Why NOAA's forecast is withheld, from the feed's machine reason (CONTRACT.md section 2): issue over 48 h old,
 * an issue time in the future, a path that ends before 24 h ahead, or fewer than 4 points in the next 24 h.
 * @param {string|undefined} reason feeds.js reason or code
 * @returns {string}
 */
export function noaaWithheldReason(reason) {
  const r = String(reason || '').toLowerCase();
  if (/future/.test(r)) return "NOAA's forecast is withheld: its issue time is in the future.";
  if (/48|old|stale/.test(r)) return "NOAA's forecast is withheld: it was issued over 48 h ago.";
  if (/point|few/.test(r)) return "NOAA's forecast is withheld: it has fewer than 4 points in the next 24 h.";
  if (/short|reach|ahead|end|cover|span/.test(r)) return "NOAA's forecast is withheld: its path does not reach 24 h ahead.";
  return "NOAA's forecast is withheld: it was issued over 48 h ago, does not reach 24 h ahead, or has fewer than 4 points in the next 24 h.";
}

/**
 * Radar rain line when the radar file is current: quiet (no solid hour in 48 h) is said in its own words and is
 * never confused with an old or missing file.
 * @param {object} view @returns {string} '' when the radar feed is not current
 */
export function radarNote(view) {
  const r = view && view.radar;
  const b = view && view.feeds ? view.feeds.basin : null;
  if (!r || !b || b.status !== 'ok') return '';
  if (r.quiet) return 'No hour of solid rain over the basin in the last 48 h.';
  if (isTime(r.lastSolidT)) return `Last hour of solid rain over the basin ended ${when(r.lastSolidT, view.nowMs)}.`;
  return '';
}

/**
 * Why a feed is not current, in one sentence (empty string when current).
 * @param {string} key @param {{status:string, reason?:string}} feed @returns {string}
 */
export function feedProblem(key, feed) {
  const s = feed ? feed.status : 'could_not_read';
  if (s === 'ok' || s === 'loading') return '';
  if (key === 'noaa' && (s === 'withheld' || s === 'stale')) return noaaWithheldReason(feed && feed.reason);
  if (key === 'basin' && s === 'stale' && feed && feed.problem === 'gaps') {
    return 'The radar rain record is missing an hour from the last 6 h, so the rain clock and the quiet-rain note are not shown.';
  }
  const m = {
    gauge: {
      stale: 'The gauge has not reported for over 2 h. The history stays on the chart; the aligned line, high case and low case wait for a fresh reading.',
      could_not_read: 'Could not read the USGS gauge. Nothing that depends on it is shown.',
    },
    noaa: {
      could_not_read: "Could not read NOAA's forecast. No forecast lines are shown.",
    },
    tides: {
      stale: 'Tide predictions were read over 36 h ago, so tide times are not shown.',
      withheld: 'Tide predictions are withheld.',
      could_not_read: 'Could not read the tide predictions.',
    },
    basin: {
      stale: 'The newest radar rain hour is over 3 h old, so the rain clock is not shown.',
      withheld: 'The radar rain file is not available, so the rain clock is not shown.',
      could_not_read: 'Could not read radar rain, so the rain clock is not shown.',
    },
  };
  return (m[key] && m[key][s]) || `${FEED_LONG[key] || 'This feed'}: could not read.`;
}

/**
 * Accessible label for one feed dot: "Gauge: current, newest reading 22:00 PT (4 min ago)".
 * @param {string} key @param {object} feed @param {number} nowMs @returns {string}
 */
export function feedDotLabel(key, feed, nowMs) {
  return `${FEED_NAMES[key]}: ${feedStatusWord(feed ? feed.status : 'could_not_read')}, ${feedAge(key, feed, nowMs)}`;
}

// ---------------------------------------------------------------------------------------------
// Status sentence (the hero line; aria-live)
// ---------------------------------------------------------------------------------------------

function gaugeUsable(view) {
  return view.feeds && view.feeds.gauge && view.feeds.gauge.status === 'ok';
}

/**
 * Clock for the call time beside a peak time: "22:45" on the peak's own day, "Wed 00:15" on a later day.
 * PT is written once, after the peak time.
 * @param {number} confirmedT @param {number} peakT @returns {string}
 */
function calledClock(confirmedT, peakT) {
  if (!isTime(confirmedT)) return '';
  return dayKey(confirmedT) === dayKey(peakT) ? clock(confirmedT) : `${WD.format(confirmedT)} ${clock(confirmedT)}`;
}

/**
 * The peak sentence (CONTRACT.md section 3): "Peak reached about 21:00 PT (called at 22:45)."
 * @param {{peakT:number, confirmedT?:number|null, secondPeak?:boolean}} call @param {number} nowMs @returns {string}
 */
export function peakReached(call, nowMs) {
  const lead = call.secondPeak ? 'Second peak reached about' : 'Peak reached about';
  const c = calledClock(call.confirmedT, call.peakT);
  return `${lead} ${when(call.peakT, nowMs)}${c ? ` (called at ${c})` : ''}.`;
}

function riverPart(view) {
  const g = view.feeds ? view.feeds.gauge : null;
  const latest = view.observed ? view.observed.latest : null;
  if (!g || g.status === 'loading') return 'Reading the river gauge.';
  if (g.status === 'could_not_read' || !latest) return 'Could not read the river gauge.';
  if (g.status === 'stale') return `The river gauge has not reported since ${when(latest.t, view.nowMs)}.`;
  const p = view.peak || {};
  const call = p.call || null;
  if (p.unavailable) return 'River reading is current. Peak tracking is not available.';
  // The peak time and call time live in the crest strip (CONTRACT.md section 5(3)); the hero line only says where the river is.
  if (p.state === 'called' && call) return call.secondPeak ? 'River below its second peak.' : 'River below its called peak.';
  if (p.state === 'rising') {
    if (call && call.premature) return 'River rising past the earlier peak call.';
    if (call && call.secondPeak) return 'River rising again: a second peak is building.';
    return 'River rising.';
  }
  return 'No rise under way.';
}

function observedLinePart(view) {
  const o = view.observed || {};
  if (!o.latest || !(view.feeds && view.feeds.gauge && (view.feeds.gauge.status === 'ok' || view.feeds.gauge.status === 'stale'))) return '';
  const stale = view.feeds.gauge.status === 'stale';
  if (o.overLine) return stale ? 'At that reading it was over the season line.' : 'It is over the season line.';
  if (isTime(o.crossT)) return `It crossed the season line ${when(o.crossT, view.nowMs)}.`;
  return '';
}

/**
 * Tense of a forecast crossing time: null (no crossing), 'already' (at or before the last gauge reading), 'passed'
 * (after the last reading but at or before now: the gauge has not reported since, so the page cannot say whether it
 * happened), or the day and time when it is still ahead.
 */
function crossingWhen(t, view) {
  const latestT = view.observed && view.observed.latest ? view.observed.latest.t : view.nowMs;
  if (!isTime(t)) return null;
  if (t <= latestT) return 'already';
  if (t <= view.nowMs) return 'passed';
  return dayTime(t);
}

function noaaPart(view) {
  const f = view.forecast || {};
  const n = view.feeds ? view.feeds.noaa : null;
  if (!n || n.status === 'loading') return '';
  if (n.status === 'could_not_read') return "Could not read NOAA's forecast.";
  if (n.status !== 'ok' || f.status !== 'ok') return "NOAA's forecast is withheld.";
  const t = f.crossings ? f.crossings.raw : null;
  const w = crossingWhen(t, view);
  if (w === null) return 'NOAA shows no season-line crossing.';
  if (w === 'already') return view.observed && view.observed.overLine ? '' : 'NOAA shows the river over the season line.';
  if (w === 'passed') return `NOAA's forecast had the river reaching the season line at ${when(t, view.nowMs)}, after the last gauge reading.`;
  return `NOAA's forecast crosses the season line ${w}.`;
}

function casesPart(view) {
  const f = view.forecast || {};
  if (f.status !== 'ok' || f.edges !== 'shown' || !gaugeUsable(view)) return '';
  const hiT = f.crossings ? f.crossings.high : null;
  const loT = f.crossings ? f.crossings.low : null;
  const hi = crossingWhen(hiT, view);
  const lo = crossingWhen(loT, view);
  if (hi === null) return 'Our high case stays below the line.';
  if (hi === 'already') return '';
  if (hi === 'passed') return `Our high case reached the line at ${when(hiT, view.nowMs)}, after the last gauge reading.`;
  if (lo === 'passed') return `Our high case crosses ${hi}; our low case reached it at ${when(loT, view.nowMs)}, after the last gauge reading.`;
  if (lo !== null && lo !== 'already') return `Our high case crosses ${hi}; our low case ${lo}.`;
  return `Our high case crosses ${hi}.`;
}

/**
 * The status sentence, e.g. "River rising. NOAA shows no season-line crossing. Our high case crosses Wed 22:00 PT."
 * @param {object} view the immutable view built by app.js
 * @returns {string}
 */
export function statusSentence(view) {
  if (!view || view.loading) return 'Reading the river…';
  return [riverPart(view), observedLinePart(view), noaaPart(view), casesPart(view)].filter(Boolean).join(' ');
}

/**
 * The line under the status sentence: "Checked 22:05 PT · newest gauge reading 22:00 PT".
 * @param {object} view @returns {string}
 */
export function statusTime(view) {
  if (!view || view.loading) return 'Reading the feeds…';
  const latest = view.observed ? view.observed.latest : null;
  const g = view.feeds ? view.feeds.gauge : null;
  const parts = [`Checked ${when(view.builtMs ?? view.nowMs, view.nowMs)}`];
  if (latest && (!g || g.status !== 'ok')) parts.push(`gauge reading ${when(latest.t, view.nowMs)}`);
  return parts.join(' · ');
}

/**
 * Season-line chip: {word, detail, state}.
 * @param {object} view @returns {{state:'crossed'|'not_crossed'|'unknown', word:string, detail:string}}
 */
export function lineChip(view) {
  const o = view && view.observed;
  if (!o || !o.latest) return { state: 'unknown', word: 'Season line: no reading', detail: '' };
  if (o.overLine || isTime(o.crossT)) {
    return { state: 'crossed', word: 'Line crossed', detail: isTime(o.crossT) ? when(o.crossT, view.nowMs) : '' };
  }
  const g = view.feeds ? view.feeds.gauge : null;
  if (g && g.status === 'stale') return { state: 'unknown', word: 'Not crossed', detail: `as of ${when(o.latest.t, view.nowMs)}` };
  return { state: 'not_crossed', word: 'Not crossed', detail: 'last 72 h' };
}

// ---------------------------------------------------------------------------------------------
// Observed rise card
// ---------------------------------------------------------------------------------------------

/**
 * Words for the observed-rise card.
 * @param {object} view
 * @returns {{value:string, unit:string, label:string, compare:string, line:string, flow:string, age:string, stale:boolean, missing:boolean}}
 */
export function riseCard(view) {
  const g = view.feeds ? view.feeds.gauge : null;
  const o = view.observed || {};
  const line = view.season ? view.season.lineCfs : null;
  const age = feedAge('gauge', g, view.nowMs);
  const label = `${UI.riseHeading} (${UI.riseStudy})`;
  const lineText = seasonLineText(line);
  if (!g || g.status === 'could_not_read' || !o.latest) {
    return { value: '', unit: '', label, compare: 'Could not read the river gauge.', line: lineText, flow: '', age, stale: false, missing: true };
  }
  const stale = g.status === 'stale';
  const r = o.riseCfs;
  let compare;
  if (!isNum(r)) compare = 'Not enough readings in the last 24 h for a rise.';
  else if (isNum(line) && r >= line) compare = `Over the line by ${cfs(r - line)}.`;
  else if (isNum(line)) compare = `${cfs(line - r)} below the line.`;
  else compare = '';
  if (stale) compare = `As of ${when(o.latest.t, view.nowMs)}. ${compare}`;
  return {
    value: isNum(r) ? num(r) : '--',
    unit: 'cfs',
    label,
    compare,
    line: lineText,
    flow: `Flow ${cfs(o.latest.cfs)}`,
    age,
    stale,
    missing: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Crest strip (above the fold) and crest panel (below)
// ---------------------------------------------------------------------------------------------

/**
 * Words for the crest strip.
 * @param {object} view
 * @returns {{state:string, title:string, detail:string, record:string, tide:string}}
 */
export function crestStrip(view) {
  const g = view.feeds ? view.feeds.gauge : null;
  const p = view.peak || {};
  const call = p.call || null;
  const record = peakCallRecord(view);
  const tide = tideWindowText(view);
  if (!g || g.status === 'could_not_read') {
    return { state: 'paused', title: 'Peak call paused.', detail: 'Could not read the river gauge.', record, tide: '' };
  }
  if (g.status === 'stale') {
    const latest = view.observed ? view.observed.latest : null;
    return { state: 'paused', title: 'Peak call paused.', detail: `No fresh gauge reading since ${latest ? when(latest.t, view.nowMs) : 'the last read'}.`, record, tide: '' };
  }
  if (p.unavailable) return { state: 'paused', title: 'Peak tracking is not available.', detail: '', record: '', tide: '' };
  if (p.state === 'called' && call) {
    return {
      state: 'called',
      title: `${peakReached(call, view.nowMs)} Can still be exceeded.`,
      detail: isNum(call.peakCfs) ? `Peak flow ${cfs(call.peakCfs)}.` : '',
      record,
      tide,
    };
  }
  if (p.state === 'rising') {
    let detail = p.high ? `Running high ${cfs(p.high.cfs)} at ${when(p.high.t, view.nowMs)}.` : '';
    if (call && call.premature) detail = `Earlier peak call was premature; river rose higher. ${detail}`.trim();
    else if (call && call.secondPeak) detail = `Second peak: the river rose again more than 12 h after the last call. ${detail}`.trim();
    return { state: 'rising', title: 'Still rising. Peak call not made.', detail, record, tide: '' };
  }
  return { state: 'none', title: 'No rise under way', detail: '', record: '', tide: '' };
}

/**
 * Tide window line shown when a call exists: "Taylor's target about 03:00 PT · next high tide 04:12 PT, 8.1 ft (NOAA predictions at Bellingham)".
 * @param {object} view @returns {string}
 */
export function tideWindowText(view) {
  const s = view.sampling;
  if (!s || !s.card || !isTime(s.card.targetT)) return '';
  const target = `Taylor's target about ${when(s.card.targetT, view.nowMs)}`;
  const t = view.feeds ? view.feeds.tides : null;
  if (!t || t.status !== 'ok') return `${target} · tide times not shown (${feedStatusWord(t ? t.status : 'could_not_read')})`;
  const n = s.card.nextTideAfterTarget;
  if (!n) return `${target} · no tide prediction after it was read`;
  return `${target} · next ${n.type === 'H' ? 'high' : 'low'} tide ${when(n.t, view.nowMs)}, ${feet(n.ft)} (${tideSource(view)})`;
}

/** Whether the tides on screen are a replay's synthetic tides (the replay banner says so too). @param {object} view @returns {boolean} */
function syntheticTides(view) {
  return Boolean(view && view.fixtureNotes && view.fixtureNotes.syntheticTides);
}

/** Label beside a tide time. @param {object} view @returns {string} */
function tideSource(view) {
  return syntheticTides(view) ? 'synthetic replay tide' : 'NOAA predictions at Bellingham';
}

/**
 * NOAA crest value: "1,480 cfs at Thu 04:00 PT", or why there is none. A path already falling at the look time
 * has no crest ahead (crest.noaaCrest sets fallingFromNow); a path still rising at 72 h has its crest beyond the
 * span the page reads (risingAt72h); a path that ends without a lower point after its highest has no crest in the
 * forecast (noTurn: still rising or level at its last point), and its last point is never called a crest.
 * @param {object} view @returns {string}
 */
export function noaaCrestValue(view) {
  const f = view.forecast || {};
  const n = view.feeds ? view.feeds.noaa : null;
  if (!n || n.status === 'could_not_read') return "Could not read NOAA's forecast.";
  if (n.status !== 'ok' || f.status !== 'ok') return 'Withheld with the forecast.';
  const c = f.noaaCrest;
  if (!c) return 'None in the next 72 h.';
  if (c.fallingFromNow) return `None ahead. NOAA's path falls from ${cfs(c.cfs)} now.`;
  if (c.risingAt72h) return `Beyond the next 72 h. NOAA's path is still rising at ${cfs(c.cfs)} at ${dayTime(c.t)}.`;
  // No turn before the path ends: its last point is not a crest (external review 2026-10-19), so no crest time or height.
  if (c.noTurn === 'rising') return `NOAA's path is still rising at its last point (${dayTime(c.t)}); no crest within the forecast.`;
  if (c.noTurn === 'flat') return `NOAA's path is level at its last point (${dayTime(c.t)}); no crest within the forecast.`;
  return `${cfs(c.cfs)} at ${dayTime(c.t)}.`;
}

/**
 * NOAA crest line: "NOAA's forecast crest: 1,480 cfs at Thu 04:00 PT."
 * @param {object} view @returns {string}
 */
export function noaaCrestText(view) {
  return `${UI.noaaCrestLabel}: ${noaaCrestValue(view)}`;
}

/**
 * The rain clock after rain eases, or why it is not shown. Its counts are the partner study's REAL-TIME look back
 * (Q9 part 5: at past hours when rain had eased and the river had not yet peaked). The hindsight figure ("87% of 89
 * storms within 8 hours, most often about 2 hours after") was withdrawn on 2026-10-19 and is never shown, and no
 * time is ever called "likely" or "latest".
 * @param {object} view
 * @returns {{shown:boolean, lead:string, times:string, timesNote:string, basis:string, reason:string, passed:boolean}}
 */
export function crestWindow(view) {
  const w = view.crest ? view.crest.window : null;
  const basin = view.feeds ? view.feeds.basin : null;
  const off = (reason) => ({ shown: false, lead: '', times: '', timesNote: '', basis: '', reason, passed: false });
  const episode = view.peak && view.peak.episode;
  if (!episode) return off('The rain clock is shown only during a rise.');
  if (!basin || basin.status === 'could_not_read') return off(feedProblem('basin', { status: 'could_not_read' }));
  if (basin.status !== 'ok') return off(feedProblem('basin', basin));
  if (!w || w.withheld) {
    const code = w ? w.reason : '';
    if ((code === 'rain_not_eased' || !code) && view.radar && view.radar.quiet) {
      return off('No hour of solid rain over the basin in the last 48 h, so there is no rain end to count from.');
    }
    return off(windowReason(code));
  }
  const eased = isTime(w.easedT) ? w.easedT : null;
  const mark = isTime(w.medianT) ? w.medianT : null;
  if (eased === null || mark === null) return off(windowReason(''));
  const markH = num((mark - eased) / 3_600_000);
  const passed = mark <= view.nowMs;
  return {
    shown: true,
    lead: `Rain over the basin eased at ${when(eased, view.nowMs)}.`,
    times: passed ? `${markH} h after that: ${when(mark, view.nowMs)} (passed).` : `${markH} h after that: ${when(mark, view.nowMs)}.`,
    timesNote: passed ? 'The peak can still come later.' : 'In past storms the peak came later than this about half the time.',
    basis: rainClockBasis(view),
    reason: '',
    passed,
  };
}

/**
 * The rain clock's basis line from records.json (real-time counts only), or a plain note when the record file is missing.
 * @param {object} view @returns {string}
 */
export function rainClockBasis(view) {
  const med = recordValue(view, 'rain_clock_median_h');
  const storms = recordValue(view, 'rain_clock_storms_n');
  const back = recordValue(view, 'rain_clock_rain_returned_n');
  const late = recordValue(view, 'rain_clock_more_than_8h_pct');
  if ([med, storms, back, late].some((x) => x === null)) return 'The past counts behind this are in the record file, which could not be read.';
  // The study's definition of "eased" is stated beside its counts, and the radar's known miss is said in the same place
  // (second refuting pass 2026-10-19: the counts belong to a one-hour wait and to archive rain, not radar).
  const share = recordValue(view, 'radar_solid_hours_share_pct');
  const radar = share === null
    ? 'Radar finds fewer solid-rain hours than the archive did, so the rain end shown here can come earlier than the study’s.'
    : `Radar found solid rain in ${num(share)}% of the hours the archive did, so the rain end shown here can come earlier than the study’s.`;
  return `In ${num(storms)} past storms (2016 to 2023, archive rain), at hours when rain had eased (an hour under 1 mm after the last hour of 1 mm or more), the peak came a median ${num(med)} hours after the rain end shown, and more than 8 hours after it in ${num(late)}% of those hours. In ${num(back)} of those ${num(storms)} storms solid rain came back before the peak. ${radar}`;
}

/**
 * Map a crest.js withheld reason (machine text) to a sentence from this module.
 * @param {string} reason @returns {string}
 */
export function windowReason(reason) {
  const codes = {
    no_episode: 'The rain clock is shown only during a rise.',
    radar_missing: feedProblem('basin', { status: 'could_not_read' }),
    radar_could_not_read: feedProblem('basin', { status: 'could_not_read' }),
    radar_withheld: feedProblem('basin', { status: 'withheld' }),
    radar_stale: feedProblem('basin', { status: 'stale' }),
    radar_incomplete: 'Radar rain hours are missing since the rain eased, so the rain clock is not shown.',
    rain_not_eased: 'Rain has not eased over the basin yet, so the rain clock waits.',
    rain_end_before_rise: 'Radar has not shown rain easing since this rise began, so the rain clock waits.',
    rain_end_in_future: 'The radar rain end time is not usable, so the rain clock is not shown.',
    unavailable: 'The rain clock is not available right now.',
  };
  if (Object.prototype.hasOwnProperty.call(codes, reason)) return codes[reason];
  const r = String(reason || '').toLowerCase();
  if (/stale|old|fresh|age/.test(r)) return feedProblem('basin', { status: 'stale' });
  if (/missing|absent|could|read|parse|shape/.test(r)) return feedProblem('basin', { status: 'could_not_read' });
  if (/before|episode start|earlier/.test(r)) return 'Radar has not shown rain easing since this rise began, so the rain clock waits.';
  if (/ease|end|solid|null|rain/.test(r)) return 'Rain has not eased over the basin yet, so the rain clock waits.';
  if (/episode|rise/.test(r)) return 'The rain clock is shown only during a rise.';
  return 'The rain clock is not shown right now.';
}

// ---------------------------------------------------------------------------------------------
// Crossing reading (below the chart)
// ---------------------------------------------------------------------------------------------

function crossingWord(t, view) {
  const w = crossingWhen(t, view);
  if (w === null) return 'stays below';
  if (w === 'already') return 'already over';
  if (w === 'passed') return `reached ${dayTime(t)} (after the last reading)`;
  return w;
}

/**
 * The one-line crossing reading, e.g. "NOAA Thu 06:00 PT | high case Wed 22:00 PT | low case stays below".
 * @param {object} view
 * @returns {{line:string, aligned:string, note:string}}
 */
export function crossingReading(view) {
  const f = view.forecast || {};
  const n = view.feeds ? view.feeds.noaa : null;
  if (!n || n.status === 'could_not_read') return { line: "Could not read NOAA's forecast, so no crossing times are shown.", aligned: '', note: '' };
  // The feed's own status decides as well: a re-aged cached view can hold a forecast whose feed is now withheld.
  if (n.status !== 'ok' || f.status !== 'ok') return { line: "NOAA's forecast is withheld, so no crossing times are shown.", aligned: '', note: '' };
  if (view.observed && view.observed.overLine && gaugeUsable(view)) {
    return { line: 'The river is over the season line now, so no forecast crossing times are shown.', aligned: '', note: '' };
  }
  const c = f.crossings || {};
  const parts = [`NOAA ${crossingWord(c.raw, view)}`];
  let note = '';
  if (f.edges === 'shown') {
    parts.push(`high case ${crossingWord(c.high, view)}`, `low case ${crossingWord(c.low, view)}`);
  } else {
    note = edgesNote(f.edges);
  }
  const aligned = f.aligned === 'shown' ? `NOAA aligned to the gauge: ${crossingWord(c.aligned, view)}.` : '';
  return { line: parts.join(' | '), aligned, note };
}

/**
 * Why the high and low cases are not drawn, in plain words.
 * @param {string} edges shown|noaa_withheld|noaa_could_not_read|no_forecast|off_season|gauge_stale|gauge_missing|no_table|unavailable
 * @returns {string}
 */
export function edgesNote(edges) {
  switch (edges) {
    case 'shown': return '';
    case 'noaa_withheld':
    case 'no_forecast': return "High and low cases are not drawn: they are built on NOAA's forecast, which is withheld.";
    case 'noaa_could_not_read': return "High and low cases are not drawn: they are built on NOAA's forecast, which could not be read.";
    case 'off_season': return 'High and low cases are drawn Oct–Apr only, the months the past-miss table covers. NOAA and the aligned line are shown.';
    case 'gauge_stale': return 'High and low cases wait for a fresh gauge reading.';
    case 'gauge_missing': return 'High and low cases need a gauge reading.';
    case 'no_table': return 'Could not read the past-miss table, so high and low cases are not drawn.';
    default: return 'High and low cases are not available right now.';
  }
}

/**
 * One line under the chart legend saying why the high-to-low range is missing ('' when it is drawn).
 * @param {object} view @returns {string}
 */
export function rangeNote(view) {
  const f = (view && view.forecast) || {};
  if (!f.edges || f.edges === 'shown') return '';
  return edgesNote(f.edges);
}

// ---------------------------------------------------------------------------------------------
// Sampling card
// ---------------------------------------------------------------------------------------------

/**
 * Words for the sampling card.
 * @param {object} view
 * @returns {{visible:boolean, big:string, bigLabel:string, target:string, tide:string, tideNote:string, counter:string, counterNote:string, hidden:string}}
 */
export function samplingCard(view) {
  const s = view.sampling || {};
  const counter = sampleCounter(view.log ? view.log.seasonCount : 0);
  const counterNote = 'Counts bay-sample taps on this phone since Oct 1, 00:00 PT.';
  const tideNote = syntheticTides(view)
    ? 'Synthetic replay tides, made up for this replay; not NOAA predictions and not Samish Bay water level.'
    : 'NOAA predictions at Bellingham, feet above MLLW; not Samish Bay water level.';
  const base = { counter, counterNote, tideNote, pending: false };
  if (!s.visible) {
    return { ...base, visible: false, big: '', bigLabel: '', target: '', tide: '', hidden: 'The sampling card appears during a rise or within 48 h of a peak call. You can still log a sample below.' };
  }
  const card = s.card;
  if (!card) {
    // Never a bare "--" (CONTRACT.md section 1): say what the card is waiting for.
    return { ...base, visible: true, pending: true, big: 'Waiting', bigLabel: 'for the peak call', target: "Peak not called yet. Taylor's target: about 6 h after the peak.", tide: '', hidden: '' };
  }
  const passed = isTime(card.targetT) && card.targetT <= view.nowMs;
  const target = passed
    ? `Taylor's target (about 6 h after the peak) passed at ${when(card.targetT, view.nowMs)}.`
    : `Taylor's target: about 6 h after the peak, ${when(card.targetT, view.nowMs)}.`;
  const t = view.feeds ? view.feeds.tides : null;
  let tide;
  if (!t || t.status === 'could_not_read') tide = 'Could not read the tide predictions.';
  else if (t.status !== 'ok') tide = feedProblem('tides', t);
  else if (!card.nextTideAfterTarget) tide = 'No tide prediction after the target time.';
  else {
    const n = card.nextTideAfterTarget;
    tide = `Next ${n.type === 'H' ? 'high' : 'low'} tide after the target: ${when(n.t, view.nowMs)}, ${feet(n.ft)}.`;
  }
  const peakAt = isTime(card.peakT) ? ` (${when(card.peakT, view.nowMs)})` : '';
  return { ...base, visible: true, big: hours(card.hoursSinceCall), bigLabel: `since the peak${peakAt}`, target, tide, hidden: '' };
}

/**
 * "3 of 15 storm-response samples banked this water year (from Oct 1)" (CONTRACT.md section 3).
 * @param {number} n bay-sample taps since the most recent Oct 1, 00:00 PT @returns {string}
 */
export function sampleCounter(n) {
  const k = isNum(n) ? Math.max(0, Math.round(n)) : 0;
  return `${k} of 15 storm-response samples banked this water year (from Oct 1)`;
}

// ---------------------------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------------------------

/**
 * Words for the log section.
 * @param {{available:boolean, entries:any[], replay?:boolean}} log
 * @returns {{empty:string, unavailable:string, note:string}}
 */
export function logText(log) {
  return {
    empty: 'No taps logged on this phone yet.',
    unavailable: 'This browser is not letting the page store taps right now. Taps will not be kept.',
    note: log && log.replay
      ? 'Replay: taps go to a separate replay log, not your season log.'
      : 'Taps stay on this phone only. Nothing leaves the browser.',
  };
}

/**
 * Toast after a tap: "Bay sample taken logged at 22:14 PT."
 * @param {string} kind @param {number} t @param {number} nowMs @returns {string}
 */
export function tapLogged(kind, t, nowMs) {
  return `Logged: ${TAP_KINDS[kind] || 'tap'}, ${when(t, nowMs)}.`;
}

/** Toast after undo. @returns {string} */
export function tapUndone() {
  return 'Removed the last tap.';
}

/** Message after export or clear. @param {'exported'|'cleared'|'nothing'|'failed'} what @param {number} [n] @returns {string} */
export function logMessage(what, n) {
  if (what === 'exported') return `Prepared a CSV of ${num(n)} tap${n === 1 ? '' : 's'}.`;
  if (what === 'cleared') return 'The log on this phone is now empty.';
  if (what === 'nothing') return 'There is nothing to export yet.';
  return 'This browser did not keep that change.';
}

/** CSV header row (export). @type {readonly string[]} */
export const CSV_HEADER = Object.freeze([
  'time_pt', 'time_utc', 'tap', 'status_sentence', 'gauge_cfs', 'rise_24h_cfs', 'season_line_cfs', 'peak_call_pt', 'noaa_issued_pt', 'mode',
]);

// ---------------------------------------------------------------------------------------------
// Records (NOAA's record, our basis) from records.json
// ---------------------------------------------------------------------------------------------

function recordList(view) {
  const r = view && view.records;
  if (!r) return [];
  if (Array.isArray(r)) return r;
  if (Array.isArray(r.entries)) return r.entries;
  if (Array.isArray(r.records)) return r.records;
  return [];
}

function recordEntry(view, id) {
  return recordList(view).find((x) => x && x.id === id) || null;
}

/** Numeric value of one record by id, or null. @param {object} view @param {string} id @returns {number|null} */
export function recordValue(view, id) {
  const e = recordEntry(view, id);
  const v = e ? (typeof e.value === 'string' ? Number(e.value) : e.value) : null;
  return isNum(v) ? v : null;
}

/**
 * Sentence of one record by id (records.json `sentence`), or '' when missing or worded against the rules.
 * @param {object} view @param {string} id @returns {string}
 */
export function recordText(view, id) {
  const e = recordEntry(view, id);
  if (e && e.display === 'never') return '';
  const t = e ? (typeof e.sentence === 'string' ? e.sentence : typeof e.text === 'string' ? e.text : '') : '';
  return t && !findForbidden(t).length ? t : '';
}

/** Short display form of a record's source path: Lab paths from the repo root, local paths as given. */
export function sourceLabel(path) {
  if (typeof path !== 'string' || !path) return '';
  const p = path.split('\\').join('/');
  const i = p.indexOf('/projects/');
  return i >= 0 ? `Lab: ${p.slice(i + '/projects/'.length)}` : p;
}

/** File name of a record's source path ("HYPOTHESES_LEDGER.json"). @param {string} path @returns {string} */
export function sourceName(path) {
  const p = sourceLabel(path);
  const parts = p.split('/').filter(Boolean);
  const name = parts.pop() || p;
  // A generic file name (several studies each have a RESULT.md) keeps its folder so two sources never read the same.
  return GENERIC_SOURCE_NAMES.includes(name) && parts.length ? `${parts.pop()}/${name}` : name;
}

/** File names that say nothing on their own; sourceName adds the folder. */
const GENERIC_SOURCE_NAMES = Object.freeze(['RESULT.md', 'RESULT.json', 'SPEC.md', 'BRIEF.md', 'README.md']);

/**
 * Unique full source paths of a list of record items, for the "Source files" disclosure.
 * @param {{path?:string}[]} items @returns {string[]}
 */
export function sourcePaths(items) {
  return [...new Set(items.map((i) => i.path).filter(Boolean))];
}

/**
 * One shared source line for a list whose items all cite the same file ("Source for all: q1b_test_result.json"), or ''
 * when the items cite different files (each item then keeps its own source line).
 * @param {{source?:string}[]} items @returns {string}
 */
export function sharedSource(items) {
  const list = Array.isArray(items) ? items : [];
  const s = [...new Set(list.map((i) => i.source || ''))];
  if (list.length < 2 || s.length !== 1 || !s[0]) return '';
  return s[0].replace(/^Source: /, 'Source for all: ');
}

/** Records shown under "NOAA's record", in order (a lead-time sentence is deliberately left out). */
export const NOAA_RECORD_IDS = Object.freeze([
  'noaa_rise_warned_n', 'noaa_72h_false_ratio', 'noaa_crest_6h_0_24_event', 'noaa_crest_6h_24_48_event',
  'noaa_crest_6h_48_72_event', 'noaa_peak_within_25pct_h',
]);

/** Records shown under "Our basis", grouped. A group's note is a plain caveat shown with it (no number of its own). */
export const BASIS_RECORD_GROUPS = Object.freeze([
  { heading: 'Peak call', ids: ['peak_call_storms_n', 'peak_call_within3h_pct', 'peak_call_median_delay_h', 'peak_call_premature_pct', 'peak_second_peak_pct'] },
  { heading: 'Rain clock', ids: ['rain_clock_median_h', 'rain_clock_more_than_8h_pct', 'rain_clock_rain_returned_n', 'rain_clock_period', 'radar_solid_hours_share_pct', 'crest_late_caution_n', 'radar_match_r'] },
  {
    heading: 'County river samples at one site (site 32), by time since the peak',
    ids: ['county_pass_rising_pct', 'county_pass_0_6h_pct', 'county_pass_6_24h_pct', 'county_pass_24_72h_pct'],
    note: "These are samples from one county site, taken when the county chose, so their timing goes with storm size and with how long a closure had lasted. The county's pass test uses bacteria times flow, so lower flow after the peak raises the pass share by itself. The peaks and rises behind the time bins follow this page's study definitions, not the state's rule. These are past county choices, not advice on when to sample, and no line on this page rests on them.",
  },
]);

function recordItems(view, ids) {
  return ids
    .map((id) => ({ id, text: recordText(view, id), e: recordEntry(view, id) }))
    .filter((x) => x.text)
    .map((x) => ({ text: x.text, source: x.e && x.e.source_path ? `Source: ${sourceName(x.e.source_path)}` : '', path: x.e && x.e.source_path ? sourceLabel(x.e.source_path) : '' }));
}

/**
 * Lines for "NOAA's record". Each line carries its source path so the basis is one tap away.
 * @param {object} view @returns {{items:{text:string, source:string}[], empty:string}}
 */
export function noaaRecord(view) {
  const items = recordItems(view, NOAA_RECORD_IDS);
  let empty = '';
  if (view && view.recordsStatus === 'could_not_read') empty = 'Could not read the record file.';
  else if (!items.length) empty = "NOAA's record is not in the record file.";
  return { items, empty };
}

/**
 * Groups for "Our basis" from records.json.
 * @param {object} view @returns {{groups:{heading:string, items:{text:string, source:string}[]}[], empty:string}}
 */
export function basisRecords(view) {
  const groups = BASIS_RECORD_GROUPS.map((g) => ({ heading: g.heading, items: recordItems(view, g.ids), note: g.note || '' })).filter((g) => g.items.length);
  const empty = view && view.recordsStatus === 'could_not_read' ? 'Could not read the record file.' : '';
  return { groups, empty };
}

/**
 * The record line under the crest strip: how the peak-call rule did on past storms.
 * @param {object} view @returns {string}
 */
export function peakCallRecord(view) {
  return [recordText(view, 'peak_call_within3h_pct'), recordText(view, 'peak_call_premature_pct')].filter(Boolean).join(' ');
}

/** The one-line basis of the high and low cases (CONTRACT.md section 4 requires this sentence). */
export const RANGE_BASIS = "range of past misses around NOAA's forecast";

const pct = (share) => (isNum(share) ? `${Math.round(share * 100)}%` : '--');
const countPct = (c) => `${num(c.inside)} of ${num(c.n)} (${pct(c.inside / c.n)})`;
const okCount = (c) => Boolean(c && isNum(c.inside) && isNum(c.n) && c.n > 0);
const factorPair = (p) => (p && isNum(p.low) && isNum(p.high) ? `${p.low.toFixed(2)}–${p.high.toFixed(2)}` : '–');
const leadLabel = (lo, hi) => `${num(lo)}–${num(hi)} h`;
const binLabel = (bin) => `${String(bin).replace('-', '–')} h`;

/**
 * Our basis drawn from the frozen past-miss table (counts and the table's own shares, never a rate of our own).
 * Accepts the summary app.js builds (summarizeTable) or a raw table with the same field names.
 * @param {object|null} table summarized ratio_table.json
 * @returns {string[]}
 */
export function tableBasis(table) {
  if (!table) return ['Could not read the past-miss table, so the basis of the high and low cases is not shown.'];
  const span = Array.isArray(table.training_issue_span) ? table.training_issue_span : [];
  const asDate = (v) => (typeof v === 'string' ? longDate(Date.parse(v.replace(' ', 'T'))) : '');
  const storm = isNum(table.storm_flow_cfs) ? table.storm_flow_cfs : null;
  const floor = isNum(table.rise_floor_cfs) ? table.rise_floor_cfs : null;
  const pc = table.pooled_coverage || (table.coverage && table.coverage.pooled) || null;
  return [
    `Our high and low cases are the ${RANGE_BASIS}. NOAA's path is aligned to the gauge, then widened by how far the river ended up from it in past wet-season forecasts (Oct–Apr).`,
    span.length === 2 ? `Built from NOAA forecasts issued ${asDate(span[0])} to ${asDate(span[1])}, all before Oct 6, 2026.` : '',
    storm !== null && floor !== null
      ? `Where the aligned path is at least ${cfs(storm)}, it is multiplied by a low and a high factor: the rising pair when the path is at least ${cfs(floor)} above the latest reading, the level pair otherwise. Below ${cfs(storm)} it is widened by a fixed number of cfs.`
      : '',
    okCount(pc) ? `Checked one water year at a time, the river stayed between the high and low cases at ${num(pc.inside)} of ${num(pc.n)} forecast points (${pct(pc.inside / pc.n)}).` : '',
    'Points within one storm are not independent, so these counts overstate how much evidence there is.',
    'The range is built for a forecast about 3 h old. It covers less as NOAA’s forecast ages.',
  ].filter(Boolean);
}

/**
 * The factor table for OUR BASIS: hours ahead, the rising pair, the level pair and the fixed widening below the
 * storm flow, copied from the table (rounded to 2 decimals and whole cfs).
 * @param {object|null} table summarized ratio_table.json
 * @returns {{caption:string, head:string[], rows:string[][]}|null} null when the table has no v3 factors
 */
export function basisFactors(table) {
  const f = table && Array.isArray(table.factors) ? table.factors.filter((x) => x && (x.rise || x.flat)) : [];
  if (!f.length) return null;
  const storm = isNum(table.storm_flow_cfs) ? table.storm_flow_cfs : 150;
  return {
    caption: `Low and high factors that multiply NOAA's aligned path. Rising: the path is at least ${cfs(table.rise_floor_cfs ?? 50)} above the latest reading. Below ${cfs(storm)}: plus or minus a fixed amount.`,
    head: [UI.colLead, UI.colRising, UI.colLevel, UI.colBelow],
    rows: f.map((x) => [leadLabel(x.lead_lo_h, x.lead_hi_h), factorPair(x.rise), factorPair(x.flat), isNum(x.add_cfs) ? `±${num(x.add_cfs)} cfs` : '–']),
  };
}

/**
 * Coverage lines for OUR BASIS: pooled, rising and level paths, NOAA rises of 200 cfs or more, the rising-path
 * range across hours ahead, and how coverage falls as NOAA's forecast ages. Every number is the table's own.
 * @param {object|null} table summarized ratio_table.json
 * @returns {string[]}
 */
export function basisCoverage(table) {
  const c = table && table.coverage;
  if (!c) return [];
  const out = [];
  if (okCount(c.pooled)) out.push(`All past points, each water year left out of the build in turn: ${countPct(c.pooled)}.`);
  if (okCount(c.rise) && okCount(c.flat)) out.push(`Rising path: ${countPct(c.rise)}. Level path: ${countPct(c.flat)}.`);
  if (okCount(c.rise_ge_200)) out.push(`When NOAA showed a rise of 200 cfs or more: ${countPct(c.rise_ge_200)}. Big rises land outside more often.`);
  const rb = Array.isArray(c.rise_bins) ? c.rise_bins.filter((x) => isNum(x.share)) : [];
  if (rb.length >= 2) {
    const lo = Math.min(...rb.map((x) => x.share));
    const hi = Math.max(...rb.map((x) => x.share));
    out.push(`Rising path by hours ahead: ${pct(lo)} to ${pct(hi)} in every 12-hour step out to 72 h.`);
  }
  const age = Array.isArray(table.coverage_by_age) ? table.coverage_by_age : [];
  if (age.length >= 2) {
    out.push(`It covers less as NOAA's forecast ages: ${age.map((x) => `${pct(x.share)} at ${num(x.age_h)} h old`).join(', ')}.`);
  }
  return out;
}

/**
 * Fizzle counts for OUR BASIS, with the contract's two exact wordings. Shown as counts, never drawn as a line.
 * @param {object|null} table summarized ratio_table.json
 * @returns {{intro:string, head:string[], rows:string[][], note:string}|null}
 */
export function basisFizzle(table) {
  const f = table && Array.isArray(table.fizzle) ? table.fizzle : [];
  if (!f.length) return null;
  return {
    intro: 'Past rising-path points where the river was no higher than its starting flow at that hour, and points where it never rose above its starting flow before that hour.',
    head: [UI.colLead, UI.colNoHigher, UI.colNeverRose, UI.colPoints],
    rows: f.map((x) => [binLabel(x.bin), pct(x.no_higher), pct(x.never_rose), num(x.n_points)]),
    note: 'These figures come from the frozen table. They are not drawn on the chart.',
  };
}

// ---------------------------------------------------------------------------------------------
// Chart words
// ---------------------------------------------------------------------------------------------

/**
 * Readout text for one chart position (hover or tap).
 * @param {{t:number, observed:number|null, raw:number|null, aligned:number|null, low:number|null, high:number|null, rise:number|null, riseKind:string}} p
 * @param {number} nowMs
 * @returns {{time:string, rows:{key:string, label:string, value:string}[]}}
 */
export function chartReadout(p, nowMs) {
  const rows = [];
  if (isNum(p.observed)) rows.push({ key: 'observed', label: LINE_NAMES.observed, value: cfs(p.observed) });
  if (isNum(p.raw)) rows.push({ key: 'raw', label: 'NOAA', value: cfs(p.raw) });
  if (isNum(p.aligned)) rows.push({ key: 'aligned', label: 'Aligned', value: cfs(p.aligned) });
  if (isNum(p.low) && isNum(p.high)) rows.push({ key: 'range', label: 'Low to high', value: `${num(p.low)}–${num(p.high)} cfs` });
  if (isNum(p.rise)) rows.push({ key: 'rise', label: p.riseKind === 'observed' ? '24-h rise' : '24-h rise (aligned)', value: cfs(p.rise) });
  if (isNum(p.line)) rows.push({ key: 'season', label: 'Season line', value: cfs(p.line) });
  return { time: dayTime(p.t), rows };
}

/**
 * Short note drawn in the forecast side of the chart when no forecast lines are drawn.
 * @param {'could_not_read'|'withheld'} status @returns {string}
 */
export function chartForecastNote(status) {
  return status === 'could_not_read' ? "Could not read NOAA's forecast" : "NOAA's forecast withheld";
}

/** Hint under the chart. @returns {string} */
export function chartHint() {
  return 'Tap or drag on the chart to read values. With a keyboard, focus the chart and use the arrow keys.';
}

/** Axis label for days: "Tue 29". @param {number} ms @returns {string} */
export function axisDay(ms) {
  if (!isTime(ms)) return '';
  const d = Number(dayKey(ms).slice(8, 10));
  return `${WD.format(ms)} ${d}`;
}

/** Axis number with thousands commas: "1,500", "800". @param {number} n @returns {string} */
export function axisNum(n) {
  if (!isNum(n)) return '';
  // Full thousands with commas ("1,000", "1,500"); the 40 px left margin fits them at 12 px.
  return num(n);
}

/**
 * Screen-reader summary of the chart.
 * @param {object} view @returns {string}
 */
export function chartSummary(view) {
  const parts = ['Chart of river flow at the Samish gauge for the last 72 hours, with NOAA’s forecast for the next 72 hours.'];
  const o = view.observed || {};
  const c = view.chart || {};
  if (o.latest) parts.push(`Flow now ${cfs(o.latest.cfs)} at ${when(o.latest.t, view.nowMs)}.`);
  else parts.push('No gauge readings could be read.');
  if (c.obsMax) parts.push(`Highest in the last 72 hours: ${cfs(c.obsMax.cfs)} at ${dayTime(c.obsMax.t)}.`);
  if (c.obsMin) parts.push(`Lowest: ${cfs(c.obsMin.cfs)} at ${dayTime(c.obsMin.t)}.`);
  parts.push(noaaCrestText(view));
  const f = view.forecast || {};
  if (f.status === 'ok' && f.edges === 'shown' && c.rangeAtEnd) {
    parts.push(`At the end of the drawn forecast the low case is ${cfs(c.rangeAtEnd.low)} and the high case ${cfs(c.rangeAtEnd.high)}.`);
  }
  const r = crossingReading(view);
  parts.push(`Season-line crossing: ${r.line.replace(/\.$/, '')}.`);
  if (view.season && isNum(view.season.lineCfs)) parts.push(`${seasonLineText(view.season.lineCfs)}, applied to the 24-hour rise.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------------------------
// Banners and page-level messages
// ---------------------------------------------------------------------------------------------

/**
 * Banner for cached, offline or replay states ('' when none).
 * @param {object} view @returns {{kind:'replay'|'cached'|'', text:string}}
 */
export function banner(view) {
  if (!view) return { kind: '', text: '' };
  if (view.mode === 'replay') {
    const extra = view.fixtureNotes && view.fixtureNotes.syntheticTides ? ' Tide times in this replay are synthetic, not NOAA predictions.' : '';
    return { kind: 'replay', text: `Replay · ${dayTime(view.nowMs)}, ${longDate(view.nowMs)} · not live.${extra}` };
  }
  if (view.mode === 'fixture_error') {
    return { kind: 'cached', text: 'Could not read that replay file. Showing nothing from it.' };
  }
  if (view.fromCache) {
    return { kind: 'cached', text: `Could not refresh. Showing the last good reading from ${when(view.builtMs, view.renderMs ?? view.builtMs)} (${ago(view.cacheAgeMin)}).` };
  }
  return { kind: '', text: '' };
}

/** Refresh note in the header area. @param {object} view @returns {string} */
export function refreshNote(view) {
  if (!view || view.mode === 'replay') return '';
  return 'Refreshes every 5 min while this page is on screen.';
}

/** Generic "part not available" sentence. @returns {string} */
export function notAvailable() {
  return 'This part is not available right now.';
}

/**
 * Why the chart is empty: the gauge reason when the gauge could not be read, else the generic sentence.
 * @param {object} view @returns {string}
 */
export function chartEmpty(view) {
  const g = view && view.feeds ? view.feeds.gauge : null;
  if (!g || g.status === 'could_not_read') return 'Could not read the river gauge, so there is no chart to draw.';
  return notAvailable();
}

// ---------------------------------------------------------------------------------------------
// About, Limits, first-run explainer (each line's basis in plain words)
// ---------------------------------------------------------------------------------------------

/** Basis of each line, keyed by chart line. */
export const BASIS = Object.freeze({
  observed: 'Observed: USGS gauge 12201500 on the Samish River near Burlington, 15-minute readings. USGS marks them provisional.',
  raw: "NOAA's forecast: the Northwest River Forecast Center forecast for SMRW1, drawn as issued, straight lines between its points.",
  aligned: "NOAA aligned to the gauge: NOAA's path moved up or down by one constant so it starts at the latest gauge reading.",
  range: `High case to low case: the ${RANGE_BASIS}. The aligned path is widened by how far the river ended up from NOAA in past wet-season forecasts (Oct–Apr, 2018–2026). Not drawn past 72 h.`,
  season: "Season line: confirmed in writing by Taylor Shellfish (October 2026). 400 cfs Nov–Feb, 200 cfs Mar–Apr, 100 cfs May–Oct, compared with the 24-h rise.",
  rise: '24-h rise (study definition): flow now minus the lowest flow in the 24 hours ending now.',
});

/**
 * About sheet content.
 * @returns {{title:string, sections:{heading:string, id:string, paras:string[]}[]}}
 */
export function aboutContent() {
  return {
    title: 'About Samish River Watch',
    sections: [
      { heading: 'What this page is', id: 'about-what', paras: [
        'A storm view of the Samish River at Burlington for Taylor Shellfish. It shows the river against the season line, NOAA’s forecast, our high case and low case, the peak call and a sampling card.',
        'It sends no messages and claims no forecast skill. Every feed shows its age. A feed that fails says “could not read”, never a blank or a zero.',
      ] },
      { heading: 'The lines on the chart', id: 'about-lines', paras: [BASIS.observed, BASIS.raw, BASIS.aligned, BASIS.range, BASIS.season, BASIS.rise] },
      { heading: 'Crossing times', id: 'about-crossing', paras: [
        'For each line, the page joins the last 24 h of gauge readings to the forecast path and finds the first time the 24-h rise reaches the season line. “Stays below” means the path does not reach it within the drawn hours.',
      ] },
      { heading: 'The peak call', id: 'about-peak', paras: [
        'The partner study’s rule. During a rise, the page tracks the highest flow. It calls the peak when flow has dropped 2% below that high and the high is at least 90 minutes old.',
        'If the river later climbs more than 5% above the called peak within 12 h, the earlier call was premature. After 12 h, a new climb is a second peak.',
        'A rise starts counting once the river is at least 150 cfs and half again above its lowest flow in the 72 h before. This live rule differs from the study’s storm list.',
      ] },
      { heading: 'The rain clock', id: 'about-window', paras: [
        'Shown only during a rise, once radar shows rain has eased over the basin: the last hour with at least 1 mm, followed by at least one hour under 1 mm. That is the partner study’s definition, so its counts below describe the same hours.',
        'It names the time 6 h after the rain eased. In 75 past storms (2016 to 2023, archive rain), at hours when rain had eased and the river had not yet peaked, the peak came a median 6 hours after the rain end shown, and more than 8 hours after it in 45% of those hours. In 24 of those 75 storms solid rain came back before the peak.',
        'The counts use archive rain over a rectangle around the basin. Radar found solid rain in 61% of the hours the archive did, so the rain end shown here can come earlier than the study’s.',
        'It is not a crest window. It gives no crest height and no latest time, and the peak can come well after the 6-hour mark.',
      ] },
      { heading: 'Sampling', id: 'about-sampling', paras: [
        'Taylor Shellfish’s stated target (September 2026) is about 6 h after the peak. It is Taylor’s own target, not a Department of Health rule.',
        'Tide times are NOAA predictions at Bellingham, feet above MLLW; not Samish Bay water level.',
      ] },
      { heading: 'Sources', id: 'about-sources', paras: [
        'USGS Water Data API (gauge 12201500) · NOAA National Water Prediction Service (SMRW1) · NOAA Tides and Currents (Bellingham 9449211) · MRMS radar one-hour rain over the gauge drainage, computed by the Lab.',
      ] },
    ],
  };
}

/**
 * Limits sheet content. Counts come from the frozen table summary and records.json when they are loaded;
 * without them the same limits are stated without numbers.
 * @param {object|null} [table] summarized ratio_table.json
 * @param {object|null} [view] view, for records.json counts
 * @returns {{title:string, items:string[]}}
 */
export function limitsContent(table, view) {
  const pc = table && (table.pooled_coverage || (table.coverage && table.coverage.pooled));
  const outside = okCount(pc)
    ? `Over past wet seasons the river still ended up outside the high-to-low range at ${num(pc.n - pc.inside)} of ${num(pc.n)} forecast points.`
    : 'Over past wet seasons the river sometimes ended up outside the high-to-low range.';
  const age = table && Array.isArray(table.coverage_by_age) ? table.coverage_by_age : [];
  const aging = age.length >= 2
    ? `The range covers less as NOAA's forecast ages: ${pct(age[0].share)} of past points when the forecast was ${num(age[0].age_h)} h old, ${pct(age[age.length - 1].share)} at ${num(age[age.length - 1].age_h)} h.`
    : "The range covers less as NOAA's forecast ages.";
  const big = table && table.coverage && okCount(table.coverage.rise_ge_200)
    ? `Big rises land outside more often: when NOAA showed a rise of 200 cfs or more, the river stayed inside at ${pct(table.coverage.rise_ge_200.inside / table.coverage.rise_ge_200.n)} of points.`
    : '';
  const second = recordValue(view, 'peak_second_peak_n');
  const storms = recordValue(view, 'peak_call_storms_n');
  const again = second !== null && storms !== null
    ? `A peak call can be exceeded. In ${num(second)} of ${num(storms)} past storms (about 1 in ${num(storms / second)}) a higher second peak came more than 12 h later.`
    : 'A peak call can be exceeded, and some storms peak again higher more than 12 h later.';
  return {
    title: 'Limits',
    items: [
      'This page does not show or decide shellfish status. The Washington Department of Health makes those decisions.',
      'It claims no forecast skill. Our high and low cases describe NOAA’s past misses; they are not a forecast of their own.',
      outside,
      aging,
      big,
      'High and low cases are drawn Oct–Apr only, and never past 72 h.',
      "NOAA's forecast is withheld when its issue is over 48 h old, its path does not reach 24 h ahead, or it has fewer than 4 points in the next 24 h.",
      'USGS readings are provisional and can be revised.',
      again,
      'The live rule that starts a rise differs from the study’s offline storm list, so the study’s counts describe its own list.',
      'The rain clock needs a current radar record (its newest hour under 3 h old and no hour missing from the last 6) and appears only after rain has eased. Its past counts use archive rain over a rectangle around the basin, not this radar drainage average. Radar found solid rain in 61% of the hours the archive did, so the rain end shown can come earlier than the study’s, and solid rain can come back before the peak.',
      "County sample pass shares come from one county site (site 32) and are past county choices, not advice on when to sample. Their timing goes with storm size and with how long a closure had lasted. The county's test multiplies bacteria by flow, so lower flow after the peak raises the pass share by itself. No line on this page rests on them.",
      'Tide times are predictions at Bellingham, not measured Samish Bay water level. In a replay they are synthetic.',
      'The page refreshes every 5 min only while it is on screen. It sends no messages and no notices.',
      'The log stays in this browser. Clearing browser data erases it. Export a CSV to keep a copy.',
      'The page shows its own counts and times only. It computes no rates of its own.',
    ].filter(Boolean),
  };
}

/**
 * First-run explainer content (one screen, dismissible).
 * @returns {{title:string, steps:{heading:string, text:string}[]}}
 */
export function explainerContent() {
  return {
    title: 'How to read this page',
    steps: [
      { heading: 'The top sentence', text: 'What the river is doing now, and when NOAA and our high case reach the season line.' },
      { heading: 'The 24-h rise', text: 'One number against the season line for this time of year. Below the fold, the lower chart panel shows the same rise for each forecast line.' },
      { heading: 'The peak', text: 'Whether a rise is under way, and when the peak call is made. A call can still be exceeded.' },
      { heading: 'The dots', text: 'Tap the dots for each feed’s age. Red means old or could not read; that part is held back and says why.' },
    ],
  };
}
