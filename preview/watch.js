// site/js/season.js
var oa = "America/Los_Angeles";
var Ot = null;
function la() {
  return Ot === null && (Ot = new Intl.DateTimeFormat("en-US", {
    timeZone: oa,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), Ot;
}
function Y(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of la().formatToParts(new Date(e)))
    n.type !== "literal" && (t[n.type] = Number(n.value));
  return {
    year: t.year,
    month: t.month,
    day: t.day,
    hour: t.hour,
    minute: t.minute,
    second: t.second
  };
}
function Kt(e) {
  let t = Y(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function Ve(e, t, n, a = 0, s = 0) {
  let i = Date.UTC(e, t - 1, n, a, s), o = i - Kt(i);
  return i - Kt(o);
}
function _e(e) {
  let t = Y(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var ca = 3600 * 1e3, ua = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function fa(e, t) {
  for (let n = 0; n < e.length; n++) {
    let a = e[n], s = n === e.length - 1;
    if (t >= a.lead_lo_h && (t < a.lead_hi_h || s && t === a.lead_hi_h)) return a;
  }
  return null;
}
function da(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : ua).includes(Y(t).month);
}
var Re = (e) => typeof e == "number" && Number.isFinite(e);
function ha(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!Re(e.rise_floor_cfs) || !Re(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!Re(t.lead_lo_h) || !Re(t.lead_hi_h) || !Re(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !Re(a.low_factor) || !Re(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function en(e, t, n, a = t.t) {
  let s = [], i = [], o = da(n, a);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: s, low: i, wetSeason: o };
  ha(n);
  let r = n.bins, c = r[r.length - 1].lead_hi_h;
  for (let u of e) {
    let l = (u.t - t.t) / ca;
    if (l <= 0 || l > c) continue;
    let d = fa(r, l);
    if (!d) continue;
    let f, p;
    if (u.cfs >= n.storm_flow_cfs) {
      let h = u.cfs - t.cfs >= n.rise_floor_cfs ? d.rise : d.flat;
      f = u.cfs * h.high_factor, p = u.cfs * h.low_factor;
    } else
      f = u.cfs + d.add_cfs, p = u.cfs - d.add_cfs;
    s.push({ t: u.t, cfs: Math.max(f, u.cfs) }), i.push({ t: u.t, cfs: Math.max(0, Math.min(p, u.cfs)) });
  }
  return { high: s, low: i, wetSeason: o };
}

// site/js/watch-conditions.js
var ye = Number.isFinite, It = 0.1;
function tn(e, t = [], n = []) {
  let a = /* @__PURE__ */ new Map(), s = new Set(n);
  for (let f of t)
    !ye(f?.endT) || f.endT % 36e5 || f.endT > e || (!ye(f.mm) || f.mm < 0 || a.has(f.endT) && a.get(f.endT) !== f.mm ? s.add(f.endT) : a.set(f.endT, f.mm));
  let i = [...a.keys(), ...s].filter((f) => ye(f) && f <= e && f % 36e5 === 0), o = i.length ? Math.max(...i) : null, r = {
    available: !1,
    state: "unknown",
    endT: o,
    thresholdMm: It,
    ageMs: o === null ? null : e - o,
    hours: 0,
    sinceT: null,
    transitionKnown: !1
  };
  if (o === null || e - o > 3 * 36e5 || s.has(o) || !a.has(o)) return r;
  let c = a.get(o) >= It, u = 0, l = o;
  for (; a.has(l) && !s.has(l) && a.get(l) >= It === c; )
    u++, l -= 36e5;
  let d = a.has(l) && !s.has(l);
  return {
    ...r,
    available: !0,
    state: c ? d ? "restarted" : "raining" : "paused",
    hours: u,
    sinceT: o - u * 36e5,
    transitionKnown: d,
    latestMm: a.get(o)
  };
}
function nn(e, t, n = null) {
  let a = t?.data, s = e + 240 * 36e5, i = ye(n?.cfs) && ye(n?.t) && n.t <= e && e - n.t <= 49 * 36e5 ? { t: n.t, cfs: n.cfs } : null, o = {
    available: !1,
    reason: "Forecast scenarios unavailable",
    issuedT: a?.issuedT ?? null,
    createdT: a?.createdT ?? null,
    startT: e,
    endT: s,
    memberCount: 0,
    excludedCount: 0,
    higherCount: null,
    comparisonHigh: i,
    resolvedCount: 0,
    openEndCount: 0,
    noPeakCount: 0,
    peakStartT: null,
    peakEndT: null
  };
  if (!a || !ye(a.issuedT) || a.issuedT > e || e - a.issuedT > 48 * 36e5 || !Array.isArray(a.members))
    return { ...o, reason: a ? "Forecast scenarios are too old or their issue time is invalid" : o.reason };
  let r = /* @__PURE__ */ new Set(), c = 0, u = [];
  for (let l of a.members) {
    if (r.has(l.id)) return { ...o, reason: "Conflicting forecast scenario identities" };
    r.add(l.id);
    let d = (l.points ?? []).filter((b) => ye(b?.t)).sort((b, S) => b.t - S.t), f = d.filter((b) => b.t <= e).at(-1), p = d.filter((b) => b.t > e && b.t <= s), h = f ? [f, ...p] : p;
    if (!(f && e - f.t <= 6 * 36e5 && p.length >= 2 && s - p.at(-1).t < 6 * 36e5 && h.every((b, S) => ye(b.cfs) && b.cfs >= 0 && (!S || b.t - h[S - 1].t === 6 * 36e5)))) {
      o.excludedCount++;
      continue;
    }
    o.memberCount++;
    let $ = Math.max(...p.map((b) => b.cfs));
    i && $ > i.cfs && c++;
    let v = h.findIndex((b) => b.t > e && b.cfs === $), g = v;
    for (let b = v; b < h.length; b++) h[b].cfs === $ && (g = b);
    g === h.length - 1 && h[g].cfs > h[0].cfs ? o.openEndCount++ : v > 0 && g < h.length - 1 && h[v - 1].cfs < $ && h[g + 1].cfs < $ ? (o.resolvedCount++, u.push(h[v].t, h[g].t)) : o.noPeakCount++;
  }
  return o.memberCount ? {
    ...o,
    available: !0,
    reason: null,
    higherCount: i ? c : null,
    peakStartT: u.length ? Math.min(...u) : null,
    peakEndT: u.length ? Math.max(...u) : null
  } : { ...o, reason: "No complete ten-day forecast scenarios" };
}

// site/js/watch-model.js
var Ie = 6e4, U = 60 * Ie, O = 24 * U, pe = 30 * Ie, Xe = 6 * U, He = 15 * Ie, pa = [2, 4, 6, 8, 12, 18, 24], j = (e) => typeof e == "number" && Number.isFinite(e), R = (e) => j(e) && Math.abs(e) <= 864e13, _ = (e, t = {}) => ({ code: e, details: t }), Qe = (e, t) => R(t) ? Math.max(0, e - t) : null, ga = (e, t) => Object.prototype.hasOwnProperty.call(e, t), Tt = (e) => ({ t: e.t, cfs: e.cfs }), Z = (e) => e && e.usable !== !1 && j(e.cfs) && e.cfs >= 0;
function Je(e, t) {
  let n = (r) => {
    let [c, u = "0"] = String(r).toLowerCase().split("e"), l = c.includes(".") ? c.length - c.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(c.replace(".", "")), exponent: Number(u) - l };
  }, a = n(e), s = n(t), i = Math.min(a.exponent, s.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - s.coefficient * 10n ** BigInt(s.exponent - i)}e${i}`;
}
function an(e) {
  let t = j(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : ga(e, "qualifier"), s = {
    t: e.t,
    cfs: t ? e.cfs : null,
    approval: e.approval ?? null,
    qualifierAvailable: a,
    qualityLabel: e.qualityLabel ?? (a ? "Quality metadata supplied" : "Quality flags unavailable"),
    eligible: e.eligible === !0 && n && a,
    usable: n,
    reason: n ? null : typeof e.reason == "object" && e.reason ? e.reason : _(typeof e.reason == "string" ? e.reason : "unusable_observation")
  };
  return a && (s.qualifier = e.qualifier), s;
}
function on(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !R(n.t)) continue;
    let a = an(n), s = t.get(n.t);
    s ? JSON.stringify(s) !== JSON.stringify(a) && t.set(n.t, an({
      t: n.t,
      cfs: null,
      usable: !1,
      eligible: !1,
      qualityLabel: "Conflicting readings at this time",
      reason: "conflicting_duplicate"
    })) : t.set(n.t, a);
  }
  return [...t.values()].sort((n, a) => n.t - a.t);
}
function Pe(e, t) {
  let n = 0, a = e.length;
  for (; n < a; ) {
    let s = n + a >>> 1;
    e[s].t < t ? n = s + 1 : a = s;
  }
  return n;
}
function ln(e, t) {
  let n = Pe(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function Ye(e, t, n = He) {
  let { before: a, after: s } = ln(e, t), i = s?.t === t ? s : a && (!s || t - a.t <= s.t - t) ? a : s;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function $e(e) {
  if (!R(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return _e(e);
}
function cn(e, t) {
  let n = R(t) ? e[Pe(e, t)] : null, a = R(t) ? t - O : null, s = R(a) ? ln(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: R(t) ? $e(t) : null,
    distanceCfs: null,
    reached: null,
    ...s
  };
}
function un(e, t) {
  let n = Je(e.current.cfs, t.cfs), a = j(n) ? Je(e.referenceCfs, n) : null;
  return !j(n) || !j(a) ? { ...e, comparison: t, reason: _("non_finite_arithmetic") } : {
    ...e,
    available: !0,
    reason: null,
    comparison: t,
    elapsedMs: e.current.t - t.t,
    approximate: t.t !== e.targetT,
    changeCfs: n,
    distanceCfs: a,
    reached: n >= e.referenceCfs
  };
}
function Ht(e, t) {
  let n = cn(e, t);
  if (!Z(n.current))
    return { ...n, reason: _(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = Ye(e, n.targetT);
  return a ? Z(a) ? un(n, a) : { ...n, comparison: a, reason: _("comparison_unusable") } : { ...n, reason: _("comparison_missing", { toleranceMs: He }) };
}
function Pt(e, t) {
  let n = cn(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: R(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!Z(a.current)) return { ...a, reason: _(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let s = Ye(e, a.targetT);
  if (!s) return { ...a, reason: _("window_start_missing", { toleranceMs: He }) };
  if (!Z(s)) return { ...a, startSupport: s, reason: _("window_start_unusable") };
  let i = e.slice(Pe(e, a.targetT), Pe(e, t) + 1), o = i.find((l) => !Z(l));
  if (o) return { ...a, startSupport: s, reason: _("window_unusable_observation", { t: o.t }) };
  let r = s.t < a.targetT ? [s, ...i] : i, c = 0;
  for (let l = 1; l < r.length; l++) c = Math.max(c, r[l].t - r[l - 1].t);
  if (c > pe) return {
    ...a,
    startSupport: s,
    maxGapMs: c,
    reason: _("observation_gap", { maxGapMs: c, allowedMs: pe })
  };
  let u = i.reduce((l, d) => !l || d.cfs < l.cfs ? d : l, null);
  return u ? {
    ...un(a, u),
    minimum: u,
    startSupport: s,
    maxGapMs: c,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: s, maxGapMs: c, reason: _("window_empty") };
}
function $t(e, t, n = !1) {
  let a = [], s = [], i = [], o = [];
  for (let r of e) {
    if (!Z(r) || n && r.cfs <= 0) {
      s.length && a.push(s), s = [], o.push({ t: r.t, reason: n && r.cfs <= 0 ? "non_positive_flow" : r.reason?.code ?? "unusable_observation" });
      continue;
    }
    let c = s[s.length - 1];
    c && r.t - c.t > t && (i.push({ startT: c.t, endT: r.t, reason: "unsupported_gap" }), a.push(s), s = []), s.push(Tt(r));
  }
  return s.length && a.push(s), { segments: a, gaps: i, exclusions: o };
}
function ue(e = "path_unavailable") {
  return {
    available: !1,
    reason: typeof e == "string" ? _(e) : e,
    points: [],
    segments: [],
    startT: null,
    endT: null,
    gaps: [],
    exclusions: []
  };
}
function Te(e, t = {}) {
  let n = e.filter((s) => s.length).map((s) => s.map(Tt)), a = n.flat();
  return {
    available: a.length > 0,
    reason: a.length ? null : _("path_unavailable"),
    points: a,
    segments: n,
    startT: a[0]?.t ?? null,
    endT: a[a.length - 1]?.t ?? null,
    gaps: [],
    exclusions: [],
    ...t
  };
}
function fn(e, t = Xe, n = !1) {
  let a = $t(e, t, n);
  return Te(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function Oe(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Pe(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let s = e[n - 1], i = (t - s.t) / (a.t - s.t), o = (1 - i) * s.cfs + i * a.cfs;
  return j(o) ? o : null;
}
function ft(e, t) {
  for (let n of e.segments) {
    let a = Oe(n, t);
    if (a !== null) return a;
  }
  return null;
}
function Ut(e, t, n) {
  let a = [];
  for (let s of e.segments) {
    let i = Math.max(t, s[0].t), o = Math.min(n, s[s.length - 1].t);
    if (i > o) continue;
    let r = [
      { t: i, cfs: Oe(s, i) },
      ...s.filter((c) => c.t > i && c.t < o),
      ...o > i ? [{ t: o, cfs: Oe(s, o) }] : []
    ];
    a.push(r);
  }
  return Te(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function ze(e, t, n, a) {
  let s = Qe(n, t);
  return {
    available: !!e?.data,
    dataT: R(t) ? t : null,
    ageMs: s,
    stale: s === null || s > a,
    lastAttemptAt: R(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: R(e?.lastSuccessAt) ? e.lastSuccessAt : null,
    error: e?.error ?? null,
    url: e?.url ?? null,
    rawRefs: e?.rawRefs ?? [],
    reasons: [
      ...e?.data ? [] : [_("source_unavailable")],
      ...e?.error ? [_("source_fetch_failed")] : [],
      ...s !== null && s > a ? [_("source_stale", { ageMs: s, maxAgeMs: a })] : []
    ]
  };
}
function ma(e, t, n, a) {
  let s = t ? t.t - 12 * U : null, i = {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: t,
    comparison: null,
    targetT: s,
    elapsedMs: null,
    changeCfs: null,
    approximate: !1,
    asOf: !!(t && n - t.t > 30 * Ie)
  };
  if (!Z(t)) return { ...i, reason: _(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let o = Ye(e, s);
  if (!o) return { ...i, reason: _("comparison_missing", { toleranceMs: He }) };
  let r = {
    ...i,
    comparison: o,
    elapsedMs: t.t - o.t,
    approximate: o.t !== s
  };
  if (!Z(o)) return { ...r, reason: _("comparison_unusable") };
  if (n - t.t > 2 * U) return { ...r, reason: _("gauge_stale") };
  if (a?.error) return { ...r, reason: _("source_fetch_failed") };
  let c = e.slice(Pe(e, o.t), Pe(e, t.t) + 1), u = c.find((f) => !Z(f));
  if (u) return { ...r, reason: _("unusable_observation", { t: u.t }) };
  let l = 0;
  for (let f = 1; f < c.length; f++) l = Math.max(l, c[f].t - c[f - 1].t);
  if (l > pe) return { ...r, reason: _("observation_gap", { maxGapMs: l, allowedMs: pe }) };
  let d = Je(t.cfs, o.cfs);
  return j(d) ? { ...r, available: !0, reason: null, changeCfs: d } : { ...r, reason: _("non_finite_arithmetic") };
}
function ba(e, t, n, a) {
  let s = {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * Ie)
  };
  if (!Z(t)) return { ...s, reason: _(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = Ye(e, t.t - U);
  if (!Z(i)) return { ...s, comparison: i, reason: _("direction_comparison_unavailable") };
  let o = Je(t.cfs, i.cfs), r = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), c = { ...s, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: r };
  if (!j(o)) return { ...c, changeCfs: null, reason: _("non_finite_arithmetic") };
  if (n - t.t > 2 * U) return { ...c, reason: _("gauge_stale") };
  if (a?.error) return { ...c, reason: _("source_fetch_failed") };
  let u = e.filter((l) => l.t >= i.t && l.t <= t.t);
  return u.some((l) => !Z(l)) || u.some((l, d) => d && l.t - u[d - 1].t > pe) ? { ...c, reason: _("direction_observation_gap") } : {
    ...c,
    available: !0,
    reason: null,
    label: Math.abs(o) <= r ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function sn(e, t, n) {
  let a = R(t) ? t - 7 * O : null, s = {
    windowStartT: a,
    windowEndT: R(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!R(t)) return s;
  for (let o of e) {
    if (o.t < a || o.t > t) continue;
    let r = n(e, o.t);
    r.available ? (s.evaluatedCount++, s.coverageStartT ?? (s.coverageStartT = o.t), s.coverageEndT = o.t, r.reached && (s.last = r)) : s.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= a && o.t <= t);
  return s.coverageComplete = s.coverageStartT !== null && s.coverageStartT <= a + He && s.coverageEndT >= t - pe && s.unavailableCount === 0 && !i.some((o, r) => r && o.t - i[r - 1].t > pe), s;
}
function rn(e, t, n) {
  if (!R(t)) return { ...ue("observations_unavailable"), steps: [] };
  let a = [], s = [], i = [], o = [], r = null;
  for (let c of e) {
    if (c.t < t - 2 * O) continue;
    let u = n(e, c.t), l = u.comparison?.cfs;
    if (!u.available || !j(l + u.referenceCfs)) {
      o.length && a.push(o), o = [], r = null;
      continue;
    }
    if (r && c.t - r.t > pe && (i.push({ startT: r.t, endT: c.t, reason: "unsupported_gap" }), o.length && a.push(o), o = [], r = null), r) for (let f of Ft(r.t, c.t)) {
      let p = (f - r.t) / (c.t - r.t), h = (1 - p) * r.base + p * l, m = h + $e(f - 1), $ = h + $e(f);
      o.push({ t: f, cfs: m }), a.push(o), o = [{ t: f, cfs: $ }], s.push({ t: f, beforeCfs: m, afterCfs: $ });
    }
    let d = { t: c.t, cfs: l + u.referenceCfs };
    o.at(-1)?.t !== c.t && o.push(d), r = { t: c.t, base: l };
  }
  return o.length && a.push(o), { ...Te(a, { gaps: i }), steps: s };
}
function yt(e, t = "forecast_unavailable") {
  let n = () => ue(t), a = () => ({ endpoint: Ze(t), low: Ze(t) });
  return {
    available: !1,
    reason: _(t),
    issuedT: null,
    issueAgeMs: null,
    older: !1,
    freshContext: !1,
    offsetCfs: null,
    largeAdjustment: !1,
    raw: n(),
    shifted: n(),
    high: n(),
    low: n(),
    references: { endpoint: { ...n(), steps: [] }, low: { ...n(), steps: [] } },
    crossings: { shifted: a(), high: a(), low: a() },
    crests: [],
    nextCrest: null,
    laterHigherCrests: [],
    higherLater: { available: !1, reason: _(t), aboveCurrent: null, peakCfs: null, peakT: null, largeAdjustment: !1 },
    cases: {
      available: !1,
      reason: _(t),
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(Y(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function Ze(e = "path_unavailable", t = !1) {
  return {
    available: !1,
    reason: typeof e == "string" ? _(e) : e,
    t: null,
    currentCfs: null,
    comparisonCfs: null,
    changeCfs: null,
    referenceCfs: null,
    alreadyReached: !1,
    largeAdjustment: t
  };
}
function Ft(e, t) {
  if (!R(e) || !R(t) || e >= t) return [];
  let n = Y(e), a = Y(t), s = [];
  for (let i = n.year; i <= a.year; i++)
    for (let o of [3, 5, 11]) {
      let r = Ve(i, o, 1);
      r > e && r <= t && s.push(r);
    }
  return s.sort((i, o) => i - o);
}
function va(e, t, n) {
  let a = Ut(e, n.t - 2 * O, n.t), s = Ut(t, n.t, t.endT ?? n.t), i = a.segments.map((o) => [...o]);
  for (let o of s.segments) {
    let r = o.filter((l) => l.t > n.t);
    if (!r.length) continue;
    let c = i[i.length - 1];
    o[0].t === n.t && c?.[c.length - 1].t === n.t ? c.push(...r) : i.push(r);
  }
  return Te(i);
}
function dn(e, t) {
  let n = t - O, a = ft(e, t);
  if (a === null) return null;
  let s = ft(e, n);
  if (s === null) return null;
  let i = e.segments.find((r) => r[0].t <= n && r[r.length - 1].t >= t), o = null;
  if (i) {
    o = s;
    for (let r of i) r.t > n && r.t <= t && (o = Math.min(o, r.cfs));
    o = Math.min(o, a);
  }
  return { current: a, endpoint: s, low: o };
}
function wa(e, t, n, a, s, i) {
  let o = ft(t, s);
  if (o === null) return null;
  let r = s - O;
  if (r > a.t) {
    let h = dn(e, s);
    return h && h[i] !== null ? { current: o, base: h[i] } : null;
  }
  if (i === "endpoint") {
    let h = Ye(n, r);
    return Z(h) ? { current: o, base: h.cfs, comparisonT: h.t } : null;
  }
  let c = Ye(n, r);
  if (!Z(c)) return null;
  let u = n.filter((h) => h.t >= r && h.t <= a.t), l = c.t < r ? [c, ...u] : u;
  if (!u.length || u.some((h) => !Z(h)) || l.some((h, m) => m && h.t - l[m - 1].t > pe)) return null;
  let d = t.segments.find((h) => h[0].t <= a.t && h[h.length - 1].t >= s);
  if (!d) return null;
  let f = o, p = null;
  for (let h of u) h.cfs <= f && (f = h.cfs, p = h.t);
  for (let h of d) h.t > a.t && h.t <= s && h.cfs < f && (f = h.cfs, p = null);
  return { current: o, base: f, minimumObservedT: p };
}
function _a(e, t, n, a, s) {
  let i = [], o = (r) => {
    r > n && r <= a && i.push(r);
  };
  if (s === "endpoint") {
    for (let r = 1; r < e.length; r++)
      o(Math.floor((e[r - 1].t + e[r].t) / 2) + O + 1);
    for (let r of e)
      o(r.t - He + O), o(r.t + He + O + 1);
  } else for (let r of e) o(r.t + O + 1);
  return i.filter((r) => r - O <= t.t);
}
function ya(e, t, n, a, s = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let r of e.points)
    for (let c of [r.t, r.t + O]) c >= t && c <= n && i.add(c);
  for (let r of Ft(t, n))
    i.add(r), r - 1 >= t && i.add(r - 1);
  for (let r of s)
    i.add(r), r - 1 >= t && i.add(r - 1);
  let o = [...i].sort((r, c) => r - c);
  for (let r = 1; r < o.length; r++) {
    let c = o[r - 1], u = o[r], l = (c + u) / 2, d = dn(e, l);
    if (!d || a === "low" && d.low === null) {
      i.add(l);
      continue;
    }
    if (a !== "low") continue;
    let f = e.segments.find((m) => m[0].t <= l - O && m[m.length - 1].t >= l);
    if (!f) continue;
    let p = 1 / 0;
    for (let m of f) m.t > l - O && m.t < l && (p = Math.min(p, m.cfs));
    let h = [
      [Oe(f, c - O), Oe(f, u - O)],
      [Oe(f, c), Oe(f, u)],
      ...j(p) ? [[p, p]] : []
    ].filter((m) => m.every(j));
    for (let m = 0; m < h.length; m++) for (let $ = m + 1; $ < h.length; $++) {
      let v = h[m][0] - h[$][0], g = h[m][1] - h[$][1];
      if (!j(v) || !j(g) || v === g) continue;
      let b = v / (v - g);
      b > 0 && b < 1 && i.add(c + b * (u - c));
    }
  }
  return [...i].sort((r, c) => r - c);
}
function $a(e, t, n, a, s, i) {
  if (!t.available) return { reference: { ...ue(t.reason), steps: [] }, crossing: Ze(t.reason, s) };
  let o = va(e, t, n), r = t.endT, c = n.t, u = _a(i, n, c, r, a), l = ya(o, c, r, a, u), d = /* @__PURE__ */ new Set([...Ft(c, r), ...u]), f = [], p = [], h = [], m = Ze("comparison_coverage_missing", s), $ = 0, v = !1, g = null, b = (k) => {
    if (ft(t, k) === null) return null;
    let y = wa(o, t, i, n, k, a), A = y?.base;
    if (!y || A === null || !j(A)) return null;
    let W = $e(k), q = A + W, V = Je(y.current, A);
    return j(q) && j(V) ? {
      t: k,
      current: y.current,
      base: A,
      line: q,
      delta: V,
      threshold: W,
      comparisonT: y.comparisonT ?? null,
      minimumObservedT: y.minimumObservedT ?? null
    } : null;
  };
  for (let k of l) {
    let y = b(k);
    if (!y) {
      m.t === null && (v = !0), h.length && f.push(h), h = [], g = null;
      continue;
    }
    if ($++, d.has(k)) {
      let A = b(k - 1), W = $e(k - 1) !== y.threshold, q = A && A.base !== y.base && (a === "endpoint" ? A.comparisonT !== y.comparisonT : A.minimumObservedT !== null && A.minimumObservedT + O + 1 === k);
      if (A && h.length && (W || q)) {
        let V = q ? A.line : y.base + $e(k - 1);
        h.push({ t: k, cfs: V }), f.push(h), h = [], V !== y.line && p.push({ t: k, beforeCfs: V, afterCfs: y.line });
      }
    }
    if (h.push({ t: k, cfs: y.line }), m.t === null && y.delta >= y.threshold && !v) {
      let A = y;
      if (g && g.delta < g.threshold && !d.has(k) && $e(g.t) === y.threshold) {
        let W = g.t, q = k;
        for (; q - W > 1; ) {
          let V = Math.floor((q + W) / 2), Ae = b(V);
          !Ae || Ae.delta < Ae.threshold ? W = V : q = V;
        }
        A = b(q) ?? y;
      }
      m = {
        available: !0,
        reason: null,
        t: A.t,
        currentCfs: A.current,
        comparisonCfs: A.base,
        changeCfs: A.delta,
        referenceCfs: A.threshold,
        alreadyReached: A.t === n.t,
        largeAdjustment: s
      };
    }
    g = y;
  }
  h.length && f.push(h), m.t === null && $ && !v ? m = { ...Ze(null, s), available: !0, reason: null } : m.t === null && v && (m = Ze("comparison_coverage_missing", s));
  let S = f.map((k) => {
    let y = [];
    for (let A of k)
      y.length >= 2 && y.at(-2).cfs === y.at(-1).cfs && y.at(-1).cfs === A.cfs && y.pop(), y.push(A);
    return y;
  });
  return { reference: { ...Te(S), steps: p }, crossing: m };
}
function Ta(e, t) {
  let n = [e, t];
  for (let s = e + Ie; s < t; s += Ie) n.push(s);
  let a = n.map((s) => {
    let i = Y(s);
    return i.hour >= 8 && (i.hour < 17 || i.hour === 17 && i.minute === 0 && i.second === 0);
  });
  return a.every(Boolean) ? "inside_08_17" : a.every((s) => !s) ? "outside_08_17" : "spans_both";
}
function xa(e, t) {
  let n = [];
  for (let a of e.segments) {
    let s = 0;
    for (; s < a.length; ) {
      let i = s;
      for (; i + 1 < a.length && a[i + 1].cfs === a[s].cfs; ) i++;
      let o = a[s - 1], r = a[i + 1];
      if (o && r && o.cfs < a[s].cfs && r.cfs < a[i].cfs && a[i].t > t) {
        let c = s - 1;
        for (; c > 0 && a[c - 1].cfs <= a[c].cfs; ) c--;
        let u = Tt(a[c]);
        n.push({
          startT: a[s].t,
          endT: a[i].t,
          cfs: a[s].cfs,
          precedingLow: u,
          riseCfs: a[s].cfs - u.cfs,
          bracketStartT: o.t,
          bracketEndT: r.t,
          clockRange: Ta(o.t, r.t)
        });
      }
      s = i + 1;
    }
  }
  return n.sort((a, s) => a.startT - s.startT);
}
function Ma(e, t, n, a, s, i, o) {
  let r = yt(e), c = t?.data;
  if (!c) return r;
  let u = c.issuedT;
  r.issuedT = R(u) ? u : null, r.issueAgeMs = Qe(e, u), r.older = r.issueAgeMs !== null && r.issueAgeMs > 12 * U, r.cases.tableVersion = o?.version ?? null, r.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let l = (g) => ({
    ...yt(e, g),
    issuedT: r.issuedT,
    issueAgeMs: r.issueAgeMs,
    older: r.older,
    cases: { ...r.cases, reason: _(g) }
  });
  if (!R(u)) return l("forecast_issue_missing");
  if (u > e) return l("forecast_issue_future");
  if (e - u > 48 * U) return l("forecast_issue_too_old");
  let d = on(c.points).filter((g) => g.t <= e + 10 * O), f = fn(d, Xe);
  if (!f.segments.some((g) => g[0].t <= e + Xe && g[g.length - 1].t >= e + O))
    return l("forecast_next_day_coverage_missing");
  if (r.available = f.available, r.reason = f.reason, r.raw = f, r.crests = xa(f, i?.t ?? e), r.nextCrest = r.crests[0] ?? null, r.laterHigherCrests = r.nextCrest ? r.crests.slice(1).filter((g) => g.cfs > r.nextCrest.cfs) : [], !Z(i)) {
    let b = yt(e, i ? "current_observation_unusable" : "current_observation_unavailable");
    return {
      ...r,
      shifted: b.shifted,
      high: b.high,
      low: b.low,
      references: b.references,
      crossings: b.crossings,
      higherLater: b.higherLater,
      cases: { ...r.cases, reason: b.cases.reason }
    };
  }
  let p = ft(f, i.t);
  if (p === null) {
    let g = yt(e, "forecast_alignment_unsupported");
    return {
      ...r,
      shifted: g.shifted,
      high: g.high,
      low: g.low,
      references: g.references,
      crossings: g.crossings,
      higherLater: g.higherLater,
      cases: { ...r.cases, reason: g.cases.reason }
    };
  }
  let h = Je(i.cfs, p);
  if (!j(h)) return l("non_finite_arithmetic");
  r.offsetCfs = h, r.largeAdjustment = Math.abs(h) > Math.max(10, 0.1 * i.cfs);
  let m = [], $ = [];
  for (let g of f.segments) {
    let b = g.map((k) => ({ t: k.t, cfs: k.cfs + h })), S = $t(b, Xe, !0);
    m.push(...S.segments), $.push(...S.exclusions);
  }
  r.shifted = Ut(Te(m, { gaps: f.gaps, exclusions: $ }), i.t, i.t + 72 * U), r.shifted.points.some((g) => g.t > i.t) || (r.shifted = { ...ue("non_positive_shifted_flow"), exclusions: $, gaps: f.gaps }), r.freshContext = !r.older && !t.error && !n?.error && e - i.t <= 2 * U, r.higherLater = {
    available: !1,
    reason: _("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: r.largeAdjustment
  };
  let v = r.shifted.points.filter((g) => g.t > i.t);
  if (r.freshContext && v.length) {
    let g = v.reduce((b, S) => S.cfs > b.cfs ? S : b);
    r.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: g.cfs > i.cfs,
      peakCfs: g.cfs,
      peakT: g.t,
      largeAdjustment: r.largeAdjustment
    };
  }
  if (r.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(Y(e).month), !r.cases.wetSeason)
    r.cases.reason = _("historical_cases_off_season"), r.high = ue(r.cases.reason), r.low = ue(r.cases.reason);
  else if (!o || o.version !== 3 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    r.cases.reason = _("historical_table_unavailable"), r.high = ue(r.cases.reason), r.low = ue(r.cases.reason);
  else
    try {
      let g = [], b = [], S = [], k = [];
      for (let y of r.shifted.segments) {
        let A = en(y, i, o, e), W = y[0]?.t === i.t && i.cfs > 0 ? [Tt(i)] : [], q = $t([...W, ...A.high], Xe, !0), V = $t([...W, ...A.low], Xe, !0);
        g.push(...q.segments), b.push(...V.segments), S.push(...q.exclusions), k.push(...V.exclusions);
      }
      r.high = Te(g, { gaps: r.shifted.gaps, exclusions: S }), r.low = Te(b, { gaps: r.shifted.gaps, exclusions: k });
      for (let y of ["high", "low"]) r[y].points.some((A) => A.t > i.t) || (r[y] = { ...ue("historical_case_values_unsupported"), exclusions: r[y].exclusions, gaps: r[y].gaps });
      r.cases.available = r.high.available || r.low.available, r.cases.reason = r.cases.available ? null : _("historical_case_values_unsupported");
    } catch {
      r.cases.reason = _("historical_table_invalid"), r.high = ue(r.cases.reason), r.low = ue(r.cases.reason);
    }
  for (let g of ["shifted", "high", "low"])
    for (let b of ["endpoint", "low"]) {
      let S = $a(s, r[g], i, b, r.largeAdjustment, a);
      r.crossings[g][b] = S.crossing, g === "shifted" && (r.references[b] = S.reference);
    }
  return r;
}
function hn(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
  for (let l of n?.conflicts ?? []) R(l) && l <= e && l % U === 0 && s.add(l);
  for (let l of n?.hours ?? [])
    if (!(!R(l.endT) || l.endT > e || l.endT % U !== 0)) {
      if (!j(l.mm) || l.mm < 0) {
        s.add(l.endT);
        continue;
      }
      a.has(l.endT) && a.get(l.endT) !== l.mm ? s.add(l.endT) : a.set(l.endT, l.mm);
    }
  let i = [...a.keys(), ...s], o = i.length ? Math.max(...i) : null, r = Qe(e, o), c = pa.map((l) => {
    let d = {
      hours: l,
      available: !1,
      reason: _("radar_unavailable"),
      startT: o === null ? null : o - l * U,
      endT: o,
      ageMs: r,
      mm: null,
      inches: null
    };
    if (o === null) return d;
    let f = 0;
    for (let p = 0; p < l; p++) {
      let h = o - p * U;
      if (s.has(h)) return { ...d, reason: _("radar_conflicting_hour", { endT: h }) };
      if (!a.has(h)) return { ...d, reason: _("radar_missing_hour", { endT: h }) };
      f += a.get(h);
    }
    return j(f) ? { ...d, available: !0, reason: null, mm: f, inches: f / 25.4 } : { ...d, reason: _("non_finite_arithmetic") };
  }), u = c.some((l) => l.available);
  return {
    available: u,
    reason: u ? null : _("radar_windows_unavailable"),
    endT: o,
    generatedT: R(n?.generatedT) ? n.generatedT : null,
    ageMs: r,
    historical: r !== null && r > 2 * U,
    stale: r === null || r > 3 * U,
    windows: c,
    status: tn(e, n?.hours ?? [], n?.conflicts ?? []),
    hours: [...new Set(i)].sort((l, d) => l - d).map((l) => ({ endT: l, mm: s.has(l) ? null : a.get(l) ?? null })),
    definitionCode: n?.definitionCode ?? null,
    regions: Object.fromEntries(["upper", "lower"].filter((l) => n?.regions?.[l]).map((l) => [l, {
      ...hn(e, { data: { ...n.regions[l], generatedT: n.generatedT } }),
      areaFraction: n.regions[l].areaFraction
    }]))
  };
}
function Aa(e, t) {
  let n = t?.data, a = Qe(e, n?.updatedT), s = {
    available: !1,
    reason: _("grid_forecast_unavailable"),
    startT: e,
    endT: e + O,
    updatedT: R(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * U,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return s;
  if (!R(n.updatedT) || n.updatedT > e) return { ...s, reason: _("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((u) => R(u.startT) && R(u.endT) && u.endT > e && u.startT < e + O).sort((u, l) => u.startT - l.startT || u.endT - l.endT), o = e, r = 0, c = !1;
  for (let u of i) {
    if (u.startT >= u.endT || !j(u.mm) || u.mm < 0) return { ...s, reason: _("grid_interval_invalid") };
    let l = Math.max(e, u.startT), d = Math.min(e + O, u.endT);
    if (l < o) return { ...s, reason: _("grid_interval_overlap", { t: l }) };
    if (l > o) return { ...s, reason: _("grid_interval_gap", { startT: o, endT: l }) };
    let f = (d - l) / (u.endT - u.startT);
    r += u.mm * f, c || (c = f !== 1), o = d;
  }
  return o < e + O ? { ...s, reason: _("grid_interval_gap", { startT: o, endT: e + O }) } : j(r) ? { ...s, available: !0, reason: null, mm: r, inches: r / 25.4, prorated: c } : { ...s, reason: _("non_finite_arithmetic") };
}
function ka(e, t) {
  let n = t?.data, a = Qe(e, t?.lastSuccessAt), s = {
    available: !1,
    reason: _("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * U,
    startT: e,
    endT: e + 2 * O,
    events: []
  };
  if (!n) return s;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...s, reason: _("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let c of n.points ?? []) {
    if (!R(c.t) || c.t < e || c.t > e + 2 * O || !j(c.ft) || !["H", "L"].includes(c.type)) continue;
    let u = i.get(c.t);
    u && (u.ft !== c.ft || u.type !== c.type) && o.add(c.t), i.set(c.t, { t: c.t, ft: c.ft, type: c.type });
  }
  let r = [...i.values()].filter((c) => !o.has(c.t)).sort((c, u) => c.t - u.t);
  return { ...s, available: r.length > 0, reason: r.length ? null : _("tide_events_unavailable"), events: r };
}
function pn({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!R(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, s = on(a?.points).filter((v) => v.t <= e), i = s[s.length - 1] ?? null, o = [...s].reverse().find((v) => Z(v)) ?? null, r = fn(s, pe), c = i?.t ?? null, u = ze(t.gauge, c, e, 2 * U), l = {
    latest: i,
    lastNumericObservation: o,
    points: s,
    segments: r.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: Qe(e, c),
    stale: u.stale,
    referenceCfs: R(c) ? $e(c) : null,
    endpoint: Ht(s, c),
    low: Pt(s, c),
    references: { endpoint: rn(s, c, Ht), low: rn(s, c, Pt) },
    direction: ba(s, i, e, t.gauge),
    twelveHourChange: ma(s, i, e, t.gauge),
    history: { endpoint: sn(s, c, Ht), low: sn(s, c, Pt) }
  }, d = Ma(e, t.noaa, t.gauge, s, r, i, n), f = hn(e, t.radar), p = Aa(e, t.grid), h = ka(e, t.tides), m = i?.eligible && i?.usable && e - i.t >= 0 && e - i.t <= U ? s.filter((v) => v.eligible && v.usable && v.t >= i.t - 2 * O).reduce((v, g) => !v || g.cfs >= v.cfs ? g : v, null) : null, $ = nn(e, t.ensemble, m);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: u,
      noaa: ze(t.noaa, d.issuedT, e, 12 * U),
      radar: ze(t.radar, f.endT, e, 3 * U),
      grid: ze(t.grid, p.updatedT, e, 12 * U),
      tides: ze(t.tides, t.tides?.lastSuccessAt, e, 36 * U),
      ensemble: ze(t.ensemble, $.issuedT, e, 48 * U)
    },
    gauge: l,
    forecast: d,
    rain: { radar: f, grid: p },
    tides: h,
    outlook: $
  };
}

// site/js/watch-render.js
function mn(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var T = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), ne = (e) => typeof e == "number" && Number.isFinite(e);
function bn(e, t = !1) {
  if (!ne(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function et(e, t = !1) {
  if (!ne(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function K(e, t = !1) {
  if (!ne(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
function Q(e, t = !1) {
  return ne(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function ie(e) {
  if (!ne(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function xt(e) {
  return ne(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var vn = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function tt(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(tt).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return vn[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(vn, {
  ice: "Ice-affected values are unusable.",
  malformed_value: "Invalid numeric values are unusable.",
  negative_value: "Negative discharge values are unusable.",
  wrong_station: "Readings from another station are excluded.",
  wrong_parameter: "Other measured quantities are excluded.",
  unsupported_unit: "Unsupported units are excluded.",
  invalid_timestamp: "Invalid timestamps are excluded.",
  future_timestamp: "Future-dated observations are excluded.",
  estimated: "Estimated readings are displayed but cannot support automatic notices.",
  unsupported_quality: "Unsupported quality flags prevent automatic notices.",
  quality_flags_unavailable: "Missing quality flags prevent automatic notices.",
  approval_unavailable: "Missing approval status prevents automatic notices.",
  latest_ineligible: "The newest reading cannot support an automatic turn notice.",
  observation_older_than_60min: "The newest eligible reading is more than 60 minutes old.",
  no_data: "No eligible observation is available.",
  rate_suppression: "The warning rate limit has been reached.",
  rate_limit: "The warning rate limit has been reached.",
  observations_unavailable: "Gauge readings are unavailable.",
  current_observation_unavailable: "The current gauge reading is unavailable.",
  current_observation_unusable: "The newest reading is unusable; an older reading has not been substituted.",
  unusable_observation: "An unusable reading interrupts this calculation.",
  conflicting_duplicate: "The source returned conflicting readings at the same time.",
  comparison_missing: "No comparison reading is available within the allowed time tolerance.",
  comparison_unusable: "The comparison reading is unusable.",
  window_start_missing: "There is no supported reading near the start of this 24-hour window.",
  window_start_unusable: "The reading at the start of this window is unusable.",
  window_unusable_observation: "An unusable reading interrupts this 24-hour window.",
  observation_gap: "A gap longer than 30 minutes interrupts the observed record.",
  window_empty: "No supported readings are available in this window.",
  direction_comparison_unavailable: "The required hour-ago comparison is unavailable.",
  direction_observation_gap: "A gap interrupts the hour-change calculation.",
  gauge_stale: "The newest gauge reading is more than two hours old.",
  forecast_unavailable: "The issued river forecast is unavailable.",
  forecast_issue_missing: "The forecast issue time is missing.",
  forecast_issue_future: "The forecast issue time is in the future.",
  forecast_issue_too_old: "The forecast was issued more than 48 hours ago and is withheld.",
  forecast_next_day_coverage_missing: "The forecast lacks the required coverage of the next day.",
  forecast_alignment_unsupported: "No forecast value is supported at the gauge-reading time. Adjusted and past-case lines are unavailable; the issued forecast remains visible.",
  non_positive_shifted_flow: "The gauge adjustment would create a non-positive flow; that part is withheld.",
  non_positive_flow: "Non-positive flow values are withheld.",
  forecast_context_not_current: "The gauge or forecast context is stale or has a failed latest retrieval.",
  comparison_coverage_missing: "The forecast comparison path lacks required coverage.",
  path_unavailable: "This calculation path is unavailable.",
  unsupported_gap: "A gap exceeds the allowed interpolation interval.",
  historical_cases_off_season: "Historical cases are available only for October\u2013April.",
  historical_table_unavailable: "The historical case table is unavailable.",
  historical_table_invalid: "The historical case table did not pass its checks.",
  historical_case_values_unsupported: "Historical case values are unsupported here.",
  radar_unavailable: "The radar rainfall source is unavailable.",
  radar_windows_unavailable: "Supported hourly radar totals are unavailable.",
  radar_conflicting_hour: "Conflicting radar totals were returned for an hour.",
  radar_missing_hour: "A missing radar hour prevents this total.",
  grid_forecast_unavailable: "The one-cell rainfall forecast is unavailable.",
  grid_issue_invalid: "The rainfall forecast issue time is invalid.",
  grid_interval_invalid: "A rainfall forecast interval is invalid.",
  grid_interval_overlap: "Overlapping rainfall forecast intervals prevent this total.",
  grid_interval_gap: "A gap in forecast intervals prevents this total.",
  tides_unavailable: "Tide predictions are unavailable.",
  tide_identity_or_datum_invalid: "The tide station or height reference does not match Bellingham predictions.",
  tide_events_unavailable: "No supported tide events are available.",
  source_unavailable: "The source is unavailable.",
  source_fetch_failed: "The latest source retrieval failed; retained values keep their original times.",
  source_stale: "The source is stale.",
  published_snapshot_old: "The published snapshot is old; current direction and monitoring status cannot be confirmed.",
  public_snapshot_unavailable: "A current public snapshot could not be verified; the newest retained readings keep their original times.",
  public_time_uncertain: "Current time could not be confirmed for this public view.",
  preview_ended: "This preview has ended; the retained readings are earlier evidence.",
  non_finite_arithmetic: "The supplied values cannot produce a finite calculation."
});
function Ke(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var Ca = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, wn = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, be = (e) => `<time datetime="${ne(e) ? new Date(e).toISOString() : ""}">${T(Q(e, !0))}</time>`;
var Sa = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function Ea(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return tt("public_time_uncertain");
  let a = tt(t);
  return e.timeUncertain && Sa.includes(n) ? `At the snapshot save time: ${a}` : a;
}
function _n(e, t) {
  let n = e.forecast || {}, a = (h) => Ea(e, h);
  Ke("forecast-age", n.issuedT ? `Issued ${be(n.issuedT)} \xB7 ${T(e.timeUncertain ? "age unknown" : ie(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${T(a(n.reason))}` : ""}` : `Forecast unavailable. ${T(a(n.reason))}`);
  let s = [];
  e.sources?.noaa?.error && s.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && s.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${et(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? s.push({ text: a(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && s.push(`Adjusted forecast unavailable. ${a(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && s.push(`Historical cases unavailable. ${a(n.cases.reason)}`), Ke("forecast-problems", s.map((h) => `<p${typeof h == "object" && h.neutral ? ' class="neutral"' : ""}>${T(typeof h == "object" ? h.text : h)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (i && s.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let c = n.crossings?.shifted?.[t.reference], u = c?.available ? ne(c.t) ? `The adjusted forecast ${c.alreadyReached ? "already meets" : "first reaches"} the reference at ${Q(c.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${a(c?.reason)}`, l = ne(n.offsetCfs) ? `Adjustment to the gauge reading: ${et(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", d = Date.parse(n.cases?.trainingCutoff ?? ""), f = ne(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${bn(n.cases.tableVersion)}${ne(d) ? `; training cutoff ${be(d)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  Ke("forecast-details", wn("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier measurements or the adjusted forecast; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${ne(n.raw?.endT) ? `; available through ${be(n.raw.endT)}` : ""}.</p><p>${T(l)} ${n.available === !1 ? `The issued forecast is unavailable. ${T(a(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${T(u)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. Cases extend up to 72 hours from the latest reading in October\u2013April. A low case stops when its historical subtraction reaches zero; this does not predict a dry river. Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.</p>${f}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function gn(e, t = !1) {
  if (t || !e?.available) return "Rain status unknown: recent complete hourly data are needed.";
  let n = `${e.hours} complete ${e.hours === 1 ? "hour" : "hours"}`;
  return e.state === "paused" ? `Rain paused${e.transitionKnown ? "" : " or very light"} for ${n} \xB7 below 0.1 mm per hour.` : e.state === "restarted" ? `Rain restarted \xB7 ${n} at or above 0.1 mm per hour.` : `Rain observed in the latest ${n} \xB7 earlier change unknown.`;
}
function La(e, t) {
  let n = ["upper", "lower"].filter((r) => e.regions?.[r]), a = { upper: "Upper + middle", lower: "Lower above gauge" }, s = n.map((r) => {
    let c = e.regions[r], u = c.windows?.find((l) => l.hours === 24);
    return `<article class="rain-region"><h3>${a[r]}</h3><strong>${T(gn(c.status, t))}</strong><p>${u?.available ? `${xt(u.inches)} in over 24 hours` : "24-hour total unavailable"} \xB7 about ${Math.round(c.areaFraction * 100)}% of the drainage area.</p></article>`;
  }).join(""), i = e.endT, o = Array.from({ length: 24 }, (r, c) => i - (23 - c) * 36e5).map((r) => {
    let c = (u) => {
      let l = u?.hours?.find((d) => d.endT === r)?.mm;
      return ne(l) ? xt(l / 25.4) : "Missing";
    };
    return `<tr><td>${be(r)}</td><td>${c(e)}</td>${n.map((u) => `<td>${c(e.regions[u])}</td>`).join("")}</tr>`;
  }).join("");
  return `<div class="rain-status" role="status"><strong>${T(gn(e.status, t))}</strong><p class="meta">Whole drainage area \xB7 status ends at the rainfall time above. \u201CPaused\u201D means below the display threshold, not dry everywhere.</p></div><div class="rain-regions">${s || '<p class="meta">Upper and lower rainfall unavailable in this saved snapshot.</p>'}</div>${n.length ? '<p class="meta">Upper + middle includes Friday Creek. Lower means the part of the Lower Samish subwatershed upstream of the river gauge. These official watershed areas cover the drainage feeding this gauge, not the whole area down to the bay.</p>' : ""}${ne(i) ? `<details class="hourly-rain"><summary>Hourly rain: stopped, continued or restarted</summary><p class="meta">Inches in each complete hour ending at the listed Pacific time. Missing hours remain unknown.</p><div class="rain-table-wrap"><table><thead><tr><th>Hour ending</th><th>Whole area</th>${n.map((r) => `<th>${a[r]}</th>`).join("")}</tr></thead><tbody>${o}</tbody></table></div></details>` : ""}`;
}
function yn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${Q(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : ie(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", s = t.windows || [2, 4, 6, 8, 12, 18, 24].map((r) => ({ hours: r, available: !1 })), i = [...new Set(s.filter((r) => !r.available).map((r) => tt(r.reason || t.reason)))], o = wn("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over each drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. A pause means the area average is below 0.1 millimetres per hour (about 0.004 inches). A restart requires a complete below-threshold hour followed by rain at or above the threshold, with no missing hour between. This display threshold describes radar rain; it does not predict a river crest. Status is withheld when the latest hour is more than three hours old.</p><p>Upper and lower areas follow the official Watershed Boundary Dataset. Upper includes Upper Samish River, Middle Samish River and Friday Creek; lower is the Lower Samish River area above the gauge. Region totals are area averages, not amounts to add together.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  Ke("rain", `<div class="section-heading"><h2>Rain</h2>${Ca("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${T(a)}</p>${La(t, e.timeUncertain || e.conditionsSuppressed)}<div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${s.map((r) => `<div class="rain-total" aria-label="${r.hours}-hour total ending ${T(Q(r.endT ?? t.endT, !0))}, ${T(e.timeUncertain ? "age unknown" : ie(r.ageMs ?? t.ageMs) + " old")}"><span>${r.hours} hours</span><strong>${r.available ? xt(r.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map(T).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${xt(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${T(tt(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${be(n.updatedT)} \xB7 ${T(e.timeUncertain ? "age unknown" : ie(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function $n(e) {
  let t = e.tides || {};
  Ke("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + T(ie(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${be(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${bn(n.ft)}</td></tr>`).join("")}</tbody></table>` : `<p>${T(tt(t.reason))}</p>`}</div>`);
}
function Tn(e, t, n) {
  Ke("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", ensemble: "NOAA Hydrologic Ensemble Forecast Service \xB7 alternative flow scenarios", tides: "NOAA Bellingham tide predictions" }).map(([s, i]) => {
    let o = t.sources?.[s] || {}, r = n?.sources?.[s] || {};
    return `<div class="source-row"><strong>${T(i)}</strong>${s === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>Data time: ${be(o.dataT)} \xB7 ${T(t.timeUncertain ? "age unknown" : ie(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${be(r.lastSuccessAt ?? o.lastSuccessAt)}.${r.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot collection began ${be(e.createdAt)}. This collection time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}

// site/js/watch-crest-settings.js
var dt = Object.freeze({ releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1, floorCfs: 1, fraction: 62e-4, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), Dt = Object.freeze({ mode: "A", heading: "Observed high \u2014 crest not confirmed", automaticDirectionLabelsEnabled: !1, rejectedDesignSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), Na = Object.freeze({ mode: "B", trendMedianPoints: 5, trendWindowMinutes: 60, comparisonMinutes: 60, nativeIntervalMinutes: 15, persistencePoints: 5, floorCfs: 1, fraction: 62e-4, designSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), xn = Object.freeze({ floorCfs: 1, fraction: 62e-4, minimumHoursBelowHigh: 6, minimumPeakAgeHours: 12, firstConfirmationDeadlineHours: 18, minimumHistoryBeforePeakHours: 12, minimumDropFraction: 0.05, minimumDropCfs: 2, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), xs = Object.freeze({
  schemaVersion: 3,
  releaseMode: "observed-facts-only",
  automaticConfirmationEnabled: !1,
  automaticConfirmationVerdict: "FAIL",
  calibrationPurpose: "descriptive-trend-noise-only",
  floorCfs: 1,
  fraction: 62e-4,
  returningWobbles: 138,
  calibrationPassed: !0,
  calibrationStart: "2025-11-01T07:00:00Z",
  calibrationEndExclusive: "2026-01-01T08:00:00Z",
  sourceSha256: "9d779634658a99bdea6e8defe92603b716c52d728b61efdc64b37ec53732f372",
  contractSha256: "ed7ded05aabe88e5e3528ae573f21888ab3bd38ab8de734856420686b1660fa5"
}), ht = (e, t = dt) => Math.max(t.floorCfs, e * t.fraction);

// site/js/watch-preview.js
var G = 36e5, Bt = 15 * 6e4, J = Number.isFinite;
function oe(e, t) {
  let n = (r) => {
    let [c, u = "0"] = String(r).toLowerCase().split("e"), l = c.includes(".") ? c.length - c.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(c.replace(".", "")), exponent: Number(u) - l };
  }, a = n(e), s = n(t), i = Math.min(a.exponent, s.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - s.coefficient * 10n ** BigInt(s.exponent - i)}e${i}`;
}
var B = (e) => `<time datetime="${new Date(e).toISOString()}">${T(Q(e, !0))}</time>`, jt = (e) => {
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = t % 60;
  return n ? a ? `${n}h ${a}m` : `${n} ${n === 1 ? "hour" : "hours"}` : `${a} ${a === 1 ? "minute" : "minutes"}`;
}, Ue = (e, t) => {
  document.getElementById(e).innerHTML = t;
}, An = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}">\u24D8</button>`, kn = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, Ra = `This page does not make a crest call. It shows the observed high and time since it, plus a separate official forecast scenario outlook; growers and sampling staff judge whether the river has crested. Automatic crest confirmation is withheld because the tested rules failed real-storm replay. This page shows the actual observed high, its reading time and age, the drop since that high, and a separate clock for time without a material renewed rise. That clock uses the middle value of five actual 15-minute readings spanning the preceding hour; the displayed high and its time remain actual readings. A rebound in this smoothed trend exceeding the larger of ${dt.floorCfs} cfs or ${+(dt.fraction * 100).toFixed(2)}% of the actual high resets the clock to the last increasing trend reading in that upswing. Flat readings and smaller flickers are allowed: this does not mean continuous falling. This allowance was measured from returning fluctuations in November\u2013December 2025 readings, not chosen as a closure or sampling rule. Missing quarter-hours or ineligible readings break the trend clock, with no interpolation.`;
function Oa(e, t) {
  let n = t.trendMedianPoints, a = t.trendWindowMinutes * 6e4;
  if (n !== 5 || a !== G) throw new Error("Unsupported crest trend window");
  return e.map((s, i) => {
    let o = e.slice(Math.max(0, i - n + 1), i + 1), r = o.length === n && o.every((c, u) => c.eligible === !0 && c.usable === !0 && J(c.cfs) && c.t === s.t - a + u * Bt);
    return { t: s.t, cfs: r ? o.map((c) => c.cfs).sort((c, u) => c - u)[2] : null, eligible: r, usable: r };
  });
}
function Mn(e, t, n) {
  let a = null, s = null, i = t.t, o = !1, r = ht(t.cfs, n);
  for (let c of Oa(e, n))
    if (!(c.t < t.t)) {
      if (!c.eligible) {
        a = null, s = null, o = !1, i = c.t;
        continue;
      }
      if (!a) {
        a = c, i = Math.max(i, c.t), o = !0;
        continue;
      }
      s ? c.cfs > s.cfs ? (i = c.t, s = c) : s.cfs - c.cfs > r && (s = null, a = c) : (c.cfs < a.cfs && (a = c), c.cfs - a.cfs > r && (i = c.t, s = c));
    }
  return { lastResetT: i, supported: o };
}
function Ia(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  return { ...Cn(e, { checking: t, suppressed: n, settings: dt }, !1, !0), mode: "observed-facts-only", releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1 };
}
function Ha(e, t = {}) {
  let n = Ia(e, t);
  return { ...n, state: n.state === "checking" || n.state === "unavailable" ? n.state : "observed_high", label: Dt.heading, labelCategory: "neutral", labelMode: "removed" };
}
function Cn(e, { checking: t = !1, suppressed: n = !1, settings: a = xn } = {}, s, i = !1) {
  let o = e.gauge || {}, r = o.latest, c = (M) => ({ state: t ? "checking" : "unavailable", label: t ? "Checking river readings\u2026" : "Crest status unavailable", why: M, peak: null, high: null, fallMs: null });
  if (t) return c("Verification is in progress.");
  if (n || e.timeUncertain) return c("A current snapshot and current time must be verified first.");
  if (!r || !J(r.cfs) || r.usable !== !0 || r.eligible !== !0) return c("The newest gauge reading is missing or its quality does not support a crest check.");
  if (o.ageMs > G || e.sources?.gauge?.error) return c("The newest eligible reading must be no more than one hour old, with a successful latest retrieval.");
  let u = o.points.filter((M) => M.t >= r.t - 48 * G && M.t <= r.t), l = [], d = null;
  for (let M of u) M.eligible === !0 && M.usable === !0 && J(M.cfs) && (!d || M.cfs >= d.cfs) && (d = M);
  for (let M = u.length - 1; M >= 0; M--) {
    let x = u[M];
    if (x.eligible !== !0 || x.usable !== !0 || !J(x.cfs) || l.length && l[0].t - x.t > 2 * Bt) break;
    l.unshift(x);
  }
  if (l.length < 5 || r.t - l[0].t < G)
    return i && d ? { state: "possible", label: "Crest not confirmed \u2014 short reading history", high: d, peak: d, candidateHigh: null, drop: oe(d.cfs, r.cfs), highDropCfs: oe(d.cfs, r.cfs), sincePeakMs: r.t - d.t, sinceHighMs: r.t - d.t, fallMs: null, trendSupported: !1, evidenceStartT: l[0]?.t ?? r.t, hadGap: l[0]?.t > u[0]?.t, bracketed: !1 } : c("At least an hour of uninterrupted eligible observations is needed.");
  let f = l[0], p = f, h = f, m = f.t, $ = null, v = !1, g = !1, b = f, S = null;
  for (let M = 1; M < l.length; M++) {
    let x = l[M], he = ht(f.cfs, a), We = Math.max(a.episodeTurnCfs ?? 2, f.cfs * (a.episodeTurnFraction ?? 0.05));
    if (x.cfs >= f.cfs) {
      x.cfs - p.cfs > he && f.cfs - p.cfs > he && (g = !0), v || (v = oe(x.cfs, h.cfs) > Math.max(a.capturedRiseCfs, x.cfs * a.capturedRiseFraction)), f = x, p = x, m = x.t, b = x, S = null;
      continue;
    }
    x.cfs < p.cfs && (p = x);
    let Ge = x.cfs - p.cfs;
    S ? x.cfs > S.cfs ? (m = x.t, S = x) : S.cfs - x.cfs > he && (S = null, b = x) : (x.cfs < b.cfs && (b = x), x.cfs - b.cfs > he && (m = x.t, S = x, g = !0)), f.cfs - p.cfs >= We && Ge >= We && ($ = f, h = p, f = x, p = x, v = !0, m = x.t, b = x, S = null);
  }
  let k = a.trendMedianPoints ? Mn(l, f, a) : { lastResetT: m, supported: !0 }, y = ht(f.cfs, a), A = f.cfs - r.cfs, W = r.t - Math.max(f.t, k.lastResetT), q = r.t - f.t, V = l[0].t, Ae = V > u[0].t, je = l.reduce((M, x) => Math.abs(x.t - (r.t - G)) < Math.abs(M.t - (r.t - G)) ? x : M, l[0]), vt = l.reduce((M, x) => Math.abs(x.t - (r.t - 2 * G)) < Math.abs(M.t - (r.t - 2 * G)) ? x : M, l[0]), ke = oe(r.cfs, vt.cfs) > 0, wt = l.filter((M) => M.t >= r.t - 6 * G).reduce((M, x) => Math.min(M, x.cfs), r.cfs), qe = oe(r.cfs, je.cfs) > y || A <= y && r.t - f.t < G && oe(r.cfs, wt) > y && ke, P = a.minimumHistoryBeforePeakHours ?? 0, me = f.t - V, lt = me >= P * G, ct = P > 0 && !lt && q > (48 - P) * G, St = lt ? null : ct ? `The 48-hour window no longer includes ${P} hours before this high. Its time and flow remain shown; the earlier crest check has expired.` : `At least ${P} hours of uninterrupted eligible readings before this high are needed to establish a crest.`, ut = oe(r.cfs, p.cfs) <= y, we = { high: d, earlierPeak: $, peak: f, fallMs: i && !k.supported ? null : W, sincePeakMs: q, sinceHighMs: r.t - d.t, highDropCfs: oe(d.cfs, r.cfs), drop: A, bracketed: v, evidenceStartT: V, hadGap: Ae, trendSupported: k.supported, peakContextMs: me, contextExpired: ct, contextWhy: St, nearPostPeakLow: ut }, de = oe(r.cfs, p.cfs) > y && ke;
  if (i) {
    let M = Mn(l, d, a), x = { ...we, peak: d, candidateHigh: f, drop: oe(d.cfs, r.cfs), sincePeakMs: r.t - d.t, fallMs: M.supported ? r.t - Math.max(d.t, M.lastResetT) : null, trendSupported: M.supported, contextExpired: !1, contextWhy: null }, he = r.cfs - p.cfs > y && (qe || de), We = A <= y && qe, Ge = he ? "rising_again" : A <= y ? We ? $ || g ? "rising_again" : "rising" : "level" : ut && oe(r.cfs, je.cfs) < 0 && !ke ? "falling_unconfirmed" : "possible";
    return { ...x, state: Ge, label: { rising: "Rising \u2014 crest not confirmed", rising_again: "Rising again \u2014 crest not confirmed", level: "Little change \u2014 crest not confirmed", falling_unconfirmed: "Falling \u2014 crest not confirmed", possible: "Possible crest \u2014 not confirmed" }[Ge] };
  }
  if (r.cfs - p.cfs > y && (qe || de)) return { ...we, state: "rising_again", label: "Rising again \u2014 crest not confirmed", peak: null };
  if (A <= y) {
    let M = qe;
    return { ...we, state: M ? $ || g ? "rising_again" : "rising" : "level", label: M ? $ || g ? "Rising again \u2014 crest not confirmed" : "Rising \u2014 crest not confirmed" : "Little change \u2014 crest not confirmed", peak: null, fallMs: 0 };
  }
  if (!v || !lt) return { ...we, bracketed: !1, state: "falling_unbracketed", label: ct ? "Falling \u2014 earlier crest check expired" : "Falling \u2014 crest not established" };
  let _t = (a.minimumPeakAgeHours ?? 0) * G, Ce = (a.firstConfirmationDeadlineHours ?? 1 / 0) * G, Se = !(oe(r.cfs, je.cfs) > 0) && ut && k.supported && q >= _t && W >= a.minimumHoursBelowHigh * G && A >= Math.max(a.minimumDropCfs, f.cfs * a.minimumDropFraction), Ee = null;
  if (Se && q > Ce && (Se = !1, s))
    for (let M of l) {
      if (M.t < f.t + _t || M.t > f.t + Ce) continue;
      let x = Cn({ ...e, gauge: { ...o, points: u.filter((he) => he.t <= M.t), latest: M, ageMs: 0 } }, { settings: a }, !1);
      if (x.state === "confirmed" && x.peak.t === f.t) {
        Se = !0, Ee = M.t;
        break;
      }
    }
  return { ...we, evidenceEarnedT: Ee, state: Se ? "confirmed" : "possible", label: Se ? "Observed crest so far" : "Possible crest \u2014 not confirmed" };
}
function Pa(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  if (t) {
    Ue("current", '<div class="flow-row"><h2>24-hour rise</h2><p class="checking-readings" role="status">Checking river readings\u2026</p><p class="meta">Verifying the latest snapshot and reading ages.</p></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>'), document.getElementById("current").setAttribute("aria-busy", "true"), Ue("number-strip", "<span>Checking river readings\u2026</span>");
    return;
  }
  let a = e.gauge, s = a.endpoint, i = a.latest, o = s.available, r = o && s.elapsedMs === 24 * G, c = o ? K(s.changeCfs, !0) : "Unavailable", u = o ? s.changeCfs < 0 ? "No net 24-hour rise" : s.distanceCfs === 0 ? `At the ${K(s.referenceCfs)} cfs rise trigger` : `${Math.abs(s.distanceCfs) < 0.5 ? "Less than 1" : K(Math.abs(s.distanceCfs))} cfs ${s.distanceCfs > 0 ? "below" : "above"} the ${K(s.referenceCfs)} cfs rise trigger` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", l = e.timeUncertain ? "age unknown" : `${ie(a.ageMs)} old${a.stale ? " \xB7 STALE" : ""}`, d = J(i?.cfs) ? `${K(i.cfs)} cfs` : "unavailable", f = n || a.stale || e.timeUncertain, p = o ? `${c} cfs ${f ? "over the 24 hours to this reading" : r ? "in the last 24 hours" : "over about 24 hours"}` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", h = o && s.changeCfs < 0 ? " (a fall; no net rise)" : "", m = a.history?.endpoint?.last, $ = o && s.distanceCfs > 0 && m ? `<p class="meta rise-history-note">Rise reference last met ${B(m.current?.t ?? m.windowEndT)}. Closure status is decided by health authorities.</p>` : "";
  Ue("current", `<div class="flow-row"><div class="section-heading flow-heading"><h2>24-hour rise</h2>${An("flow", "About flow readings")}</div><div class="rise-headline"><strong class="distance-headline">${T(p + h)}</strong><b class="rise-support">${T(u)}</b></div>${$}<div class="preview-flow"><strong class="actual-flow flow-number">Actual flow: ${T(d)} \xB7 ${T(l)}</strong>${i ? B(i.t) : ""}</div></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>${kn("flow", "How flow comparisons work", `<p>Flow is water passing the gauge, in cubic feet per second (cfs). A rise of 400 cfs means an increase of 400, not a river flow of 400.</p><p>The 24-hour rise compares the newest actual reading with the actual reading nearest 24 elapsed hours earlier, within 15 minutes. ${o ? `Comparison: ${K(s.comparison.cfs)} cfs at ${B(s.comparison.t)}; ${ie(s.elapsedMs)} earlier.` : ""} It is not a calendar day. Missing data are not filled.</p><p>Rise trigger shown: 400 cfs November\u2013February, 200 March\u2013April, 100 May\u2013October. Confirm these seasons with the health department.</p><p>Rise from the 24-hour low is ${a.low.available ? K(a.low.changeCfs, !0) + " cfs" : "unavailable"}. It differs from comparing with the reading 24 hours earlier.</p><p>Gauge quality: ${T(i?.qualityLabel || "unknown")}. Provisional readings are not yet finalized and may be revised.</p>`)}`), document.getElementById("current").setAttribute("aria-busy", String(t)), Ue("number-strip", `<span>Flow (cfs) <strong>${J(i?.cfs) ? K(i.cfs) : "\u2014"}</strong><small>${T(l)}</small></span><span>24h change <strong>${o ? c : "\u2014"}</strong></span><span>Low rise <strong>${a.low.available ? K(a.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function Ua(e, t) {
  let n = e.peak ?? e.high, a = e.peak ? e.sincePeakMs : e.sinceHighMs, s = n ? `Observed high: <strong>${K(n.cfs)} cfs</strong> \xB7 ${B(n.t)}<br>${T(jt(a))} before latest reading${e.peak ? `; now ${K(e.drop)} cfs lower` : ""}.` : T(e.why || ""), i = e.peak && e.drop > ht(e.peak.cfs) ? `<p class="crest-fact">${e.trendSupported && J(e.fallMs) ? `<strong>No new rise for ${T(jt(e.fallMs))}</strong> <span class="clock-qualifier">\xB7 small fluctuations ignored</span>.` : "Renewed-rise clock unavailable: a complete hour of eligible readings is needed."}</p>` : "", o = e.peak && e.high?.cfs > e.peak.cfs ? `<p class="crest-fact">Earlier higher reading: ${K(e.high.cfs)} cfs \xB7 ${B(e.high.t)} (${T(jt(e.sinceHighMs))} before latest reading).</p>` : "", r = e.hadGap ? `<p class="crest-fact">Continuous evidence starts ${B(e.evidenceStartT)} after a gap or unusable reading.</p>` : "";
  Ue("monitor", `<div class="crest-top"><h2 data-crest-state="${e.state}" data-crest-mode="observed-facts-only">${T(e.label)}</h2>${An("crest", "About observed highs and the renewed-rise clock")}</div><p class="crest-fact">${s}</p>${i}${o}${r}${t?.available ? `<p class="crest-fact"><strong>Forecast outlook:</strong> ${t.peakStartT ? `${B(t.peakStartT)} to ${B(t.peakEndT)} across scenarios with a peak in the next ten days.` : "No bounded peak time across the next ten days."} See the crest outlook below.</p>` : ""}<p class="crest-fact crest-guidance">Growers and sampling staff make the crest call.</p>${kn("crest", "Observed highs and the renewed-rise clock", `<p>${Ra}</p><p>The observed high is the highest eligible actual reading in the available 48 hours, using the latest time when equal highs repeat. Gaps may exist. ${Dt.mode === "B" ? "Direction labels compare the middle of five native readings spanning the past hour with the same middle value one hour earlier. A change larger than both 1 cfs and 0.62% of the larger comparison value is Rising or Falling; otherwise it is Little change. Every new direction must persist across five consecutive quarter-hour comparisons (60 elapsed minutes) before the label changes. Missing support clears the direction to the neutral observed-high heading. The calculation restarts from the available 48-hour history on every load; no browser memory or future readings are used." : "Direction labels are withheld. The observed high and the separate renewed-rise clock remain available as measured facts."} These describe the available readings, not a final crest decision.</p><p>The two clocks end at the newest gauge reading: the high's age is elapsed time since that actual reading; the renewed-rise clock starts at that high or its last material increasing trend reading. A missing quarter-hour breaks trend support; a gap over 30 minutes or unusable reading restarts the contiguous evidence window. Its first complete trend hour restarts the clock, so missing time is never counted. Reading age and quality can withhold all status. Older highs do not acquire an automatic confirmation or an expiry verdict.</p><p>A crest concerns actual river flow topping out, not the peak of the 24-hour rise. A closure can already be in place while the river rises. Around 12 hours of falling is a staff planning judgment, not a fixed closure or sampling rule. The clocks do not mean continuous falling or establish that a storm has ended.</p>`)}`);
}
function qt(e, t) {
  for (let n of e || [])
    if (!(!n.length || t < n[0].t || t > n[n.length - 1].t))
      for (let a = 0; a < n.length; a++) {
        if (n[a].t === t) return n[a].cfs;
        if (a && n[a].t > t) {
          let s = n[a - 1], i = n[a];
          return s.cfs + (i.cfs - s.cfs) * (t - s.t) / (i.t - s.t);
        }
      }
  return null;
}
function Fa(e, t, n) {
  for (let a of e || []) {
    if (!a.length || a[0].t > t || a[a.length - 1].t < n) continue;
    let s = qt([a], t), i = qt([a], n);
    if (!J(s) || !J(i)) continue;
    let o = Math.min(s, i);
    for (let r of a) r.t > t && r.t < n && (o = Math.min(o, r.cfs));
    return o;
  }
  return null;
}
function Da(e) {
  let t = e.gauge?.segments || [], n = e.forecast?.shifted?.segments || [], a = e.gauge?.latest, s = t.find((o) => o[o.length - 1]?.t === a?.t), i = n.find((o) => o[0]?.t === a?.t);
  return !s || !i || s[s.length - 1].cfs !== i[0].cfs ? [] : [[...s, ...i.slice(1)]];
}
function Sn(e) {
  let t = e.forecast || {}, n = Math.max(e.nowMs, e.gauge?.latest?.t ?? e.nowMs), a = t.raw?.endT, s = e.gauge?.latest?.t;
  if (!t.available || !J(a) || e.timeUncertain) return { available: !1, through: a, peaks: [], maxRatio: null, complete: !1 };
  let i = t.raw.segments, o = Da(e), r = J(s) ? s + 24 * G : n, c = /* @__PURE__ */ new Set([n, a, r]);
  for (let v = Y(n).year; v <= Y(a).year; v++) for (let g of [3, 5, 11]) {
    let b = Ve(v, g, 1);
    b >= n && b <= a && (c.add(b), c.add(b - 1));
  }
  for (let v of [...i, ...o]) for (let g of v)
    g.t >= n && g.t <= a && c.add(g.t), g.t + 24 * G >= n && g.t + 24 * G <= a && c.add(g.t + 24 * G);
  for (let v = n; v <= a; v += Bt) c.add(v);
  let u = -1 / 0, l = null, d = null, f = !0, p = [];
  for (let v of [...c].filter((g) => g >= n && g <= a).sort((g, b) => g - b)) {
    let g = v <= r ? o : i, b = qt(g, v), S = Fa(g, v - 24 * G, v);
    if (!J(b) || !J(S)) {
      f = !1;
      continue;
    }
    let k = oe(b, S), y = k / _e(v);
    p.push({ t: v, rise: k, ratio: y }), y > u && (u = y), (l === null || k > l) && (l = k, d = v);
  }
  let h = (t.crests || []).filter((v) => v.endT > n && p.some((g) => g.t >= Math.max(n, v.precedingLow?.t ?? n) && g.t <= v.endT && g.ratio >= 0.5)), m = i?.[i.length - 1], $ = m?.length > 1 && m[m.length - 1].cfs > m[m.length - 2].cfs;
  return { available: p.length > 0, complete: f, through: a, maxRatio: J(u) ? u : null, maxRise: l, maxT: d, peaks: h, risingTail: $ };
}
function ja(e, t, n = Sn(e)) {
  let a = e.forecast || {}, s = e.outlook || {}, i = t.peak ?? t.high, r = (a.crests || []).filter((h) => h.endT > e.nowMs).sort((h, m) => h.startT - m.startT)[0], c = J(a.raw?.endT) ? B(a.raw.endT) : "unavailable", u = !a.available || e.timeUncertain ? "<p>Official forecast timing unavailable.</p>" : r ? `<p><strong>Next peak in the official forecast:</strong> ${B(r.startT)}${r.endT !== r.startT ? ` to ${B(r.endT)}` : ""} \xB7 ${K(r.cfs)} cubic feet per second.</p><p class="meta">Surrounding forecast readings: ${B(r.bracketStartT)} to ${B(r.bracketEndT)}. These show the forecast\u2019s time spacing; they are not a guarantee of the actual crest time.</p>` : `<p>No rising-then-falling peak is resolved in the official forecast through ${c}.${n.risingTail ? " The river forecast is still rising at its end." : ""}</p>`, l = J(n.through) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(n.through) : "the available forecast", d = n.available ? n.maxRatio < 0.5 ? `${n.complete ? "NOAA-based forecast shows no rise near the trigger" : "Where readings are available, the NOAA-based forecast shows no rise near the trigger"} through ${l}.` : n.peaks.length ? "" : "The comparison using measured flow and forecasts reaches at least half the seasonal rise trigger; no supported future peak time is identified." : "There are not enough readings to check the forecast rise.", f = `${d ? `<p>${T(d)}</p>` : ""}${n.available ? `<p class="meta">Largest supported rise from the 24-hour low (measured + forecast comparison): ${et(n.maxRise, !0)} cubic feet per second \xB7 ${B(n.maxT)}. Near the trigger means at least half the seasonal rise trigger.</p>` : ""}${n.risingTail ? `<p class="meta">Forecast still rising at its last point (${B(n.through)}); no final crest time is established.</p>` : ""}${!n.complete && n.available ? '<p class="meta">Some forecast comparisons are unsupported; a missing comparison does not mean no rise.</p>' : ""}`, p = "<p>Forecast scenario range unavailable.</p>";
  e.timeUncertain || e.conditionsSuppressed ? p = "<p>Forecast scenario range unavailable until the current snapshot and time are verified.</p>" : s.available ? (p = `<p class="meta">${s.memberCount} complete official forecast scenarios \xB7 next ten days, through ${B(s.endT)}.</p>`, p += s.resolvedCount ? `<p class="outlook-range">Peak-time range: ${B(s.peakStartT)} to ${B(s.peakEndT)}</p><p>${s.resolvedCount} of ${s.memberCount} scenarios have their highest upcoming flow rise and fall within this window.</p>` : '<p class="outlook-range">No bounded peak-time range within the next ten days.</p>', s.openEndCount && (p += `<p><strong>${s.openEndCount} of ${s.memberCount} scenarios still have their high at the forecast window\u2019s end.</strong> Their crest may be later; they are outside the bounded range above.</p>`), s.noPeakCount && (p += `<p>${s.noPeakCount} of ${s.memberCount} scenarios have no distinct highest upcoming peak with lower readings on both sides.</p>`), s.higherCount !== null && s.comparisonHigh ? p += `<p><strong>Another higher flow:</strong> ${s.higherCount} of ${s.memberCount} scenarios exceed the 48-hour observed high of ${K(s.comparisonHigh.cfs)} cubic feet per second (${B(s.comparisonHigh.t)}) within ten days.</p>` : p += "<p>Comparison with the observed high is unavailable: a recent eligible river reading is needed.</p>", s.excludedCount && (p += `<p>${s.excludedCount} incomplete scenarios are excluded from these counts.</p>`), p += `<p class="meta">Forecast issued ${B(s.issuedT)} \xB7 ${T(ie(e.nowMs - s.issuedT))} old. Scenario values are six hours apart.</p>`) : s.reason && (p = `<p>${T(s.reason)}.</p>`), Ue("peaks", `<div class="section-top"><h2>Crest outlook</h2></div><p><strong>Has the river finished cresting?</strong> ${i ? `The observed high is ${K(i.cfs)} cubic feet per second at ${B(i.t)}.` : "A supported observed high is unavailable."} A later higher crest remains possible; this page does not confirm the final storm crest.</p><div class="outlook-summary"><h3>Range across forecast scenarios</h3>${p}<p class="meta">These are alternative model scenarios, not measured odds or a confidence interval. The range summarizes the highest upcoming flow within ten days, not necessarily the current storm. It can span different future storms.</p></div><h3>Official river forecast</h3><p class="meta">National Oceanic and Atmospheric Administration (NOAA), National Weather Service. ${J(a.issuedT) ? `Issued ${B(a.issuedT)}.` : ""}</p><p class="forecast-through">Available through ${c}.</p>${u}${f}<details><summary>How the crest outlook works</summary><p>The Hydrologic Ensemble Forecast Service supplies alternative river-flow scenarios. Each complete scenario is examined over the next ten days. A bounded peak needs lower forecast values before and after its highest upcoming value. A high at the end remains open; a declining or flat path does not establish a new peak. Missing or conflicting values exclude that scenario. Forecasts more than 48 hours old are withheld.</p><p>The range covers only scenarios with a bounded peak. Counts are not calibrated probabilities. A future peak can belong to a different storm. Neither these forecasts nor the observed drop proves that the final crest has passed. Health authorities and sampling staff make operational decisions.</p><a href="https://api.water.noaa.gov/about/api" target="_blank" rel="noopener noreferrer">Official ensemble forecast description \u2197</a></details>`);
}
function En(e, t, n, a, s, i = {}) {
  Pa(t, i);
  let o = { ...t, conditionsSuppressed: !!(i.suppressed || i.checking) }, r = Ha(t, i), c = Sn(t);
  Ua(r, t.timeUncertain || o.conditionsSuppressed ? null : t.outlook), _n(t, a), yn(o);
  let u = document.getElementById("rain");
  u.innerHTML = u.innerHTML.replaceAll("<strong>Unavailable</strong>", '<strong class="unavailable">Unavailable</strong>');
  let l = u.querySelector?.(".station-links"), d = u.querySelector?.(".rain-total-grid");
  l && d && d.insertAdjacentElement("afterend", l), ja(o, r, c), $n(t), Tn(e, t, n);
  let f = document.getElementById("forecast-details");
  f.innerHTML = f.innerHTML.replace("The adjusted forecast first reaches", "Within its first 72 hours, the adjusted forecast first reaches").replace("The adjusted forecast already meets", "Within its first 72 hours, the adjusted forecast already meets").replace("earlier measurements or the adjusted forecast", "earlier measurements or forecast values").replace("Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.", "After 72 hours, the moving rise reference uses only the unchanged official forecast. Adjusted forecasts and past cases still stop at 72 hours; a gap marks any change of basis.").replace("Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.", "The observed high is listed first. The next official forecast peak is shown alongside a separate range across official forecast scenarios.");
  let p = document.getElementById("sources");
  p.innerHTML = p.innerHTML.replace("Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.", "Estimated or otherwise unsupported readings cannot confirm an observed crest."), Ue("snapshot-label", `Saved snapshot ${T(e.id)} \xB7 ${T(Q(e.createdAt))}`);
}

// site/js/watch-preview-reference.js
var Ln = 36e5, fe = 24 * Ln, qa = 6 * Ln, le = Number.isFinite, Wt = (e) => le(e) && Math.abs(e) <= 864e13;
function Ba(e) {
  if (e?.available === !1) return [];
  let t = [];
  for (let n of e?.segments || []) {
    if (!Array.isArray(n) || n.some((i, o) => o && i?.t <= n[o - 1]?.t)) continue;
    let a = [], s = () => {
      a.length && t.push(a), a = [];
    };
    for (let i of n) {
      if (!Wt(i?.t) || !le(i?.cfs) || i.cfs < 0 || le(e?.endT) && i.t > e.endT) {
        s();
        continue;
      }
      a.length && i.t - a.at(-1).t > qa && s(), a.push({ t: i.t, cfs: i.cfs });
    }
    s();
  }
  return t;
}
function Fe(e, t) {
  if (!e.length || t < e[0].t || t > e.at(-1).t) return null;
  for (let n = 0; n < e.length; n++) {
    let a = e[n];
    if (t === a.t) return a.cfs;
    if (t < a.t) {
      let s = e[n - 1], i = (t - s.t) / (a.t - s.t), o = (1 - i) * s.cfs + i * a.cfs;
      return le(o) ? o : null;
    }
  }
  return null;
}
function Wa(e, t) {
  let n = [];
  for (let a = Y(e).year; a <= Y(t).year; a++) for (let s of [3, 5, 11]) {
    let i = Ve(a, s, 1);
    i > e && i <= t && n.push(i);
  }
  return n.sort((a, s) => a - s);
}
function Ga(e, t) {
  let n = Fe(e, t - fe), a = Fe(e, t);
  if (n === null || a === null) return null;
  let s = Math.min(n, a);
  for (let i of e) i.t > t - fe && i.t < t && (s = Math.min(s, i.cfs));
  return s;
}
function Va(e, t, n) {
  let a = /* @__PURE__ */ new Set([t, n]);
  for (let i of e) for (let o of [i.t, i.t + fe]) o > t && o < n && a.add(o);
  let s = [...a].sort((i, o) => i - o);
  for (let i = 1; i < s.length; i++) {
    let o = s[i - 1], r = s[i], c = (o + r) / 2, u = e.filter((d) => d.t > c - fe && d.t < c).reduce((d, f) => Math.min(d, f.cfs), 1 / 0), l = [
      [Fe(e, o - fe), Fe(e, r - fe)],
      [Fe(e, o), Fe(e, r)],
      ...le(u) ? [[u, u]] : []
    ];
    for (let d = 0; d < l.length; d++) for (let f = d + 1; f < l.length; f++) {
      let p = l[d][0] - l[f][0], h = l[d][1] - l[f][1];
      if (!le(p) || !le(h) || p === h) continue;
      let m = Math.max(Math.abs(p), Math.abs(h)), $ = p / m / (p / m - h / m);
      $ > 0 && $ < 1 && a.add(o + $ * (r - o));
    }
  }
  return [...a].sort((i, o) => i - o);
}
function za(e, t, n, a) {
  let s = (u, l) => {
    let d = a(u);
    return le(d) && le(d + l) ? d + l : null;
  };
  if (e === t) {
    let u = s(e, _e(e));
    return { segments: le(u) ? [[{ t: e, cfs: u }]] : [], steps: [] };
  }
  let i = Wa(e, t), o = [e, ...i, ...i.at(-1) === t ? [] : [t]], r = [], c = [];
  for (let u = 1; u < o.length; u++) {
    let l = o[u - 1], d = o[u], f = _e(l), h = [l, ...n.filter((m) => m > l && m < d), d].map((m) => ({ t: m, cfs: s(m, f) }));
    if (h.every((m) => le(m.cfs)) && r.push(h), i.includes(d)) {
      let m = s(d, f), $ = s(d, _e(d));
      le(m) && le($) && (c.push({ t: d, beforeCfs: m, afterCfs: $ }), d === t && r.push([{ t: d, cfs: $ }]));
    }
  }
  return { segments: r, steps: c };
}
function Nn(e, t, n = "endpoint") {
  let a = { available: !1, basis: "official_forecast", segments: [], steps: [], startT: null, endT: null };
  if (!Wt(t) || !Wt(e?.endT) || e.endT <= t || !["endpoint", "low"].includes(n)) return a;
  let s = Ba(e), i = [], o = [], r = t + 1, c = (l, d, f, p) => {
    if (l > d) return;
    let h = za(l, d, f, p);
    i.push(...h.segments), o.push(...h.steps);
  };
  if (n === "endpoint")
    for (let l of s) for (let d of s) {
      let f = Math.max(r, l[0].t, d[0].t + fe), p = Math.min(e.endT, l.at(-1).t, d.at(-1).t + fe);
      c(f, p, d.map((h) => h.t + fe), (h) => Fe(d, h - fe));
    }
  else
    for (let l of s) {
      let d = Math.max(r, l[0].t + fe), f = Math.min(e.endT, l.at(-1).t);
      d <= f && c(d, f, Va(l, d, f), (p) => Ga(l, p));
    }
  i.sort((l, d) => l[0].t - d[0].t);
  let u = i.flat();
  return u.length ? {
    available: !0,
    basis: "official_forecast",
    segments: i,
    steps: o,
    startT: Math.min(...u.map((l) => l.t)),
    endT: Math.max(...u.map((l) => l.t))
  } : a;
}

// site/js/watch-chart.js
var F = Number.isFinite, D = null, Xa = (e, t, n) => F(e?.t) && F(e?.cfs) && e.t >= t && e.t <= n;
function Mt(e, t, n) {
  for (let a of e || []) {
    let s = mn(a, (i) => i.t === t);
    if (s) return s.cfs;
    for (let i = 1; i < a.length; i++) {
      let o = a[i], r = a[i - 1];
      if (r.t < t && o.t > t)
        return o.t - r.t > n ? null : r.cfs + (o.cfs - r.cfs) * (t - r.t) / (o.t - r.t);
    }
  }
  return null;
}
function On(e, t, n, a) {
  let s = e.filter((i) => Xa(i, t, n));
  for (let i of [t, n])
    if (!s.some((o) => o.t === i)) {
      let o = Mt([e], i, a);
      F(o) && s.push({ t: i, cfs: o });
    }
  return s.sort((i, o) => i.t - o.t);
}
function Za(e, t, n) {
  return e.map((a, s) => `${s ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function Rn(e, t, n) {
  return (e?.segments || []).map((a) => {
    let s = On(a, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !a.length || i.t < a[0].t || i.t > a.at(-1).t) continue;
      let o = s.findIndex((c) => c.t >= i.t), r = o < 0 ? s.length : o;
      for (; s[r]?.t === i.t; ) s.splice(r, 1);
      s.splice(r, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return s;
  });
}
var Ja = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function Gt(e) {
  let t = Object.fromEntries(Ja.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function Ya(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - Gt(t);
  return t;
}
function Qa(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), s = Gt(e), i = Gt(t), o = [];
  for (let r of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let c = Math.min(r, 12) * 36e5, u = [];
    for (let d = Math.ceil(s / c) * c; d <= i + 36e5; d += r * 36e5) {
      let f = Ya(d);
      f >= e && f <= t && u.push(f);
    }
    if (u.length < 2) continue;
    o = u;
    let l = Math.min(...u.slice(1).map((d, f) => (d - u[f]) / (t - e) * n));
    if (u.length <= a && l >= 40) return u;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function In(e, t, n, { previewReferenceTail: a = !1, officialReferenceTail: s = null } = {}) {
  let i = Math.max(1, Math.floor(e.clientWidth)), o = globalThis.innerHeight, r = i < 500 ? 240 : F(o) && o < 500 ? Math.max(180, Math.min(280, o - 80)) : 280, c = { left: Math.min(49, i / 4), right: Math.min(14, i / 4), top: 26, bottom: 38 }, u = c.left, l = i - c.right, d = c.top, f = r - c.bottom, p = t.gauge?.latest?.t, h = Math.round(t.nowMs), m = document.getElementById("chart-cursor");
  if (t.timeUncertain && !F(p)) {
    let w = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="${w}"><text x="${i / 2}" y="${r / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${i / 2}" y="${r / 2 + 4}" text-anchor="middle">${i < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let N of document.querySelectorAll?.(".legend span") ?? []) N.hidden = !0;
    D = null, m.min = "0", m.max = "1", m.step = "1", m.value = "0", m.disabled = !0, m.style.marginLeft = `${u - 10}px`, m.style.width = `${l - u + 20}px`, m.setAttribute("aria-valuetext", w), document.getElementById("chart-readout").textContent = w;
    return;
  }
  let $ = t.timeUncertain ? p : h, v = $ - Number(n.past || 24) * 36e5, g = n.range === "full" ? Math.max($ + 36e5, t.forecast?.raw?.endT ?? $ + 72 * 36e5) : $ + (n.range === "day" ? 24 : 72) * 36e5, b = t.forecast || {}, S = t.gauge?.references?.[n.reference], k = b.references?.[n.reference], y = { segments: [...S?.segments || [], ...k?.segments || []], steps: [...S?.steps || [], ...k?.steps || []] }, A = a && F(p) ? s : null, W = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: b.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: b.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: b.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: b.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: a ? "Rise-trigger flow" : "24-hour rise reference", segments: Rn(y, v, g), gap: 1 / 0 }, ...A ? [{ key: "reference", name: "Official forecast-based rise-trigger flow", basis: "official-forecast", segments: Rn(A, Math.max(v, p + 72 * 36e5 + 1), g), gap: 1 / 0 }] : []].map((w) => ({ ...w, visible: w.key === "reference" ? w.segments : w.segments.map((N) => On(N, v, g, w.gap)) })), q = W.flatMap((w) => w.visible.flat()).filter((w) => F(w.cfs)), V = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let w of document.querySelectorAll?.(".legend span") ?? []) {
    let N = V[w.querySelector("i")?.className];
    w.hidden = !!N && !W.some((Ne) => Ne.key === N && Ne.visible.some((Rt) => Rt.length));
  }
  let Ae = Math.max(10, ...q.map((w) => w.cfs)) * 1.08, je = Ae / 4, vt = Math.pow(10, Math.floor(Math.log10(je))), ke = je / vt, wt = (ke <= 1 ? 1 : ke <= 2 ? 2 : ke <= 5 ? 5 : 10) * vt, qe = wt * 4, P = (w) => u + (w - v) / (g - v) * (l - u), me = (w) => f - w / qe * (f - d), lt = Array.from({ length: 5 }, (w, N) => wt * N), ct = Qa(v, g, l - u), St = lt.map((w) => `<line class="grid" x1="${u}" x2="${l}" y1="${me(w)}" y2="${me(w)}"/><text x="${u - 7}" y="${me(w) + 4}" text-anchor="end">${T(et(w))}</text>`).join("") + ct.map((w) => {
    let N = P(w), Ne = N < 24 ? "start" : N > i - 24 ? "end" : "middle", Rt = `<tspan x="${N}">${T(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(w))}</tspan><tspan x="${N}" dy="14">${T(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(w))}</tspan>`;
    return `<text class="x-axis-label" x="${N}" y="${r - 24}" text-anchor="${Ne}">${Rt}</text>`;
  }).join(""), ut = W.map((w) => w.visible.filter((N) => N.length).map((N) => N.length === 1 ? `<circle class="${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} cx="${P(N[0].t)}" cy="${me(N[0].cfs)}" r="2" fill="var(--${w.key === "observed" ? "obs" : w.key})"/>` : `<path class="plot-line ${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} d="${Za(N, P, me)}"/>`).join("")).join(""), we = Mt(y.segments, v, 1 / 0) ?? Mt(y.segments, $, 1 / 0), de = F(we) ? me(we) : d + 14;
  de = de - d > 32 ? de - 10 : de + 24, de = Math.max(d + 12, Math.min(f - 6, de));
  let _t = W.find((w) => w.key === "reference")?.visible.flat() || [], Ce = _t.reduce((w, N) => !w || N.t > w.t ? N : w, null), Be = a ? 112 : 84, Se = a ? "Rise-trigger flow" : "24h rise line", Ee = Ce ? Math.max(u + 4, Math.min(l - Be - 4, P(Ce.t) - Be)) : u + 4, M = de, x = Ee + Be, he = F(n.cursorT) && n.cursorT >= v && n.cursorT <= g ? P(n.cursorT) : null, We = F(p) && p >= v && p <= g ? P(p) : null, Ge = Ce && P(Ce.t) - u >= Be, Yt = [he, We].some((w) => F(w) && w >= Ee && w <= x), Yn = l - u < 200 || !Ge || Yt ? "" : `<rect class="reference-label-bg" x="${Ee}" y="${M - 12}" width="${Be}" height="16" rx="3"/><text class="reference-label" x="${Ee + 4}" y="${M}">${Se}</text>`, Qt = t.timeUncertain && l - u < 132, Qn = t.timeUncertain ? Qt ? "Last reading" : "Last saved river reading" : "Latest observed", Kn = t.timeUncertain ? Qt ? 80 : 132 : 90, ea = F(p) && p >= v && p <= g ? `<line x1="${P(p)}" x2="${P(p)}" y1="${d}" y2="${f}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(u, Math.min(l - Kn, P(p) + 5))}" y="${d - 9}">${Qn}</text>` : "", ta = !t.timeUncertain && h >= v && h <= g ? `<line class="now" x1="${P(h)}" x2="${P(h)}" y1="${d}" y2="${f}"/><text x="${Math.min(l - 25, P(h) + 5)}" y="${d + 15}">Now</text>` : "", Le = F(n.cursorT) ? Math.max(v, Math.min(g, n.cursorT)) : null, na = Le !== null ? `<line class="cursor" x1="${P(Le)}" x2="${P(Le)}" y1="${d}" y2="${f}"/>` : "", ce = F(p) ? p + 72 * 36e5 : null, aa = F(b.raw?.endT) && b.raw.endT > ce && (b.raw?.segments || []).some((w) => w.some((N) => F(N.cfs) && N.t > ce)), Et = n.range === "full" && F(ce) && ce > v && g - ce > 6 * 36e5 && aa, Lt = Et ? l - P(ce) : 0, sa = a ? "Beyond this limit the forecast and its 24-hour rise reference use official forecast values only, where supported. Adjusted forecasts and past cases stop at 72 hours. The reference changes basis in a separate path." : "Beyond this limit only supported official forecast points can be shown. Adjustments, past cases and moving references are limited to at most 72 hours.", ra = Et ? `<g class="forecast-horizon"><title>72-hour context limit: ${T(Q(ce, !0))}. ${sa}</title><rect x="${P(ce)}" y="${d}" width="${Lt}" height="${f - d}" fill="currentColor" opacity=".04"/><line x1="${P(ce)}" x2="${P(ce)}" y1="${d}" y2="${f}" stroke="currentColor" stroke-dasharray="3 4" opacity=".55"/>${Lt >= 65 ? `<rect x="${l - 68}" y="${d + 6}" width="67" height="33" rx="3" fill="var(--surface)" opacity=".95"/><text x="${l - 4}" y="${d + 19}" text-anchor="end"><tspan x="${l - 4}">After 72h</tspan><tspan x="${l - 4}" dy="14">Official only</tspan></text>` : ""}</g>` : "", ia = W.some((w) => w.segments.some((N) => N.some((Ne) => F(Ne.t) && F(Ne.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. ${a ? "After the 72-hour limit, any reference shown uses only official forecast values and begins as a separate path. " : ""}Observations and forecast paths from ${T(Q(v, !0))} through ${T(Q(g, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${u}" y="${d}" width="${l - u}" height="${f - d}"/></clipPath></defs>${St}<g clip-path="url(#plot-clip)">${ra}${ut}${na}</g>${Yn}${ea}${ta}${q.length ? "" : `<text x="${(u + l) / 2}" y="${r / 2}" text-anchor="middle">${ia}</text>`}</svg>${Et && Lt < 65 ? `<p class="meta forecast-horizon-caption">${a ? "After 72h: official forecast and its supported 24-hour reference." : "After 72h: official forecast only, where supported."}</p>` : ""}`, D = { lines: W, hasData: q.length > 0, start: v, end: g, left: u, right: l, width: i, host: e, contextLimit: ce, previewReferenceTail: a }, m.min = String(v), m.max = String(g), m.step = "1", m.disabled = !D.hasData, m.style.marginLeft = `${u - 10}px`, m.style.width = `${l - u + 20}px`;
  let Nt = Le ?? Math.max(v, Math.min(g, F(p) ? p : h));
  m.value = String(Math.round(Nt)), m.setAttribute("aria-valuetext", t.timeUncertain ? `${Le === null ? "Last saved river reading" : "Saved chart selection"}: ${Q(Nt)}. Current time is unconfirmed.` : Q(Nt)), Le !== null ? Ka(Le) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function Ka(e) {
  if (!D) return;
  let t = D.lines.map((n) => {
    let a = Mt(n.visible, e, n.gap);
    return F(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${T(Q(e))}</strong><br>${t.map(T).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}${F(D.contextLimit) && e > D.contextLimit ? `<br><span class="meta">${D.previewReferenceTail ? "Beyond 72 hours: official forecast values only. The reference uses those forecast values when supported; adjusted forecasts and past cases stop at 72 hours." : "Beyond 72 hours: official forecast only, where supported. Other comparisons are limited to 72 hours."}</span>` : ""}`;
}
function Hn(e) {
  if (!D?.hasData) return null;
  let t = D.host.getBoundingClientRect(), n = t.width / D.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - D.left) / (D.right - D.left)));
  return Math.round(D.start + a * (D.end - D.start));
}
function Vt() {
  if (!D?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return F(e) ? Math.max(D.start, Math.min(D.end, e)) : null;
}
function Pn(e) {
  let t = Vt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? D.start : e === "End" ? D.end : F(n[e]) ? Math.max(D.start, Math.min(D.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var Un = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var bt = (e, t, n) => In(e, t, n, { previewReferenceTail: !0, officialReferenceTail: Nn(t.forecast.raw, (t.gauge.latest?.t ?? NaN) + 72 * 36e5, n.reference) }), ts = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", qn = new URL("./", import.meta.url), Bn = "samish.public.preview.packet.v1", Wn = "samish.public.preview.preferences.v1", At = 9466848e5, st = 41024448e5, De = 5 * 6e4, Gn = 2 * 1024 * 1024, C = (e) => document.getElementById(e), rt = Number.isFinite;
function it() {
  let e = C("number-strip"), t = C("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", it, { passive: !0 });
window.addEventListener("resize", it);
function Jt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = C(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function Xt(e, t, n = !1) {
  let a = C(e), s = C(`${e}-toggle`);
  if (!(!a || !s) && (a.open = t, Jt(), it(), n)) {
    s.focus({ preventScroll: !0 });
    let i = C("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, r = s.getBoundingClientRect();
    (r.top < o + 8 || r.bottom > innerHeight - 8) && s.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), it();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), Xt(t.dataset.helpTarget, !C(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), Xt(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || C(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), Xt(t.id, !1, !0));
});
Jt();
var Vn = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, zn = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, I = () => {
  throw new Error("invalid_public_packet");
};
function L(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && I(), e;
}
function se(e, t = !1, n = !1, a = !1, s = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !rt(e) || !n && e < 0 || a && !Number.isInteger(e) || e > s) && I();
}
function E(e, t = !1) {
  se(e, t, !1, !0, st), e !== null && e < At && I();
}
function at(e) {
  typeof e != "boolean" && I();
}
function te(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && I();
}
function ae(e, t, n) {
  (!Array.isArray(e) || e.length > t) && I(), e.forEach(n);
}
var ns = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], as = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], ss = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function Zt(e, t = !1) {
  L(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), E(e.t, t), "cfs" in e && se(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && at(e[n]);
  "approval" in e && te(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && te(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && te(e[n], ss);
  "reason" in e && te(e.reason, ns, !0);
}
function pt(e, t = !1) {
  e !== null && (L(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), E(e.t), se(e.cfs, !0), t && E(e.eligibleT, !0));
}
function Fn(e, t) {
  L(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), E(t.lastAttemptAt, !0), E(t.lastSuccessAt, !0), te(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (L(n, ["points", "exclusions", "coveredWindow"]), ae(n.points, 4096, (a) => Zt(a)), ae(n.exclusions, 4096, (a) => Zt(a, !0)), n.coveredWindow !== null)) {
      let a = L(n.coveredWindow, ["startT", "endT", "complete"]);
      E(a.startT), E(a.endT), (a.complete !== !0 || a.startT > a.endT) && I();
    }
    if (e === "noaa" && (L(n, ["issuedT", "points", "conflicts"], ["sourceCode"]), "sourceCode" in n && te(n.sourceCode, ["nwrfc_textplot", "nwps_stageflow"]), E(n.issuedT), ae(n.points, 1024, (a) => {
      L(a, ["t", "cfs"]), E(a.t), se(a.cfs);
    }), ae(n.conflicts, 1024, (a) => E(a))), e === "radar") {
      L(n, ["generatedT", "hours", "conflicts"], ["definitionCode", "regions"]), E(n.generatedT);
      let a = (i) => {
        E(i), i % 36e5 && I();
      }, s = (i) => ae(i, 256, (o) => {
        L(o, ["endT", "mm"]), a(o.endT), se(o.mm, !0);
      });
      if (s(n.hours), ae(n.conflicts, 256, a), "regions" in n) {
        te(n.definitionCode, ["wbd_huc12_upper_middle_friday_vs_lower_v1"]), L(n.regions, ["upper", "lower"]);
        let i = 0;
        for (let [o, r] of Object.entries(n.regions))
          L(r, ["areaFraction", "hours", "conflicts"]), se(r.areaFraction, !1, !1, !1, 1), Math.abs(r.areaFraction - { upper: 0.9621456571845356, lower: 0.03785426796335805 }[o]) > 1e-9 && I(), i += r.areaFraction, s(r.hours), ae(r.conflicts, 256, a);
        Math.abs(i - 1) > 1e-6 && I();
      } else "definitionCode" in n && I();
    }
    if (e === "ensemble") {
      L(n, ["issuedT", "createdT", "archiveCreatedT", "sourceCode", "members"]), E(n.issuedT), E(n.createdT), E(n.archiveCreatedT), te(n.sourceCode, ["noaa_hefs"]);
      let a = /* @__PURE__ */ new Set();
      ae(n.members, 100, (s) => {
        L(s, ["id", "points"]), (typeof s.id != "string" || !/^\d{4}$/.test(s.id) || a.has(s.id)) && I(), a.add(s.id), ae(s.points, 256, (i) => {
          L(i, ["t", "cfs"]), E(i.t), se(i.cfs, !0);
        });
      });
    }
    e === "grid" && (L(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), E(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && I(), ae(n.periods, 1024, (a) => {
      L(a, ["startT", "endT", "mm"]), E(a.startT), E(a.endT), se(a.mm, !0), a.endT <= a.startT && I();
    })), e === "tides" && (L(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && I(), ae(n.points, 128, (a) => {
      L(a, ["t", "ft", "type"]), E(a.t), se(a.ft, !1, !0), te(a.type, ["H", "L"]);
    }));
  }
}
function rs(e) {
  L(e, ["summary", "transitions"]);
  let t = L(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && I(), E(t.asOf), te(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && Zt(t.actualCurrentObservation), E(t.supportObservationT, !0), t.event !== null) {
    let o = L(t.event, ["openedT", "high", "cycle"]);
    E(o.openedT), pt(o.high);
    let r = L(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    se(r.ordinal, !1, !1, !0, 1e5), E(r.openedT), pt(r.high, !0), pt(r.low), at(r.endingPending);
  }
  if (t.standing !== null) {
    let o = L(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    te(o.kind, ["downturn", "correction"]), te(o.state, ["possible_downturn", "rising_again"]), E(o.t), E(o.detectedAt), se(o.cfs), at(o.active), pt(o.supportingHigh), pt(o.low);
  }
  let n = (o) => ae(o, 16, (r) => te(r, as)), a = L(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  te(a.status, ["available", "warming_up", "partial", "unavailable"]), at(a.newDownturnAvailable), at(a.aboveHighCorrectionAvailable), n(a.reasons);
  let s = L(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(s.blockingReasons), E(s.nextEligibleAt, !0);
  let i = L(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  E(i.lastSuccessfulPollAt, !0), se(i.monitoringGapMs, !0, !1, !1, st), se(i.observationAgeMs, !0, !1, !1, st), ae(i.missingQuarterHours, 7, (o) => E(o)), at(i.clockTrusted), ae(e.transitions, 32, (o) => {
    L(o, ["kind", "t", "cfs", "event", "detected_at"]), te(o.kind, ["downturn", "event_end"]), E(o.t), E(o.detected_at), se(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && I();
  });
}
async function Xn(e) {
  L(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && I();
  let t = new TextEncoder().encode(e.payload);
  t.length > Gn && I(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && I();
  let a = JSON.parse(e.payload);
  L(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && I(), E(a.publishedAt);
  let s = L(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (s.schemaVersion !== 1 || typeof s.id != "string" || !/^[a-f0-9]{12}$/.test(s.id)) && I(), E(s.createdAt), a.publishedAt < s.createdAt && I();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return L(s.sources, i, ["ensemble"]), i.forEach((o) => Fn(o, s.sources[o])), "ensemble" in s.sources && Fn("ensemble", s.sources.ensemble), rs(s.monitor), s.monitor.summary.asOf !== s.createdAt && I(), a;
}
var nt = Vn(Wn) || {}, H = { range: ["day", "three", "full"].includes(nt.range) ? nt.range : "full", past: nt.past === 48 ? 48 : 24, reference: nt.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(nt.theme) ? nt.theme : null, cursorT: null };
H.theme && (document.documentElement.dataset.theme = H.theme);
var re = null, mt = null, z = null, zt = !1, X = "waiting", xe = null, gt = null, kt = !0, Me = !1, ve = Date.now(), Ct = () => zn(Wn, { range: H.range, past: H.past, reference: H.reference, theme: H.theme });
function is() {
  let e = Date.now(), t = xe ? Math.max(0, performance.now() - xe.mono) : 0, n = xe ? xe.lower + t : null, a = xe ? xe.upper + t : null;
  ve = Math.max(ve, e, a ?? 0, re?.snapshot.createdAt ?? 0);
  let s = kt || !xe || e < n - De || e > a + De || e + De < ve || re && re.snapshot.createdAt > a + De;
  return { now: ve, uncertain: s };
}
function Zn() {
  return gt ? gt.now + Math.max(0, performance.now() - gt.mono) : 0;
}
function os() {
  mt && zn(Bn, { packet: mt, greatestNow: ve, trustedNow: Zn(), savedDeviceMs: Date.now(), ended: Me });
}
function Dn(e) {
  let t = C("connection");
  if (X === "waiting") {
    t.textContent = "Checking the public snapshot and current time\u2026", t.className = "connection";
    return;
  }
  if (!re) {
    t.textContent = Me ? "Preview ended. No current readings are provided." : X === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - re.snapshot.createdAt), a = X !== "checked";
  if (!Me && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${ie(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [Me ? "Preview ended. Earlier readings are retained for reference." : a ? X === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : X === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current crest status is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${Q(re.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${ie(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current crest status is withheld." : ""].join(" "), t.className = "connection attention";
}
function ge() {
  let e = is();
  if (!re) {
    Dn(e);
    let l = X === "waiting";
    C("current").textContent = l ? "Checking river readings\u2026" : "No verified river readings available.", C("current").setAttribute("aria-busy", String(l)), C("monitor").textContent = l ? "" : "Crest status unavailable until readings can be verified.";
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((l) => l.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((l) => [...C(l).querySelectorAll("details:not(.section-help)")].flatMap((d, f) => d.open ? [`${l}:${f}`] : [])), s = re.snapshot, i = e.uncertain ? s.createdAt : e.now;
  z = pn({ nowMs: i, sources: s.sources, ratioTable: Un });
  let o = Me || e.uncertain || X !== "checked" || e.now - s.createdAt > 12 * 6e4;
  z.timeUncertain = e.uncertain, e.uncertain && (z.forecast.freshContext = !1, z.forecast.higherLater = { ...z.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let r = s.monitor.summary, c = !rt(r.supportObservationT) || i - r.supportObservationT > 60 * 6e4;
  if (o) {
    let l = { code: Me ? "preview_ended" : e.uncertain ? "public_time_uncertain" : X !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" };
    z.gauge.direction = { ...z.gauge.direction, available: !1, reason: l }, z.gauge.twelveHourChange = { ...z.gauge.twelveHourChange, available: !1, reason: l };
  }
  let u = s;
  if (o || c || !r.support.clockTrusted) {
    let l = [...r.capability.reasons, ...c ? [rt(r.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...r.support.clockTrusted ? [] : ["clock_uncertain"]];
    u = { ...s, monitor: { ...s.monitor, summary: { ...r, capability: { ...r.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: l }, preparation: { ...r.preparation, nextEligibleAt: null } } } };
  }
  En(u, z, e.uncertain ? null : { lastCommitAt: s.createdAt, workerStale: e.now - s.createdAt > 12 * 6e4 }, H, i, { checking: X === "waiting", suppressed: o });
  for (let l of C("forecast-details").querySelectorAll("a")) l.getAttribute("href") === "/data/ratio_table.json" && (l.href = new URL("ratio_table.json", qn).href, l.textContent = "View the frozen historical-case table");
  a.forEach((l) => {
    let [d, f] = l.split(":"), p = C(d).querySelectorAll("details:not(.section-help)")[Number(f)];
    p && (p.open = !0);
  }), Jt(n), document.querySelectorAll("[data-range]").forEach((l) => l.setAttribute("aria-pressed", String(l.dataset.range === H.range))), C("past").value = String(H.past), C("reference").value = H.reference, bt(C("chart"), z, H), Dn(e), it(), os(), t && C(t) && document.activeElement?.id !== t && C(t).focus({ preventScroll: !0 });
}
async function Jn(e, t = Gn * 2) {
  let n = new AbortController(), a = setTimeout(() => n.abort(), 18e3);
  try {
    let s = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!s.ok) throw new Error("unavailable");
    let i = await s.text();
    return new TextEncoder().encode(i).length > t && I(), { response: s, value: JSON.parse(i) };
  } finally {
    clearTimeout(a);
  }
}
async function ls() {
  let e = new URL("version.json", qn);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await Jn(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && I(), Me = n.state === "ended";
  let a = t.headers.get("Date"), s = t.headers.get("Age"), i = Date.parse(a || "");
  if (!rt(i) || i < At || i > st || s !== null && !/^\d+$/.test(s)) throw new Error("time_unavailable");
  let o = s === null ? 0 : Number(s);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let r = i, c = Date.now();
  c >= i - De && c <= r + De && r - c <= De && (ve = Math.max(r, c, Zn(), re?.snapshot.createdAt ?? 0), gt = { now: ve, mono: performance.now() }), xe = { lower: i, upper: r, mono: performance.now() }, kt = !1;
}
function cs(e, t) {
  if (re) {
    let n = re.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      X = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && I(), X = "checked";
      return;
    }
  }
  re = e, mt = t, X = "checked";
}
async function ot() {
  if (!zt) {
    zt = !0, C("refresh").disabled = !0, X === "waiting" && ge();
    try {
      let e = new URL(ts);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([ls(), Jn(e)]);
      if (t[0].status === "rejected" && (kt = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          cs(await Xn(n), n);
        } catch {
          X = "invalid";
        }
      else X = "offline";
      ge();
    } finally {
      zt = !1, C("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  H.range = e.dataset.range, H.cursorT = null, Ct(), ge();
}));
C("past").addEventListener("change", () => {
  H.past = Number(C("past").value), Ct(), ge();
});
C("reference").addEventListener("change", () => {
  H.reference = C("reference").value, Ct(), ge();
});
C("theme").addEventListener("click", () => {
  let e = H.theme ? H.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  H.theme = e ? "light" : "dark", document.documentElement.dataset.theme = H.theme, Ct();
});
C("refresh").addEventListener("click", ot);
C("chart").addEventListener("pointerdown", (e) => {
  H.cursorT = Hn(e), z && bt(C("chart"), z, H);
});
C("chart-cursor").addEventListener("input", () => {
  H.cursorT = Vt(), z && bt(C("chart"), z, H);
});
C("chart-cursor").addEventListener("keydown", (e) => {
  let t = Pn(e.key);
  t !== null && (e.preventDefault(), H.cursorT = t, z && bt(C("chart"), z, H));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (X = "waiting", ge(), ot());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (X = "waiting", ge(), ot());
});
window.addEventListener("offline", () => {
  X = "offline", kt = !0, ge();
});
window.addEventListener("online", ot);
var jn = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== jn && (jn = t, z && bt(C("chart"), z, H), it());
}).observe(C("chart"));
async function us() {
  let e = Vn(Bn);
  if (e?.packet)
    try {
      re = await Xn(e.packet), mt = e.packet, rt(e.greatestNow) && e.greatestNow >= At && e.greatestNow <= st && (ve = Math.max(ve, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), rt(e.trustedNow) && e.trustedNow >= At && e.trustedNow <= st && (gt = { now: e.trustedNow, mono: performance.now() }), Me = e.ended === !0, X = "waiting", ge();
    } catch {
      re = null, mt = null;
    }
  await ot(), setInterval(() => {
    document.hidden || ot();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || ge();
  }, 3e4);
}
us();
export {
  pn as buildWatchModel,
  Xn as verifyPublicPacket
};
