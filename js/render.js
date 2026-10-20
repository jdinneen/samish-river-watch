// render.js: DOM rendering for Samish River Watch. Every word comes from strings.js.
// Text is always set with textContent (never parsed as HTML); the only markup strings are fixed icons and the chart SVG,
// whose text is escaped in chart.js.
// The page (phase 5, CONTRACT.md Amendment 2026-10-19): the status sentence with one freshness line, the Peak and sample
// card (only during a rise, within 48 h of a call, or while the call is paused), the 24-h rise, the feed pills and the
// chart; a footer with two links; two sheets, How this works and Limits. Every info button opens How this works at the
// heading it names.
'use strict';

import * as S from './strings.js';
import { mountChart, tableRows } from './chart.js';

// ---------------------------------------------------------------------------------------------
// Tiny DOM helpers
// ---------------------------------------------------------------------------------------------

/**
 * Create an element. props: class, text, on<event>, dataset, aria/attrs; children: nodes or strings.
 * @param {string} tag @param {object} [props] @param {...any} kids @returns {HTMLElement}
 */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === '' || c === false) continue;
    el.append(c && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = Object.freeze({
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  bang: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.4v.1"/>',
  up: '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
  peak: '<path d="M3 19l9-13 9 13"/><path d="M12 6v-3"/>',
  // near its highest so far, or below it: a rising line that levels off, which cannot read as a summit (round 4, coordinator
  // decision 7: the round 3 rounded top with a dot read as "peak called"); neither the rising arrow nor a quiet river's flat line
  plateau: '<path d="M3 19c4 0 5-11 10-11h8"/>',
  flat: '<path d="M4 12h16"/>',
  // over or under the season line, as the rise bar draws it: a dot above or below a line (no direction, round 2 review)
  above: '<path d="M4 16h16"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/>',
  below: '<path d="M4 8h16"/><circle cx="12" cy="15" r="2.5" fill="currentColor"/>',
  wave: '<path d="M2 14c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 19c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.1"/>',
  rain: '<path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 3.5v5h5"/><path d="M12 8v4l3 2"/>',
});

/** Decorative icon (aria-hidden); data-glyph names it for the tests. @param {keyof ICONS} name @param {string} [cls] @returns {HTMLElement} */
function icon(name, cls = 'icon') {
  const span = h('span', { class: cls, 'aria-hidden': 'true', 'data-glyph': name });
  span.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${ICONS[name] || ''}</svg>`;
  return span;
}

/** Replace an element's children. */
function fill(el, ...kids) {
  el.replaceChildren();
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === '' || c === false) continue;
    el.append(c && c.nodeType ? c : document.createTextNode(String(c)));
  }
}

const $ = (doc, id) => doc.getElementById(id);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

// ---------------------------------------------------------------------------------------------
// Static chrome (built once)
// ---------------------------------------------------------------------------------------------

/**
 * Build the parts of the page that do not change between refreshes and wire their handlers.
 * @param {Document} doc
 * @param {{onRefresh:Function, onTheme:Function, replay:boolean}} ctx
 * @returns {object} refs used by the other render functions
 */
export function renderStatic(doc, ctx) {
  const ids = ['main', 'banner', 'status', 'status-h', 'status-icon', 'status-sentence', 'status-fresh', 'crest', 'crest-h', 'crest-info',
    'crest-body', 'rise', 'rise-h', 'rise-info', 'rise-body', 'feeds-h', 'feeds-toggle', 'feeds-panel', 'chart-h', 'chart-legend', 'chart-panels-note',
    'chart-basis', 'chart-range-note', 'chart-crest', 'chart-readout', 'chart-host', 'chart-summary', 'chart-keys', 'chart-table-summary',
    'chart-table', 'chart-table-body', 'footer-nav', 'footer-note', 'sheet-how', 'sheet-limits', 'btn-refresh', 'btn-theme', 'skip-link', 'app-name',
    'app-place'];
  const r = { doc, ctx, chart: null, lastStatus: '', basisKey: null, sheetsKey: null, view: null };
  for (const id of ids) r[id] = $(doc, id);

  r['skip-link'].textContent = S.UI.skip;
  // the chart caption's words are fixed (section 13, 2026-10-20); renderChart shows the line with a drawn chart and hides it otherwise
  r['chart-panels-note'].textContent = S.UI.chartPanelsNote;
  r['app-name'].textContent = S.UI.appName;
  // the place only (spec section 2 item 1); the station codes are in How this works, under Sources
  r['app-place'].textContent = S.UI.place;
  r['status-h'].textContent = S.UI.statusHeading;
  r['crest-h'].textContent = S.UI.crestHeading;
  r['rise-h'].textContent = `${S.UI.riseHeading} (${S.UI.riseStudy})`;
  r['feeds-h'].textContent = S.UI.feedsHeading;
  r['chart-h'].textContent = S.UI.chartHeading;
  r['chart-keys'].textContent = S.chartKeys();
  r['chart-host'].setAttribute('aria-label', S.UI.chartHeading);
  r['chart-table-summary'].textContent = S.UI.chartTable;
  r['footer-note'].textContent = S.UI.footer;
  // the words entry that states the study's rule and the page's tracking rule, beside Taylor's target (round 4, decision 8)
  setInfo(r, r['crest-info'], S.UI.infoPeak, 'how-peak-word');
  setInfo(r, r['rise-info'], S.UI.infoRise, 'how-rise');

  // header buttons
  fill(r['btn-refresh'], icon('refresh'), h('span', { class: 'btn-label', text: S.UI.refresh }));
  r['btn-refresh'].setAttribute('aria-label', S.UI.refresh);
  r['btn-refresh'].addEventListener('click', () => ctx.onRefresh());
  r['btn-theme'].addEventListener('click', () => ctx.onTheme());
  if (ctx.replay) r['btn-refresh'].hidden = true;

  // legend: each line's one-line basis one tap away
  const legendItems = [
    ['observed', 'key-observed'], ['raw', 'key-raw'], ['aligned', 'key-aligned'], ['range', 'key-range'], ['season', 'key-season'],
  ];
  r.legendButtons = {};
  fill(r['chart-legend'], legendItems.map(([key, cls]) => {
    const b = h('button', {
      type: 'button', class: 'legend-item', 'aria-expanded': 'false', 'aria-controls': 'chart-basis',
      onclick: () => toggleBasis(r, key),
    }, h('span', { class: `legend-key ${cls}`, 'aria-hidden': 'true' }), h('span', { class: 'legend-label', text: S.LINE_NAMES[key] }), icon('chevron', 'icon icon-sm'));
    r.legendButtons[key] = b;
    return b;
  }));

  // feeds toggle
  r['feeds-toggle'].addEventListener('click', () => {
    const show = r['feeds-panel'].hidden;
    r['feeds-panel'].hidden = !show;
    r['feeds-toggle'].setAttribute('aria-expanded', String(show));
    if (r.view) renderFeedsToggle(r, r.view);
  });

  // footer: How this works · Limits
  fill(r['footer-nav'],
    h('button', { type: 'button', class: 'link-btn', onclick: () => openHow(r, null) }, S.UI.how),
    h('button', { type: 'button', class: 'link-btn', onclick: () => showSheet(r, r['sheet-limits']) }, S.UI.limits));

  buildSheets(r, null);
  for (const d of [r['sheet-how'], r['sheet-limits']]) wireSheet(r, d);

  renderFeedsToggle(r, null);
  return r;
}

/** Turn a button into an info button: a 44 px target with a spoken label, opening How this works at a heading. */
function setInfo(r, el, label, targetId) {
  el.setAttribute('type', 'button');
  el.className = 'info-btn';
  el.setAttribute('aria-label', label);
  fill(el, icon('info'));
  el.addEventListener('click', () => openHow(r, targetId));
}

/** A new info button (for parts drawn on each refresh). */
function infoButton(r, label, targetId) {
  return h('button', { type: 'button', class: 'info-btn', 'aria-label': label, onclick: () => openHow(r, targetId) }, icon('info'));
}

function toggleBasis(r, key) {
  const pop = r['chart-basis'];
  const same = r.basisKey === key && !pop.hidden;
  for (const [k, b] of Object.entries(r.legendButtons)) b.setAttribute('aria-expanded', String(!same && k === key));
  if (same) { pop.hidden = true; r.basisKey = null; return; }
  r.basisKey = key;
  fill(pop, h('p', { text: S.legendText(r.view, key) }));
  pop.hidden = false;
}

// ---------------------------------------------------------------------------------------------
// Sheets: How this works (the words, then the numbers and their sources) and Limits
// ---------------------------------------------------------------------------------------------

function sheetHead(r, dialog, id, title) {
  return h('div', { class: 'sheet-head' },
    h('h2', { id, class: 'sheet-title', text: title }),
    h('button', { type: 'button', class: 'btn btn-secondary sheet-done', onclick: () => dialog.close() }, S.UI.close));
}

/** A small, labelled data table (first column is the row header). */
function miniTable(caption, head, rows) {
  return h('div', { class: 'mini-wrap' }, h('table', { class: 'mini' },
    h('caption', { text: caption }),
    h('thead', {}, h('tr', {}, head.map((t) => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows.map((row) => h('tr', {}, h('th', { scope: 'row', text: row[0] }), row.slice(1).map((c) => h('td', { text: c })))))));
}

function buildHow(r, view) {
  const d = r['sheet-how'];
  const c = S.howContent(view);
  const heading = (id, text) => h('h3', { id, tabindex: '-1', text });
  // every number keeps its unit on the same line in the sheets (S.keepUnits: a no-break space)
  const u = S.keepUnits;
  fill(d, h('div', { class: 'sheet-inner' },
    sheetHead(r, d, 'sheet-how-h', c.title),
    h('div', { class: 'sheet-body' },
      h('p', { class: 'sheet-intro', text: c.intro }),
      h('section', { class: 'sheet-section' }, heading(c.words.id, c.words.heading),
        h('dl', { class: 'words' }, c.words.items.map((w) => [h('dt', { id: w.id, tabindex: '-1', text: w.term }), h('dd', { text: u(w.text) })]))),
      h('section', { class: 'sheet-section' }, heading(c.sources.id, c.sources.heading), h('p', { text: c.sources.text })),
      c.sections.map((s) => h('section', { class: 'sheet-section' },
        heading(s.id, s.heading),
        s.items.map((it) => h('div', { class: 'how-item' }, h('p', { text: u(it.text) }), it.source ? h('p', { class: 'source', text: it.source }) : null)),
        s.empty ? h('p', { class: 'meta', text: s.empty }) : null,
        s.factors ? h('details', { class: 'more' }, h('summary', { text: S.UI.basisFactorsHeading }), miniTable(s.factors.caption, s.factors.head, s.factors.rows)) : null,
        s.source ? h('p', { class: 'source', text: s.source }) : null)),
      h('section', { class: 'sheet-section' }, heading(c.files.id, c.files.heading),
        c.files.paths.length
          ? h('details', { class: 'more' }, h('summary', { text: c.files.summary }), h('ul', { class: 'source-paths' }, c.files.paths.map((p) => h('li', { text: p }))))
          : (c.files.empty ? h('p', { class: 'meta', text: c.files.empty }) : null)))));
}

function buildLimits(r, view) {
  const d = r['sheet-limits'];
  const c = S.limitsContent(view ? view.table : null, view);
  fill(d, h('div', { class: 'sheet-inner' },
    sheetHead(r, d, 'sheet-limits-h', c.title),
    h('div', { class: 'sheet-body' }, h('ul', { class: 'limits-list' },
      c.items.map((t) => h('li', { text: S.keepUnits(t) })),
      h('li', { class: 'limits-more' }, `${c.more} `, h('button', { type: 'button', class: 'link-btn', onclick: () => openHow(r, 'how-noaa') }, c.link))))));
}

/** What the sheets were last built from: rebuilt only when the record file or the table arrives or goes. */
function sheetsKey(view) {
  if (!view) return 'none';
  const n = view.records && Array.isArray(view.records.records) ? view.records.records.length : 0;
  return `${view.recordsStatus || ''}|${n}|${view.table ? (view.table.factors || []).length : -1}`;
}

function buildSheets(r, view) {
  buildHow(r, view);
  buildLimits(r, view);
  r.sheetsKey = sheetsKey(view);
}

/** True while either sheet is up. */
function anySheetOpen(r) {
  return Boolean(r['sheet-how'].open || r['sheet-limits'].open);
}

function wireSheet(r, d) {
  d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
  d.addEventListener('close', () => {
    // The browser queues a dialog's close event, so when Limits hands over to How this works this runs after How this works
    // is already up: it must not unlock the page behind it or send focus behind it (round 1 review, 2026-10-19).
    if (anySheetOpen(r)) return;
    r.doc.documentElement.classList.remove('sheet-up');
    const back = r.returnFocus;
    r.returnFocus = null;
    if (back && back.isConnected !== false && typeof back.focus === 'function') back.focus();
  });
}

function showSheet(r, d) {
  if (typeof d.showModal !== 'function') return;
  try { if (d.matches(':modal')) return; } catch { /* older engines: no :modal selector */ }
  if (!anySheetOpen(r)) r.returnFocus = r.doc.activeElement;
  r.doc.documentElement.classList.add('sheet-up');
  d.showModal();
}

/**
 * Show How this works, scrolled to a heading (an info button) or at its top (the footer link). Limits closes first, so only
 * one sheet shows at a time; focus then goes back to what opened Limits.
 * @param {object} r refs @param {string|null} targetId
 */
function openHow(r, targetId) {
  const lim = r['sheet-limits'];
  const from = lim.open ? r.returnFocus : null;
  if (lim.open && typeof lim.close === 'function') lim.close();
  showSheet(r, r['sheet-how']);
  if (from) r.returnFocus = from;
  const el = targetId ? r.doc.getElementById(targetId) : null;
  if (el) {
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
    if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  } else {
    const body = r['sheet-how'].querySelector('.sheet-body');
    if (body) body.scrollTop = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Header state
// ---------------------------------------------------------------------------------------------

/** Theme button label and icon. @param {object} r @param {'auto'|'light'|'dark'} theme */
export function renderTheme(r, theme) {
  const word = theme === 'light' ? S.UI.themeLight : theme === 'dark' ? S.UI.themeDark : S.UI.themeAuto;
  fill(r['btn-theme'], icon(theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto'), h('span', { class: 'btn-label', text: word }));
  r['btn-theme'].setAttribute('aria-label', `${S.UI.themeHint}. ${word}`);
}

/** Busy state on the refresh button. @param {object} r @param {boolean} busy */
export function renderBusy(r, busy) {
  r['btn-refresh'].classList.toggle('is-busy', busy);
  r['btn-refresh'].setAttribute('aria-label', busy ? S.UI.refreshing : S.UI.refresh);
  r['btn-refresh'].disabled = busy;
}

/** Initial skeleton state (the skeleton markup is in index.html). @param {object} r */
export function renderLoading(r) {
  r.main.setAttribute('aria-busy', 'true');
  r['status-fresh'].textContent = S.freshLine({ loading: true });
  renderFeedsToggle(r, null);
}

// ---------------------------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------------------------

/**
 * Render a whole view. Can be called repeatedly; only changed text is re-announced.
 * @param {object} r refs from renderStatic
 * @param {object} view immutable view from app.js
 * @param {{refreshing?:boolean}} [opts]
 */
export function renderView(r, view, opts = {}) {
  r.view = view;
  r.main.setAttribute('aria-busy', opts.refreshing ? 'true' : 'false');
  renderBanner(r, view);
  renderStatus(r, view);
  renderPeak(r, view);
  renderRise(r, view);
  renderFeedsToggle(r, view);
  renderFeedsPanel(r, view);
  renderChart(r, view);
  if (sheetsKey(view) !== r.sheetsKey) buildSheets(r, view);
  r.doc.documentElement.dataset.mode = view.mode || 'live';
}

function renderBanner(r, view) {
  const b = S.banner(view);
  const el = r.banner;
  if (!b.text) { el.hidden = true; el.replaceChildren(); return; }
  el.className = `banner banner-${b.kind}`;
  fill(el, icon({ replay: 'replay', error: 'bang' }[b.kind] || 'clock'), h('span', { text: b.text }));
  el.hidden = false;
}

function renderStatus(r, view) {
  const sentence = S.statusSentence(view);
  const el = r['status-sentence'];
  if (sentence !== r.lastStatus || el.querySelector('.sk')) {
    el.textContent = sentence;
    r.lastStatus = sentence;
  }
  const o = view.observed || {};
  // The edge tint says where the river stands against the season line (magenta over it) or that the gauge has a problem; the
  // icon says what the river part of the sentence says (round 1 review: a rising arrow beside "Peak called." read as the
  // opposite of the words): rising arrow for "River rising", a plateau for "River near its highest so far" and "River below
  // its high so far" (round 3 review: it shared the quiet page's flat line; round 4, decisions 1a and 7), a peak for "Peak
  // called", warning for the gauge, flat otherwise.
  const kind = S.riverKind(view);
  const line = kind === 'gauge' ? 'bad' : o.overLine ? 'over' : 'under';
  r.status.classList.toggle('is-bad', line === 'bad');
  r.status.dataset.line = line;
  const glyph = { gauge: 'bang', rising: 'up', near: 'plateau', below: 'plateau', called: 'peak' }[kind] || 'flat';
  r['status-icon'].dataset.glyph = glyph;
  fill(r['status-icon'], icon(glyph));
  r['status-fresh'].textContent = S.freshLine(view);
}

function renderPeak(r, view) {
  const u = S.keepUnits;
  const w = S.peakCard(view);
  const card = r.crest;
  card.hidden = !w.visible;
  card.dataset.state = w.state;
  card.classList.toggle('is-bad', w.state === 'paused');
  if (!w.visible) { r['crest-body'].replaceChildren(); return; }
  const target = w.target ? h('div', { class: 'pk-target' },
    h('p', { class: 'pk-label', text: u(w.targetLabel) }),
    h('p', { class: `pk-time${w.targetPassed ? ' is-passed' : ''}`, text: w.target }),
    w.tide ? h('p', { class: `pk-tide${w.tideState === 'bad' ? ' bad-text' : ''}` }, icon(w.tideState === 'bad' ? 'bang' : 'wave', 'icon icon-sm'), h('span', { text: u(w.tide) })) : null)
    : null;
  // No rain clock (round 3, coordinator decision 1): the peak status, the highest so far or the call, the target rule or time.
  fill(r['crest-body'],
    h('p', { class: 'pk-title', text: u(w.title) }),
    w.detail ? h('p', { class: 'pk-detail', text: u(w.detail) }) : null,
    w.callLine ? h('p', { class: 'pk-callline', text: u(w.callLine) }) : null,
    w.rule ? h('p', { class: 'pk-rule', text: u(w.rule) }) : null,
    target);
}

function renderRise(r, view) {
  const u = S.keepUnits;
  const w = S.riseCard(view);
  const body = r['rise-body'];
  r.rise.classList.toggle('is-bad', (w.missing && !w.neutral) || w.stale);
  if (w.missing) {
    // a replay file that could not be read is not a gauge failure: no red line, and no season-line row when its time did not parse
    fill(body, w.neutral ? h('p', { class: 'rise-compare' }, h('span', { text: u(w.compare) })) : h('p', { class: 'bad-line' }, icon('bang'), h('span', { text: u(w.compare) })),
      w.line ? h('p', { class: 'rise-line', text: u(w.line) }) : null);
    return;
  }
  const line = view.observed ? view.observed.lineAtLatest : null;
  const rise = view.observed ? view.observed.riseCfs : null;
  const over = isNum(rise) && isNum(line) && rise >= line;
  const max = Math.max((line || 100) * 1.5, (rise || 0) * 1.1);
  const meter = h('div', { class: `meter${over ? ' is-over' : ''}${w.stale ? ' is-stale' : ''}`, ...(w.meterLabel ? { role: 'img', 'aria-label': w.meterLabel } : { 'aria-hidden': 'true' }) },
    h('div', { class: 'meter-fill' }), h('div', { class: 'meter-line' }));
  meter.firstChild.style.width = `${Math.max(0, Math.min(100, ((rise || 0) / max) * 100))}%`;
  meter.lastChild.style.left = `${Math.min(100, ((line || 0) / max) * 100)}%`;
  fill(body,
    h('div', { class: 'rise-top' },
      h('p', { class: 'rise-main' }, h('span', { class: 'rise-value', text: w.value }), h('span', { class: 'rise-unit', text: w.unit })),
      // over or under the season line, never a direction: an up arrow under "Peak called." read as rising (round 2 review)
      h('p', { class: `rise-compare${over ? ' is-over' : ''}` }, icon(over ? 'above' : 'below', 'icon icon-sm'), h('span', { text: u(w.compare) }))),
    meter,
    h('p', { class: `rise-line${w.stale ? ' bad-text' : ''}`, text: u(w.line) }));
}

const FEED_KEYS = ['gauge', 'noaa', 'tides', 'basin'];

/**
 * One feed's look, the same on its pill and its panel row: current (a check), not current (a warning), reading (a clock), or,
 * while the cached banner is up, neutral and "not refreshed" (a clock; round 3, coordinator decision 12). A feed a replay file
 * that could not be read never asked for has the same neutral look, "not read" (round 4, coordinator decision 6).
 * @returns {{cls:string, glyph:string}}
 */
function feedLook(f, cached) {
  if (cached || f.status === 'not_read') return { cls: 'is-cached', glyph: 'clock' };
  if (f.status === 'ok') return { cls: 'is-ok', glyph: 'check' };
  if (f.status === 'loading') return { cls: 'is-loading', glyph: 'clock' };
  return { cls: 'is-bad', glyph: 'bang' };
}

function renderFeedsToggle(r, view) {
  const nowMs = view ? view.nowMs : 0;
  const cached = Boolean(view && view.fromCache);
  const expanded = r['feeds-toggle'].getAttribute('aria-expanded') === 'true';
  const pills = FEED_KEYS.map((k) => {
    const f = view ? view.feeds[k] : { status: 'loading' };
    const look = feedLook(f, cached);
    return h('span', { class: `pill ${look.cls}` },
      icon(look.glyph, 'icon icon-sm'),
      h('span', { class: 'pill-name', text: S.pillText(k, f, cached) }));
  });
  fill(r['feeds-toggle'], h('span', { class: 'pills' }, pills), icon('chevron', `icon icon-sm chev${expanded ? ' is-up' : ''}`));
  const synthetic = Boolean(view && view.fixtureNotes && view.fixtureNotes.syntheticTides);
  const labels = FEED_KEYS.map((k) => S.feedDotLabel(k, view ? view.feeds[k] : { status: 'loading' }, nowMs, cached, synthetic));
  r['feeds-toggle'].setAttribute('aria-label', `${S.UI.feedsHeading}. ${labels.join('. ')}. ${expanded ? S.UI.feedsHide : S.UI.feedsHint}`);
}

function renderFeedsPanel(r, view) {
  const cached = Boolean(view.fromCache);
  fill(r['feeds-panel'], h('ul', { class: 'feed-list' }, FEED_KEYS.map((k) => {
    const f = view.feeds[k];
    const look = feedLook(f, cached);
    const problem = S.feedProblem(k, f);
    const extra = k === 'basin' ? S.radarNote(view) : '';
    return h('li', { class: `feed-row ${look.cls}` },
      icon(look.glyph, 'icon icon-sm'),
      h('div', { class: 'feed-text' },
        h('p', { class: 'feed-name', text: S.feedRow(k, view) }),
        extra ? h('p', { class: 'feed-extra' }, icon('rain', 'icon icon-sm'), h('span', { text: extra })) : null,
        problem ? h('p', { class: 'feed-problem', text: problem }) : null));
  })));
}

const ROW_KEY = Object.freeze({ raw: 'key-raw', aligned: 'key-aligned', high: 'key-range', low: 'key-range' });

function renderChart(r, view) {
  const c = view.chart;
  const drawn = { observed: Boolean(c && c.observed.length), raw: Boolean(c && c.raw.length), aligned: Boolean(c && c.aligned.length), range: Boolean(c && c.high.length), season: Boolean(c && c.seasonLine.length) };
  for (const [k, b] of Object.entries(r.legendButtons)) b.classList.toggle('is-off', !drawn[k]);
  if (r.basisKey && !r['chart-basis'].hidden) fill(r['chart-basis'], h('p', { text: S.legendText(view, r.basisKey) }));
  const rn = S.rangeNote(view);
  fill(r['chart-range-note'], rn ? [icon('info', 'icon icon-sm'), h('span', { text: rn })] : null);
  r['chart-range-note'].hidden = !rn;
  // NOAA's forecast crest line, only with a crest ahead or a line still rising, and its record beside a crest of 800 cfs or more
  const crest = S.noaaCrestLine(view);
  const rec = S.noaaCrestRecord(view);
  fill(r['chart-crest'], crest
    ? [h('div', { class: 'chart-crest-row' }, h('p', { class: 'chart-crest-line', text: S.keepUnits(crest) }), infoButton(r, S.UI.infoCrest, 'how-noaa')),
      rec ? h('p', { class: 'meta chart-crest-record', text: S.keepUnits(rec) }) : null]
    : null);
  r['chart-crest'].hidden = !crest;
  renderTable(r, view);
  r['chart-summary'].textContent = S.chartSummary(view);
  // Nothing to draw (no chart, or neither gauge readings nor NOAA's path): say why instead of an empty grid.
  if (!c || (!c.observed.length && !c.raw.length)) {
    if (r.chart) { r.chart.destroy(); r.chart = null; }
    fill(r['chart-host'], h('p', { class: 'chart-empty', text: S.chartEmpty(view) }));
    // no chart, so no hint to tap it, no empty readout bar (round 4, decision 6) and no caption for panels that are not there
    r['chart-readout'].replaceChildren();
    r['chart-readout'].hidden = true;
    r['chart-panels-note'].hidden = true;
    return;
  }
  r['chart-readout'].hidden = false;
  // the one visible line under the SVG that says which panel the season line is drawn in (section 13, 2026-10-20)
  r['chart-panels-note'].textContent = S.UI.chartPanelsNote;
  r['chart-panels-note'].hidden = false;
  if (!r.chart) r.chart = mountChart(r['chart-host'], r['chart-readout'], c, 'srwc');
  else r.chart.update(c);
}

/** The disclosure under the chart: crossing times for each drawn line (or why there are none), then the values table. */
function renderTable(r, view) {
  // nothing from a replay file that could not be read: no crossing times, no values, so no disclosure (round 4, decision 6)
  r['chart-table'].hidden = view.mode === 'fixture_error';
  const cr = S.crossingRows(view);
  const crossing = cr.note
    ? h('p', { class: 'cross-note', text: cr.note })
    : h('ul', { class: 'cross-list' }, cr.rows.map((row) => h('li', {},
      h('span', { class: `legend-key ${ROW_KEY[row.key] || 'key-range'}`, 'aria-hidden': 'true' }), h('span', { text: `${row.label} ${row.value}` }))));
  const rows = view.chart ? tableRows(view.chart, 3) : [];
  const td = (v) => h('td', { text: isNum(v) ? S.num(v) : '–' });
  fill(r['chart-table-body'], crossing, rows.length ? h('div', { class: 'table-wrap' }, h('table', {},
    h('caption', { class: 'sr-only', text: S.UI.chartTableCaption }),
    h('thead', {}, h('tr', {}, [S.UI.colTime, S.UI.colObserved, S.UI.colNoaa, S.UI.colAligned, S.UI.colRange, S.UI.colRise].map((t) => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows.map((v) => h('tr', { class: v.t > view.nowMs ? 'is-future' : '' },
      h('th', { scope: 'row', text: S.dayTime(v.t) }),
      td(v.observed), td(v.raw), td(v.aligned),
      h('td', { text: isNum(v.low) && isNum(v.high) ? `${S.num(v.low)}–${S.num(v.high)}` : '–' }),
      td(v.rise)))))) : null);
}
