// strings.js: every user-facing sentence on Samish River Watch lives here.
// CONTRACT.md section 4 is binding (amended 2026-10-19, phase 5: say each fact once; "withheld" is written "not shown" and
// "aligned" is written "shifted to gauge" on screen). render.js and chart.js take words only from this module.
// Sentences that carry the studies' numbers are not written here: they come from site/data/records.json, where
// tools/hash_records.py binds every number to its source quote.
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
const MD = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
/** From this far away a weekday alone could name the wrong week, so the date is added (round 1 review, 2026-10-19). */
const FAR_MS = 6 * 24 * 3_600_000;
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

/**
 * "Wed 22:00 PT", always with the weekday; "Tue Dec 22, 21:30 PT" when a clock to compare with is given and the time is
 * 6 or more days from it.
 * @param {number} ms @param {number} [nowMs] @returns {string}
 */
export function dayTime(ms, nowMs) {
  if (!isTime(ms)) return 'time not known';
  if (isTime(nowMs) && Math.abs(ms - nowMs) >= FAR_MS) return `${WD.format(ms)} ${MD.format(ms)}, ${clock(ms)} PT`;
  return `${WD.format(ms)} ${clock(ms)} PT`;
}

/**
 * "22:00 PT" when on the same local day as nowMs, otherwise "Tue 22:00 PT" (with the date from 6 days away).
 * @param {number} ms @param {number} nowMs @returns {string}
 */
export function when(ms, nowMs) {
  if (!isTime(ms)) return 'time not known';
  return dayKey(ms) === dayKey(nowMs) ? `${clock(ms)} PT` : dayTime(ms, nowMs);
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
 * The length of an age in whole minutes, without "ago" or "in": "50 min", "2 h", "3 days". From 90 minutes it is said in hours
 * (round 4, coordinator decision 10: "99 min ago" read as a sum to work out).
 * @param {number} m whole minutes, 0 or more @returns {string}
 */
function ageSpan(m) {
  const h = Math.round(m / 60);
  return m < 90 ? `${m} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
}

/**
 * Plain age: "just now", "4 min ago", "3 h ago", "2 days ago"; a time still ahead (a negative age) is "in 2 h", never "just now"
 * (round 3 review: a NOAA issue time in the future read "(just now)" beside "its issue time is in the future").
 * @param {number} ageMin @returns {string}
 */
export function ago(ageMin) {
  if (!isNum(ageMin)) return 'age not known';
  const ahead = ageMin < 0;
  const m = ahead ? Math.max(1, Math.round(-ageMin)) : Math.round(ageMin);
  if (m < 1) return 'just now';
  return ahead ? `in ${ageSpan(m)}` : `${ageSpan(m)} ago`;
}

// ---------------------------------------------------------------------------------------------
// Static labels
// ---------------------------------------------------------------------------------------------

/** Static interface words. */
export const UI = Object.freeze({
  appName: 'Samish River Watch',
  place: 'Samish River at Burlington',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  themeAuto: 'Theme: auto',
  themeLight: 'Theme: light',
  themeDark: 'Theme: dark',
  themeHint: 'Change color theme',
  how: 'How this works',
  limits: 'Limits',
  close: 'Done',
  skip: 'Skip to the river status',
  statusHeading: 'River status',
  riseHeading: '24-h rise',
  riseStudy: 'study definition',
  crestHeading: 'Peak and sample',
  feedsHeading: 'Feeds',
  feedsHint: 'Show feed ages',
  feedsHide: 'Hide feed ages',
  chartHeading: "River and NOAA's forecast",
  chartTable: 'Crossing times and chart values',
  chartTableCaption: 'Chart values as a table',
  axisFlow: 'Flow, cfs',
  axisRise: '24-h rise, cfs (study definition)',
  noaaCrestLabel: "NOAA's forecast crest",
  targetLabel: "Taylor's target: 6 h after the peak",
  readoutHint: 'Tap the chart to read values.',
  readoutClear: 'Clear',
  infoPeak: 'How the peak call works',
  infoRise: 'What the 24-h rise is',
  infoCrest: "NOAA's record for crest times",
  howLink: 'How this works ›',
  footer: 'Planning view for Taylor Shellfish. Not official. Closure status comes only from the Washington State Department of Health. It claims no forecast skill and sends no messages.',
  colTime: 'Time (PT)',
  colObserved: 'Observed',
  colNoaa: "NOAA's forecast",
  colAligned: 'NOAA shifted',
  colRange: 'Low to high case',
  colRise: '24-h rise',
  basisFactorsHeading: 'How far the range spreads',
  colLead: 'Hours ahead',
  colRising: 'Rising',
  colLevel: 'Level',
  colBelow: 'Below 150 cfs',
});

/** Names of the four feeds, as shown on the feed pills. */
export const FEED_NAMES = Object.freeze({ gauge: 'Gauge', noaa: 'NOAA', tides: 'Tides', basin: 'Radar' });

/**
 * Feed names in the feed panel (a tap on the pills). The tide row names NOAA and Bellingham beside the tide time (spec section 5;
 * round 4, decision 13), and the radar row names the file, so its time reads as how far the file runs, not as a rain end
 * (round 4, decision 12).
 */
export const FEED_LONG = Object.freeze({
  gauge: 'River gauge',
  noaa: "NOAA's river forecast",
  tides: 'Tide predictions (NOAA, Bellingham)',
  basin: 'Radar rain file',
});

/** Labels for each chart line (also the legend). */
export const LINE_NAMES = Object.freeze({
  observed: 'Observed',
  raw: "NOAA's forecast",
  aligned: 'NOAA, shifted to gauge',
  range: 'High and low case',
  season: 'Season line',
  now: 'Now',
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
 * One word for a feed status, shown on the pill beside its icon so colour is never the only signal.
 * @param {string} status @returns {string}
 */
export function feedStatusWord(status) {
  switch (status) {
    case 'ok': return 'current';
    case 'stale': return 'old';
    case 'withheld': return 'not shown';
    case 'could_not_read': return 'could not read';
    case 'not_read': return NOT_READ;
    case 'loading': return 'reading…';
    default: return 'could not read';
  }
}

/** The word on every pill while the cached banner is up (round 3 review: four green checks sat under "Could not refresh"). */
export const NOT_REFRESHED = 'not refreshed';

/**
 * A replay file that could not be read: the page never asked the feeds, so no feed is said to have failed (round 4, coordinator
 * decision 6). Its feeds carry the status 'not_read' (app.js fixtureErrorView).
 */
export const NOT_READ = 'not read';
const NOT_READ_WHY = 'this replay file could not be read';

/**
 * The word for one feed's status. "Not shown" is NOAA's rule word (a forecast held back by a rule); a radar file that is
 * not there could not be read (round 2 review: "Radar: not shown" read as a rule the page applied); a radar file with a current
 * newest hour but a missing hour among the last six is "missing an hour", and "old" is kept for an old file (round 3 review).
 * @param {string} key gauge|noaa|tides|basin @param {{status:string, problem?:string}|null} feed @returns {string}
 */
function statusWord(key, feed) {
  const s = feed ? feed.status : 'could_not_read';
  if (key === 'basin' && s === 'withheld') return feedStatusWord('could_not_read');
  if (key === 'basin' && s === 'stale' && feed.problem === 'gaps') return 'missing an hour';
  return feedStatusWord(s);
}

/**
 * The words on one feed pill: the name alone when current, the name and its word when not ("NOAA: not shown"), and, while the
 * cached banner is up, "not refreshed" on every pill (round 3 review).
 * @param {string} key gauge|noaa|tides|basin @param {{status:string, problem?:string}|null} feed @param {boolean} [cached]
 * @returns {string}
 */
export function pillText(key, feed, cached = false) {
  if (cached) return `${FEED_NAMES[key]}: ${NOT_REFRESHED}`;
  const s = feed ? feed.status : 'could_not_read';
  if (s === 'ok' || s === 'loading') return FEED_NAMES[key];
  return `${FEED_NAMES[key]}: ${statusWord(key, feed)}`;
}

/**
 * Age line for a feed: "reading 22:05 PT (4 min ago)" or "could not read".
 * @param {string} key gauge|noaa|tides|basin
 * @param {{status:string, readT?:number|null, ageMin?:number|null}} feed
 * @param {number} nowMs
 * @returns {string}
 */
export function feedAge(key, feed, nowMs) {
  if (feed && feed.status === 'loading') return 'reading…';
  if (feed && feed.status === 'not_read') return NOT_READ_WHY;
  // A withheld radar feed means the server file is absent (feeds.js maps a 404 to withheld).
  if (feed && feed.status === 'withheld' && key === 'basin') return 'not available';
  // Stale tides: one line and no tide time, since a time beside "not shown" read as one to use (round 4, decision 13). Their
  // age is from the newest prediction already past, so the predictions end that long before now.
  if (key === 'tides' && feed && feed.status === 'stale') {
    return isNum(feed.ageMin) && feed.ageMin > 36 * 60
      ? `not shown; they end ${ageSpan(Math.round(feed.ageMin))} before now, over the 36 h limit.`
      : 'not shown; they end over 36 h before now.';
  }
  const t = feed ? (isTime(feed.dataT) ? feed.dataT : feed.readT) : null;
  if (!feed || feed.status === 'could_not_read' || !isTime(t)) return 'could not read';
  // Tides age from the newest prediction already past, the clock their stale rule runs on (round 3 review: "read 12:00 PT
  // (just now)" sat above "read over 36 h ago"); with no prediction before now only the read time is known.
  if (key === 'tides') return isTime(feed.dataT) ? `latest tide ${when(t, nowMs)} (${ago(feed.ageMin)})` : `read ${when(t, nowMs)}`;
  // the radar time is how far the file runs (its newest hour's end), never a rain end (round 4, decision 12)
  const verb = key === 'noaa' ? 'issued' : key === 'basin' ? 'runs to' : 'reading';
  return `${verb} ${when(t, nowMs)} (${ago(feed.ageMin)})`;
}

/**
 * Which rule kept NOAA's forecast off the page, short form for the freshness line (CONTRACT.md section 2): issue over
 * 48 h old, an issue time in the future, a path that ends before 24 h ahead, or fewer than 4 points in the next 24 h.
 * @param {string|undefined} reason feeds.js reason or code @returns {string}
 */
export function noaaShortReason(reason) {
  const r = String(reason || '').toLowerCase();
  if (/future/.test(r)) return 'issue time in the future';
  if (/48|old|stale/.test(r)) return 'issued over 48 h ago';
  if (/point|few/.test(r)) return 'fewer than 4 points in the next 24 h';
  if (/short|reach|ahead|end|cover|span/.test(r)) return 'does not reach 24 h ahead';
  return 'issued over 48 h ago, does not reach 24 h ahead, or has fewer than 4 points in the next 24 h';
}

/**
 * Why NOAA's forecast is not shown, as a sentence for the feed panel.
 * @param {string|undefined} reason feeds.js reason or code @returns {string}
 */
export function noaaWithheldReason(reason) {
  const r = String(reason || '').toLowerCase();
  if (/future/.test(r)) return "NOAA's forecast is not shown: its issue time is in the future.";
  if (/48|old|stale/.test(r)) return "NOAA's forecast is not shown: it was issued over 48 h ago.";
  if (/point|few/.test(r)) return "NOAA's forecast is not shown: it has fewer than 4 points in the next 24 h.";
  if (/short|reach|ahead|end|cover|span/.test(r)) return "NOAA's forecast is not shown: its path does not reach 24 h ahead.";
  return "NOAA's forecast is not shown: it was issued over 48 h ago, does not reach 24 h ahead, or has fewer than 4 points in the next 24 h.";
}

/**
 * The quiet note under the radar row when the radar file is current and shows no hour of 1 mm or more in 48 h; '' otherwise.
 * No time on the page comes from rain (round 3, coordinator decision 1), so a rainy hour's end time is not given here.
 * @param {object} view @returns {string}
 */
export function radarNote(view) {
  const r = view && view.radar;
  const b = view && view.feeds ? view.feeds.basin : null;
  if (!r || !b || b.status !== 'ok' || !r.quiet) return '';
  return 'No hour of 1 mm or more over the watershed in the last 48 h.';
}

/**
 * Why a feed is not current, in one sentence (empty string when current).
 * @param {string} key @param {{status:string, reason?:string, problem?:string}} feed @returns {string}
 */
export function feedProblem(key, feed) {
  const s = feed ? feed.status : 'could_not_read';
  // a replay file that could not be read, and stale tides, say why on their own row (round 4, decisions 6 and 13)
  if (s === 'ok' || s === 'loading' || s === 'not_read') return '';
  if (key === 'tides' && s === 'stale') return '';
  if (key === 'noaa' && (s === 'withheld' || s === 'stale')) return noaaWithheldReason(feed && feed.reason);
  if (key === 'basin' && s === 'stale' && feed && feed.problem === 'gaps') return 'Radar is missing an hour from the last 6 h.';
  const m = {
    gauge: {
      stale: 'No gauge reading for over 2 h. Lines that start from the gauge wait for a new one.',
      could_not_read: 'Could not read the USGS gauge. Nothing that depends on it is shown.',
    },
    noaa: {
      could_not_read: "Could not read NOAA's forecast. No forecast lines are shown.",
    },
    tides: {
      withheld: 'Tide predictions are not shown.',
      could_not_read: 'Could not read the tide predictions.',
    },
    basin: {
      stale: 'Radar is over 3 h old.',
      withheld: 'The radar rain file is not available.',
      could_not_read: 'Could not read radar rain.',
    },
  };
  return (m[key] && m[key][s]) || `${FEED_LONG[key] || 'This feed'}: could not read.`;
}

/**
 * Accessible label for one feed pill: "Gauge: current, reading 22:00 PT (4 min ago)" ("Gauge: not refreshed, ..." under the
 * cached banner). A replay's made-up tides are spoken as made up, never with a made-up time (round 4, decision 13).
 * @param {string} key @param {object} feed @param {number} nowMs @param {boolean} [cached] @param {boolean} [synthetic] made-up
 * replay tides @returns {string}
 */
export function feedDotLabel(key, feed, nowMs, cached = false, synthetic = false) {
  if (key === 'tides' && synthetic && !cached && feed && feed.status === 'ok') return 'Tides: made up for this replay';
  return `${FEED_NAMES[key]}: ${cached ? NOT_REFRESHED : statusWord(key, feed)}, ${feedAge(key, feed, nowMs)}`;
}

/**
 * One row of the feed panel (a tap on the pills): the feed's name and its age, or, in a replay whose tides are made up,
 * that the tide times are made up (round 2 review: before a call nothing else on a replay said so).
 * @param {string} key gauge|noaa|tides|basin @param {object} view @returns {string}
 */
export function feedRow(key, view) {
  const f = view && view.feeds ? view.feeds[key] : null;
  if (f && f.status === 'not_read') return 'Not read: this replay file could not be read.';
  if (key === 'tides' && f && f.status === 'ok' && syntheticTides(view)) return 'Tide times: made up for this replay';
  return `${FEED_LONG[key]}: ${feedAge(key, f, view ? view.nowMs : NaN)}`;
}

// ---------------------------------------------------------------------------------------------
// Status sentence (the hero line; aria-live) and the freshness line under it
// ---------------------------------------------------------------------------------------------

function gaugeUsable(view) {
  return Boolean(view.feeds && view.feeds.gauge && view.feeds.gauge.status === 'ok');
}

/**
 * Tense of a forecast crossing time: null (no crossing), 'already' (at or before the last gauge reading, or, with a current
 * gauge, before now: readings come every 15 min, often in hourly batches, so a crossing in that gap is over the line now),
 * 'passed' (after the last reading and before now with the gauge old: it has not reported since, so the page cannot say
 * whether it happened), or the day and time when it is still ahead.
 */
function crossingWhen(t, view) {
  const latestT = view.observed && view.observed.latest ? view.observed.latest.t : view.nowMs;
  if (!isTime(t)) return null;
  if (t <= latestT) return 'already';
  if (t <= view.nowMs) return gaugeUsable(view) ? 'already' : 'passed';
  return dayTime(t, view.nowMs);
}

/** "River rising." stops being said of a high this old (a flat top), or of any reading below the high. */
const HIGH_STANDS_MS = 3_600_000;

/** True when the river is no longer making new highs: the latest reading is below the high, or the high is 1 h old or more. */
function offTheHigh(high, latest) {
  if (!high || !latest || !isNum(high.cfs) || !isTime(high.t) || !isNum(latest.cfs) || !isTime(latest.t)) return false;
  return latest.cfs < high.cfs || latest.t - high.t >= HIGH_STANDS_MS;
}

/**
 * Before the detector tracks a rise (150 cfs and half again above the lowest flow of the 72 h before), a rise is still under
 * way when the 24-h rise is at least RISE_MIN_CFS and the flow is half again above its 24-h low: the page's own tracking
 * rule without its 150 cfs floor, with the 50 cfs that the past-miss table calls a rise (round 2 review: "No rise under way."
 * stood for 4 h of a climb from 46 to 113 cfs against a 100 cfs line on 2026-09-29).
 */
export const RISE_MIN_CFS = 50;
const RISE_FACTOR = 1.5;

function climbing(o) {
  if (!o || !o.latest || !isNum(o.latest.cfs) || !isNum(o.riseCfs)) return false;
  return o.riseCfs >= RISE_MIN_CFS && o.latest.cfs >= RISE_FACTOR * (o.latest.cfs - o.riseCfs);
}

/**
 * What the river part of the status sentence says, as one word (the status icon and the Peak and sample card follow it):
 * 'loading', 'gauge' (old or unreadable), 'called', 'rising' (making new highs: a rise tracked by the detector, or, before
 * the detector tracks it, a river over the season line or clearly climbing below it, at its 24-h high), 'near' (a tracked
 * rise off its high before the call: below the high, or flat at it for 1 h or more; or, untracked and over the line, flat at
 * its 24-h high's printed flow for 1 h or more), 'below' (untracked and over the line, printed below its 24-h high), 'none'
 * (no rise under way) or 'line' (no river part: the line clause alone, for an untracked river climbing below the line off its
 * 24-h high, or when peak tracking is not available).
 * Round 1 review (2026-10-19): "No rise under way." is never said of a river over the line, and "River rising." never of a
 * river the readings show flat or lower. Round 2 review: nor "No rise under way." of a clear climb below the line. Round 4
 * (coordinator decision 1a): over the line, an untracked river off its high has a river part, never the line clause alone,
 * which read as a quiet river.
 * @param {object} view @returns {'loading'|'gauge'|'called'|'rising'|'near'|'below'|'none'|'line'}
 */
export function riverKind(view) {
  if (!view || view.loading) return 'loading';
  const g = view.feeds ? view.feeds.gauge : null;
  const o = view.observed || {};
  if (!g || g.status === 'loading') return 'loading';
  if (g.status !== 'ok' || !o.latest) return 'gauge';
  const p = view.peak || {};
  if (p.unavailable) return 'line';
  // "Peak called." says what happened; it never says the river is falling (the call only means flow is 2% below the high).
  if (p.state === 'called' && p.call) return 'called';
  if (p.state === 'rising') return offTheHigh(p.high, o.latest) ? 'near' : 'rising';
  if (o.overLine || climbing(o)) {
    if (!offTheHigh(o.high24, o.latest)) return 'rising';
    if (!o.overLine) return 'line';
    // "below" only when the printed flows say so; flat at the same printed flow, the river is near its highest so far
    return Math.round(o.latest.cfs) < Math.round(o.high24.cfs) ? 'below' : 'near';
  }
  return 'none';
}

function riverPart(view) {
  const kind = riverKind(view);
  const p = view.peak || {};
  const call = p.call || null;
  if (kind === 'called') return call.secondPeak ? 'Second peak called.' : 'Peak called.';
  if (kind === 'near') return 'River near its highest so far.';
  if (kind === 'below') return 'River below its high so far.';
  if (kind === 'rising') {
    if (p.state === 'rising' && call && call.premature) return 'River rising again, above the earlier peak call.';
    if (p.state === 'rising' && call && call.secondPeak) return 'River rising again: a second peak is building.';
    return 'River rising.';
  }
  return kind === 'none' ? 'No rise under way.' : '';
}

/**
 * Our high and low cases' crossing times (said only with a current gauge, so never in the past tense). Only reached while the
 * river is below the line. A crossing at or before now is "had the river over the line by now" (round 3, coordinator decision 4).
 */
function casesClause(view, c) {
  const hi = crossingWhen(c.high, view);
  const lo = crossingWhen(c.low, view);
  if (hi === null) return 'Our high case stays below the line.';
  const low = lo !== null && lo !== 'already' ? lo : '';
  if (hi === 'already') return low ? `Our high case had the river over the line by now; our low case crosses ${low}.` : 'Our high case had the river over the line by now.';
  return low ? `Our high case crosses ${hi}; our low case ${low}.` : `Our high case crosses ${hi}.`;
}

/** NOAA's forecast and our high case crossing this close together are said once, "about" the earlier time (round 3, decision 11). */
const CROSSINGS_MERGE_MS = 15 * 60_000;
const isAhead = (w) => w !== null && w !== 'already' && w !== 'passed';

/**
 * NOAA's and our high case's crossing times, or why there are none. Only reached while the river is below the line (over it,
 * the sentence has the line clause alone). A crossing at or before now is said as "had the river over the season line by now"
 * with where the river is (round 3, coordinator decision 4: "NOAA shows the river over the season line." sat above a card
 * that said it was under).
 */
function forecastClause(view) {
  const f = view.forecast || {};
  const n = view.feeds ? view.feeds.noaa : null;
  if (!n || n.status === 'loading') return '';
  if (n.status === 'could_not_read') return "Could not read NOAA's forecast.";
  if (n.status !== 'ok' || f.status !== 'ok') return "NOAA's forecast is not shown.";
  const c = f.crossings || {};
  // A high case drawn only part of the way (it ends before NOAA's crossing) is never said to stay below: it is left out.
  const casesShort = c.high === null && isTime(c.raw) && isTime(f.edgesEndT) && f.edgesEndT < c.raw;
  const cases = f.edges === 'shown' && gaugeUsable(view) && !casesShort;
  const raw = crossingWhen(c.raw, view);
  const high = cases ? crossingWhen(c.high, view) : null;
  if (raw === null && cases && high === null) return 'NOAA and our high case stay below the season line.';
  if (isAhead(raw) && isAhead(high) && Math.abs(c.raw - c.high) <= CROSSINGS_MERGE_MS) {
    const lo = crossingWhen(c.low, view);
    const low = isAhead(lo) ? `; our low case ${lo}` : '';
    return `NOAA's forecast and our high case cross the season line about ${dayTime(Math.min(c.raw, c.high), view.nowMs)}${low}.`;
  }
  let noaa;
  if (raw === null) noaa = 'NOAA stays below the season line.';
  else if (raw === 'already') noaa = "NOAA's forecast had the river over the season line by now. The river is below it.";
  else if (raw === 'passed') noaa = `NOAA's forecast had the river reaching the season line at ${when(c.raw, view.nowMs)}, after the last gauge reading.`;
  else noaa = `NOAA's forecast crosses the season line ${raw}.`;
  return [noaa, cases ? casesClause(view, c) : ''].filter(Boolean).join(' ');
}

/** Whether the forecast clause names a crossing (NOAA's or our high or low case's), rather than "stays below" or a reason. */
function namesCrossing(view) {
  const f = view.forecast || {};
  const n = view.feeds ? view.feeds.noaa : null;
  if (!n || n.status !== 'ok' || f.status !== 'ok') return false;
  const c = f.crossings || {};
  if (crossingWhen(c.raw, view) !== null) return true;
  return f.edges === 'shown' && gaugeUsable(view) && (crossingWhen(c.high, view) !== null || crossingWhen(c.low, view) !== null);
}

/**
 * Where the river stands against the season line: over it (since the most recent upward crossing inside the last 72 h,
 * or with no "since" when none falls inside it), back below it after a call (with the next storm's crossing times while
 * one is ahead), or else the forecast clause.
 */
function linePart(view) {
  const o = view.observed || {};
  const p = view.peak || {};
  if (o.overLine) return isTime(o.crossT) ? `Over the season line since ${when(o.crossT, view.nowMs)}.` : 'Over the season line.';
  if (p.state === 'called' && p.call && o.wasOver) {
    // the time is when the river went over the line, said so (round 1 review: "crossed" read as the time it came back below)
    const back = isTime(o.crossT) ? `Back below the season line (went over at ${when(o.crossT, view.nowMs)}).` : 'Back below the season line.';
    // before the next storm the crossing times for NOAA and our cases stay in the sentence (spec section 5; round 2 review)
    return namesCrossing(view) ? `${back} ${forecastClause(view)}` : back;
  }
  return forecastClause(view);
}

/**
 * The status sentence, e.g. "Peak called. Over the season line since Tue 12:00 PT." or "No rise under way. NOAA's
 * forecast crosses the season line Thu 06:00 PT. Our high case crosses Wed 22:00 PT."
 * @param {object} view the immutable view built by app.js
 * @returns {string}
 */
export function statusSentence(view) {
  if (!view || view.loading) return 'Reading the river…';
  if (view.mode === 'fixture_error') return 'Nothing to show from this replay. Check the link.';
  const g = view.feeds ? view.feeds.gauge : null;
  const o = view.observed || {};
  if (!g || g.status === 'loading') return 'Reading the river…';
  if (g.status === 'could_not_read' || !o.latest) return 'Could not read the river gauge.';
  if (g.status === 'stale') {
    const at = `No gauge reading since ${when(o.latest.t, view.nowMs)}.`;
    return [at, o.overLine ? 'At that reading it was over the season line.' : forecastClause(view)].filter(Boolean).join(' ');
  }
  return [riverPart(view), linePart(view)].filter(Boolean).join(' ');
}

/**
 * The freshness line under the status sentence: "Gauge 22:00 PT (4 min ago) · NOAA issued 15:19 PT (7 h ago)", or why
 * NOAA's forecast is not shown. The gauge time is its newest reading, never the time the page checked.
 * @param {object} view @returns {string}
 */
export function freshLine(view) {
  if (!view || view.loading || !view.feeds) return 'Reading the feeds…';
  // nothing was read from a replay file that could not be read, so there is no reading time to give (round 4, decision 6)
  if (view.mode === 'fixture_error') return '';
  const g = view.feeds.gauge;
  const n = view.feeds.noaa;
  let gauge;
  if (!g || g.status === 'could_not_read' || !isTime(g.dataT)) gauge = 'Could not read the gauge';
  else gauge = `Gauge ${when(g.dataT, view.nowMs)} (${ago(g.ageMin)})`;
  let noaa;
  if (!n || n.status === 'could_not_read') noaa = 'Could not read NOAA';
  else if (n.status !== 'ok') noaa = `NOAA not shown: ${noaaShortReason(n.reason)}`;
  else noaa = isTime(n.dataT) ? `NOAA issued ${when(n.dataT, view.nowMs)} (${ago(n.ageMin)})` : 'NOAA issue time not known';
  return `${gauge} · ${noaa}`;
}

// ---------------------------------------------------------------------------------------------
// The 24-h rise card
// ---------------------------------------------------------------------------------------------

/**
 * Words for the 24-h rise card.
 * @param {object} view
 * @returns {{value:string, unit:string, label:string, compare:string, line:string, meterLabel:string, stale:boolean, missing:boolean,
 *   neutral:boolean}}
 */
export function riseCard(view) {
  const g = view.feeds ? view.feeds.gauge : null;
  const o = view.observed || {};
  const line = isNum(o.lineAtLatest) ? o.lineAtLatest : view.season ? view.season.lineCfs : null;
  const label = `${UI.riseHeading} (${UI.riseStudy})`;
  // a replay file that could not be read: no readings, nothing red, and the season line of the link's own time when it parsed
  // (no row at all otherwise, never "not known"; round 4, decision 6)
  if (view.mode === 'fixture_error') {
    return { value: '', unit: '', label, compare: 'No readings in this replay.', line: isNum(line) ? seasonLineText(line) : '', meterLabel: '', stale: false, missing: true, neutral: true };
  }
  if (!g || g.status === 'could_not_read' || !o.latest) {
    return { value: '', unit: '', label, compare: 'Could not read the river gauge.', line: seasonLineText(line), meterLabel: '', stale: false, missing: true, neutral: false };
  }
  const stale = g.status === 'stale';
  const r = o.riseCfs;
  let compare;
  if (!isNum(r)) compare = 'Not enough readings in the last 24 h for a rise.';
  else if (isNum(line) && r >= line) compare = `Over the line by ${cfs(r - line)}.`;
  else if (Math.round(r) <= 0) compare = 'Below the line.';
  else if (isNum(line)) compare = `${cfs(line - r)} below the line.`;
  else compare = '';
  if (stale) compare = `At ${when(o.latest.t, view.nowMs)}: ${compare}`;
  // The current flow is always on the card (spec section 2 item 7; round 1 review): the big number is the rise, not the flow,
  // and the flow is "river now" (round 4, decision 11: "flow" read as the quantity the season line applies to).
  return {
    value: isNum(r) ? num(r) : '--',
    unit: 'cfs',
    label,
    compare,
    line: `${seasonLineText(line)} · river now ${cfs(o.latest.cfs)}`,
    meterLabel: isNum(r) && isNum(line) ? `24-h rise ${cfs(r)} against a season line of ${cfs(line)}` : '',
    stale,
    missing: false,
    neutral: false,
  };
}

// ---------------------------------------------------------------------------------------------
// The Peak and sample card (records/SPEC_PHASE5_20261019.md section 0 items 2 and 3)
// ---------------------------------------------------------------------------------------------

/**
 * Clock for the call time beside a peak time: "22:45 PT" on the peak's own day, "Wed 00:15 PT" on a later day (round 4,
 * coordinator decision 10: every clock time on the page carries PT).
 * @param {number} confirmedT @param {number} peakT @returns {string}
 */
function calledClock(confirmedT, peakT) {
  if (!isTime(confirmedT)) return '';
  return dayKey(confirmedT) === dayKey(peakT) ? `${clock(confirmedT)} PT` : `${WD.format(confirmedT)} ${clock(confirmedT)} PT`;
}

/**
 * The peak call (CONTRACT.md section 3): "Peak about Tue 21:00 PT, 191 cfs (called 23:30 PT). Can still be exceeded."
 * @param {{peakT:number, peakCfs?:number|null, confirmedT?:number|null, secondPeak?:boolean}} call @returns {string}
 */
export function peakCallLine(call) {
  const lead = call.secondPeak ? 'Second peak about' : 'Peak about';
  const flow = isNum(call.peakCfs) ? `, ${cfs(call.peakCfs)}` : '';
  const c = calledClock(call.confirmedT, call.peakT);
  return `${lead} ${dayTime(call.peakT)}${flow}${c ? ` (called ${c})` : ''}. Can still be exceeded.`;
}

/** Whether the tides on screen are a replay's made-up tides (the replay banner says so too). @param {object} view @returns {boolean} */
function syntheticTides(view) {
  return Boolean(view && view.fixtureNotes && view.fixtureNotes.syntheticTides);
}

/** The next tide after Taylor's target, with its source beside the time. */
function tideLine(view, card) {
  const t = view.feeds ? view.feeds.tides : null;
  if (!t || t.status === 'could_not_read') return { tide: 'Could not read the tide predictions.', tideState: 'bad' };
  if (t.status === 'stale') return { tide: 'Tide times not shown: predictions are old.', tideState: 'bad' };
  if (t.status !== 'ok') return { tide: 'Tide times not shown.', tideState: 'bad' };
  const n = card.nextTideAfterTarget;
  if (!n || !isTime(n.t)) return { tide: 'No tide prediction after that time.', tideState: 'none' };
  const source = syntheticTides(view) ? 'made-up replay tide' : 'NOAA predictions at Bellingham';
  // once that tide is past too (so the target is), its time says so (round 4, decision 10)
  const passed = isTime(view.nowMs) && n.t < view.nowMs ? ' (passed)' : '';
  return { tide: `Next tide after that: ${n.type === 'L' ? 'low' : 'high'} ${when(n.t, view.nowMs)}${passed}, ${feet(n.ft)} (${source})`, tideState: 'ok' };
}

/** For this long from Taylor's target time it reads "(now)", not "(passed)": one reading interval (round 2 review). */
const TARGET_NOW_MS = 15 * 60_000;

/** Taylor's target time, counted from the observed peak (never from NOAA's crest or from rain), and the tide after it. */
function targetBlock(view, card) {
  const since = isTime(card.targetT) ? view.nowMs - card.targetT : null;
  const now = since !== null && since >= 0 && since < TARGET_NOW_MS;
  const passed = since !== null && since >= TARGET_NOW_MS;
  return {
    targetLabel: UI.targetLabel,
    target: isTime(card.targetT) ? `About ${when(card.targetT, view.nowMs)}${now ? ' (now)' : passed ? ' (passed)' : ''}` : '',
    targetPassed: passed,
    ...tideLine(view, card),
  };
}

/** A standing call the latest reading has passed (by under 5%, so the call stands): said under the call (round 2 review). */
function aboveCall(view, call) {
  const latest = view.observed ? view.observed.latest : null;
  if (!latest || !isNum(latest.cfs) || !isNum(call.peakCfs) || Math.round(latest.cfs) <= Math.round(call.peakCfs)) return '';
  return `The river is now above that peak: ${cfs(latest.cfs)} at ${when(latest.t, view.nowMs)}.`;
}

/** Counted from the river's own peak, said so (round 4, decision 2: NOAA's forecast crest was the only peak time on the page). */
const TARGET_RULE = "Taylor's target: sample about 6 h after the river's peak.";

/**
 * Words for the Peak and sample card. It shows during a rise, within 48 h of a peak call (the frozen sampling-card rule,
 * view.sampling.visible), while the peak call is paused (the gauge is old or could not be read), and while the status
 * sentence says "River rising." before the detector tracks the rise (the same test, riverKind; round 2 review), and while an
 * untracked river is over the line off its 24-h high (round 4, decision 1b: the card said nothing of a rise the detector never
 * tracks). The peak status is the card's weight; after a call the largest line is Taylor's target time. There is no rain
 * clock (round 3, coordinator decision 1: it read as a second, predicted peak time one line under Taylor's 6 h). Without
 * crest.js (app.js sets sampling.unavailable) the card stays hidden in every state (round 4, decision 22e); a replay file that
 * could not be read has no card either, since its gauge was never read (status 'not_read': no rise, call or line is known).
 * @param {object} view
 * @returns {{visible:boolean, state:string, title:string, detail:string, callLine:string, rule:string, targetLabel:string,
 *   target:string, targetPassed:boolean, tide:string, tideState:string}}
 */
export function peakCard(view) {
  const v = view || {};
  const out = { visible: false, state: 'none', title: '', detail: '', callLine: '', rule: '', targetLabel: '', target: '', targetPassed: false, tide: '', tideState: '' };
  if (!v.feeds || v.loading) return out;
  if (v.sampling && v.sampling.unavailable) return out;
  const g = v.feeds.gauge;
  const p = v.peak || {};
  const s = v.sampling || {};
  const call = p.call || null;
  if (!g || g.status === 'stale' || g.status === 'could_not_read') {
    const latest = v.observed ? v.observed.latest : null;
    const unreadable = !g || g.status === 'could_not_read' || !latest;
    // a premature call has no sampling card (crest.samplingCard), so s.card already leaves it out
    const standingCall = Boolean(call && s.visible && s.card);
    // Paused only when there is something to pause: a rise under way or a call standing at the last good reading. An old
    // gauge on a quiet day shows no red card (round 1 review); with no reading at all nothing is known, so the card shows.
    if (!unreadable && !p.episode && !standingCall) return out;
    // the status sentence already gives the gauge time, so the card does not repeat it (round 1 review)
    const detail = unreadable ? 'Could not read the river gauge.' : 'No fresh gauge reading.';
    const standing = standingCall ? { callLine: peakCallLine(call), ...targetBlock(v, s.card) } : {};
    return { ...out, visible: true, state: 'paused', title: 'Peak call paused.', detail, ...standing };
  }
  if (p.unavailable) return { ...out, visible: true, state: 'unavailable', title: 'Peak tracking is not available.' };
  // A tracked rise with a current gauge always has its card (crest.samplingVisible: an episode with a fresh gauge).
  if (p.state === 'rising') {
    let title = 'Peak not called yet.';
    if (call && call.premature) title = 'The river rose past the earlier peak call.';
    else if (call && call.secondPeak) title = 'Second peak building: the river rose again more than 12 h after the last call.';
    // "Highest so far" on every tracked-rise card, so the card always states a flow and the line never comes and goes with
    // ties (round 3, coordinator decision 3; spec section 2 item 6). The target rule says how the sample time will be set.
    return {
      ...out, visible: true, state: 'rising', title,
      detail: p.high ? `Highest so far: ${cfs(p.high.cfs)} at ${when(p.high.t, v.nowMs)}.` : '',
      rule: TARGET_RULE,
    };
  }
  // a premature call exists only while the river is rising (detector.js), so a standing call here is never premature
  if (s.visible && call) {
    return { ...out, visible: true, state: 'called', title: peakCallLine(call), detail: aboveCall(v, call), ...(s.card ? targetBlock(v, s.card) : { rule: TARGET_RULE }) };
  }
  // A rise the readings show before the detector tracks it. The card states a flow too, the 24-h high (earliest reading on ties),
  // so nothing jumps when tracking starts (round 4, decision 1c).
  const kind = riverKind(v);
  const o = v.observed || {};
  const h = o.high24;
  const detail = h && isNum(h.cfs) && isTime(h.t) ? `Highest so far: ${cfs(h.cfs)} at ${when(h.t, v.nowMs)}.` : '';
  if (kind === 'rising') return { ...out, visible: true, state: 'rising', title: 'Peak not called yet.', detail, rule: TARGET_RULE };
  // Over the line, off its 24-h high, never tracked: the card says no peak call comes for this rise and stays until the river is
  // back below the line (round 4, decision 1b).
  if (o.overLine && (kind === 'below' || kind === 'near')) {
    return { ...out, visible: true, state: 'untracked', title: 'No peak call: this rise is below the tracking rule.', detail, rule: TARGET_RULE };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Chart words: NOAA's crest line, crossing rows, legend taps, readout, summary
// ---------------------------------------------------------------------------------------------

/** The crest record line is shown beside NOAA's forecast crest only from this flow up (the study's storm size). */
export const CREST_RECORD_MIN_CFS = 800;

/**
 * NOAA's forecast crest line, shown only when NOAA's path has a crest within 72 h (a turn: a lower point after the
 * highest) or is still rising where the page stops reading it; '' otherwise. A path falling from now is drawn and needs
 * no line ("None ahead" under "rising" read as no peak coming), and a path's last point is never called its crest.
 * @param {object} view @returns {string}
 */
export function noaaCrestLine(view) {
  const f = (view && view.forecast) || {};
  const n = view && view.feeds ? view.feeds.noaa : null;
  if (!n || n.status !== 'ok' || f.status !== 'ok') return '';
  const c = f.noaaCrest;
  // no line for a path falling from now, or from its own first point after now (no rise before the turn: round 1 review)
  if (!c || c.fallingFromNow || c.fallingFromStart || c.noTurn === 'flat') return '';
  // still rising where the page stops reading it (its last point, or 72 h ahead): one short line with that time (round 4,
  // coordinator decision 5: the longer forms put a quiet day over its 160-word limit)
  if (c.risingAt72h || c.noTurn === 'rising') return `NOAA's line still rising at ${dayTime(c.t)}.`;
  return `${UI.noaaCrestLabel}: ${cfs(c.cfs)} at ${dayTime(c.t)}.`;
}

/**
 * NOAA's crest-timing record beside a forecast crest of 800 cfs or more (records.json), '' otherwise. When the record file
 * could not be read, or the record is missing or not displayable, the line says so (round 3, coordinator decision 7).
 * @param {object} view @returns {string}
 */
export function noaaCrestRecord(view) {
  const c = view && view.forecast ? view.forecast.noaaCrest : null;
  if (!noaaCrestLine(view) || !c || c.fallingFromNow || c.fallingFromStart || c.risingAt72h || c.noTurn || !isNum(c.cfs)) return '';
  // gated on the flow the line prints (a crest of 799.5 cfs prints "800 cfs" and gets its record: round 1 review)
  if (Math.round(c.cfs) < CREST_RECORD_MIN_CFS) return '';
  return recordText(view, 'chart_noaa_crest_record') || "NOAA's crest-timing record could not be read.";
}

/** A crest sentence for the screen-reader summary, which also describes a line that falls from now. */
function crestSummary(view) {
  const c = view.forecast ? view.forecast.noaaCrest : null;
  const n = view.feeds ? view.feeds.noaa : null;
  if (!c || !n || n.status !== 'ok' || !view.forecast || view.forecast.status !== 'ok') return '';
  if (c.fallingFromNow) return `NOAA's line falls from ${cfs(c.cfs)} now.`;
  if (c.fallingFromStart) return `NOAA's line falls from ${cfs(c.cfs)} at ${dayTime(c.t)}.`;
  if (c.noTurn === 'flat') {
    return isTime(view.nowMs) && c.t >= view.nowMs + 72 * 3_600_000
      ? `NOAA's line is level 72 h ahead (${dayTime(c.t)}).`
      : `NOAA's line is level at its last point (${dayTime(c.t)}).`;
  }
  return noaaCrestLine(view);
}

function crossingWord(t, view) {
  const w = crossingWhen(t, view);
  if (w === null) return 'stays below';
  if (w === 'already') return 'already over';
  if (w === 'passed') return `reached ${dayTime(t, view.nowMs)} (after the last reading)`;
  return w;
}

/**
 * Crossing times for the disclosure under the chart, one row per drawn line, or the reason there are none.
 * @param {object} view @returns {{rows:{key:string, label:string, value:string}[], note:string}}
 */
export function crossingRows(view) {
  // nothing from a replay file that could not be read, not even a reason (round 4, decision 6: render.js hides the disclosure)
  if (view && view.mode === 'fixture_error') return { rows: [], note: '' };
  const f = (view && view.forecast) || {};
  const n = view && view.feeds ? view.feeds.noaa : null;
  const g = view && view.feeds ? view.feeds.gauge : null;
  // No gauge readings, no crossing: the splice needs them. A missing computation is never shown as "stays below" (round 1 review).
  if (!g || g.status === 'could_not_read' || !view.observed || !view.observed.latest) {
    return { rows: [], note: 'Could not read the river gauge, so no crossing times are shown.' };
  }
  if (!n || n.status === 'could_not_read') return { rows: [], note: "Could not read NOAA's forecast, so no crossing times are shown." };
  // The feed's own status decides as well: a re-aged cached view can hold a forecast whose feed is now not shown.
  if (n.status !== 'ok' || f.status !== 'ok') return { rows: [], note: "NOAA's forecast is not shown, so no crossing times are shown." };
  // With the river over the line no crossing time is shown, the gauge current or not: with an old gauge the spliced path starts
  // at its own last reading, which a row would read as "NOAA already over" (round 4, decision 18).
  if (view.observed && view.observed.overLine) {
    return { rows: [], note: gaugeUsable(view) ? 'The river is over the season line, so no crossing times are shown.'
      : 'At the last gauge reading the river was over the season line, so no crossing times are shown.' };
  }
  const c = f.crossings || {};
  const rows = [{ key: 'raw', label: 'NOAA', value: crossingWord(c.raw, view) }];
  if (f.aligned === 'shown') rows.push({ key: 'aligned', label: 'NOAA shifted', value: crossingWord(c.aligned, view) });
  if (f.edges === 'shown') {
    // a case drawn only part of the way (it ends before NOAA's or the shifted line's crossing) says how far it is drawn
    const firstOther = [c.raw, c.aligned].filter(isTime).sort((a, b) => a - b)[0];
    const short = (t) => t === null && isTime(f.edgesEndT) && isTime(firstOther) && f.edgesEndT < firstOther;
    const word = (t) => (short(t) ? `stays below through ${dayTime(f.edgesEndT, view.nowMs)}` : crossingWord(t, view));
    rows.push({ key: 'high', label: 'High case', value: word(c.high) }, { key: 'low', label: 'Low case', value: word(c.low) });
  }
  return { rows, note: '' };
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
    case 'no_forecast': return "High and low cases not drawn: NOAA's forecast is not shown.";
    case 'noaa_could_not_read': return "High and low cases not drawn: could not read NOAA's forecast.";
    case 'off_season': return 'High and low cases: Oct–Apr only.';
    case 'gauge_stale': return 'High and low cases not drawn: no fresh gauge reading.';
    case 'gauge_missing': return 'High and low cases not drawn: no gauge reading.';
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

/** The one-line basis of the high and low cases (CONTRACT.md section 4 requires this phrase). */
export const RANGE_BASIS = "range of past misses around NOAA's forecast";

/** One line behind each legend button (the high and low case line comes from records.json, with its count). */
export const LEGEND = Object.freeze({
  observed: 'USGS gauge 12201500, every 15 minutes. Provisional.',
  raw: "NOAA's river forecast for this gauge (SMRW1), drawn as issued.",
  aligned: "NOAA's line moved up or down so it starts at the river's latest reading.",
  season: "Taylor Shellfish's line for the 24-h rise: 400 cfs Nov–Feb, 200 cfs Mar–Apr, 100 cfs May–Oct.",
});

/**
 * The line shown when a legend button is tapped.
 * @param {object|null} view @param {'observed'|'raw'|'aligned'|'range'|'season'} key @returns {string}
 */
export function legendText(view, key) {
  if (key === 'range') {
    return recordText(view, 'legend_range') || `The ${RANGE_BASIS}, Oct–Apr only. Its past counts are in the record file, which could not be read.`;
  }
  return LEGEND[key] || '';
}

/**
 * Readout text for one chart position (tap, drag or arrow keys).
 * @param {{t:number, observed:number|null, raw:number|null, aligned:number|null, low:number|null, high:number|null, rise:number|null, riseKind:string, line?:number|null}} p
 * @returns {{time:string, rows:{key:string, label:string, value:string}[]}}
 */
export function chartReadout(p) {
  const rows = [];
  if (isNum(p.observed)) rows.push({ key: 'observed', label: LINE_NAMES.observed, value: cfs(p.observed) });
  if (isNum(p.raw)) rows.push({ key: 'raw', label: 'NOAA', value: cfs(p.raw) });
  if (isNum(p.aligned)) rows.push({ key: 'aligned', label: 'NOAA shifted', value: cfs(p.aligned) });
  if (isNum(p.high)) rows.push({ key: 'range', label: 'High case', value: cfs(p.high) });
  if (isNum(p.low)) rows.push({ key: 'range', label: 'Low case', value: cfs(p.low) });
  if (isNum(p.rise)) rows.push({ key: 'rise', label: p.riseKind === 'observed' ? '24-h rise' : '24-h rise (NOAA shifted)', value: cfs(p.rise) });
  if (isNum(p.line)) rows.push({ key: 'season', label: 'Season line', value: cfs(p.line) });
  return { time: dayTime(p.t), rows };
}

/**
 * Short note drawn in the forecast side of the chart when no forecast lines are drawn.
 * @param {'could_not_read'|'withheld'} status @returns {string}
 */
export function chartForecastNote(status) {
  return status === 'could_not_read' ? "Could not read NOAA's forecast" : "NOAA's forecast not shown";
}

/** Keyboard help, read as the chart's description. @returns {string} */
export function chartKeys() {
  return 'With a keyboard, focus the chart and use the arrow keys.';
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
  if (view && view.mode === 'fixture_error') return `${chartEmpty(view)} Check the link.`;
  const n = view.feeds ? view.feeds.noaa : null;
  const shown = Boolean(n && n.status === 'ok' && view.forecast && view.forecast.status === 'ok');
  // NOAA's forecast is promised only when it is shown (round 1 review)
  const parts = [shown
    ? 'Chart of river flow at the Samish gauge for the last 72 hours, with NOAA’s forecast for the next 72 hours.'
    : 'Chart of river flow at the Samish gauge for the last 72 hours.'];
  const o = view.observed || {};
  const c = view.chart || {};
  // "Flow now" only from a current gauge; an old one gives its last reading (round 4, decision 18)
  if (o.latest) parts.push(`${gaugeUsable(view) ? 'Flow now' : 'Last reading'} ${cfs(o.latest.cfs)} at ${when(o.latest.t, view.nowMs)}.`);
  else parts.push('No gauge readings could be read.');
  if (c.obsMax) parts.push(`Highest in the last 72 hours: ${cfs(c.obsMax.cfs)} at ${dayTime(c.obsMax.t)}.`);
  if (c.obsMin) parts.push(`Lowest: ${cfs(c.obsMin.cfs)} at ${dayTime(c.obsMin.t)}.`);
  const crest = crestSummary(view);
  if (crest) parts.push(crest);
  const f = view.forecast || {};
  if (f.status === 'ok' && f.edges === 'shown' && c.rangeAtEnd) {
    parts.push(`At the end of the drawn forecast the low case is ${cfs(c.rangeAtEnd.low)} and the high case ${cfs(c.rangeAtEnd.high)}.`);
  }
  const cr = crossingRows(view);
  if (cr.note) parts.push(cr.note);
  else parts.push(`Season-line crossing: ${cr.rows.map((r) => `${r.key === 'aligned' ? 'NOAA shifted to gauge' : r.label} ${r.value}`).join(', ')}.`);
  if (view.season && isNum(view.season.lineCfs)) parts.push(`${seasonLineText(view.season.lineCfs)}, applied to the 24-hour rise.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------------------------
// Banners and page-level messages
// ---------------------------------------------------------------------------------------------

/**
 * Banner for cached, offline or replay states ('' when none).
 * @param {object} view @returns {{kind:'replay'|'cached'|'error'|'', text:string}}
 */
export function banner(view) {
  if (!view) return { kind: '', text: '' };
  if (view.mode === 'replay') {
    // No year (the weekday and date are enough in a replay); made-up tides are named whenever the replay's tides are made up,
    // so a current Tides pill is never the only word about them (round 3, coordinator decision 13; spec section 2 item 2).
    const tides = syntheticTides(view) ? ' · tides made up' : '';
    return { kind: 'replay', text: `Replay · ${dayTime(view.nowMs)}, ${MD.format(view.nowMs)} · not live${tides}` };
  }
  if (view.mode === 'fixture_error') {
    // a replay and not live, though nothing from it shows; a warning, not the cached view's clock (round 4, decision 6)
    return { kind: 'error', text: 'Replay · not live · Could not read that replay file. Showing nothing from it.' };
  }
  if (view.fromCache) {
    // the last good reading's own time and age, the same as the freshness line under the status (round 2 review)
    const g = view.feeds ? view.feeds.gauge : null;
    const t = g && isTime(g.dataT) ? g.dataT : view.builtMs;
    const age = g && isNum(g.ageMin) ? g.ageMin : view.cacheAgeMin;
    return { kind: 'cached', text: `Could not refresh. Showing the last good reading from ${when(t, view.renderMs ?? view.nowMs ?? view.builtMs)} (${ago(age)}).` };
  }
  return { kind: '', text: '' };
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
  if (view && view.mode === 'fixture_error') return 'No chart: nothing from this replay.';
  const g = view && view.feeds ? view.feeds.gauge : null;
  if (!g || g.status === 'could_not_read') return 'Could not read the river gauge, so there is no chart to draw.';
  return notAvailable();
}

// ---------------------------------------------------------------------------------------------
// Records (records.json): the sentences that carry the studies' numbers
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

/**
 * Sentence of one record by id (records.json `sentence`), or '' when missing, kept only for traceability (display never)
 * or worded against the rules.
 * @param {object} view @param {string} id @returns {string}
 */
export function recordText(view, id) {
  const e = recordEntry(view, id);
  if (e && e.display === 'never') return '';
  const t = e ? (typeof e.sentence === 'string' ? e.sentence : typeof e.text === 'string' ? e.text : '') : '';
  return t && !findForbidden(t).length ? t : '';
}

/** File names that say nothing on their own; sourceName adds the folder. */
const GENERIC_SOURCE_NAMES = Object.freeze(['RESULT.md', 'RESULT.json', 'SPEC.md', 'BRIEF.md', 'README.md']);

/** Short display form of a record's source path: Lab paths from the repo root, local paths as given; the frozen table by name. */
export function sourceLabel(path) {
  if (typeof path !== 'string' || !path) return '';
  const p = path.split('\\').join('/');
  if (p.split('/').pop() === 'ratio_table.json') return 'past-miss table';
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

/**
 * One shared source line for a list whose items all cite the same source, or '' when the items cite different sources
 * (each item then keeps its own line).
 * @param {{source?:string}[]} items @returns {string}
 */
export function sharedSource(items) {
  const list = Array.isArray(items) ? items : [];
  const s = [...new Set(list.map((i) => i.source || ''))];
  return list.length >= 2 && s.length === 1 && s[0] ? s[0] : '';
}

const pairText = (p) => (p && isNum(p.low) && isNum(p.high) ? `${p.low.toFixed(2)}–${p.high.toFixed(2)}` : '–');
const leadLabel = (lo, hi) => `${num(lo)}–${num(hi)} h`;

/**
 * The factor table under "High and low case": hours ahead, the rising pair, the level pair and the fixed widening below
 * the storm flow, copied from the frozen table (rounded to 2 decimals and whole cfs).
 * @param {object|null} table summarized ratio_table.json
 * @returns {{caption:string, head:string[], rows:string[][]}|null} null when the table has no v3 factors
 */
export function basisFactors(table) {
  const f = table && Array.isArray(table.factors) ? table.factors.filter((x) => x && (x.rise || x.flat)) : [];
  if (!f.length) return null;
  const storm = isNum(table.storm_flow_cfs) ? table.storm_flow_cfs : 150;
  return {
    caption: `Low and high factors that multiply NOAA's shifted path. Rising: the path is at least ${cfs(table.rise_floor_cfs ?? 50)} above the latest reading. Below ${cfs(storm)}: plus or minus a fixed amount.`,
    head: [UI.colLead, UI.colRising, UI.colLevel, UI.colBelow],
    rows: f.map((x) => [leadLabel(x.lead_lo_h, x.lead_hi_h), pairText(x.rise), pairText(x.flat), isNum(x.add_cfs) ? `±${num(x.add_cfs)} cfs` : '–']),
  };
}

// ---------------------------------------------------------------------------------------------
// How this works (one place to learn: the words, then the numbers and their sources) and Limits
// ---------------------------------------------------------------------------------------------

/**
 * The words on the page, each with the id an info button can scroll to. The season line and Taylor's target name their
 * private sources here; tools/build_public.py replaces those two sentences in the public copy. Taylor's 6 h has its written
 * source in records.json taylor_target_h, listed under Source files (round 3, coordinator decision 6; the sentence names that
 * source plainly since round 4, decision 17). "Peak call" holds the study's rule and the page's own tracking rule, beside
 * Taylor's target, and the Peak and sample card's info button lands on it (round 4, decisions 1d and 8).
 */
export const WORDS = Object.freeze([
  { id: 'how-season', term: 'Season line', text: "Confirmed in writing by Taylor Shellfish (October 2026). 400 cfs Nov–Feb, 200 cfs Mar–Apr, 100 cfs May–Oct, compared with the 24-h rise." },
  { id: 'how-rise', term: '24-h rise (study definition)', text: 'Flow now minus the lowest flow in the last 24 h.' },
  { id: 'how-noaa-line', term: "NOAA's forecast", text: "NOAA's river forecast for this gauge, drawn as issued." },
  { id: 'how-shifted', term: 'NOAA, shifted to gauge', text: "NOAA's line moved up or down so it starts at the latest gauge reading." },
  { id: 'how-cases', term: 'High and low case', text: `The ${RANGE_BASIS}. Oct–Apr only, out to 72 h.` },
  { id: 'how-crosses', term: 'Crosses', text: "When a line's 24-h rise first reaches the season line. Stays below: it does not within the 72 h drawn." },
  {
    id: 'how-peak-word', term: 'Peak call',
    text: "The rule of the study behind this page: flow is 2% below the highest reading, and that reading is at least 90 minutes old. This page starts tracking a rise at 150 cfs and half again above the lowest flow of the 72 h before, which differs from the study's storm list. Below that there is no peak call and no target time; before then, \"River rising.\" means the river is at its 24-h high and over the season line or up 50 cfs and half again from its 24-h low.",
  },
  { id: 'how-target', term: "Taylor's target", text: "Taylor Shellfish’s stated target (September 2026) is about 6 h after the peak. Counted from the peak this page calls on the gauge, never from NOAA's forecast crest. Not a Department of Health rule." },
  { id: 'how-tides', term: 'Tide heights', text: "Feet above NOAA's chart zero (MLLW): the average of each day's lowest tide." },
]);

/**
 * The numbers half of How this works: each heading and the records.json lines under it. The evidence headings say they are past
 * tests, so none repeats a word on the page (round 4, decision 8); the tracking rule moved to the words entry "Peak call".
 */
export const HOW_RECORD_SECTIONS = Object.freeze([
  { id: 'how-noaa', heading: "NOAA's record", ids: ['how_noaa_rises', 'how_noaa_no_rise', 'how_noaa_crest_timing', 'how_noaa_peak_flow'] },
  { id: 'how-range', heading: 'High and low case: past tests', ids: ['how_range_basis', 'how_range_coverage'] },
  { id: 'how-peak', heading: 'Peak call: past tests', ids: ['how_peak_call'] },
  // round 3 (coordinator decision 1): the page sets no time from rain; the study's counts say why, in short sentences
  { id: 'how-rain', heading: 'Rain and the peak', ids: ['how_rain_clock'] },
]);

/** Every records.json line the page can show outside the sheet's sections (their files join the source list). */
const OTHER_SHOWN_IDS = Object.freeze(['legend_range', 'chart_noaa_crest_record', 'limits_peak_call', 'limits_rain_clock']);

/** Records whose sentence is not shown but whose source file is listed: Taylor's 6 h (round 3, coordinator decision 6). */
const SOURCE_ONLY_IDS = Object.freeze(['taylor_target_h']);

/**
 * Every record the page shows (its sentence) or whose file it lists. Every other record in records.json is kept for traceability
 * and marked display never (round 4, coordinator decision 16; tests/strings.test.mjs pins the match both ways).
 */
export const PAGE_RECORD_IDS = Object.freeze([...HOW_RECORD_SECTIONS.flatMap((s) => s.ids), ...OTHER_SHOWN_IDS, ...SOURCE_ONLY_IDS]);

function recordItems(view, ids) {
  return ids
    .map((id) => ({ text: recordText(view, id), e: recordEntry(view, id) }))
    .filter((x) => x.text)
    .map((x) => {
      const title = typeof x.e.source_title === 'string' && x.e.source_title ? x.e.source_title : sourceName(x.e.source_path);
      return { text: x.text, source: title ? `Source: ${title}.` : '', path: sourceLabel(x.e.source_path) };
    });
}

/** Every source file behind the records the page shows, the record's own and any a single number cites. */
function sourceFiles(view) {
  const out = [];
  for (const id of PAGE_RECORD_IDS) {
    const e = recordEntry(view, id);
    if (!e || !recordText(view, id)) continue;
    out.push(sourceLabel(e.source_path));
    const nums = e.sentence_numbers && typeof e.sentence_numbers === 'object' ? Object.values(e.sentence_numbers) : [];
    for (const n of nums) if (n && typeof n.source_path === 'string') out.push(sourceLabel(n.source_path));
  }
  return [...new Set(out.filter(Boolean))];
}

/**
 * How this works: the words on the page, the feeds' sources, then NOAA's record, the high and low case, the peak call and
 * rain and the peak with their counts from records.json, and the list of source files. Plain sections, so any number is one
 * tap plus a scroll. Without the record file the counts are not invented.
 * @param {object|null} view @returns {object}
 */
export function howContent(view) {
  const unread = Boolean(view && view.recordsStatus === 'could_not_read');
  const empty = unread ? 'Could not read the record file.' : '';
  const sections = HOW_RECORD_SECTIONS.map((sec) => {
    const items = recordItems(view, sec.ids);
    const shared = sharedSource(items);
    return {
      id: sec.id,
      heading: sec.heading,
      items: shared ? items.map((i) => ({ ...i, source: '' })) : items,
      source: shared,
      factors: sec.id === 'how-range' ? basisFactors(view ? view.table : null) : null,
      empty: items.length ? '' : empty,
    };
  });
  // Without the record file, Source files only says it could not be read, so Taylor's target drops its pointer there (round 4,
  // decision 20). The pattern names no private word: the public copy's sentence has no pointer and passes through unchanged.
  const words = unread ? WORDS.map((w) => (w.id === 'how-target' ? { ...w, text: w.text.replace(/; [^;()]*under Source files\)/, ')') } : w)) : WORDS;
  const files = sourceFiles(view);
  return {
    title: UI.how,
    intro: 'A storm view of the Samish River at Burlington for Taylor Shellfish. Old or missing data is held back, and the page says why.',
    words: { id: 'how-words', heading: 'Words on this page', items: words },
    sources: {
      id: 'how-feeds', heading: 'Sources',
      text: 'USGS gauge 12201500 · NOAA river forecast, point SMRW1 · NOAA tide predictions, Bellingham 9449211 · NOAA radar rain (MRMS), averaged by us over the watershed above the gauge.',
    },
    sections,
    files: { id: 'how-sources', heading: 'Source files', summary: 'Every source file', paths: files, empty: files.length ? '' : empty },
  };
}

/**
 * Sheet text with every number kept on one line with its unit ("6 h", "800 cfs", "1 mm"): a no-break space between them, so
 * "(67 of 88 within 6 h)" never breaks between "6" and "h)" at 390 px (round 1 review). "24-h" is left as it is.
 * @param {string} text @returns {string}
 */
export function keepUnits(text) {
  return String(text).replace(/(\d) (h|cfs|mm|ft|min)(?![\w-])/g, '$1\xa0$2');
}

const okCount = (c) => Boolean(c && isNum(c.inside) && isNum(c.n) && c.n > 0);

/**
 * Limits sheet content. The outside count is the frozen table's own; the peak-call and rain counts are records.json
 * sentences. Without them the same limits are stated without numbers.
 * @param {object|null} [table] summarized ratio_table.json
 * @param {object|null} [view] view, for records.json
 * @returns {{title:string, items:string[], more:string, link:string}}
 */
export function limitsContent(table, view) {
  const pc = table && (table.pooled_coverage || (table.coverage && table.coverage.pooled));
  const outside = okCount(pc)
    ? `The river ended up outside the high–low range at ${num(pc.n - pc.inside)} of ${num(pc.n)} past forecast points (one forecast at one lead time), more often for big rises and older forecasts.`
    : 'The river sometimes ended up outside the high–low range, more often for big rises and older forecasts.';
  return {
    title: UI.limits,
    items: [
      'This page does not show or decide shellfish status. The Washington State Department of Health does.',
      "It claims no forecast skill. The high and low cases describe NOAA's past misses; they are not a forecast of their own.",
      outside,
      recordText(view, 'limits_peak_call') || 'A peak call can be exceeded: some first calls came too early, and some storms peaked again higher more than 12 h later.',
      recordText(view, 'limits_rain_clock') || 'The Radar pill shows only whether the hourly radar rain file is current. No peak or sample time on this page comes from rain.',
      'USGS readings are provisional and can be revised.',
      'Tide times are NOAA predictions at Bellingham, not Samish Bay water level. In a replay they are made up.',
      'The page updates every 5 min, only while it is on screen. It sends no messages.',
    ],
    more: 'Every count here, with its source:',
    link: UI.howLink,
  };
}
