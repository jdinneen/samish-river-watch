// render.js: DOM rendering for Samish River Watch. Every word comes from strings.js.
// Text is always set with textContent (never parsed as HTML); the only markup strings are fixed icons and the chart SVG,
// whose text is escaped in chart.js.
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
  peak: '<path d="M3 19l6-9 4 5 3-4 5 8"/><path d="M9 10V4"/><path d="M9 4h5l-1.5 2L14 8H9"/>',
  flat: '<path d="M4 12h16"/>',
  wave: '<path d="M2 14c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 19c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.1"/>',
  rain: '<path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 3.5v5h5"/><path d="M12 8v4l3 2"/>',
});

/** Decorative icon (aria-hidden). @param {keyof ICONS} name @param {string} [cls] @returns {HTMLElement} */
function icon(name, cls = 'icon') {
  const span = h('span', { class: cls, 'aria-hidden': 'true' });
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

// ---------------------------------------------------------------------------------------------
// Static chrome (built once)
// ---------------------------------------------------------------------------------------------

/**
 * Build the parts of the page that do not change between refreshes and wire their handlers.
 * @param {Document} doc
 * @param {{onRefresh:Function, onTheme:Function, onTap:Function, onUndo:Function, onExport:Function, onClear:Function, replay:boolean}} ctx
 * @returns {object} refs used by the other render functions
 */
export function renderStatic(doc, ctx) {
  const ids = ['main', 'banner', 'status', 'status-h', 'status-sentence', 'line-chip', 'status-time', 'rise-h', 'rise-body',
    'crest-h', 'crest-body', 'feeds-h', 'feeds-toggle', 'feeds-panel', 'chart-h', 'chart-ages', 'chart-legend', 'chart-basis', 'chart-range-note',
    'chart-readout', 'chart-host', 'chart-hint', 'chart-summary', 'crossing', 'chart-table-summary', 'chart-table-body',
    'crest-panel-h', 'crest-panel-body', 'sampling', 'sampling-h', 'sampling-body', 'tap-slot-sampling', 'record-h', 'record-body',
    'basis-h', 'basis-body', 'log-h', 'tap-slot-log', 'log-body', 'footer-nav', 'footer-note', 'sheet-about', 'sheet-limits',
    'sheet-explainer', 'confirm-clear', 'toast', 'btn-refresh', 'btn-theme', 'skip-link', 'app-name', 'app-place'];
  const r = { doc, ctx, chart: null, lastStatus: '', toastTimer: 0, basisKey: null, sheetsTable: undefined };
  for (const id of ids) r[id] = $(doc, id);

  r['skip-link'].textContent = S.UI.skip;
  r['app-name'].textContent = S.UI.appName;
  fill(r['app-place'], h('span', { text: S.UI.place }), h('span', { class: 'brand-ids', text: ` · ${S.UI.placeIds}` }));
  r['status-h'].textContent = S.UI.statusHeading;
  r['rise-h'].textContent = `${S.UI.riseHeading} (${S.UI.riseStudy})`;
  r['crest-h'].textContent = S.UI.crestHeading;
  r['feeds-h'].textContent = S.UI.feedsHeading;
  r['chart-h'].textContent = S.UI.chartHeading;
  r['chart-hint'].textContent = S.chartHint();
  r['chart-host'].setAttribute('aria-label', S.UI.chartHeading);
  r['chart-table-summary'].textContent = S.UI.chartTable;
  r['crest-panel-h'].textContent = S.UI.crestPanelHeading;
  r['sampling-h'].textContent = S.UI.samplingHeading;
  r['record-h'].textContent = S.UI.recordHeading;
  r['basis-h'].textContent = S.UI.basisHeading;
  r['log-h'].textContent = S.UI.logHeading;
  r['footer-note'].textContent = S.UI.footer;

  // header buttons
  fill(r['btn-refresh'], icon('refresh'), h('span', { class: 'btn-label', text: S.UI.refresh }));
  r['btn-refresh'].setAttribute('aria-label', S.UI.refresh);
  r['btn-refresh'].addEventListener('click', () => ctx.onRefresh());
  r['btn-theme'].addEventListener('click', () => ctx.onTheme());
  if (ctx.replay) r['btn-refresh'].hidden = true;

  // legend: each line's basis one tap away
  const legendItems = [
    ['observed', 'key-observed'], ['raw', 'key-raw'], ['aligned', 'key-aligned'], ['range', 'key-range'], ['season', 'key-season'],
  ];
  r.legendButtons = {};
  fill(r['chart-legend'], legendItems.map(([key, cls]) => {
    const b = h('button', {
      type: 'button', class: 'legend-item', 'aria-expanded': 'false', 'aria-controls': 'chart-basis',
      onclick: () => toggleBasis(r, key),
    }, h('span', { class: `legend-key ${cls}`, 'aria-hidden': 'true' }), h('span', { class: 'legend-label', text: S.LINE_NAMES[key] }), icon('info', 'icon icon-sm'));
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

  // taps (one group, moved between the sampling card and the log)
  r.taps = h('div', { class: 'taps', role: 'group', 'aria-label': S.UI.logHeading },
    ...['bay', 'county', 'call50', 'call80'].map((kind) => h('button', {
      type: 'button', class: `tap tap-${kind}`, dataset: { kind }, onclick: () => ctx.onTap(kind),
    }, icon(kind === 'bay' ? 'drop' : kind === 'county' ? 'wave' : 'check'), h('span', { text: S.TAP_KINDS[kind] }))));
  r['tap-slot-log'].append(r.taps);

  // log list + actions
  r.logCounter = h('div', { class: 'counter' });
  r.logList = h('div', { class: 'log-list' });
  r.logNote = h('p', { class: 'meta' });
  r.logExport = h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => ctx.onExport() }, S.UI.logExport);
  r.logClear = h('button', { type: 'button', class: 'btn btn-danger-quiet', onclick: () => showSheet(r, r['confirm-clear']) }, S.UI.logClear);
  fill(r['log-body'], r.logCounter, r.logList, h('div', { class: 'log-actions' }, r.logExport, r.logClear), r.logNote);

  // footer
  fill(r['footer-nav'],
    h('button', { type: 'button', class: 'link-btn', onclick: () => showSheet(r, r['sheet-about']) }, S.UI.about),
    h('button', { type: 'button', class: 'link-btn', onclick: () => showSheet(r, r['sheet-limits']) }, S.UI.limits),
    h('button', { type: 'button', class: 'link-btn', onclick: () => showSheet(r, r['sheet-explainer']) }, S.UI.howToRead));

  buildAbout(r);
  buildLimits(r, null);
  buildExplainer(r, null);
  buildConfirm(r);
  for (const d of [r['sheet-about'], r['sheet-limits'], r['sheet-explainer'], r['confirm-clear']]) wireSheet(r, d);

  renderFeedsToggle(r, null);
  return r;
}

function toggleBasis(r, key) {
  const pop = r['chart-basis'];
  const same = r.basisKey === key && !pop.hidden;
  for (const [k, b] of Object.entries(r.legendButtons)) b.setAttribute('aria-expanded', String(!same && k === key));
  if (same) { pop.hidden = true; r.basisKey = null; return; }
  r.basisKey = key;
  fill(pop, h('p', { text: S.BASIS[key] }));
  pop.hidden = false;
}

// ---------------------------------------------------------------------------------------------
// Sheets (About, Limits, explainer, confirm)
// ---------------------------------------------------------------------------------------------

function sheetHead(r, dialog, id, title) {
  return h('div', { class: 'sheet-head' },
    h('h2', { id, class: 'sheet-title', text: title }),
    h('button', { type: 'button', class: 'btn btn-secondary sheet-done', onclick: () => dialog.close() }, S.UI.close));
}

function buildAbout(r) {
  const d = r['sheet-about'];
  const c = S.aboutContent();
  fill(d, h('div', { class: 'sheet-inner' },
    sheetHead(r, d, 'sheet-about-h', c.title),
    h('div', { class: 'sheet-body' }, c.sections.map((s) => h('section', { class: 'sheet-section', id: s.id },
      h('h3', { text: s.heading }), s.paras.map((p) => h('p', { text: p })))))));
}

function buildLimits(r, table, view) {
  const d = r['sheet-limits'];
  const c = S.limitsContent(table, view || null);
  fill(d, h('div', { class: 'sheet-inner' },
    sheetHead(r, d, 'sheet-limits-h', c.title),
    h('div', { class: 'sheet-body' }, h('ul', { class: 'limits-list' }, c.items.map((t) => h('li', { text: t }))))));
  r.sheetsTable = table ? JSON.stringify([table, view ? view.recordsStatus : '']) : undefined;
}

function buildExplainer(r, onDone) {
  const d = r['sheet-explainer'];
  const c = S.explainerContent();
  const done = h('button', { type: 'button', class: 'btn btn-primary btn-wide', onclick: () => d.close() }, S.UI.gotIt);
  fill(d, h('div', { class: 'sheet-inner' },
    h('div', { class: 'sheet-head' }, h('h2', { id: 'sheet-explainer-h', class: 'sheet-title', text: c.title })),
    h('div', { class: 'sheet-body' },
      h('ol', { class: 'steps' }, c.steps.map((s, i) => h('li', { class: 'step' },
        h('span', { class: 'step-n', 'aria-hidden': 'true', text: String(i + 1) }),
        h('div', {}, h('h3', { text: s.heading }), h('p', { text: s.text }))))),
      h('div', { class: 'sheet-actions' }, done))));
  r.explainerDone = onDone;
}

function buildConfirm(r) {
  const d = r['confirm-clear'];
  fill(d, h('div', { class: 'sheet-inner' },
    h('div', { class: 'sheet-head' }, h('h2', { id: 'confirm-clear-h', class: 'sheet-title', text: S.UI.logClearConfirmTitle })),
    h('div', { class: 'sheet-body' }, h('p', { text: S.UI.logClearConfirmBody }),
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', autofocus: true, onclick: () => d.close() }, S.UI.logClearNo),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: () => { d.close(); r.ctx.onClear(); } }, S.UI.logClearYes)))));
}

function wireSheet(r, d) {
  d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
  d.addEventListener('close', () => {
    r.doc.documentElement.classList.remove('sheet-up');
    if (d === r['sheet-explainer'] && typeof r.explainerDone === 'function') { r.explainerDone(); r.explainerDone = null; }
    if (r.returnFocus && typeof r.returnFocus.focus === 'function') r.returnFocus.focus();
    r.returnFocus = null;
  });
}

function showSheet(r, d) {
  if (typeof d.showModal !== 'function') return;
  try { if (d.matches(':modal')) return; } catch { /* older engines: no :modal selector */ }
  r.returnFocus = r.doc.activeElement;
  r.doc.documentElement.classList.add('sheet-up');
  d.showModal();
}

/**
 * Show the first-run explainer; onDone runs when it is dismissed.
 * @param {object} r refs @param {Function} onDone
 */
export function showExplainer(r, onDone) {
  r.explainerDone = onDone;
  showSheet(r, r['sheet-explainer']);
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
  r['status-time'].textContent = S.statusTime({ loading: true });
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
  renderRise(r, view);
  renderCrestStrip(r, view);
  renderFeedsToggle(r, view);
  renderFeedsPanel(r, view);
  renderChart(r, view);
  renderCrestPanel(r, view);
  renderSampling(r, view);
  renderRecords(r, view);
  renderLog(r, view);
  if (view.table && r.sheetsTable !== JSON.stringify([view.table, view.recordsStatus])) buildLimits(r, view.table, view);
  r.doc.documentElement.dataset.mode = view.mode || 'live';
}

/**
 * Re-render only the log and the sampling counter (after a tap, undo or clear).
 * @param {object} r @param {object} view @param {string} [message]
 */
export function renderLogOnly(r, view, message) {
  r.view = view;
  renderSampling(r, view);
  renderLog(r, view, message);
}

function renderBanner(r, view) {
  const b = S.banner(view);
  const el = r.banner;
  if (!b.text) { el.hidden = true; el.replaceChildren(); return; }
  el.className = `banner banner-${b.kind}`;
  fill(el, icon(b.kind === 'replay' ? 'replay' : 'clock'), h('span', { text: b.text }));
  el.hidden = false;
}

function renderStatus(r, view) {
  const sentence = S.statusSentence(view);
  const el = r['status-sentence'];
  if (sentence !== r.lastStatus || el.querySelector('.sk')) {
    el.textContent = sentence;
    r.lastStatus = sentence;
  }
  const g = view.feeds ? view.feeds.gauge : null;
  r.status.classList.toggle('is-bad', !g || g.status !== 'ok');
  const chip = S.lineChip(view);
  const chipEl = r['line-chip'];
  chipEl.className = `chip chip-${chip.state}`;
  fill(chipEl, icon(chip.state === 'crossed' ? 'up' : chip.state === 'not_crossed' ? 'flat' : 'bang', 'icon icon-sm'),
    h('span', { text: chip.word }), chip.detail ? h('span', { class: 'chip-detail', text: chip.detail }) : null);
  r['status-time'].textContent = S.statusTime(view);
}

function renderRise(r, view) {
  const w = S.riseCard(view);
  const body = r['rise-body'];
  const card = body.closest('.card');
  card.classList.toggle('is-bad', w.missing || w.stale);
  if (w.missing) {
    fill(body, h('p', { class: 'bad-line' }, icon('bang'), h('span', { text: w.compare })), h('p', { class: 'meta', text: w.line }));
    return;
  }
  const line = view.observed ? view.observed.lineAtLatest : null;
  const rise = view.observed ? view.observed.riseCfs : null;
  const over = typeof rise === 'number' && typeof line === 'number' && rise >= line;
  const max = Math.max((line || 100) * 1.5, (rise || 0) * 1.1);
  const meter = h('div', { class: `meter${over ? ' is-over' : ''}${w.stale ? ' is-stale' : ''}`, 'aria-hidden': 'true' },
    h('div', { class: 'meter-fill' }), h('div', { class: 'meter-line' }));
  const fillEl = meter.firstChild;
  const lineEl = meter.lastChild;
  fillEl.style.width = `${Math.max(0, Math.min(100, ((rise || 0) / max) * 100))}%`;
  lineEl.style.left = `${Math.min(100, ((line || 0) / max) * 100)}%`;
  fill(body,
    h('div', { class: 'rise-top' },
      h('p', { class: 'rise-main' },
        h('span', { class: 'rise-value', text: w.value }),
        h('span', { class: 'rise-unit', text: w.unit })),
      h('p', { class: `rise-compare${over ? ' is-over' : ''}` }, icon(over ? 'up' : 'flat', 'icon icon-sm'), h('span', { text: w.compare }))),
    meter,
    h('p', { class: 'rise-line', text: w.line }),
    h('p', { class: `meta${w.stale ? ' bad-text' : ''}`, text: `${w.flow} · ${w.age}` }));
}

function renderCrestStrip(r, view) {
  const w = S.crestStrip(view);
  const ic = { none: 'flat', rising: 'up', called: 'peak', paused: 'bang' }[w.state] || 'flat';
  const card = r['crest-body'].closest('.card');
  card.dataset.state = w.state;
  card.classList.toggle('is-bad', w.state === 'paused');
  fill(r['crest-body'],
    h('div', { class: 'crest-row' }, icon(ic, 'icon icon-badge'),
      h('div', { class: 'crest-text' },
        h('p', { class: 'crest-title', text: w.title }),
        w.detail ? h('p', { class: 'crest-detail', text: w.detail }) : null)),
    w.tide ? h('p', { class: 'crest-tide' }, icon('wave', 'icon icon-sm'), h('span', { text: w.tide })) : null,
    w.record ? h('p', { class: 'meta crest-record', text: w.record }) : null);
}

const FEED_KEYS = ['gauge', 'noaa', 'tides', 'basin'];

function renderFeedsToggle(r, view) {
  const nowMs = view ? view.nowMs : 0;
  const expanded = r['feeds-toggle'].getAttribute('aria-expanded') === 'true';
  const pills = FEED_KEYS.map((k) => {
    const f = view ? view.feeds[k] : { status: 'loading' };
    const ok = f.status === 'ok';
    const loading = f.status === 'loading';
    return h('span', { class: `pill ${ok ? 'is-ok' : loading ? 'is-loading' : 'is-bad'}` },
      icon(ok ? 'check' : loading ? 'clock' : 'bang', 'icon icon-sm'),
      h('span', { class: 'pill-name', text: S.FEED_NAMES[k] }));
  });
  fill(r['feeds-toggle'], h('span', { class: 'pills' }, pills), icon('chevron', `icon icon-sm chev${expanded ? ' is-up' : ''}`));
  const labels = FEED_KEYS.map((k) => S.feedDotLabel(k, view ? view.feeds[k] : { status: 'loading' }, nowMs));
  r['feeds-toggle'].setAttribute('aria-label', `${S.UI.feedsHeading}. ${labels.join('. ')}. ${expanded ? S.UI.feedsHide : S.UI.feedsHint}`);
}

function renderFeedsPanel(r, view) {
  fill(r['feeds-panel'], h('ul', { class: 'feed-list' }, FEED_KEYS.map((k) => {
    const f = view.feeds[k];
    const ok = f.status === 'ok';
    const problem = S.feedProblem(k, f);
    const extra = k === 'basin' ? S.radarNote(view) : '';
    return h('li', { class: `feed-row ${ok ? 'is-ok' : 'is-bad'}` },
      icon(ok ? 'check' : 'bang', 'icon icon-sm'),
      h('div', { class: 'feed-text' },
        h('p', { class: 'feed-name' }, h('span', { text: S.FEED_LONG[k] }), h('span', { class: 'feed-word', text: S.feedStatusWord(f.status) })),
        h('p', { class: 'meta', text: S.feedAge(k, f, view.nowMs) }),
        extra ? h('p', { class: 'feed-extra' }, icon('rain', 'icon icon-sm'), h('span', { text: extra })) : null,
        problem ? h('p', { class: 'feed-problem', text: problem }) : null));
  })));
}

function renderChart(r, view) {
  const c = view.chart;
  const g = view.feeds.gauge;
  const n = view.feeds.noaa;
  r['chart-ages'].textContent = `${S.FEED_NAMES.gauge}: ${S.feedAge('gauge', g, view.nowMs)} · ${S.FEED_NAMES.noaa}: ${S.feedAge('noaa', n, view.nowMs)}`;
  const f = view.forecast || {};
  const drawn = { observed: Boolean(c && c.observed.length), raw: Boolean(c && c.raw.length), aligned: Boolean(c && c.aligned.length), range: Boolean(c && c.high.length), season: Boolean(c && c.seasonLine.length) };
  for (const [k, b] of Object.entries(r.legendButtons)) b.classList.toggle('is-off', !drawn[k]);
  const rn = S.rangeNote(view);
  fill(r['chart-range-note'], rn ? [icon('info', 'icon icon-sm'), h('span', { text: rn })] : null);
  r['chart-range-note'].hidden = !rn;
  // Nothing to draw (no chart, or neither gauge readings nor NOAA's path): say why instead of an empty grid.
  if (!c || (!c.observed.length && !c.raw.length)) {
    if (r.chart) { r.chart.destroy(); r.chart = null; }
    fill(r['chart-host'], h('p', { class: 'chart-empty', text: S.chartEmpty(view) }));
    r['chart-summary'].textContent = S.chartSummary(view);
    r['chart-readout'].replaceChildren();
    fill(r.crossing);
    return;
  }
  if (!r.chart) r.chart = mountChart(r['chart-host'], r['chart-readout'], c, 'srwc');
  else r.chart.update(c);
  r['chart-summary'].textContent = S.chartSummary(view);

  const cr = S.crossingReading(view);
  const parts = cr.line.includes(' | ') ? cr.line.split(' | ') : null;
  fill(r.crossing,
    h('h3', { class: 'sub-title', text: S.UI.crossingHeading }),
    // The reading stays one sentence in strings.js; on screen each line gets its own row and its legend key
    // (NOAA, high case, low case), and screen readers get the whole sentence once.
    parts
      ? [h('ul', { class: 'crossing-list', 'aria-hidden': 'true' }, parts.map((s, i) => h('li', {},
        h('span', { class: `legend-key ${['key-raw', 'key-range', 'key-range'][i] || 'key-range'}`, 'aria-hidden': 'true' }), h('span', { text: s })))),
      h('span', { class: 'sr-only', text: cr.line })]
      : h('p', { class: 'crossing-line', text: cr.line }),
    cr.aligned ? h('p', { class: 'meta', text: cr.aligned }) : null,
    cr.note && cr.note !== rn ? h('p', { class: 'note' }, icon('info', 'icon icon-sm'), h('span', { text: cr.note })) : null);

  renderTable(r, view);
}

function renderTable(r, view) {
  const rows = tableRows(view.chart, 3);
  const td = (v) => h('td', { text: typeof v === 'number' ? S.num(v) : '–' });
  fill(r['chart-table-body'], h('table', {},
    h('caption', { class: 'sr-only', text: S.UI.chartTable }),
    h('thead', {}, h('tr', {}, [S.UI.colTime, S.UI.colObserved, S.UI.colNoaa, S.UI.colAligned, S.UI.colRange, S.UI.colRise].map((t) => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows.map((v) => h('tr', { class: v.t > view.nowMs ? 'is-future' : '' },
      h('th', { scope: 'row', text: S.dayTime(v.t) }),
      td(v.observed), td(v.raw), td(v.aligned),
      h('td', { text: typeof v.low === 'number' && typeof v.high === 'number' ? `${S.num(v.low)}–${S.num(v.high)}` : '–' }),
      td(v.rise))))));
}

function renderCrestPanel(r, view) {
  const strip = S.crestStrip(view);
  const win = S.crestWindow(view);
  const noaaRec = S.recordText(view, 'noaa_crest_6h_0_24_event');
  fill(r['crest-panel-body'], h('dl', { class: 'rows' },
    h('div', { class: 'row' }, h('dt', { text: S.UI.peakCallLabel }), h('dd', {}, h('p', { text: strip.title }), strip.detail ? h('p', { class: 'meta', text: strip.detail }) : null)),
    h('div', { class: 'row' }, h('dt', { text: S.UI.noaaCrestLabel }), h('dd', {}, h('p', { text: S.noaaCrestValue(view) }), noaaRec ? h('p', { class: 'meta', text: noaaRec }) : null)),
    h('div', { class: `row${win.shown ? '' : ' is-muted'}` }, h('dt', { text: S.UI.windowLabel }),
      h('dd', {},
        win.shown ? [h('p', { text: win.lead }), h('p', { class: `window-times${win.passed ? ' is-passed' : ''}` }, icon('clock', 'icon icon-sm'), h('span', { text: win.times })), win.timesNote ? h('p', { class: 'window-note', text: win.timesNote }) : null, h('p', { class: 'meta', text: win.basis })]
          : h('p', { class: 'meta', text: win.reason }),
        !win.shown && S.radarNote(view) && !win.reason.startsWith(S.radarNote(view).slice(0, -1)) ? h('p', { class: 'meta', text: S.radarNote(view) }) : null,
        h('p', { class: 'meta', text: `${S.FEED_NAMES.basin}: ${S.feedAge('basin', view.feeds.basin, view.nowMs)}` })))));
}

function counterEl(view) {
  const n = view.log ? view.log.seasonCount : 0;
  const text = S.samplingCard(view).counter;
  const segs = h('div', { class: 'segments', 'aria-hidden': 'true' },
    Array.from({ length: 15 }, (_, i) => h('span', { class: i < n ? 'seg is-on' : 'seg' })));
  return [h('p', { class: 'counter-text', text }), segs];
}

function renderSampling(r, view) {
  const w = S.samplingCard(view);
  const card = r.sampling;
  card.classList.toggle('is-quiet', !w.visible);
  if (!w.visible) {
    fill(r['sampling-body'], h('p', { class: 'meta', text: w.hidden }));
    if (r.taps.parentElement !== r['tap-slot-log']) r['tap-slot-log'].append(r.taps);
    return;
  }
  const tidesOk = view.feeds.tides && view.feeds.tides.status === 'ok';
  fill(r['sampling-body'],
    h('div', { class: 'big-figure' }, h('span', { class: `big-value${w.pending ? ' is-pending' : ''}`, text: w.big }), h('span', { class: 'big-label', text: w.bigLabel })),
    h('p', { class: 'target' }, icon('clock', 'icon icon-sm'), h('span', { text: w.target })),
    w.tide ? h('p', { class: tidesOk ? 'tide' : 'tide bad-text' }, icon(tidesOk ? 'wave' : 'bang', 'icon icon-sm'), h('span', { text: w.tide })) : null,
    w.tide ? h('p', { class: 'meta', text: `${w.tideNote} ${S.FEED_NAMES.tides}: ${S.feedAge('tides', view.feeds.tides, view.nowMs)}` }) : null,
    h('div', { class: 'counter' }, counterEl(view)));
  if (r.taps.parentElement !== r['tap-slot-sampling']) r['tap-slot-sampling'].append(r.taps);
}

function recordList(items) {
  const shared = S.sharedSource(items);
  const list = h('ul', { class: 'record-list' }, items.map((it) => h('li', {},
    h('p', { text: it.text }), it.source && !shared ? h('p', { class: 'source', text: it.source }) : null)));
  return shared ? [list, h('p', { class: 'source source-shared', text: shared })] : list;
}

/** A collapsible OUR BASIS group (the first group is always shown; the rest are one tap away). */
function basisMore(heading, ...body) {
  return h('details', { class: 'basis-group basis-more' }, h('summary', { class: 'sub-title', text: heading }), h('div', { class: 'basis-more-body' }, ...body));
}

function sourcesBox(items) {
  const paths = S.sourcePaths(items);
  if (!paths.length) return null;
  return h('details', { class: 'sources' }, h('summary', { text: S.UI.sourcesToggle }),
    h('ul', { class: 'source-paths' }, paths.map((p) => h('li', { text: p }))));
}

/** A small, labelled data table (first column is the row header). */
function miniTable(caption, head, rows, cls) {
  return h('div', { class: `mini-wrap ${cls || ''}` }, h('table', { class: 'mini' },
    h('caption', { text: caption }),
    h('thead', {}, h('tr', {}, head.map((t) => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows.map((row) => h('tr', {}, h('th', { scope: 'row', text: row[0] }), row.slice(1).map((c) => h('td', { text: c })))))));
}

function renderRecords(r, view) {
  const noaa = S.noaaRecord(view);
  fill(r['record-body'], noaa.items.length ? [recordList(noaa.items), sourcesBox(noaa.items)] : h('p', { class: 'meta', text: noaa.empty }));
  const basis = S.basisRecords(view);
  const all = basis.groups.flatMap((g) => g.items);
  const factors = S.basisFactors(view.table);
  const coverage = S.basisCoverage(view.table);
  const fizzle = S.basisFizzle(view.table);
  fill(r['basis-body'],
    h('div', { class: 'basis-group' },
      h('h3', { class: 'sub-title', text: S.UI.basisTableHeading }),
      recordList(S.tableBasis(view.table).map((t) => ({ text: t, source: '' })))),
    factors ? basisMore(S.UI.basisFactorsHeading, miniTable(factors.caption, factors.head, factors.rows, 'mini-factors')) : null,
    coverage.length ? basisMore(S.UI.basisCoverageHeading, recordList(coverage.map((t) => ({ text: t, source: '' })))) : null,
    fizzle ? basisMore(S.UI.basisFizzleHeading, miniTable(fizzle.intro, fizzle.head, fizzle.rows, 'mini-fizzle'), h('p', { class: 'meta', text: fizzle.note })) : null,
    basis.groups.map((g) => basisMore(g.heading, recordList(g.items), g.note ? h('p', { class: 'note basis-note' }, icon('info', 'icon icon-sm'), h('span', { text: g.note })) : null)),
    sourcesBox(all),
    basis.empty ? h('p', { class: 'meta', text: basis.empty }) : null);
}

function renderLog(r, view, message) {
  const L = view.log || { entries: [], available: false };
  const w = S.logText(L);
  const inLog = r.taps.parentElement === r['tap-slot-log'];
  fill(r.logCounter, inLog ? counterEl(view) : null);
  r.logCounter.hidden = !inLog;
  const entries = [...(L.entries || [])].sort((a, b) => b.t - a.t);
  if (!L.available) fill(r.logList, h('p', { class: 'bad-line' }, icon('bang', 'icon icon-sm'), h('span', { text: w.unavailable })));
  else if (!entries.length) fill(r.logList, h('p', { class: 'empty', text: w.empty }));
  else {
    fill(r.logList, h('ol', { class: 'log-entries', 'aria-label': S.UI.logListLabel }, entries.slice(0, 200).map((e) => h('li', { class: 'log-entry' },
      h('p', { class: 'log-when' }, h('span', { class: 'log-time', text: S.when(e.t, view.nowMs) }), h('span', { class: `log-kind kind-${e.kind}`, text: S.TAP_KINDS[e.kind] })),
      e.status ? h('p', { class: 'log-status', text: e.status }) : null))));
  }
  r.logExport.disabled = !entries.length;
  r.logClear.disabled = !entries.length;
  r.logNote.textContent = message || w.note;
}

// ---------------------------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------------------------

/**
 * Show a short message; with an entry id it carries an Undo button.
 * @param {object} r @param {string} text @param {string|null} undoId
 */
export function showToast(r, text, undoId) {
  const t = r.toast;
  clearTimeout(r.toastTimer);
  fill(t, h('span', { class: 'toast-text', text }),
    undoId ? h('button', { type: 'button', class: 'btn btn-toast', onclick: () => { t.hidden = true; r.ctx.onUndo(undoId); } }, S.UI.undo) : null);
  t.hidden = false;
  r.toastTimer = setTimeout(() => { t.hidden = true; }, undoId ? 10_000 : 5_000);
}
