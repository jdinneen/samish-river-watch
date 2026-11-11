// site/js/season.js
var wn = "America/Los_Angeles";
var at = null;
function yn() {
  return at === null && (at = new Intl.DateTimeFormat("en-US", {
    timeZone: wn,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), at;
}
function ie(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of yn().formatToParts(new Date(e)))
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
function _t(e) {
  let t = ie(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function wt(e, t, n, a = 0, r = 0) {
  let i = Date.UTC(e, t - 1, n, a, r), o = i - _t(i);
  return i - _t(o);
}
function yt(e) {
  let t = ie(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var Tn = 3600 * 1e3, $n = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function xn(e, t) {
  for (let n = 0; n < e.length; n++) {
    let a = e[n], r = n === e.length - 1;
    if (t >= a.lead_lo_h && (t < a.lead_hi_h || r && t === a.lead_hi_h)) return a;
  }
  return null;
}
function An(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : $n).includes(ie(t).month);
}
var _e = (e) => typeof e == "number" && Number.isFinite(e);
function Sn(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!_e(e.rise_floor_cfs) || !_e(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!_e(t.lead_lo_h) || !_e(t.lead_hi_h) || !_e(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !_e(a.low_factor) || !_e(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function Tt(e, t, n, a = t.t) {
  let r = [], i = [], o = An(n, a);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: r, low: i, wetSeason: o };
  Sn(n);
  let s = n.bins, l = s[s.length - 1].lead_hi_h;
  for (let u of e) {
    let c = (u.t - t.t) / Tn;
    if (c <= 0 || c > l) continue;
    let p = xn(s, c);
    if (!p) continue;
    let h, d;
    if (u.cfs >= n.storm_flow_cfs) {
      let f = u.cfs - t.cfs >= n.rise_floor_cfs ? p.rise : p.flat;
      h = u.cfs * f.high_factor, d = u.cfs * f.low_factor;
    } else
      h = u.cfs + p.add_cfs, d = u.cfs - p.add_cfs;
    r.push({ t: u.t, cfs: Math.max(h, u.cfs) }), i.push({ t: u.t, cfs: Math.max(0, Math.min(d, u.cfs)) });
  }
  return { high: r, low: i, wetSeason: o };
}

// site/js/watch-model.js
var Ae = 6e4, U = 60 * Ae, C = 24 * U, fe = 30 * Ae, $e = 6 * U, Se = 15 * Ae, Mn = [2, 4, 6, 8, 12, 18, 24], R = (e) => typeof e == "number" && Number.isFinite(e), S = (e) => R(e) && Math.abs(e) <= 864e13, _ = (e, t = {}) => ({ code: e, details: t }), Me = (e, t) => S(t) ? Math.max(0, e - t) : null, kn = (e, t) => Object.prototype.hasOwnProperty.call(e, t), Je = (e) => ({ t: e.t, cfs: e.cfs }), Z = (e) => e && e.usable !== !1 && R(e.cfs) && e.cfs >= 0;
function Ie(e, t) {
  let n = (s) => {
    let [l, u = "0"] = String(s).toLowerCase().split("e"), c = l.includes(".") ? l.length - l.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(l.replace(".", "")), exponent: Number(u) - c };
  }, a = n(e), r = n(t), i = Math.min(a.exponent, r.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - r.coefficient * 10n ** BigInt(r.exponent - i)}e${i}`;
}
function $t(e) {
  let t = R(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : kn(e, "qualifier"), r = {
    t: e.t,
    cfs: t ? e.cfs : null,
    approval: e.approval ?? null,
    qualifierAvailable: a,
    qualityLabel: e.qualityLabel ?? (a ? "Quality metadata supplied" : "Quality flags unavailable"),
    eligible: e.eligible === !0 && n && a,
    usable: n,
    reason: n ? null : typeof e.reason == "object" && e.reason ? e.reason : _(typeof e.reason == "string" ? e.reason : "unusable_observation")
  };
  return a && (r.qualifier = e.qualifier), r;
}
function St(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !S(n.t)) continue;
    let a = $t(n), r = t.get(n.t);
    r ? JSON.stringify(r) !== JSON.stringify(a) && t.set(n.t, $t({
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
function qe(e, t) {
  let n = 0, a = e.length;
  for (; n < a; ) {
    let r = n + a >>> 1;
    e[r].t < t ? n = r + 1 : a = r;
  }
  return n;
}
function Mt(e, t) {
  let n = qe(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function De(e, t, n = Se) {
  let { before: a, after: r } = Mt(e, t), i = r?.t === t ? r : a && (!r || t - a.t <= r.t - t) ? a : r;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function ue(e) {
  if (!S(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return yt(e);
}
function kt(e, t) {
  let n = S(t) ? e[qe(e, t)] : null, a = S(t) ? t - C : null, r = S(a) ? Mt(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: S(t) ? ue(t) : null,
    distanceCfs: null,
    reached: null,
    ...r
  };
}
function Ct(e, t) {
  let n = Ie(e.current.cfs, t.cfs), a = R(n) ? Ie(e.referenceCfs, n) : null;
  return !R(n) || !R(a) ? { ...e, comparison: t, reason: _("non_finite_arithmetic") } : {
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
function st(e, t) {
  let n = kt(e, t);
  if (!Z(n.current))
    return { ...n, reason: _(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = De(e, n.targetT);
  return a ? Z(a) ? Ct(n, a) : { ...n, comparison: a, reason: _("comparison_unusable") } : { ...n, reason: _("comparison_missing", { toleranceMs: Se }) };
}
function rt(e, t) {
  let n = kt(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: S(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!Z(a.current)) return { ...a, reason: _(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let r = De(e, a.targetT);
  if (!r) return { ...a, reason: _("window_start_missing", { toleranceMs: Se }) };
  if (!Z(r)) return { ...a, startSupport: r, reason: _("window_start_unusable") };
  let i = e.slice(qe(e, a.targetT), qe(e, t) + 1), o = i.find((c) => !Z(c));
  if (o) return { ...a, startSupport: r, reason: _("window_unusable_observation", { t: o.t }) };
  let s = r.t < a.targetT ? [r, ...i] : i, l = 0;
  for (let c = 1; c < s.length; c++) l = Math.max(l, s[c].t - s[c - 1].t);
  if (l > fe) return {
    ...a,
    startSupport: r,
    maxGapMs: l,
    reason: _("observation_gap", { maxGapMs: l, allowedMs: fe })
  };
  let u = i.reduce((c, p) => !c || p.cfs < c.cfs ? p : c, null);
  return u ? {
    ...Ct(a, u),
    minimum: u,
    startSupport: r,
    maxGapMs: l,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: r, maxGapMs: l, reason: _("window_empty") };
}
function Xe(e, t, n = !1) {
  let a = [], r = [], i = [], o = [];
  for (let s of e) {
    if (!Z(s) || n && s.cfs <= 0) {
      r.length && a.push(r), r = [], o.push({ t: s.t, reason: n && s.cfs <= 0 ? "non_positive_flow" : s.reason?.code ?? "unusable_observation" });
      continue;
    }
    let l = r[r.length - 1];
    l && s.t - l.t > t && (i.push({ startT: l.t, endT: s.t, reason: "unsupported_gap" }), a.push(r), r = []), r.push(Je(s));
  }
  return r.length && a.push(r), { segments: a, gaps: i, exclusions: o };
}
function ae(e = "path_unavailable") {
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
function de(e, t = {}) {
  let n = e.filter((r) => r.length).map((r) => r.map(Je)), a = n.flat();
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
function Et(e, t = $e, n = !1) {
  let a = Xe(e, t, n);
  return de(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function we(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = qe(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let r = e[n - 1], i = (t - r.t) / (a.t - r.t), o = (1 - i) * r.cfs + i * a.cfs;
  return R(o) ? o : null;
}
function Pe(e, t) {
  for (let n of e.segments) {
    let a = we(n, t);
    if (a !== null) return a;
  }
  return null;
}
function it(e, t, n) {
  let a = [];
  for (let r of e.segments) {
    let i = Math.max(t, r[0].t), o = Math.min(n, r[r.length - 1].t);
    if (i > o) continue;
    let s = [
      { t: i, cfs: we(r, i) },
      ...r.filter((l) => l.t > i && l.t < o),
      ...o > i ? [{ t: o, cfs: we(r, o) }] : []
    ];
    a.push(s);
  }
  return de(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function Ue(e, t, n, a) {
  let r = Me(n, t);
  return {
    available: !!e?.data,
    dataT: S(t) ? t : null,
    ageMs: r,
    stale: r === null || r > a,
    lastAttemptAt: S(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: S(e?.lastSuccessAt) ? e.lastSuccessAt : null,
    error: e?.error ?? null,
    url: e?.url ?? null,
    rawRefs: e?.rawRefs ?? [],
    reasons: [
      ...e?.data ? [] : [_("source_unavailable")],
      ...e?.error ? [_("source_fetch_failed")] : [],
      ...r !== null && r > a ? [_("source_stale", { ageMs: r, maxAgeMs: a })] : []
    ]
  };
}
function Cn(e, t, n, a) {
  let r = {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * Ae)
  };
  if (!Z(t)) return { ...r, reason: _(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = De(e, t.t - U);
  if (!Z(i)) return { ...r, comparison: i, reason: _("direction_comparison_unavailable") };
  let o = Ie(t.cfs, i.cfs), s = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), l = { ...r, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: s };
  if (!R(o)) return { ...l, changeCfs: null, reason: _("non_finite_arithmetic") };
  if (n - t.t > 2 * U) return { ...l, reason: _("gauge_stale") };
  if (a?.error) return { ...l, reason: _("source_fetch_failed") };
  let u = e.filter((c) => c.t >= i.t && c.t <= t.t);
  return u.some((c) => !Z(c)) || u.some((c, p) => p && c.t - u[p - 1].t > fe) ? { ...l, reason: _("direction_observation_gap") } : {
    ...l,
    available: !0,
    reason: null,
    label: Math.abs(o) <= s ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function xt(e, t, n) {
  let a = S(t) ? t - 7 * C : null, r = {
    windowStartT: a,
    windowEndT: S(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!S(t)) return r;
  for (let o of e) {
    if (o.t < a || o.t > t) continue;
    let s = n(e, o.t);
    s.available ? (r.evaluatedCount++, r.coverageStartT ?? (r.coverageStartT = o.t), r.coverageEndT = o.t, s.reached && (r.last = s)) : r.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= a && o.t <= t);
  return r.coverageComplete = r.coverageStartT !== null && r.coverageStartT <= a + Se && r.coverageEndT >= t - fe && r.unavailableCount === 0 && !i.some((o, s) => s && o.t - i[s - 1].t > fe), r;
}
function At(e, t, n) {
  if (!S(t)) return { ...ae("observations_unavailable"), steps: [] };
  let a = [], r = [], i = [], o = [], s = null;
  for (let l of e) {
    if (l.t < t - 2 * C) continue;
    let u = n(e, l.t), c = u.comparison?.cfs;
    if (!u.available || !R(c + u.referenceCfs)) {
      o.length && a.push(o), o = [], s = null;
      continue;
    }
    if (s && l.t - s.t > fe && (i.push({ startT: s.t, endT: l.t, reason: "unsupported_gap" }), o.length && a.push(o), o = [], s = null), s) for (let h of ot(s.t, l.t)) {
      let d = (h - s.t) / (l.t - s.t), f = (1 - d) * s.base + d * c, m = f + ue(h - 1), A = f + ue(h);
      o.push({ t: h, cfs: m }), a.push(o), o = [{ t: h, cfs: A }], r.push({ t: h, beforeCfs: m, afterCfs: A });
    }
    let p = { t: l.t, cfs: c + u.referenceCfs };
    o.at(-1)?.t !== l.t && o.push(p), s = { t: l.t, base: c };
  }
  return o.length && a.push(o), { ...de(a, { gaps: i }), steps: r };
}
function ze(e, t = "forecast_unavailable") {
  let n = () => ae(t), a = () => ({ endpoint: xe(t), low: xe(t) });
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
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(ie(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function xe(e = "path_unavailable", t = !1) {
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
function ot(e, t) {
  if (!S(e) || !S(t) || e >= t) return [];
  let n = ie(e), a = ie(t), r = [];
  for (let i = n.year; i <= a.year; i++)
    for (let o of [3, 5, 11]) {
      let s = wt(i, o, 1);
      s > e && s <= t && r.push(s);
    }
  return r.sort((i, o) => i - o);
}
function En(e, t, n) {
  let a = it(e, n.t - 2 * C, n.t), r = it(t, n.t, t.endT ?? n.t), i = a.segments.map((o) => [...o]);
  for (let o of r.segments) {
    let s = o.filter((c) => c.t > n.t);
    if (!s.length) continue;
    let l = i[i.length - 1];
    o[0].t === n.t && l?.[l.length - 1].t === n.t ? l.push(...s) : i.push(s);
  }
  return de(i);
}
function Nt(e, t) {
  let n = t - C, a = Pe(e, t);
  if (a === null) return null;
  let r = Pe(e, n);
  if (r === null) return null;
  let i = e.segments.find((s) => s[0].t <= n && s[s.length - 1].t >= t), o = null;
  if (i) {
    o = r;
    for (let s of i) s.t > n && s.t <= t && (o = Math.min(o, s.cfs));
    o = Math.min(o, a);
  }
  return { current: a, endpoint: r, low: o };
}
function Nn(e, t, n, a, r, i) {
  let o = Pe(t, r);
  if (o === null) return null;
  let s = r - C;
  if (s > a.t) {
    let f = Nt(e, r);
    return f && f[i] !== null ? { current: o, base: f[i] } : null;
  }
  if (i === "endpoint") {
    let f = De(n, s);
    return Z(f) ? { current: o, base: f.cfs, comparisonT: f.t } : null;
  }
  let l = De(n, s);
  if (!Z(l)) return null;
  let u = n.filter((f) => f.t >= s && f.t <= a.t), c = l.t < s ? [l, ...u] : u;
  if (!u.length || u.some((f) => !Z(f)) || c.some((f, m) => m && f.t - c[m - 1].t > fe)) return null;
  let p = t.segments.find((f) => f[0].t <= a.t && f[f.length - 1].t >= r);
  if (!p) return null;
  let h = o, d = null;
  for (let f of u) f.cfs <= h && (h = f.cfs, d = f.t);
  for (let f of p) f.t > a.t && f.t <= r && f.cfs < h && (h = f.cfs, d = null);
  return { current: o, base: h, minimumObservedT: d };
}
function Ln(e, t, n, a, r) {
  let i = [], o = (s) => {
    s > n && s <= a && i.push(s);
  };
  if (r === "endpoint") {
    for (let s = 1; s < e.length; s++)
      o(Math.floor((e[s - 1].t + e[s].t) / 2) + C + 1);
    for (let s of e)
      o(s.t - Se + C), o(s.t + Se + C + 1);
  } else for (let s of e) o(s.t + C + 1);
  return i.filter((s) => s - C <= t.t);
}
function On(e, t, n, a, r = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let s of e.points)
    for (let l of [s.t, s.t + C]) l >= t && l <= n && i.add(l);
  for (let s of ot(t, n))
    i.add(s), s - 1 >= t && i.add(s - 1);
  for (let s of r)
    i.add(s), s - 1 >= t && i.add(s - 1);
  let o = [...i].sort((s, l) => s - l);
  for (let s = 1; s < o.length; s++) {
    let l = o[s - 1], u = o[s], c = (l + u) / 2, p = Nt(e, c);
    if (!p || a === "low" && p.low === null) {
      i.add(c);
      continue;
    }
    if (a !== "low") continue;
    let h = e.segments.find((m) => m[0].t <= c - C && m[m.length - 1].t >= c);
    if (!h) continue;
    let d = 1 / 0;
    for (let m of h) m.t > c - C && m.t < c && (d = Math.min(d, m.cfs));
    let f = [
      [we(h, l - C), we(h, u - C)],
      [we(h, l), we(h, u)],
      ...R(d) ? [[d, d]] : []
    ].filter((m) => m.every(R));
    for (let m = 0; m < f.length; m++) for (let A = m + 1; A < f.length; A++) {
      let O = f[m][0] - f[A][0], g = f[m][1] - f[A][1];
      if (!R(O) || !R(g) || O === g) continue;
      let y = O / (O - g);
      y > 0 && y < 1 && i.add(l + y * (u - l));
    }
  }
  return [...i].sort((s, l) => s - l);
}
function Rn(e, t, n, a, r, i) {
  if (!t.available) return { reference: { ...ae(t.reason), steps: [] }, crossing: xe(t.reason, r) };
  let o = En(e, t, n), s = t.endT, l = n.t, u = Ln(i, n, l, s, a), c = On(o, l, s, a, u), p = /* @__PURE__ */ new Set([...ot(l, s), ...u]), h = [], d = [], f = [], m = xe("comparison_coverage_missing", r), A = 0, O = !1, g = null, y = (T) => {
    if (Pe(t, T) === null) return null;
    let w = Nn(o, t, i, n, T, a), $ = w?.base;
    if (!w || $ === null || !R($)) return null;
    let W = ue(T), j = $ + W, P = Ie(w.current, $);
    return R(j) && R(P) ? {
      t: T,
      current: w.current,
      base: $,
      line: j,
      delta: P,
      threshold: W,
      comparisonT: w.comparisonT ?? null,
      minimumObservedT: w.minimumObservedT ?? null
    } : null;
  };
  for (let T of c) {
    let w = y(T);
    if (!w) {
      m.t === null && (O = !0), f.length && h.push(f), f = [], g = null;
      continue;
    }
    if (A++, p.has(T)) {
      let $ = y(T - 1), W = ue(T - 1) !== w.threshold, j = $ && $.base !== w.base && (a === "endpoint" ? $.comparisonT !== w.comparisonT : $.minimumObservedT !== null && $.minimumObservedT + C + 1 === T);
      if ($ && f.length && (W || j)) {
        let P = j ? $.line : w.base + ue(T - 1);
        f.push({ t: T, cfs: P }), h.push(f), f = [], P !== w.line && d.push({ t: T, beforeCfs: P, afterCfs: w.line });
      }
    }
    if (f.push({ t: T, cfs: w.line }), m.t === null && w.delta >= w.threshold && !O) {
      let $ = w;
      if (g && g.delta < g.threshold && !p.has(T) && ue(g.t) === w.threshold) {
        let W = g.t, j = T;
        for (; j - W > 1; ) {
          let P = Math.floor((j + W) / 2), V = y(P);
          !V || V.delta < V.threshold ? W = P : j = P;
        }
        $ = y(j) ?? w;
      }
      m = {
        available: !0,
        reason: null,
        t: $.t,
        currentCfs: $.current,
        comparisonCfs: $.base,
        changeCfs: $.delta,
        referenceCfs: $.threshold,
        alreadyReached: $.t === n.t,
        largeAdjustment: r
      };
    }
    g = w;
  }
  f.length && h.push(f), m.t === null && A && !O ? m = { ...xe(null, r), available: !0, reason: null } : m.t === null && O && (m = xe("comparison_coverage_missing", r));
  let D = h.map((T) => {
    let w = [];
    for (let $ of T)
      w.length >= 2 && w.at(-2).cfs === w.at(-1).cfs && w.at(-1).cfs === $.cfs && w.pop(), w.push($);
    return w;
  });
  return { reference: { ...de(D), steps: d }, crossing: m };
}
function Un(e, t) {
  let n = [e, t];
  for (let r = e + Ae; r < t; r += Ae) n.push(r);
  let a = n.map((r) => {
    let i = ie(r);
    return i.hour >= 8 && (i.hour < 17 || i.hour === 17 && i.minute === 0 && i.second === 0);
  });
  return a.every(Boolean) ? "inside_08_17" : a.every((r) => !r) ? "outside_08_17" : "spans_both";
}
function In(e, t) {
  let n = [];
  for (let a of e.segments) {
    let r = 0;
    for (; r < a.length; ) {
      let i = r;
      for (; i + 1 < a.length && a[i + 1].cfs === a[r].cfs; ) i++;
      let o = a[r - 1], s = a[i + 1];
      if (o && s && o.cfs < a[r].cfs && s.cfs < a[i].cfs && a[i].t > t) {
        let l = r - 1;
        for (; l > 0 && a[l - 1].cfs <= a[l].cfs; ) l--;
        let u = Je(a[l]);
        n.push({
          startT: a[r].t,
          endT: a[i].t,
          cfs: a[r].cfs,
          precedingLow: u,
          riseCfs: a[r].cfs - u.cfs,
          bracketStartT: o.t,
          bracketEndT: s.t,
          clockRange: Un(o.t, s.t)
        });
      }
      r = i + 1;
    }
  }
  return n.sort((a, r) => a.startT - r.startT);
}
function qn(e, t, n, a, r, i, o) {
  let s = ze(e), l = t?.data;
  if (!l) return s;
  let u = l.issuedT;
  s.issuedT = S(u) ? u : null, s.issueAgeMs = Me(e, u), s.older = s.issueAgeMs !== null && s.issueAgeMs > 12 * U, s.cases.tableVersion = o?.version ?? null, s.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let c = (g) => ({
    ...ze(e, g),
    issuedT: s.issuedT,
    issueAgeMs: s.issueAgeMs,
    older: s.older,
    cases: { ...s.cases, reason: _(g) }
  });
  if (!S(u)) return c("forecast_issue_missing");
  if (u > e) return c("forecast_issue_future");
  if (e - u > 48 * U) return c("forecast_issue_too_old");
  let p = St(l.points).filter((g) => g.t <= e + 10 * C), h = Et(p, $e);
  if (!h.segments.some((g) => g[0].t <= e + $e && g[g.length - 1].t >= e + C))
    return c("forecast_next_day_coverage_missing");
  if (s.available = h.available, s.reason = h.reason, s.raw = h, s.crests = In(h, i?.t ?? e), s.nextCrest = s.crests[0] ?? null, s.laterHigherCrests = s.nextCrest ? s.crests.slice(1).filter((g) => g.cfs > s.nextCrest.cfs) : [], !Z(i)) {
    let y = ze(e, i ? "current_observation_unusable" : "current_observation_unavailable");
    return {
      ...s,
      shifted: y.shifted,
      high: y.high,
      low: y.low,
      references: y.references,
      crossings: y.crossings,
      higherLater: y.higherLater,
      cases: { ...s.cases, reason: y.cases.reason }
    };
  }
  let d = Pe(h, i.t);
  if (d === null) {
    let g = ze(e, "forecast_alignment_unsupported");
    return {
      ...s,
      shifted: g.shifted,
      high: g.high,
      low: g.low,
      references: g.references,
      crossings: g.crossings,
      higherLater: g.higherLater,
      cases: { ...s.cases, reason: g.cases.reason }
    };
  }
  let f = Ie(i.cfs, d);
  if (!R(f)) return c("non_finite_arithmetic");
  s.offsetCfs = f, s.largeAdjustment = Math.abs(f) > Math.max(10, 0.1 * i.cfs);
  let m = [], A = [];
  for (let g of h.segments) {
    let y = g.map((T) => ({ t: T.t, cfs: T.cfs + f })), D = Xe(y, $e, !0);
    m.push(...D.segments), A.push(...D.exclusions);
  }
  s.shifted = it(de(m, { gaps: h.gaps, exclusions: A }), i.t, i.t + 72 * U), s.shifted.points.some((g) => g.t > i.t) || (s.shifted = { ...ae("non_positive_shifted_flow"), exclusions: A, gaps: h.gaps }), s.freshContext = !s.older && !t.error && !n?.error && e - i.t <= 2 * U, s.higherLater = {
    available: !1,
    reason: _("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: s.largeAdjustment
  };
  let O = s.shifted.points.filter((g) => g.t > i.t);
  if (s.freshContext && O.length) {
    let g = O.reduce((y, D) => D.cfs > y.cfs ? D : y);
    s.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: g.cfs > i.cfs,
      peakCfs: g.cfs,
      peakT: g.t,
      largeAdjustment: s.largeAdjustment
    };
  }
  if (s.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(ie(e).month), !s.cases.wetSeason)
    s.cases.reason = _("historical_cases_off_season"), s.high = ae(s.cases.reason), s.low = ae(s.cases.reason);
  else if (!o || o.version !== 3 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    s.cases.reason = _("historical_table_unavailable"), s.high = ae(s.cases.reason), s.low = ae(s.cases.reason);
  else
    try {
      let g = [], y = [], D = [], T = [];
      for (let w of s.shifted.segments) {
        let $ = Tt(w, i, o, e), W = w[0]?.t === i.t && i.cfs > 0 ? [Je(i)] : [], j = Xe([...W, ...$.high], $e, !0), P = Xe([...W, ...$.low], $e, !0);
        g.push(...j.segments), y.push(...P.segments), D.push(...j.exclusions), T.push(...P.exclusions);
      }
      s.high = de(g, { gaps: s.shifted.gaps, exclusions: D }), s.low = de(y, { gaps: s.shifted.gaps, exclusions: T });
      for (let w of ["high", "low"]) s[w].points.some(($) => $.t > i.t) || (s[w] = { ...ae("historical_case_values_unsupported"), exclusions: s[w].exclusions, gaps: s[w].gaps });
      s.cases.available = s.high.available || s.low.available, s.cases.reason = s.cases.available ? null : _("historical_case_values_unsupported");
    } catch {
      s.cases.reason = _("historical_table_invalid"), s.high = ae(s.cases.reason), s.low = ae(s.cases.reason);
    }
  for (let g of ["shifted", "high", "low"])
    for (let y of ["endpoint", "low"]) {
      let D = Rn(r, s[g], i, y, s.largeAdjustment, a);
      s.crossings[g][y] = D.crossing, g === "shifted" && (s.references[y] = D.reference);
    }
  return s;
}
function Dn(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
  for (let c of n?.conflicts ?? []) S(c) && c <= e && c % U === 0 && r.add(c);
  for (let c of n?.hours ?? [])
    if (!(!S(c.endT) || c.endT > e || c.endT % U !== 0)) {
      if (!R(c.mm) || c.mm < 0) {
        r.add(c.endT);
        continue;
      }
      a.has(c.endT) && a.get(c.endT) !== c.mm ? r.add(c.endT) : a.set(c.endT, c.mm);
    }
  let i = [...a.keys(), ...r], o = i.length ? Math.max(...i) : null, s = Me(e, o), l = Mn.map((c) => {
    let p = {
      hours: c,
      available: !1,
      reason: _("radar_unavailable"),
      startT: o === null ? null : o - c * U,
      endT: o,
      ageMs: s,
      mm: null,
      inches: null
    };
    if (o === null) return p;
    let h = 0;
    for (let d = 0; d < c; d++) {
      let f = o - d * U;
      if (r.has(f)) return { ...p, reason: _("radar_conflicting_hour", { endT: f }) };
      if (!a.has(f)) return { ...p, reason: _("radar_missing_hour", { endT: f }) };
      h += a.get(f);
    }
    return R(h) ? { ...p, available: !0, reason: null, mm: h, inches: h / 25.4 } : { ...p, reason: _("non_finite_arithmetic") };
  }), u = l.some((c) => c.available);
  return {
    available: u,
    reason: u ? null : _("radar_windows_unavailable"),
    endT: o,
    generatedT: S(n?.generatedT) ? n.generatedT : null,
    ageMs: s,
    historical: s !== null && s > 2 * U,
    stale: s === null || s > 3 * U,
    windows: l
  };
}
function Pn(e, t) {
  let n = t?.data, a = Me(e, n?.updatedT), r = {
    available: !1,
    reason: _("grid_forecast_unavailable"),
    startT: e,
    endT: e + C,
    updatedT: S(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * U,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return r;
  if (!S(n.updatedT) || n.updatedT > e) return { ...r, reason: _("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((u) => S(u.startT) && S(u.endT) && u.endT > e && u.startT < e + C).sort((u, c) => u.startT - c.startT || u.endT - c.endT), o = e, s = 0, l = !1;
  for (let u of i) {
    if (u.startT >= u.endT || !R(u.mm) || u.mm < 0) return { ...r, reason: _("grid_interval_invalid") };
    let c = Math.max(e, u.startT), p = Math.min(e + C, u.endT);
    if (c < o) return { ...r, reason: _("grid_interval_overlap", { t: c }) };
    if (c > o) return { ...r, reason: _("grid_interval_gap", { startT: o, endT: c }) };
    let h = (p - c) / (u.endT - u.startT);
    s += u.mm * h, l || (l = h !== 1), o = p;
  }
  return o < e + C ? { ...r, reason: _("grid_interval_gap", { startT: o, endT: e + C }) } : R(s) ? { ...r, available: !0, reason: null, mm: s, inches: s / 25.4, prorated: l } : { ...r, reason: _("non_finite_arithmetic") };
}
function Fn(e, t) {
  let n = t?.data, a = Me(e, t?.lastSuccessAt), r = {
    available: !1,
    reason: _("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * U,
    startT: e,
    endT: e + 2 * C,
    events: []
  };
  if (!n) return r;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...r, reason: _("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let l of n.points ?? []) {
    if (!S(l.t) || l.t < e || l.t > e + 2 * C || !R(l.ft) || !["H", "L"].includes(l.type)) continue;
    let u = i.get(l.t);
    u && (u.ft !== l.ft || u.type !== l.type) && o.add(l.t), i.set(l.t, { t: l.t, ft: l.ft, type: l.type });
  }
  let s = [...i.values()].filter((l) => !o.has(l.t)).sort((l, u) => l.t - u.t);
  return { ...r, available: s.length > 0, reason: s.length ? null : _("tide_events_unavailable"), events: s };
}
function Lt({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!S(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, r = St(a?.points).filter((m) => m.t <= e), i = r[r.length - 1] ?? null, o = [...r].reverse().find((m) => Z(m)) ?? null, s = Et(r, fe), l = i?.t ?? null, u = Ue(t.gauge, l, e, 2 * U), c = {
    latest: i,
    lastNumericObservation: o,
    points: r,
    segments: s.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: Me(e, l),
    stale: u.stale,
    referenceCfs: S(l) ? ue(l) : null,
    endpoint: st(r, l),
    low: rt(r, l),
    references: { endpoint: At(r, l, st), low: At(r, l, rt) },
    direction: Cn(r, i, e, t.gauge),
    history: { endpoint: xt(r, l, st), low: xt(r, l, rt) }
  }, p = qn(e, t.noaa, t.gauge, r, s, i, n), h = Dn(e, t.radar), d = Pn(e, t.grid), f = Fn(e, t.tides);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: u,
      noaa: Ue(t.noaa, p.issuedT, e, 12 * U),
      radar: Ue(t.radar, h.endT, e, 3 * U),
      grid: Ue(t.grid, d.updatedT, e, 12 * U),
      tides: Ue(t.tides, t.tides?.lastSuccessAt, e, 36 * U)
    },
    gauge: c,
    forecast: p,
    rain: { radar: h, grid: d },
    tides: f
  };
}

// site/js/watch-render.js
function Ze(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var b = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), q = (e) => typeof e == "number" && Number.isFinite(e);
function Fe(e, t = !1) {
  if (!q(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function he(e, t = !1) {
  if (!q(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function z(e, t = !1) {
  if (!q(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
var lt = (e, t = !1) => b(z(e, t)).replace(/,/g, ",<wbr>");
function F(e, t = !1) {
  return q(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function X(e) {
  if (!q(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function Ot(e) {
  return q(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var Rt = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function oe(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(oe).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return Rt[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(Rt, {
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
function Q(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var Ut = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, ct = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, ee = (e) => `<time datetime="${q(e) ? new Date(e).toISOString() : ""}">${b(F(e, !0))}</time>`;
function It(e) {
  let t = (e?.qualityLabel || e?.quality || "quality unknown").replace(/; no qualifier supplied$/, ""), n = t.toLowerCase() === "provisional" ? "not yet finalized" : t, a = { ice: "ice-affected value", malformed_value: "invalid numeric value", negative_value: "invalid negative flow", conflicting_duplicate: "conflicting readings", unsupported_quality: "unsupported quality flag", quality_flags_unavailable: "quality flags unavailable", approval_unavailable: "approval unavailable" }[typeof e?.reason == "object" ? e.reason?.code : e?.reason];
  return a ? `${n} \xB7 ${a}` : n;
}
function qt(e) {
  return e?.available ? e.distanceCfs === 0 ? `At ${z(e.referenceCfs)} cfs line` : `${z(Math.abs(e.distanceCfs))} cfs ${e.distanceCfs > 0 ? "below" : "past"} the ${z(e.referenceCfs)} cfs line` : "";
}
function Dt(e, t = !1) {
  if (!e?.available) {
    let o = [["Before", e?.before], ["After", e?.after]].filter(([, s]) => s);
    return `${b(oe(e?.reason))}${o.length ? "<br>Nearest readings: " + o.map(([s, l]) => `${s} ${ee(l.t)}: ${z(l.cfs)} cfs`).join("; ") + "." : ""}`;
  }
  let n = t ? e.minimum : e.comparison, a = F(n.t, !0), r = a.slice(-3) === F(e.current?.t, !0).slice(-3), i = `<time datetime="${new Date(n.t).toISOString()}" title="${b(F(n.t))}">${b(r ? a.replace(/ PST$| PDT$/, "") : a)}</time>`;
  return `${t ? "Low" : "From"} <strong>${z(n.cfs)} cfs</strong><br>${i}${t || e.elapsedMs === 24 * 36e5 ? "" : `<span class="comparison-interval">${b(X(e.elapsedMs))} earlier</span>`}`;
}
function jn(e, t, n = !1, a = "") {
  return `<div class="metric"><div class="metric-heading"><h3>${b(t)}</h3><div class="metric-value${e?.available ? "" : " unavailable"}">${e?.available ? z(e.changeCfs, !0) : "Unavailable"}${e?.available ? "<small> cfs</small>" : ""}</div></div><p class="distance" aria-label="Distance from rolling reference">${b(qt(e))}</p>${a ? `<p class="metric-note">${b(a)}</p>` : ""}<p>${Dt(e, n)}</p></div>`;
}
function Hn(e) {
  let t = e.gauge || {}, n = e.actualCurrentObservation || t.latest, a = t.direction || {}, r = a.available && { rising: "Rising", falling: "Falling", roughly_level: "Roughly level" }[a.label] || "Direction unavailable", i = t.endpoint?.available && t.low?.available && z(t.endpoint.changeCfs, !0) === z(t.low.changeCfs, !0), o = t.endpoint?.approximate ? "About 24-hour change" : "24-hour change", s = t.endpoint?.available ? `<div class="rise-source">${Dt(t.endpoint, !1)}</div>` : "", l = ct("flow", "How flow comparisons work", `<p>Flow means water passing the gauge, in cubic feet per second (cfs). The reading time, source quality and age describe this observation.</p><p><strong>24-hour change</strong> compares the reading nearest 24 elapsed hours earlier (within 15 minutes). <strong>Rise from the 24-hour low</strong> compares the lowest actual reading in that same window. They answer different questions and may differ. Missing readings are not filled; gaps over 30 minutes make the comparison unavailable.</p><p>The descriptive line is ${Fe(t.referenceCfs)} cfs of rolling change: 400 in November\u2013February, 200 in March\u2013April, and 100 in May\u2013October. This is a planning reference; the official live closure calculation has not been confirmed.</p>`), u = i ? "" : `<div class="metrics">${jn(t.low, "Rise from 24h low", !0)}</div>`, c = i ? t.endpoint.changeCfs === t.low.changeCfs ? "24h change; same as rise from 24h low" : "Rounds to same value as rise from 24h low" : "", p = q(n?.cfs) ? `${z(n.cfs)} cfs` : "Unavailable", h = e.timeUncertain ? "Age unknown" : `${X(t.ageMs)} old${t.stale ? " \xB7 STALE" : ""}`;
  Q("current", `<div class="flow-row"><div><div class="section-heading flow-heading"><h2>Flow</h2>${Ut("flow", "About flow readings")}<span class="actual-flow flow-number">Actual flow: ${p} \xB7 ${b(h)}</span></div><div class="rise-headline"><span${i ? ' class="equal-label" title="The 24-hour change and rise from the 24-hour low are rounded for display"' : ""}>${i ? c : o}</span><strong class="distance-headline">${t.endpoint?.available ? b(qt(t.endpoint)) : "24-hour reference unavailable"}</strong><b class="rise-support">24-hour change: ${t.endpoint?.available ? z(t.endpoint.changeCfs, !0) + " cfs" : "unavailable"}</b>${s}</div></div><div class="flow-context"><strong>${b(r)}</strong>${n ? ee(n.t) : ""}<span class="reading-age">${b(It(n))}${t.stale && !e.timeUncertain ? " \xB7 STALE" : ""}</span></div></div>${u}<p class="authority">Health authorities decide closures and reopening.</p>${l}`), Q("flow-history", ""), document.getElementById("current").setAttribute("aria-busy", "false");
  let d = q(n?.cfs) ? lt(n.cfs) : "\u2014", f = e.timeUncertain ? "Age unknown" : X(t.ageMs).replace("less than 1 minute", "<1m").replace(" minutes", "m").replace(" minute", "m");
  Q("number-strip", `<span aria-label="Actual flow ${b(p)}, ${b(e.timeUncertain ? "age unknown" : X(t.ageMs) + " old")}${t.stale && !e.timeUncertain ? " and stale" : ""}">Flow (cfs) <strong>${d}</strong><small>${b(f)}${t.stale && !e.timeUncertain ? " \xB7 STALE" : ""}</small></span><span aria-label="Rolling 24-hour change ${t.endpoint?.available ? z(t.endpoint.changeCfs, !0) + " cfs" : "unavailable"}">24h change <strong>${t.endpoint?.available ? lt(t.endpoint.changeCfs, !0) : "\u2014"}</strong></span><span aria-label="Rise from 24-hour low ${t.low?.available ? z(t.low.changeCfs, !0) + " cfs" : "unavailable"}">Low rise <strong>${t.low?.available ? lt(t.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function Bn(e, t = !1) {
  return (e || []).map((n) => b(t && ["rate_limited", "rate_limit", "rate_suppression"].includes(typeof n == "string" ? n : n?.code) ? "Saved monitoring updates are temporarily rate-limited; this page only displays saved status." : oe(n))).filter((n, a, r) => r.indexOf(n) === a).join(" ");
}
function Wn(e, t, n, a, { publicView: r = !1 } = {}) {
  let i = e.monitor?.summary || {}, o = i.capability || {}, s = i.preparation || {}, l = i.support || {}, c = q(i.supportObservationT) && a - i.supportObservationT > 60 * 6e4 ? { ...o, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: [...o.reasons || [], "observation_older_than_60min"] } : o, p = q(n?.lastCommitAt) ? a - n.lastCommitAt : null, h = !!n?.workerStale || q(p) && p > 12 * 6e4, d = i.standing, f = d?.active === !0 && (d.kind === "correction" || d.state === "rising_again"), m = { unarmed: "No downturn detected yet", tracking: "Watching for a possible downturn", possible_downturn: "Possible downturn \u2014 it may reverse", ended: "Earlier event retained for reference" }[i.phase] || "Turn monitor is starting";
  f && i.phase !== "ended" && (m = "Rising again after a possible downturn"), c.status === "unavailable" || h ? m = "Turn monitoring unavailable" : c.status === "partial" ? m = "New downturn checks unavailable" : c.status === "warming_up" && (m = "Turn checks are warming up");
  let A = e.monitor?.transitions || [], O = (re) => ["downturn", "possible_downturn"].includes(re?.kind), g = i.phase === "ended" && (O(d) ? d : d ? null : Ze(A, O)), y = g && Ze(A, (re) => O(re) && re.t === (g.t ?? g.observationT)), D = y && A.some((re) => re.kind === "event_end" && re.event === y.event && re.detected_at === y.detected_at), T = g ? `A possible downturn was recorded at ${ee(g.t ?? g.observationT)} \xB7 ${Fe(g.cfs ?? Number(g.q))} cfs. The event grouping has ended; this turn remains earlier evidence.${D ? " The turn and event end were recorded in the same check, so no current-turn preview was prepared." : ""}` : q(d?.t) ? `${d.active === !0 ? "" : "Earlier event: "}${d.kind === "correction" || d.state === "rising_again" ? "Rising again after a possible downturn; correction observed" : "Possible downturn recorded"} at ${ee(d.t)} \xB7 ${Fe(d.cfs)} cfs.${d.active === !0 ? "" : " This is earlier evidence, separate from the current event."}` : "", w = q(s.nextEligibleAt) && s.nextEligibleAt > a ? r ? ` Saved monitoring status is rate-limited until ${F(s.nextEligibleAt, !0)}.` : ` River-warning previews are rate-limited until ${F(s.nextEligibleAt, !0)}.` : "", $ = h ? r ? " The published snapshot is old; current monitoring status cannot be confirmed." : " The monitor has not saved a recent check; silence does not mean no turn." : "", W = c.status === "partial" ? " Above-high corrections remain available." : "", j = It(t.actualCurrentObservation), P = t.actualCurrentObservation?.eligible === !1 ? `Latest quality: ${j}; this reading cannot support an automatic turn notice.` : "", V = t.gauge?.direction, We = V?.available ? `Measured hour change: ${he(V.changeCfs, !0)} cfs over ${X(V.elapsedMs)}, from ${he(V.comparison?.cfs)} to ${he(V.current?.cfs)} cfs. The roughly-level tolerance is ${he(V.toleranceCfs)} cfs, an engineering choice, not instrument precision. These hour-change values are rounded for readability.` : oe(V?.reason);
  Q("monitor", `<details><summary><h2>${b(m)}</h2><span>Details</span></summary><p>Experimental checks follow observed river flow. A possible turn can reverse.</p><p>${b(We)}</p><p>${Bn([...c.reasons || [], ...s.blockingReasons || []], r)}</p><p>${l.monitoringGapMs ? `Recorded monitoring gap: ${b(X(l.monitoringGapMs))}. ` : ""}These event groupings do not set a sampling deadline or reset a closure rule. ${r ? "Display only \xB7 no alerts sent. This page does not prepare or send alerts." : "Warning delivery is disabled."}</p></details>${T || W || w || $ ? `<p class="monitor-fact">${T}${b(W + w + $)}</p>` : ""}${P ? `<p>${b(P)}</p>` : ""}`), document.getElementById("monitor").classList.toggle("attention", c.status === "unavailable" || c.status === "partial" || h);
}
var Vn = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function Pt(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return oe("public_time_uncertain");
  let a = oe(t);
  return e.timeUncertain && Vn.includes(n) ? `At the snapshot save time: ${a}` : a;
}
function Gn(e, t) {
  let n = e.forecast || {}, a = (f) => Pt(e, f);
  Q("forecast-age", n.issuedT ? `Issued ${ee(n.issuedT)} \xB7 ${b(e.timeUncertain ? "age unknown" : X(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${b(a(n.reason))}` : ""}` : `Forecast unavailable. ${b(a(n.reason))}`);
  let r = [];
  e.sources?.noaa?.error && r.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && r.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${he(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? r.push({ text: a(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && r.push(`Adjusted forecast unavailable. ${a(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && r.push(`Historical cases unavailable. ${a(n.cases.reason)}`), Q("forecast-problems", r.map((f) => `<p${typeof f == "object" && f.neutral ? ' class="neutral"' : ""}>${b(typeof f == "object" ? f.text : f)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (i && r.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let l = n.crossings?.shifted?.[t.reference], u = l?.available ? q(l.t) ? `The adjusted forecast ${l.alreadyReached ? "already meets" : "first reaches"} the reference at ${F(l.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${a(l?.reason)}`, c = q(n.offsetCfs) ? `Adjustment to the gauge reading: ${he(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", p = Date.parse(n.cases?.trainingCutoff ?? ""), h = q(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${Fe(n.cases.tableVersion)}${q(p) ? `; training cutoff ${ee(p)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  Q("forecast-details", ct("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier readings; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${q(n.raw?.endT) ? `; available through ${ee(n.raw.endT)}` : ""}.</p><p>${b(c)} ${n.available === !1 ? `The issued forecast is unavailable. ${b(a(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${b(u)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. They cover the first 72 hours in October\u2013April; later points show the issued forecast alone.</p>${h}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function zn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${F(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : X(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", r = t.windows || [2, 4, 6, 8, 12, 18, 24].map((s) => ({ hours: s, available: !1 })), i = [...new Set(r.filter((s) => !s.available).map((s) => oe(s.reason || t.reason)))], o = ct("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over the drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. Radar cannot confirm whether rain has stopped upriver.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  Q("rain", `<div class="section-heading"><h2>Rain</h2>${Ut("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${b(a)}</p><div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${r.map((s) => `<div class="rain-total" aria-label="${s.hours}-hour total ending ${b(F(s.endT ?? t.endT, !0))}, ${b(e.timeUncertain ? "age unknown" : X(s.ageMs ?? t.ageMs) + " old")}"><span>${s.hours} hours</span><strong>${s.available ? Ot(s.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map(b).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${Ot(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${b(oe(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${ee(n.updatedT)} \xB7 ${b(e.timeUncertain ? "age unknown" : X(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function Xn(e, t) {
  let n = e.forecast || {};
  if (n.available === !1) {
    Q("peaks", `<div class="section-top"><h2>Forecast peaks unavailable</h2></div><p class="meta">${b(Pt(e, n.reason))}</p>`);
    return;
  }
  let a = Array.isArray(n.crests) ? n.crests : [n.nextCrest, ...n.laterHigherCrests || []].filter(Boolean), r = Math.max(e.nowMs, e.gauge?.latest?.t ?? -1 / 0), i = [...a].filter((d) => e.timeUncertain || d.endT > r).sort((d, f) => d.startT - f.startT), o = i[0], s = o ? [o, ...i.slice(1).filter((d) => d.cfs > o.cfs)] : [], l = !e.timeUncertain && o && o.startT <= e.nowMs && o.endT > e.nowMs, u = e.timeUncertain ? e.gauge?.latest?.t : e.nowMs, c = q(u) ? t.range === "full" ? Math.max(u + 36e5, n.raw?.endT ?? u + 72 * 36e5) : u + (t.range === "day" ? 24 : 72) * 36e5 : 1 / 0, p = (d) => `<time datetime="${new Date(d).toISOString()}">${b(F(d))}</time>`, h = s.map((d, f) => `<article class="peak-card"><p class="eyebrow">${f === 0 ? e.timeUncertain ? "First listed forecast peak" : l ? "Forecast plateau in progress" : "Next local peak" : "Later peak above the first"}</p><h3>${p(d.startT)}${d.endT !== d.startT ? ` to ${p(d.endT)}` : ""}</h3><p class="peak-values"><strong class="peak-flow">${z(d.cfs)} cfs</strong><span>Issued forecast flow</span><span>${z(d.riseCfs, !0)} cfs from prior forecast low</span></p><p class="meta">${d.endT !== d.startT ? "Several forecast readings at this level" : "One forecast reading at this time"}; timing is uncertain.${f === 0 && l ? " This forecast plateau spans the current time; its end is still ahead." : ""}${d.startT > c ? " Outside the selected chart range." : ""}</p>${f === 0 ? '<p class="sampling-lines"><strong>River samples:</strong> around the river peak and afterward, as early as possible; no fixed hours-after-peak deadline.<br><strong>Bay samples:</strong> within six hours after the river peak for a qualifying pollution closure; tide and laboratory availability also matter.</p>' : ""}<details class="peak-resolution"><summary>Surrounding issued times</summary><p>${p(d.bracketStartT)} to ${p(d.bracketEndT)}. ${{ inside_08_17: "Both are between 8 AM and 5 PM", outside_08_17: "Both are outside 8 AM\u20135 PM", spans_both: "This interval spans daytime and overnight hours" }[d.clockRange] || "Clock range unavailable"}.</p></details></article>`).join("");
  Q("peaks", `<div class="section-top"><h2>${e.timeUncertain ? "Peaks in the saved forecast" : l ? "Forecast peak in progress" : "Next river peak"}</h2></div><p class="meta">Peak values use the issued forecast, without a gauge adjustment.${e.timeUncertain ? " Current time is uncertain; these are saved forecast points." : ""}</p>${h ? `<div class="peak-grid">${h}</div>` : `<p class="meta">${e.timeUncertain ? "No supported peak is identifiable in this saved forecast." : "No supported upcoming peak is identifiable."} A rising or level tail does not establish a crest.</p>`}`);
}
function Jn(e) {
  let t = e.tides || {};
  Q("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + b(X(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${ee(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${Fe(n.ft)}</td></tr>`).join("")}</tbody></table>` : `<p>${b(oe(t.reason))}</p>`}</div>`);
}
function Zn(e, t, n) {
  Q("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", tides: "NOAA Bellingham tide predictions" }).map(([r, i]) => {
    let o = t.sources?.[r] || {}, s = n?.sources?.[r] || {};
    return `<div class="source-row"><strong>${b(i)}</strong>${r === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>Data time: ${ee(o.dataT)} \xB7 ${b(t.timeUncertain ? "age unknown" : X(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${ee(s.lastSuccessAt ?? o.lastSuccessAt)}.${s.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot saved ${ee(e.createdAt)}. This save time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}
function Ft(e, t, n, a, r, i = {}) {
  Hn(t), Wn(e, t, n, r, i), Gn(t, a), zn(t), Xn(t, a), Jn(t), Zn(e, t, n);
  let o = t.gauge?.exclusions || [], s = {};
  for (let l of o) {
    let u = typeof l.reason == "string" ? l.reason : l.reason?.code || "unspecified";
    s[u] = (s[u] || 0) + 1;
  }
  document.getElementById("sources").insertAdjacentHTML("beforeend", `<p>Gauge source exclusions: ${o.length} recorded exclusions${o.length ? ". " + Object.entries(s).map(([l, u]) => `${u} ${b(oe(l))}`).join(" ") : "."} These records do not support automatic notices.</p>`), Q("snapshot-label", `Saved snapshot ${b(e.id)} \xB7 ${b(F(e.createdAt))}`);
}

// site/js/watch-chart.js
var H = Number.isFinite, I = null, Yn = (e, t, n) => H(e?.t) && H(e?.cfs) && e.t >= t && e.t <= n;
function Ye(e, t, n) {
  for (let a of e || []) {
    let r = Ze(a, (i) => i.t === t);
    if (r) return r.cfs;
    for (let i = 1; i < a.length; i++) {
      let o = a[i], s = a[i - 1];
      if (s.t < t && o.t > t)
        return o.t - s.t > n ? null : s.cfs + (o.cfs - s.cfs) * (t - s.t) / (o.t - s.t);
    }
  }
  return null;
}
function jt(e, t, n, a) {
  let r = e.filter((i) => Yn(i, t, n));
  for (let i of [t, n])
    if (!r.some((o) => o.t === i)) {
      let o = Ye([e], i, a);
      H(o) && r.push({ t: i, cfs: o });
    }
  return r.sort((i, o) => i.t - o.t);
}
function Qn(e, t, n) {
  return e.map((a, r) => `${r ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function Kn(e, t, n) {
  return (e?.segments || []).map((a) => {
    let r = jt(a, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !a.length || i.t < a[0].t || i.t > a.at(-1).t) continue;
      let o = r.findIndex((l) => l.t >= i.t), s = o < 0 ? r.length : o;
      for (; r[s]?.t === i.t; ) r.splice(s, 1);
      r.splice(s, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return r;
  });
}
var ea = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function ut(e) {
  let t = Object.fromEntries(ea.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function ta(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - ut(t);
  return t;
}
function na(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), r = ut(e), i = ut(t), o = [];
  for (let s of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let l = Math.min(s, 12) * 36e5, u = [];
    for (let p = Math.ceil(r / l) * l; p <= i + 36e5; p += s * 36e5) {
      let h = ta(p);
      h >= e && h <= t && u.push(h);
    }
    if (u.length < 2) continue;
    o = u;
    let c = Math.min(...u.slice(1).map((p, h) => (p - u[h]) / (t - e) * n));
    if (u.length <= a && c >= 40) return u;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function ke(e, t, n) {
  let a = Math.max(1, Math.floor(e.clientWidth)), r = globalThis.innerHeight, i = a < 500 ? 240 : H(r) && r < 500 ? Math.max(180, Math.min(280, r - 80)) : 280, o = { left: Math.min(49, a / 4), right: Math.min(14, a / 4), top: 26, bottom: 38 }, s = o.left, l = a - o.right, u = o.top, c = i - o.bottom, p = t.gauge?.latest?.t, h = Math.round(t.nowMs), d = document.getElementById("chart-cursor");
  if (t.timeUncertain && !H(p)) {
    let v = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${a} ${i}" width="${a}" height="${i}" role="img" aria-label="${v}"><text x="${a / 2}" y="${i / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${a / 2}" y="${i / 2 + 4}" text-anchor="middle">${a < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let k of document.querySelectorAll?.(".legend span") ?? []) k.hidden = !0;
    I = null, d.min = "0", d.max = "1", d.step = "1", d.value = "0", d.disabled = !0, d.style.marginLeft = `${s - 10}px`, d.style.width = `${l - s + 20}px`, d.setAttribute("aria-valuetext", v), document.getElementById("chart-readout").textContent = v;
    return;
  }
  let f = t.timeUncertain ? p : h, m = f - Number(n.past || 24) * 36e5, A = n.range === "full" ? Math.max(f + 36e5, t.forecast?.raw?.endT ?? f + 72 * 36e5) : f + (n.range === "day" ? 24 : 72) * 36e5, O = t.forecast || {}, g = t.gauge?.references?.[n.reference], y = O.references?.[n.reference], D = { segments: [...g?.segments || [], ...y?.segments || []], steps: [...g?.steps || [], ...y?.steps || []] }, T = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: O.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: O.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: O.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: O.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: "24-hour rise reference", segments: Kn(D, m, A), gap: 1 / 0 }].map((v) => ({ ...v, visible: v.key === "reference" ? v.segments : v.segments.map((k) => jt(k, m, A, v.gap)) })), w = T.flatMap((v) => v.visible.flat()).filter((v) => H(v.cfs)), $ = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let v of document.querySelectorAll?.(".legend span") ?? []) {
    let k = $[v.querySelector("i")?.className];
    v.hidden = !!k && !T.some((ve) => ve.key === k && ve.visible.some((nt) => nt.length));
  }
  let W = Math.max(10, ...w.map((v) => v.cfs)) * 1.08, j = W / 4, P = Math.pow(10, Math.floor(Math.log10(j))), V = j / P, We = (V <= 1 ? 1 : V <= 2 ? 2 : V <= 5 ? 5 : 10) * P, re = We * 4, G = (v) => s + (v - m) / (A - m) * (l - s), Te = (v) => c - v / re * (c - u), nn = Array.from({ length: 5 }, (v, k) => We * k), an = na(m, A, l - s), sn = nn.map((v) => `<line class="grid" x1="${s}" x2="${l}" y1="${Te(v)}" y2="${Te(v)}"/><text x="${s - 7}" y="${Te(v) + 4}" text-anchor="end">${b(he(v))}</text>`).join("") + an.map((v) => {
    let k = G(v), ve = k < 24 ? "start" : k > a - 24 ? "end" : "middle", nt = `<tspan x="${k}">${b(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(v))}</tspan><tspan x="${k}" dy="14">${b(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(v))}</tspan>`;
    return `<text class="x-axis-label" x="${k}" y="${i - 24}" text-anchor="${ve}">${nt}</text>`;
  }).join(""), rn = T.map((v) => v.visible.filter((k) => k.length).map((k) => k.length === 1 ? `<circle class="${v.key}" cx="${G(k[0].t)}" cy="${Te(k[0].cfs)}" r="2" fill="var(--${v.key === "observed" ? "obs" : v.key})"/>` : `<path class="plot-line ${v.key}" d="${Qn(k, G, Te)}"/>`).join("")).join(""), mt = Ye(D.segments, m, 1 / 0) ?? Ye(D.segments, f, 1 / 0), me = H(mt) ? Te(mt) : u + 14;
  me = me - u > 32 ? me - 10 : me + 24, me = Math.max(u + 12, Math.min(c - 6, me));
  let on = T.find((v) => v.key === "reference")?.visible.flat() || [], Ve = on.reduce((v, k) => !v || k.t > v.t ? k : v, null), Ge = Ve ? Math.max(s + 4, Math.min(l - 88, G(Ve.t) - 84)) : s + 4, bt = me, ln = Ge + 84, cn = H(n.cursorT) && n.cursorT >= m && n.cursorT <= A ? G(n.cursorT) : null, un = H(p) && p >= m && p <= A ? G(p) : null, dn = Ve && G(Ve.t) - s >= 84, fn = [cn, un].some((v) => H(v) && v >= Ge && v <= ln), hn = l - s < 200 || !dn || fn ? "" : `<rect class="reference-label-bg" x="${Ge}" y="${bt - 12}" width="84" height="16" rx="3"/><text class="reference-label" x="${Ge + 4}" y="${bt}">24h rise line</text>`, vt = t.timeUncertain && l - s < 132, pn = t.timeUncertain ? vt ? "Last reading" : "Last saved river reading" : "Latest observed", gn = t.timeUncertain ? vt ? 80 : 132 : 90, mn = H(p) && p >= m && p <= A ? `<line x1="${G(p)}" x2="${G(p)}" y1="${u}" y2="${c}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(s, Math.min(l - gn, G(p) + 5))}" y="${u - 9}">${pn}</text>` : "", bn = !t.timeUncertain && h >= m && h <= A ? `<line class="now" x1="${G(h)}" x2="${G(h)}" y1="${u}" y2="${c}"/><text x="${Math.min(l - 25, G(h) + 5)}" y="${u + 15}">Now</text>` : "", be = H(n.cursorT) ? Math.max(m, Math.min(A, n.cursorT)) : null, vn = be !== null ? `<line class="cursor" x1="${G(be)}" x2="${G(be)}" y1="${u}" y2="${c}"/>` : "", _n = T.some((v) => v.segments.some((k) => k.some((ve) => H(ve.t) && H(ve.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${a} ${i}" width="${a}" height="${i}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. Observations and forecast paths from ${b(F(m, !0))} through ${b(F(A, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${s}" y="${u}" width="${l - s}" height="${c - u}"/></clipPath></defs>${sn}<g clip-path="url(#plot-clip)">${rn}${vn}</g>${hn}${mn}${bn}${w.length ? "" : `<text x="${(s + l) / 2}" y="${i / 2}" text-anchor="middle">${_n}</text>`}</svg>`, I = { lines: T, hasData: w.length > 0, start: m, end: A, left: s, right: l, width: a, host: e }, d.min = String(m), d.max = String(A), d.step = "1", d.disabled = !I.hasData, d.style.marginLeft = `${s - 10}px`, d.style.width = `${l - s + 20}px`;
  let tt = be ?? Math.max(m, Math.min(A, H(p) ? p : h));
  d.value = String(Math.round(tt)), d.setAttribute("aria-valuetext", t.timeUncertain ? `${be === null ? "Last saved river reading" : "Saved chart selection"}: ${F(tt)}. Current time is unconfirmed.` : F(tt)), be !== null ? aa(be) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function aa(e) {
  if (!I) return;
  let t = I.lines.map((n) => {
    let a = Ye(n.visible, e, n.gap);
    return H(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${b(F(e))}</strong><br>${t.map(b).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}`;
}
function Ht(e) {
  if (!I?.hasData) return null;
  let t = I.host.getBoundingClientRect(), n = t.width / I.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - I.left) / (I.right - I.left)));
  return Math.round(I.start + a * (I.end - I.start));
}
function dt() {
  if (!I?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return H(e) ? Math.max(I.start, Math.min(I.end, e)) : null;
}
function Bt(e) {
  let t = dt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? I.start : e === "End" ? I.end : H(n[e]) ? Math.max(I.start, Math.min(I.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var Wt = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var ra = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", zt = new URL("./", import.meta.url), Xt = "samish.public.preview.packet.v1", Jt = "samish.public.preview.preferences.v1", Qe = 9466848e5, Ne = 41024448e5, ye = 5 * 6e4, Zt = 2 * 1024 * 1024, x = (e) => document.getElementById(e), Le = Number.isFinite;
function Oe() {
  let e = x("number-strip"), t = x("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", Oe, { passive: !0 });
window.addEventListener("resize", Oe);
function gt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = x(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function ht(e, t, n = !1) {
  let a = x(e), r = x(`${e}-toggle`);
  if (!(!a || !r) && (a.open = t, gt(), Oe(), n)) {
    r.focus({ preventScroll: !0 });
    let i = x("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, s = r.getBoundingClientRect();
    (s.top < o + 8 || s.bottom > innerHeight - 8) && r.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), Oe();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), ht(t.dataset.helpTarget, !x(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), ht(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || x(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), ht(t.id, !1, !0));
});
gt();
var Yt = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, Qt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, L = () => {
  throw new Error("invalid_public_packet");
};
function E(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && L(), e;
}
function ne(e, t = !1, n = !1, a = !1, r = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !Le(e) || !n && e < 0 || a && !Number.isInteger(e) || e > r) && L();
}
function M(e, t = !1) {
  ne(e, t, !1, !0, Ne), e !== null && e < Qe && L();
}
function Ee(e) {
  typeof e != "boolean" && L();
}
function te(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && L();
}
function se(e, t, n) {
  (!Array.isArray(e) || e.length > t) && L(), e.forEach(n);
}
var ia = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], oa = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], la = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function pt(e, t = !1) {
  E(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), M(e.t, t), "cfs" in e && ne(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && Ee(e[n]);
  "approval" in e && te(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && te(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && te(e[n], la);
  "reason" in e && te(e.reason, ia, !0);
}
function je(e, t = !1) {
  e !== null && (E(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), M(e.t), ne(e.cfs, !0), t && M(e.eligibleT, !0));
}
function ca(e, t) {
  E(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), M(t.lastAttemptAt, !0), M(t.lastSuccessAt, !0), te(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (E(n, ["points", "exclusions", "coveredWindow"]), se(n.points, 4096, (a) => pt(a)), se(n.exclusions, 4096, (a) => pt(a, !0)), n.coveredWindow !== null)) {
      let a = E(n.coveredWindow, ["startT", "endT", "complete"]);
      M(a.startT), M(a.endT), (a.complete !== !0 || a.startT > a.endT) && L();
    }
    if (e === "noaa" && (E(n, ["issuedT", "points", "conflicts"]), M(n.issuedT), se(n.points, 1024, (a) => {
      E(a, ["t", "cfs"]), M(a.t), ne(a.cfs);
    }), se(n.conflicts, 1024, (a) => M(a))), e === "radar") {
      E(n, ["generatedT", "hours", "conflicts"]), M(n.generatedT);
      let a = (r) => {
        M(r), r % 36e5 && L();
      };
      se(n.hours, 256, (r) => {
        E(r, ["endT", "mm"]), a(r.endT), ne(r.mm, !0);
      }), se(n.conflicts, 256, a);
    }
    e === "grid" && (E(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), M(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && L(), se(n.periods, 1024, (a) => {
      E(a, ["startT", "endT", "mm"]), M(a.startT), M(a.endT), ne(a.mm, !0), a.endT <= a.startT && L();
    })), e === "tides" && (E(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && L(), se(n.points, 128, (a) => {
      E(a, ["t", "ft", "type"]), M(a.t), ne(a.ft, !1, !0), te(a.type, ["H", "L"]);
    }));
  }
}
function ua(e) {
  E(e, ["summary", "transitions"]);
  let t = E(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && L(), M(t.asOf), te(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && pt(t.actualCurrentObservation), M(t.supportObservationT, !0), t.event !== null) {
    let o = E(t.event, ["openedT", "high", "cycle"]);
    M(o.openedT), je(o.high);
    let s = E(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    ne(s.ordinal, !1, !1, !0, 1e5), M(s.openedT), je(s.high, !0), je(s.low), Ee(s.endingPending);
  }
  if (t.standing !== null) {
    let o = E(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    te(o.kind, ["downturn", "correction"]), te(o.state, ["possible_downturn", "rising_again"]), M(o.t), M(o.detectedAt), ne(o.cfs), Ee(o.active), je(o.supportingHigh), je(o.low);
  }
  let n = (o) => se(o, 16, (s) => te(s, oa)), a = E(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  te(a.status, ["available", "warming_up", "partial", "unavailable"]), Ee(a.newDownturnAvailable), Ee(a.aboveHighCorrectionAvailable), n(a.reasons);
  let r = E(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(r.blockingReasons), M(r.nextEligibleAt, !0);
  let i = E(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  M(i.lastSuccessfulPollAt, !0), ne(i.monitoringGapMs, !0, !1, !1, Ne), ne(i.observationAgeMs, !0, !1, !1, Ne), se(i.missingQuarterHours, 7, (o) => M(o)), Ee(i.clockTrusted), se(e.transitions, 32, (o) => {
    E(o, ["kind", "t", "cfs", "event", "detected_at"]), te(o.kind, ["downturn", "event_end"]), M(o.t), M(o.detected_at), ne(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && L();
  });
}
async function Kt(e) {
  E(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && L();
  let t = new TextEncoder().encode(e.payload);
  t.length > Zt && L(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && L();
  let a = JSON.parse(e.payload);
  E(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && L(), M(a.publishedAt);
  let r = E(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (r.schemaVersion !== 1 || typeof r.id != "string" || !/^[a-f0-9]{12}$/.test(r.id)) && L(), M(r.createdAt), a.publishedAt < r.createdAt && L();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return E(r.sources, i), i.forEach((o) => ca(o, r.sources[o])), ua(r.monitor), r.monitor.summary.asOf !== r.createdAt && L(), a;
}
var Ce = Yt(Jt) || {}, N = { range: ["day", "three", "full"].includes(Ce.range) ? Ce.range : "three", past: Ce.past === 48 ? 48 : 24, reference: Ce.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(Ce.theme) ? Ce.theme : null, cursorT: null };
N.theme && (document.documentElement.dataset.theme = N.theme);
var Y = null, Be = null, B = null, ft = !1, J = "waiting", pe = null, He = null, Ke = !0, ge = !1, le = Date.now(), et = () => Qt(Jt, { range: N.range, past: N.past, reference: N.reference, theme: N.theme });
function da() {
  let e = Date.now(), t = pe ? Math.max(0, performance.now() - pe.mono) : 0, n = pe ? pe.lower + t : null, a = pe ? pe.upper + t : null;
  le = Math.max(le, e, a ?? 0, Y?.snapshot.createdAt ?? 0);
  let r = Ke || !pe || e < n - ye || e > a + ye || e + ye < le || Y && Y.snapshot.createdAt > a + ye;
  return { now: le, uncertain: r };
}
function en() {
  return He ? He.now + Math.max(0, performance.now() - He.mono) : 0;
}
function fa() {
  Be && Qt(Xt, { packet: Be, greatestNow: le, trustedNow: en(), savedDeviceMs: Date.now(), ended: ge });
}
function Vt(e) {
  let t = x("connection");
  if (!Y) {
    t.textContent = ge ? "Preview ended. No current readings are provided." : J === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - Y.snapshot.createdAt), a = J !== "checked";
  if (!ge && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${X(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [ge ? "Preview ended. Earlier readings are retained for reference." : a ? J === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : J === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current monitoring is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${F(Y.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${X(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current direction and monitoring availability are withheld." : ""].join(" "), t.className = "connection attention";
}
function ce() {
  let e = da();
  if (!Y) {
    Vt(e);
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((c) => c.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((c) => [...x(c).querySelectorAll("details:not(.section-help)")].flatMap((p, h) => p.open ? [`${c}:${h}`] : [])), r = Y.snapshot, i = e.uncertain ? r.createdAt : e.now;
  B = Lt({ nowMs: i, sources: r.sources, ratioTable: Wt });
  let o = ge || e.uncertain || J !== "checked" || e.now - r.createdAt > 12 * 6e4;
  B.timeUncertain = e.uncertain, e.uncertain && (B.forecast.freshContext = !1, B.forecast.higherLater = { ...B.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let s = r.monitor.summary, l = !Le(s.supportObservationT) || i - s.supportObservationT > 60 * 6e4;
  o && (B.gauge.direction = { ...B.gauge.direction, available: !1, reason: { code: ge ? "preview_ended" : e.uncertain ? "public_time_uncertain" : J !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" } });
  let u = r;
  if (o || l || !s.support.clockTrusted) {
    let c = [...s.capability.reasons, ...l ? [Le(s.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...s.support.clockTrusted ? [] : ["clock_uncertain"]];
    u = { ...r, monitor: { ...r.monitor, summary: { ...s, capability: { ...s.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: c }, preparation: { ...s.preparation, nextEligibleAt: null } } } };
  }
  Ft(u, B, e.uncertain ? null : { lastCommitAt: r.createdAt, workerStale: e.now - r.createdAt > 12 * 6e4 }, N, i, { publicView: !0 });
  for (let c of x("forecast-details").querySelectorAll("a")) c.getAttribute("href") === "/data/ratio_table.json" && (c.href = new URL("ratio_table.json", zt).href, c.textContent = "View the frozen historical-case table");
  a.forEach((c) => {
    let [p, h] = c.split(":"), d = x(p).querySelectorAll("details:not(.section-help)")[Number(h)];
    d && (d.open = !0);
  }), gt(n), document.querySelectorAll("[data-range]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.range === N.range))), x("past").value = String(N.past), x("reference").value = N.reference, ke(x("chart"), B, N), Vt(e), Oe(), fa(), t && x(t) && document.activeElement?.id !== t && x(t).focus({ preventScroll: !0 });
}
async function tn(e, t = Zt * 2) {
  let n = new AbortController(), a = setTimeout(() => n.abort(), 18e3);
  try {
    let r = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!r.ok) throw new Error("unavailable");
    let i = await r.text();
    return new TextEncoder().encode(i).length > t && L(), { response: r, value: JSON.parse(i) };
  } finally {
    clearTimeout(a);
  }
}
async function ha() {
  let e = new URL("version.json", zt);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await tn(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && L(), ge = n.state === "ended";
  let a = t.headers.get("Date"), r = t.headers.get("Age"), i = Date.parse(a || "");
  if (!Le(i) || i < Qe || i > Ne || r === null || !/^\d+$/.test(r)) throw new Error("time_unavailable");
  let o = Number(r);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let s = i + o * 1e3, l = Date.now();
  l >= i - ye && l <= s + ye && s - l <= ye && (le = Math.max(s, l, en(), Y?.snapshot.createdAt ?? 0), He = { now: le, mono: performance.now() }), pe = { lower: i, upper: s, mono: performance.now() }, Ke = !1;
}
function pa(e, t) {
  if (Y) {
    let n = Y.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      J = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && L(), J = "checked";
      return;
    }
  }
  Y = e, Be = t, J = "checked";
}
async function Re() {
  if (!ft) {
    ft = !0, x("refresh").disabled = !0;
    try {
      let e = new URL(ra);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([ha(), tn(e)]);
      if (t[0].status === "rejected" && (Ke = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          pa(await Kt(n), n);
        } catch {
          J = "invalid";
        }
      else J = "offline";
      ce();
    } finally {
      ft = !1, x("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  N.range = e.dataset.range, N.cursorT = null, et(), ce();
}));
x("past").addEventListener("change", () => {
  N.past = Number(x("past").value), et(), ce();
});
x("reference").addEventListener("change", () => {
  N.reference = x("reference").value, et(), ce();
});
x("theme").addEventListener("click", () => {
  let e = N.theme ? N.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  N.theme = e ? "light" : "dark", document.documentElement.dataset.theme = N.theme, et();
});
x("refresh").addEventListener("click", Re);
x("chart").addEventListener("pointerdown", (e) => {
  N.cursorT = Ht(e), B && ke(x("chart"), B, N);
});
x("chart-cursor").addEventListener("input", () => {
  N.cursorT = dt(), B && ke(x("chart"), B, N);
});
x("chart-cursor").addEventListener("keydown", (e) => {
  let t = Bt(e.key);
  t !== null && (e.preventDefault(), N.cursorT = t, B && ke(x("chart"), B, N));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (J = "waiting", ce(), Re());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (J = "waiting", ce(), Re());
});
window.addEventListener("offline", () => {
  J = "offline", Ke = !0, ce();
});
window.addEventListener("online", Re);
var Gt = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== Gt && (Gt = t, B && ke(x("chart"), B, N), Oe());
}).observe(x("chart"));
async function ga() {
  let e = Yt(Xt);
  if (e?.packet)
    try {
      Y = await Kt(e.packet), Be = e.packet, Le(e.greatestNow) && e.greatestNow >= Qe && e.greatestNow <= Ne && (le = Math.max(le, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), Le(e.trustedNow) && e.trustedNow >= Qe && e.trustedNow <= Ne && (He = { now: e.trustedNow, mono: performance.now() }), ge = e.ended === !0, J = "offline", ce();
    } catch {
      Y = null, Be = null;
    }
  await Re(), setInterval(() => {
    document.hidden || Re();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || ce();
  }, 3e4);
}
ga();
export {
  Lt as buildWatchModel,
  Kt as verifyPublicPacket
};
