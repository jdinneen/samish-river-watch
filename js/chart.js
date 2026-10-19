// chart.js: dependency-free, responsive SVG chart for Samish River Watch.
// Two stacked panels on one time axis (never two y-scales on one panel):
//   top    = flow (observed last 72 h, NOAA's forecast as issued, NOAA aligned to the gauge, high-to-low range)
//   bottom = 24-h rise (study definition) against the season line, where crossings are read.
// Geometry is a pure function (buildChartSvg) so it can be checked in node; mountChart adds the interaction.
'use strict';

import { LINE_NAMES, UI, chartReadout, axisDay, axisNum, clock } from './strings.js';

const HOUR = 3_600_000;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {{t:number, cfs:number}} Pt
 * @typedef {object} ChartModel
 * @property {number} nowMs
 * @property {number} startMs
 * @property {number} endMs
 * @property {Pt[]} observed
 * @property {Pt[]} raw
 * @property {Pt[]} aligned
 * @property {Pt[]} high
 * @property {Pt[]} low
 * @property {{observed:Pt[], raw:Pt[], aligned:Pt[], high:Pt[], low:Pt[]}} rise
 * @property {Pt[]} seasonLine  step points {t, cfs}
 * @property {{raw:number|null, high:number|null, low:number|null, aligned:number|null}} crossings
 * @property {string} forecastNote  short text drawn in the forecast area when no forecast lines are drawn ('' for none)
 */

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

/**
 * Linear interpolation of a time series at t; null outside the series.
 * @param {Pt[]} s @param {number} t @returns {number|null}
 */
export function interpAt(s, t) {
  if (!Array.isArray(s) || !s.length) return null;
  if (t < s[0].t || t > s[s.length - 1].t) return null;
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = s[lo];
  const b = s[hi];
  if (b.t === a.t) return b.cfs;
  return a.cfs + ((b.cfs - a.cfs) * (t - a.t)) / (b.t - a.t);
}

/**
 * A "nice" axis maximum and tick step for 0..max with about `target` ticks.
 * @param {number} max @param {number} [target] @returns {{max:number, step:number}}
 */
export function niceScale(max, target = 4) {
  const m = Number.isFinite(max) && max > 0 ? max : 1;
  const raw = m / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || 10 * mag;
  return { max: Math.ceil(m / step) * step, step };
}

/**
 * Local midnights (America/Los_Angeles) strictly inside (start, end).
 * @param {number} start @param {number} end @returns {number[]}
 */
export function localMidnights(start, end) {
  const out = [];
  for (let t = Math.ceil(start / HOUR) * HOUR; t < end; t += HOUR) {
    if (t > start && clock(t) === '00:00') out.push(t);
  }
  return out;
}

const round1 = (v) => Math.round(v * 10) / 10;

function clipSeries(s, a, b) {
  return (Array.isArray(s) ? s : []).filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.cfs) && p.t >= a && p.t <= b);
}

/**
 * SVG path for a series. Observed series pass maxGapMs = 3 h so a gauge outage is a break, not a straight line
 * through missing data; forecast paths (NOAA issues are 6-hourly) pass Infinity and are joined point to point.
 * @param {Pt[]} s @param {(t:number)=>number} x @param {(v:number)=>number} y @param {number} [maxGapMs]
 * @returns {string}
 */
export function pathD(s, x, y, maxGapMs = Infinity) {
  let d = '';
  let pen = false;
  let prevT = null;
  for (const p of s) {
    const gap = prevT !== null && p.t - prevT > maxGapMs;
    d += `${!pen || gap ? 'M' : 'L'}${round1(x(p.t))},${round1(y(p.cfs))}`;
    pen = true;
    prevT = p.t;
  }
  return d;
}

function areaD(hi, lo, x, y) {
  if (!hi.length || !lo.length) return '';
  const top = hi.map((p, i) => `${i ? 'L' : 'M'}${round1(x(p.t))},${round1(y(p.cfs))}`).join('');
  const bot = [...lo].reverse().map((p) => `L${round1(x(p.t))},${round1(y(p.cfs))}`).join('');
  return `${top}${bot}Z`;
}

function stepD(s, x, y, x0, x1) {
  if (!s.length) return '';
  let d = `M${round1(x0)},${round1(y(s[0].cfs))}`;
  for (let i = 1; i < s.length; i += 1) {
    const xi = round1(x(s[i].t));
    d += `L${xi},${round1(y(s[i - 1].cfs))}L${xi},${round1(y(s[i].cfs))}`;
  }
  return `${d}L${round1(x1)},${round1(y(s[s.length - 1].cfs))}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Layout constants for a container width.
 * @param {number} width @returns {{W:number, H:number, ml:number, mr:number, top:number, flowH:number, gap:number, riseH:number, xAxisH:number}}
 */
export function layoutFor(width) {
  const W = Math.max(280, Math.round(width));
  const wide = W >= 640;
  const ml = wide ? 48 : 40;
  const mr = wide ? 16 : 8;
  const top = 24;
  // The 24-h rise panel (where season-line crossings are read) is the larger of the two.
  const flowH = wide ? 200 : 150;
  const gap = 44;
  const riseH = wide ? 232 : 190;
  const xAxisH = 28;
  return { W, H: top + flowH + gap + riseH + xAxisH, ml, mr, top, flowH, gap, riseH, xAxisH };
}

/**
 * Build the chart SVG markup and the scales used to place the crosshair.
 * @param {ChartModel} m
 * @param {number} width container width in CSS px
 * @param {string} idp unique id prefix for clip paths
 * @returns {{svg:string, L:object, x:(t:number)=>number, tAt:(px:number)=>number, yFlow:(v:number)=>number, yRise:(v:number)=>number}}
 */
export function buildChartSvg(m, width, idp = 'c') {
  const L = layoutFor(width);
  const span = Math.max(HOUR, m.endMs - m.startMs);

  const obs = clipSeries(m.observed, m.startMs, m.nowMs + HOUR);
  const raw = clipSeries(m.raw, m.startMs, m.endMs);
  const ali = clipSeries(m.aligned, m.startMs, m.endMs);
  const hi = clipSeries(m.high, m.startMs, m.endMs);
  const lo = clipSeries(m.low, m.startMs, m.endMs);
  const R = m.rise || {};
  const rObs = clipSeries(R.observed, m.startMs, m.nowMs + HOUR);
  const rRaw = clipSeries(R.raw, m.startMs, m.endMs);
  const rAli = clipSeries(R.aligned, m.startMs, m.endMs);
  const rHi = clipSeries(R.high, m.startMs, m.endMs);
  const rLo = clipSeries(R.low, m.startMs, m.endMs);
  // Season steps: keep the step in force at the left edge (its change point can sit before the window).
  const allSteps = clipSeries(m.seasonLine, -Infinity, m.endMs);
  const firstIn = allSteps.findIndex((p) => p.t >= m.startMs);
  const season = firstIn === -1 ? allSteps.slice(-1) : allSteps.slice(Math.max(0, firstIn - 1));

  const flowMax = Math.max(1, ...[obs, raw, ali, hi, lo].flat().map((p) => p.cfs));
  const fs = niceScale(flowMax * 1.05);
  // Axis labels print full thousands with commas ("1,500"); a five-digit label ("10,000") needs 8 px more margin.
  const x0 = L.ml + (fs.max >= 10000 ? 8 : 0);
  const x1 = L.W - L.mr;
  const x = (t) => x0 + ((t - m.startMs) / span) * (x1 - x0);
  const tAt = (px) => m.startMs + ((Math.min(Math.max(px, x0), x1) - x0) / (x1 - x0)) * span;
  const fTop = L.top;
  const fBot = L.top + L.flowH;
  const yFlow = (v) => fBot - (Math.max(0, v) / fs.max) * (fBot - fTop);

  const lineMax = Math.max(1, ...season.map((p) => p.cfs));
  const riseMax = Math.max(lineMax * 1.3, ...[rObs, rRaw, rAli, rHi, rLo].flat().map((p) => p.cfs));
  const rs = niceScale(riseMax, 3);
  const rTop = fBot + L.gap;
  const rBot = rTop + L.riseH;
  const yRise = (v) => rBot - (Math.max(0, v) / rs.max) * (rBot - rTop);

  const nowX = round1(x(m.nowMs));
  const parts = [];
  parts.push(`<svg xmlns="${SVG_NS}" class="chart-svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" aria-hidden="true" focusable="false">`);
  parts.push(`<defs><clipPath id="${idp}-cf"><rect x="${x0}" y="${fTop - 2}" width="${x1 - x0}" height="${fBot - fTop + 4}"/></clipPath>`);
  parts.push(`<clipPath id="${idp}-cr"><rect x="${x0}" y="${rTop - 2}" width="${x1 - x0}" height="${rBot - rTop + 4}"/></clipPath>`);
  // The rise panel's forecast tint stays below the season line, so it never mixes with the over-the-line tint.
  if (season.length) parts.push(`<clipPath id="${idp}-cb"><path d="${stepD(season, x, yRise, x0, x1)}L${round1(x1)},${round1(rBot)}L${round1(x0)},${round1(rBot)}Z"/></clipPath>`);
  parts.push('</defs>');

  // forecast side tint
  parts.push(`<rect class="c-future" x="${nowX}" y="${fTop}" width="${Math.max(0, round1(x1 - nowX))}" height="${fBot - fTop}"/>`);
  parts.push(`<rect class="c-future c-future-rise"${season.length ? ` clip-path="url(#${idp}-cb)"` : ''} x="${nowX}" y="${rTop}" width="${Math.max(0, round1(x1 - nowX))}" height="${rBot - rTop}"/>`);

  // horizontal grid + y labels
  for (let v = 0; v <= fs.max + 1e-9; v += fs.step) {
    const yy = round1(yFlow(v));
    parts.push(`<line class="c-grid" x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}"/>`);
    parts.push(`<text class="c-tick" x="${x0 - 6}" y="${yy + 4}" text-anchor="end">${esc(axisNum(v))}</text>`);
  }
  for (let v = 0; v <= rs.max + 1e-9; v += rs.step) {
    const yy = round1(yRise(v));
    parts.push(`<line class="c-grid" x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}"/>`);
    parts.push(`<text class="c-tick" x="${x0 - 6}" y="${yy + 4}" text-anchor="end">${esc(axisNum(v))}</text>`);
  }
  parts.push(`<text class="c-unit" x="${x0}" y="${fTop - 9}">${esc(UI.axisFlow)}</text>`);
  parts.push(`<text class="c-panel-title" x="${x0}" y="${rTop - 10}">${esc(UI.axisRise)}</text>`);

  // day lines and labels
  const mids = localMidnights(m.startMs, m.endMs);
  const minLabelGap = 34;
  let lastLabelX = -Infinity;
  for (const t of mids) {
    const xx = round1(x(t));
    parts.push(`<line class="c-day" x1="${xx}" x2="${xx}" y1="${fTop}" y2="${fBot}"/>`);
    parts.push(`<line class="c-day" x1="${xx}" x2="${xx}" y1="${rTop}" y2="${rBot}"/>`);
    if (xx - lastLabelX >= minLabelGap && xx + 14 <= x1) {
      parts.push(`<text class="c-tick" x="${xx + 3}" y="${rBot + 18}">${esc(axisDay(t))}</text>`);
      lastLabelX = xx;
    }
  }

  // flow panel
  const GAP = 3 * HOUR;
  parts.push(`<g clip-path="url(#${idp}-cf)">`);
  if (hi.length && lo.length) {
    parts.push(`<path class="c-range" d="${areaD(hi, lo, x, yFlow)}"/>`);
    parts.push(`<path class="c-range-edge" d="${pathD(hi, x, yFlow)}"/>`);
    parts.push(`<path class="c-range-edge" d="${pathD(lo, x, yFlow)}"/>`);
  }
  if (ali.length) parts.push(`<path class="c-aligned" d="${pathD(ali, x, yFlow)}"/>`);
  if (raw.length) parts.push(`<path class="c-raw" d="${pathD(raw, x, yFlow)}"/>`);
  if (obs.length) parts.push(`<path class="c-obs" d="${pathD(obs, x, yFlow, GAP)}"/>`);
  parts.push('</g>');
  if (obs.length) {
    const last = obs[obs.length - 1];
    parts.push(`<circle class="c-obs-dot" cx="${round1(x(last.t))}" cy="${round1(yFlow(last.cfs))}" r="4.5"/>`);
  }

  // rise panel
  parts.push(`<g clip-path="url(#${idp}-cr)">`);
  // the zone above the season line, lightly tinted, so "over the line" reads at a glance
  if (season.length) parts.push(`<path class="c-over" d="${stepD(season, x, yRise, x0, x1)}L${round1(x1)},${round1(rTop)}L${round1(x0)},${round1(rTop)}Z"/>`);
  if (rHi.length && rLo.length) {
    parts.push(`<path class="c-range" d="${areaD(rHi, rLo, x, yRise)}"/>`);
    parts.push(`<path class="c-range-edge" d="${pathD(rHi, x, yRise)}"/>`);
    parts.push(`<path class="c-range-edge" d="${pathD(rLo, x, yRise)}"/>`);
  }
  if (season.length) parts.push(`<path class="c-season" d="${stepD(season, x, yRise, x0, x1)}"/>`);
  if (rAli.length) parts.push(`<path class="c-aligned" d="${pathD(rAli, x, yRise)}"/>`);
  if (rRaw.length) parts.push(`<path class="c-raw" d="${pathD(rRaw, x, yRise)}"/>`);
  if (rObs.length) {
    const rd = pathD(rObs, x, yRise, GAP);
    if (!rd.slice(1).includes('M')) parts.push(`<path class="c-obs-area" d="${rd}L${round1(x(rObs[rObs.length - 1].t))},${round1(rBot)}L${round1(x(rObs[0].t))},${round1(rBot)}Z"/>`);
    parts.push(`<path class="c-obs c-obs-rise" d="${rd}"/>`);
  }
  parts.push('</g>');
  if (rObs.length) {
    const lr = rObs[rObs.length - 1];
    parts.push(`<circle class="c-obs-dot" cx="${round1(x(lr.t))}" cy="${round1(yRise(lr.cfs))}" r="4.5"/>`);
  }

  // crossing markers on the season line (ringed dots), only for crossings after now
  const cr = m.crossings || {};
  for (const [key, cls] of [['raw', 'c-x-raw'], ['high', 'c-x-range'], ['low', 'c-x-range']]) {
    const t = cr[key];
    if (Number.isFinite(t) && t > m.nowMs && t <= m.endMs) {
      const lv = interpAt(season, t) ?? (season.length ? season[season.length - 1].cfs : null);
      if (lv !== null) parts.push(`<circle class="c-xmark ${cls}" cx="${round1(x(t))}" cy="${round1(yRise(lv))}" r="5"/>`);
    }
  }

  // season-line direct label (text in ink, the mark carries the colour), placed on the side where the rise curves
  // stay clear of the line so the label never sits on data: the left (oldest) quarter unless the observed rise is
  // near the line there, else the right end.
  if (season.length) {
    const leftEnd = m.startMs + span / 4;
    const firstLine = interpAt(season, m.startMs) ?? season[0].cfs;
    const busyLeft = rObs.some((p) => p.t <= leftEnd && p.cfs >= firstLine * 0.6);
    const lineV = busyLeft ? season[season.length - 1].cfs : firstLine;
    const ly = round1(yRise(lineV)) - 7;
    const lx = busyLeft ? x1 - 4 : x0 + 6;
    parts.push(`<text class="c-label" x="${lx}" y="${ly}" text-anchor="${busyLeft ? 'end' : 'start'}">${esc(`${LINE_NAMES.season} ${axisNum(lineV)} cfs`)}</text>`);
  }

  // now marker
  parts.push(`<line class="c-now" x1="${nowX}" x2="${nowX}" y1="${fTop}" y2="${rBot}"/>`);
  parts.push(`<text class="c-now-label" x="${nowX}" y="${fTop - 8}" text-anchor="${nowX > x1 - 30 ? 'end' : 'middle'}">${esc(LINE_NAMES.now)}</text>`);

  if (m.forecastNote) {
    // Centered in the forecast side, in the upper part of the flow panel; wrapped onto two lines when that side is
    // narrow (phones), so it never runs over the now marker.
    const room = x1 - nowX;
    const cx = round1((nowX + x1) / 2);
    const words = String(m.forecastNote).split(' ');
    const cut = Math.ceil(words.length / 2);
    const rows = room < m.forecastNote.length * 7.4 + 16 && words.length > 1 ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [m.forecastNote];
    const y0 = round1(fTop + (fBot - fTop) * 0.3);
    parts.push(`<text class="c-note" x="${cx}" y="${y0}" text-anchor="middle">${rows.map((r, i) => `<tspan x="${cx}" dy="${i ? 16 : 0}">${esc(r)}</tspan>`).join('')}</text>`);
  }

  // crosshair (moved by mountChart)
  parts.push(`<g class="c-cross" visibility="hidden"><line class="c-cross-line" x1="0" x2="0" y1="${fTop}" y2="${rBot}"/>`);
  // Dots start hidden; a series with no value at the tapped time stays hidden (the SVG overflows its box, so a parked
  // dot would show outside the plot).
  for (const k of ['obs', 'raw', 'aligned', 'rise']) parts.push(`<circle class="c-cross-dot c-cd-${k}" r="4" cx="0" cy="0" visibility="hidden"/>`);
  parts.push('</g>');
  parts.push(`<rect class="c-hit" x="${x0}" y="${fTop}" width="${x1 - x0}" height="${rBot - fTop}"/>`);
  parts.push('</svg>');
  return { svg: parts.join(''), L, x, tAt, yFlow, yRise };
}

/**
 * Candidate times the crosshair snaps to: observed reading times up to now, then forecast path times.
 * @param {ChartModel} m @returns {number[]}
 */
export function snapTimes(m) {
  const past = (m.observed || []).filter((p) => p.t >= m.startMs && p.t <= m.nowMs).map((p) => p.t);
  const lastPast = past.length ? past[past.length - 1] : m.nowMs;
  const fut = (m.raw && m.raw.length ? m.raw : m.aligned || []).filter((p) => p.t > lastPast && p.t <= m.endMs).map((p) => p.t);
  return [...new Set([...past, ...fut])].sort((a, b) => a - b);
}

/**
 * Values at one time for the readout.
 * @param {ChartModel} m @param {number} t @returns {object}
 */
export function valuesAt(m, t) {
  const lastObs = m.observed && m.observed.length ? m.observed[m.observed.length - 1].t : -Infinity;
  const isPast = t <= lastObs;
  const rise = isPast ? interpAt(m.rise.observed, t) : interpAt(m.rise.aligned, t);
  return {
    t,
    observed: isPast ? interpAt(m.observed, t) : null,
    raw: interpAt(m.raw, t),
    aligned: isPast ? null : interpAt(m.aligned, t),
    low: isPast ? null : interpAt(m.low, t),
    high: isPast ? null : interpAt(m.high, t),
    rise,
    riseKind: isPast ? 'observed' : 'aligned',
    line: seasonAt(m.seasonLine, t),
  };
}

function seasonAt(s, t) {
  if (!Array.isArray(s) || !s.length) return null;
  let v = s[0].cfs;
  for (const p of s) if (p.t <= t) v = p.cfs;
  return v;
}

function nearest(times, t) {
  if (!times.length) return null;
  let best = times[0];
  for (const c of times) if (Math.abs(c - t) < Math.abs(best - t)) best = c;
  return best;
}

// ---------------------------------------------------------------------------------------------
// DOM: mount, resize, hover / tap / keyboard readout
// ---------------------------------------------------------------------------------------------

/**
 * Mount the chart into a host element. The host gets the SVG; `readout` gets the hover/tap values.
 * @param {HTMLElement} host focusable chart wrapper
 * @param {HTMLElement} readout element for the readout text
 * @param {ChartModel} spec
 * @param {string} idp unique id prefix
 * @returns {{reset:()=>void, update:(m:ChartModel)=>void, destroy:()=>void}}
 */
export function mountChart(host, readout, spec, idp) {
  let m = spec;
  let geo = null;
  let times = [];
  let cur = null;
  let width = 0;

  const draw = () => {
    width = host.clientWidth || 340;
    geo = buildChartSvg(m, width, idp);
    host.innerHTML = geo.svg;
    times = snapTimes(m);
    showAt(cur, false);
  };

  const setDot = (svg, k, cx, cy) => {
    const el = svg.querySelector(`.c-cd-${k}`);
    if (!el) return;
    const off = cx === null || cy === null;
    el.setAttribute('visibility', off ? 'hidden' : 'visible');
    if (!off) {
      el.setAttribute('cx', String(round1(cx)));
      el.setAttribute('cy', String(round1(cy)));
    }
  };

  const writeReadout = (v, isDefault) => {
    const r = chartReadout(v, m.nowMs);
    readout.replaceChildren();
    readout.classList.toggle('has-back', !isDefault);
    const time = document.createElement('span');
    time.className = 'ro-time';
    // The default readout is the latest gauge reading, which can be older than now (a stale gauge), so it is never called "Now".
    time.textContent = isDefault ? `${LINE_NAMES.latest} · ${r.time}` : r.time;
    readout.append(time);
    for (const row of r.rows) {
      const item = document.createElement('span');
      item.className = `ro-item ro-${row.key}`;
      const key = document.createElement('span');
      key.className = `ro-key key-${row.key}`;
      key.setAttribute('aria-hidden', 'true');
      const lab = document.createElement('span');
      lab.className = 'ro-label';
      lab.textContent = `${row.label} `;
      const val = document.createElement('span');
      val.className = 'ro-value';
      val.textContent = row.value;
      item.append(key, lab, val);
      readout.append(item);
    }
    if (!isDefault) {
      // On touch there is no pointer leave, so a tapped readout gets a way back to the latest reading.
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'link-btn ro-back';
      back.textContent = UI.backToLatest;
      back.addEventListener('click', () => reset());
      readout.append(back);
    }
  };

  /** Clear the cursor and show the latest-reading readout again. */
  function reset() {
    cur = null;
    delete host.dataset.cursor;
    showAt(null, false);
  }

  function showAt(t, fromUser) {
    const svg = host.querySelector('svg');
    if (!svg || !geo) return;
    const cross = svg.querySelector('.c-cross');
    if (t === null) {
      cross.setAttribute('visibility', 'hidden');
      for (const k of ['obs', 'raw', 'aligned', 'rise']) setDot(svg, k, null, null);
      const lastObs = m.observed && m.observed.length ? m.observed[m.observed.length - 1].t : m.nowMs;
      writeReadout(valuesAt(m, Math.min(lastObs, m.nowMs)), true);
      return;
    }
    const v = valuesAt(m, t);
    const xx = geo.x(t);
    const line = cross.querySelector('.c-cross-line');
    line.setAttribute('x1', String(round1(xx)));
    line.setAttribute('x2', String(round1(xx)));
    setDot(svg, 'obs', v.observed === null ? null : xx, v.observed === null ? null : geo.yFlow(v.observed));
    setDot(svg, 'raw', v.raw === null ? null : xx, v.raw === null ? null : geo.yFlow(v.raw));
    setDot(svg, 'aligned', v.aligned === null ? null : xx, v.aligned === null ? null : geo.yFlow(v.aligned));
    setDot(svg, 'rise', v.rise === null ? null : xx, v.rise === null ? null : geo.yRise(v.rise));
    cross.setAttribute('visibility', 'visible');
    writeReadout(v, false);
    if (fromUser) host.dataset.cursor = String(t);
  }

  const pointer = (ev) => {
    const svg = host.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * geo.L.W;
    cur = nearest(times, geo.tAt(px));
    showAt(cur, true);
  };
  const leave = (ev) => {
    if (ev.pointerType === 'mouse') reset();
  };
  const key = (ev) => {
    if (!times.length) return;
    // Without a cursor, start from the latest reading (the "Now" readout), not from the end of the forecast.
    const lastObs = m.observed && m.observed.length ? m.observed[m.observed.length - 1].t : m.nowMs;
    const from = cur ?? nearest(times, Math.min(lastObs, m.nowMs));
    const stepH = ev.shiftKey ? 6 : 1;
    let target = null;
    if (ev.key === 'ArrowRight') target = nearest(times, from + stepH * HOUR);
    else if (ev.key === 'ArrowLeft') target = nearest(times, from - stepH * HOUR);
    else if (ev.key === 'Home') target = times[0];
    else if (ev.key === 'End') target = times[times.length - 1];
    else if (ev.key === 'Escape') { reset(); return; }
    else return;
    ev.preventDefault();
    cur = target;
    showAt(cur, true);
  };

  host.addEventListener('pointermove', pointer);
  host.addEventListener('pointerdown', pointer);
  host.addEventListener('pointerleave', leave);
  host.addEventListener('keydown', key);
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { if (Math.abs((host.clientWidth || 0) - width) >= 2) draw(); })
    : null;
  if (ro) ro.observe(host);
  draw();

  return {
    reset,
    update(next) {
      m = next;
      if (cur !== null && (cur < m.startMs || cur > m.endMs)) cur = null;
      draw();
    },
    destroy() {
      if (ro) ro.disconnect();
      host.removeEventListener('pointermove', pointer);
      host.removeEventListener('pointerdown', pointer);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('keydown', key);
    },
  };
}

/**
 * Rows for the chart's table view: one row every `stepH` hours across the drawn span.
 * @param {ChartModel} m @param {number} [stepH] @returns {object[]}
 */
export function tableRows(m, stepH = 3) {
  const rows = [];
  const first = Math.ceil(m.startMs / (stepH * HOUR)) * stepH * HOUR;
  for (let t = first; t <= m.endMs; t += stepH * HOUR) {
    const v = valuesAt(m, t);
    if ([v.observed, v.raw, v.aligned, v.low, v.high, v.rise].some((n) => n !== null)) rows.push(v);
  }
  return rows;
}

