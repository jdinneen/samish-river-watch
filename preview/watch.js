// site/js/season.js
var hn = "America/Los_Angeles";
var et = null;
function pn() {
  return et === null && (et = new Intl.DateTimeFormat("en-US", {
    timeZone: hn,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), et;
}
function oe(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of pn().formatToParts(new Date(e)))
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
function mt(e) {
  let t = oe(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function bt(e, t, n, a = 0, r = 0) {
  let o = Date.UTC(e, t - 1, n, a, r), i = o - mt(o);
  return o - mt(i);
}
function vt(e) {
  let t = oe(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var gn = 3600 * 1e3, mn = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function bn(e, t) {
  for (let n = 0; n < e.length; n++) {
    let a = e[n], r = n === e.length - 1;
    if (t >= a.lead_lo_h && (t < a.lead_hi_h || r && t === a.lead_hi_h)) return a;
  }
  return null;
}
function vn(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : mn).includes(oe(t).month);
}
var ve = (e) => typeof e == "number" && Number.isFinite(e);
function _n(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!ve(e.rise_floor_cfs) || !ve(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!ve(t.lead_lo_h) || !ve(t.lead_hi_h) || !ve(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !ve(a.low_factor) || !ve(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function _t(e, t, n, a = t.t) {
  let r = [], o = [], i = vn(n, a);
  if (!i || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: r, low: o, wetSeason: i };
  _n(n);
  let s = n.bins, l = s[s.length - 1].lead_hi_h;
  for (let c of e) {
    let u = (c.t - t.t) / gn;
    if (u <= 0 || u > l) continue;
    let h = bn(s, u);
    if (!h) continue;
    let d, p;
    if (c.cfs >= n.storm_flow_cfs) {
      let f = c.cfs - t.cfs >= n.rise_floor_cfs ? h.rise : h.flat;
      d = c.cfs * f.high_factor, p = c.cfs * f.low_factor;
    } else
      d = c.cfs + h.add_cfs, p = c.cfs - h.add_cfs;
    r.push({ t: c.t, cfs: Math.max(d, c.cfs) }), o.push({ t: c.t, cfs: Math.max(0, Math.min(p, c.cfs)) });
  }
  return { high: r, low: o, wetSeason: i };
}

// site/js/watch-model.js
var xe = 6e4, R = 60 * xe, M = 24 * R, he = 30 * xe, Te = 6 * R, Ae = 15 * xe, wn = [2, 4, 6, 8, 12, 18, 24], L = (e) => typeof e == "number" && Number.isFinite(e), A = (e) => L(e) && Math.abs(e) <= 864e13, m = (e, t = {}) => ({ code: e, details: t }), Se = (e, t) => A(t) ? Math.max(0, e - t) : null, yn = (e, t) => Object.prototype.hasOwnProperty.call(e, t), ze = (e) => ({ t: e.t, cfs: e.cfs }), Z = (e) => e && e.usable !== !1 && L(e.cfs) && e.cfs >= 0;
function Re(e, t) {
  let n = (s) => {
    let [l, c = "0"] = String(s).toLowerCase().split("e"), u = l.includes(".") ? l.length - l.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(l.replace(".", "")), exponent: Number(c) - u };
  }, a = n(e), r = n(t), o = Math.min(a.exponent, r.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - o) - r.coefficient * 10n ** BigInt(r.exponent - o)}e${o}`;
}
function wt(e) {
  let t = L(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : yn(e, "qualifier"), r = {
    t: e.t,
    cfs: t ? e.cfs : null,
    approval: e.approval ?? null,
    qualifierAvailable: a,
    qualityLabel: e.qualityLabel ?? (a ? "Quality metadata supplied" : "Quality flags unavailable"),
    eligible: e.eligible === !0 && n && a,
    usable: n,
    reason: n ? null : typeof e.reason == "object" && e.reason ? e.reason : m(typeof e.reason == "string" ? e.reason : "unusable_observation")
  };
  return a && (r.qualifier = e.qualifier), r;
}
function $t(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !A(n.t)) continue;
    let a = wt(n), r = t.get(n.t);
    r ? JSON.stringify(r) !== JSON.stringify(a) && t.set(n.t, wt({
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
function Ie(e, t) {
  let n = 0, a = e.length;
  for (; n < a; ) {
    let r = n + a >>> 1;
    e[r].t < t ? n = r + 1 : a = r;
  }
  return n;
}
function xt(e, t) {
  let n = Ie(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function qe(e, t, n = Ae) {
  let { before: a, after: r } = xt(e, t), o = r?.t === t ? r : a && (!r || t - a.t <= r.t - t) ? a : r;
  return o && Math.abs(o.t - t) <= n ? o : null;
}
function de(e) {
  if (!A(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return vt(e);
}
function At(e, t) {
  let n = A(t) ? e[Ie(e, t)] : null, a = A(t) ? t - M : null, r = A(a) ? xt(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: m("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: A(t) ? de(t) : null,
    distanceCfs: null,
    reached: null,
    ...r
  };
}
function St(e, t) {
  let n = Re(e.current.cfs, t.cfs), a = L(n) ? Re(e.referenceCfs, n) : null;
  return !L(n) || !L(a) ? { ...e, comparison: t, reason: m("non_finite_arithmetic") } : {
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
function tt(e, t) {
  let n = At(e, t);
  if (!Z(n.current))
    return { ...n, reason: m(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = qe(e, n.targetT);
  return a ? Z(a) ? St(n, a) : { ...n, comparison: a, reason: m("comparison_unusable") } : { ...n, reason: m("comparison_missing", { toleranceMs: Ae }) };
}
function nt(e, t) {
  let n = At(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: A(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!Z(a.current)) return { ...a, reason: m(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let r = qe(e, a.targetT);
  if (!r) return { ...a, reason: m("window_start_missing", { toleranceMs: Ae }) };
  if (!Z(r)) return { ...a, startSupport: r, reason: m("window_start_unusable") };
  let o = e.slice(Ie(e, a.targetT), Ie(e, t) + 1), i = o.find((u) => !Z(u));
  if (i) return { ...a, startSupport: r, reason: m("window_unusable_observation", { t: i.t }) };
  let s = r.t < a.targetT ? [r, ...o] : o, l = 0;
  for (let u = 1; u < s.length; u++) l = Math.max(l, s[u].t - s[u - 1].t);
  if (l > he) return {
    ...a,
    startSupport: r,
    maxGapMs: l,
    reason: m("observation_gap", { maxGapMs: l, allowedMs: he })
  };
  let c = o.reduce((u, h) => !u || h.cfs < u.cfs ? h : u, null);
  return c ? {
    ...St(a, c),
    minimum: c,
    startSupport: r,
    maxGapMs: l,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: r, maxGapMs: l, reason: m("window_empty") };
}
function Ge(e, t, n = !1) {
  let a = [], r = [], o = [], i = [];
  for (let s of e) {
    if (!Z(s) || n && s.cfs <= 0) {
      r.length && a.push(r), r = [], i.push({ t: s.t, reason: n && s.cfs <= 0 ? "non_positive_flow" : s.reason?.code ?? "unusable_observation" });
      continue;
    }
    let l = r[r.length - 1];
    l && s.t - l.t > t && (o.push({ startT: l.t, endT: s.t, reason: "unsupported_gap" }), a.push(r), r = []), r.push(ze(s));
  }
  return r.length && a.push(r), { segments: a, gaps: o, exclusions: i };
}
function te(e = "path_unavailable") {
  return {
    available: !1,
    reason: typeof e == "string" ? m(e) : e,
    points: [],
    segments: [],
    startT: null,
    endT: null,
    gaps: [],
    exclusions: []
  };
}
function fe(e, t = {}) {
  let n = e.filter((r) => r.length).map((r) => r.map(ze)), a = n.flat();
  return {
    available: a.length > 0,
    reason: a.length ? null : m("path_unavailable"),
    points: a,
    segments: n,
    startT: a[0]?.t ?? null,
    endT: a[a.length - 1]?.t ?? null,
    gaps: [],
    exclusions: [],
    ...t
  };
}
function Mt(e, t = Te, n = !1) {
  let a = Ge(e, t, n);
  return fe(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function _e(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Ie(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let r = e[n - 1], o = (t - r.t) / (a.t - r.t), i = (1 - o) * r.cfs + o * a.cfs;
  return L(i) ? i : null;
}
function Ue(e, t) {
  for (let n of e.segments) {
    let a = _e(n, t);
    if (a !== null) return a;
  }
  return null;
}
function st(e, t, n) {
  let a = [];
  for (let r of e.segments) {
    let o = Math.max(t, r[0].t), i = Math.min(n, r[r.length - 1].t);
    if (o > i) continue;
    let s = [
      { t: o, cfs: _e(r, o) },
      ...r.filter((l) => l.t > o && l.t < i),
      ...i > o ? [{ t: i, cfs: _e(r, i) }] : []
    ];
    a.push(s);
  }
  return fe(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function Oe(e, t, n, a) {
  let r = Se(n, t);
  return {
    available: !!e?.data,
    dataT: A(t) ? t : null,
    ageMs: r,
    stale: r === null || r > a,
    lastAttemptAt: A(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: A(e?.lastSuccessAt) ? e.lastSuccessAt : null,
    error: e?.error ?? null,
    url: e?.url ?? null,
    rawRefs: e?.rawRefs ?? [],
    reasons: [
      ...e?.data ? [] : [m("source_unavailable")],
      ...e?.error ? [m("source_fetch_failed")] : [],
      ...r !== null && r > a ? [m("source_stale", { ageMs: r, maxAgeMs: a })] : []
    ]
  };
}
function Tn(e, t, n, a) {
  let r = {
    available: !1,
    reason: m("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * xe)
  };
  if (!Z(t)) return { ...r, reason: m("current_observation_unusable") };
  let o = qe(e, t.t - R);
  if (!Z(o)) return { ...r, comparison: o, reason: m("direction_comparison_unavailable") };
  let i = Re(t.cfs, o.cfs), s = Math.max(1, 0.01 * Math.max(t.cfs, o.cfs)), l = { ...r, comparison: o, elapsedMs: t.t - o.t, changeCfs: i, toleranceCfs: s };
  if (!L(i)) return { ...l, changeCfs: null, reason: m("non_finite_arithmetic") };
  if (n - t.t > 2 * R) return { ...l, reason: m("gauge_stale") };
  if (a?.error) return { ...l, reason: m("source_fetch_failed") };
  let c = e.filter((u) => u.t >= o.t && u.t <= t.t);
  return c.some((u) => !Z(u)) || c.some((u, h) => h && u.t - c[h - 1].t > he) ? { ...l, reason: m("direction_observation_gap") } : {
    ...l,
    available: !0,
    reason: null,
    label: Math.abs(i) <= s ? "roughly_level" : i > 0 ? "rising" : "falling"
  };
}
function yt(e, t, n) {
  let a = A(t) ? t - 7 * M : null, r = {
    windowStartT: a,
    windowEndT: A(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!A(t)) return r;
  for (let i of e) {
    if (i.t < a || i.t > t) continue;
    let s = n(e, i.t);
    s.available ? (r.evaluatedCount++, r.coverageStartT ?? (r.coverageStartT = i.t), r.coverageEndT = i.t, s.reached && (r.last = s)) : r.unavailableCount++;
  }
  let o = e.filter((i) => i.t >= a && i.t <= t);
  return r.coverageComplete = r.coverageStartT !== null && r.coverageStartT <= a + Ae && r.coverageEndT >= t - he && r.unavailableCount === 0 && !o.some((i, s) => s && i.t - o[s - 1].t > he), r;
}
function Tt(e, t, n) {
  if (!A(t)) return { ...te("observations_unavailable"), steps: [] };
  let a = [], r = [], o = [], i = [], s = null;
  for (let l of e) {
    if (l.t < t - 2 * M) continue;
    let c = n(e, l.t), u = c.comparison?.cfs;
    if (!c.available || !L(u + c.referenceCfs)) {
      i.length && a.push(i), i = [], s = null;
      continue;
    }
    if (s && l.t - s.t > he && (o.push({ startT: s.t, endT: l.t, reason: "unsupported_gap" }), i.length && a.push(i), i = [], s = null), s) for (let d of rt(s.t, l.t)) {
      let p = (d - s.t) / (l.t - s.t), f = (1 - p) * s.base + p * u, b = f + de(d - 1), O = f + de(d);
      i.push({ t: d, cfs: b }), a.push(i), i = [{ t: d, cfs: O }], r.push({ t: d, beforeCfs: b, afterCfs: O });
    }
    let h = { t: l.t, cfs: u + c.referenceCfs };
    i.at(-1)?.t !== l.t && i.push(h), s = { t: l.t, base: u };
  }
  return i.length && a.push(i), { ...fe(a, { gaps: o }), steps: r };
}
function at(e, t = "forecast_unavailable") {
  let n = () => te(t), a = () => ({ endpoint: $e(t), low: $e(t) });
  return {
    available: !1,
    reason: m(t),
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
    higherLater: { available: !1, reason: m(t), aboveCurrent: null, peakCfs: null, peakT: null, largeAdjustment: !1 },
    cases: {
      available: !1,
      reason: m(t),
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(oe(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function $e(e = "path_unavailable", t = !1) {
  return {
    available: !1,
    reason: typeof e == "string" ? m(e) : e,
    t: null,
    currentCfs: null,
    comparisonCfs: null,
    changeCfs: null,
    referenceCfs: null,
    alreadyReached: !1,
    largeAdjustment: t
  };
}
function rt(e, t) {
  if (!A(e) || !A(t) || e >= t) return [];
  let n = oe(e), a = oe(t), r = [];
  for (let o = n.year; o <= a.year; o++)
    for (let i of [3, 5, 11]) {
      let s = bt(o, i, 1);
      s > e && s <= t && r.push(s);
    }
  return r.sort((o, i) => o - i);
}
function $n(e, t, n) {
  let a = st(e, n.t - 2 * M, n.t), r = st(t, n.t, t.endT ?? n.t), o = a.segments.map((i) => [...i]);
  for (let i of r.segments) {
    let s = i.filter((u) => u.t > n.t);
    if (!s.length) continue;
    let l = o[o.length - 1];
    i[0].t === n.t && l?.[l.length - 1].t === n.t ? l.push(...s) : o.push(s);
  }
  return fe(o);
}
function kt(e, t) {
  let n = t - M, a = Ue(e, t);
  if (a === null) return null;
  let r = Ue(e, n);
  if (r === null) return null;
  let o = e.segments.find((s) => s[0].t <= n && s[s.length - 1].t >= t), i = null;
  if (o) {
    i = r;
    for (let s of o) s.t > n && s.t <= t && (i = Math.min(i, s.cfs));
    i = Math.min(i, a);
  }
  return { current: a, endpoint: r, low: i };
}
function xn(e, t, n, a, r, o) {
  let i = Ue(t, r);
  if (i === null) return null;
  let s = r - M;
  if (s > a.t) {
    let f = kt(e, r);
    return f && f[o] !== null ? { current: i, base: f[o] } : null;
  }
  if (o === "endpoint") {
    let f = qe(n, s);
    return Z(f) ? { current: i, base: f.cfs, comparisonT: f.t } : null;
  }
  let l = qe(n, s);
  if (!Z(l)) return null;
  let c = n.filter((f) => f.t >= s && f.t <= a.t), u = l.t < s ? [l, ...c] : c;
  if (!c.length || c.some((f) => !Z(f)) || u.some((f, b) => b && f.t - u[b - 1].t > he)) return null;
  let h = t.segments.find((f) => f[0].t <= a.t && f[f.length - 1].t >= r);
  if (!h) return null;
  let d = i, p = null;
  for (let f of c) f.cfs <= d && (d = f.cfs, p = f.t);
  for (let f of h) f.t > a.t && f.t <= r && f.cfs < d && (d = f.cfs, p = null);
  return { current: i, base: d, minimumObservedT: p };
}
function An(e, t, n, a, r) {
  let o = [], i = (s) => {
    s > n && s <= a && o.push(s);
  };
  if (r === "endpoint") {
    for (let s = 1; s < e.length; s++)
      i(Math.floor((e[s - 1].t + e[s].t) / 2) + M + 1);
    for (let s of e)
      i(s.t - Ae + M), i(s.t + Ae + M + 1);
  } else for (let s of e) i(s.t + M + 1);
  return o.filter((s) => s - M <= t.t);
}
function Sn(e, t, n, a, r = []) {
  let o = /* @__PURE__ */ new Set([t, n]);
  for (let s of e.points)
    for (let l of [s.t, s.t + M]) l >= t && l <= n && o.add(l);
  for (let s of rt(t, n))
    o.add(s), s - 1 >= t && o.add(s - 1);
  for (let s of r)
    o.add(s), s - 1 >= t && o.add(s - 1);
  let i = [...o].sort((s, l) => s - l);
  for (let s = 1; s < i.length; s++) {
    let l = i[s - 1], c = i[s], u = (l + c) / 2, h = kt(e, u);
    if (!h || a === "low" && h.low === null) {
      o.add(u);
      continue;
    }
    if (a !== "low") continue;
    let d = e.segments.find((b) => b[0].t <= u - M && b[b.length - 1].t >= u);
    if (!d) continue;
    let p = 1 / 0;
    for (let b of d) b.t > u - M && b.t < u && (p = Math.min(p, b.cfs));
    let f = [
      [_e(d, l - M), _e(d, c - M)],
      [_e(d, l), _e(d, c)],
      ...L(p) ? [[p, p]] : []
    ].filter((b) => b.every(L));
    for (let b = 0; b < f.length; b++) for (let O = b + 1; O < f.length; O++) {
      let q = f[b][0] - f[O][0], g = f[b][1] - f[O][1];
      if (!L(q) || !L(g) || q === g) continue;
      let $ = q / (q - g);
      $ > 0 && $ < 1 && o.add(l + $ * (c - l));
    }
  }
  return [...o].sort((s, l) => s - l);
}
function Mn(e, t, n, a, r, o) {
  if (!t.available) return { reference: { ...te(t.reason), steps: [] }, crossing: $e(t.reason, r) };
  let i = $n(e, t, n), s = t.endT, l = n.t, c = An(o, n, l, s, a), u = Sn(i, l, s, a, c), h = /* @__PURE__ */ new Set([...rt(l, s), ...c]), d = [], p = [], f = [], b = $e("comparison_coverage_missing", r), O = 0, q = !1, g = null, $ = (x) => {
    if (Ue(t, x) === null) return null;
    let w = xn(i, t, o, n, x, a), y = w?.base;
    if (!w || y === null || !L(y)) return null;
    let H = de(x), D = y + H, j = Re(w.current, y);
    return L(D) && L(j) ? {
      t: x,
      current: w.current,
      base: y,
      line: D,
      delta: j,
      threshold: H,
      comparisonT: w.comparisonT ?? null,
      minimumObservedT: w.minimumObservedT ?? null
    } : null;
  };
  for (let x of u) {
    let w = $(x);
    if (!w) {
      b.t === null && (q = !0), f.length && d.push(f), f = [], g = null;
      continue;
    }
    if (O++, h.has(x)) {
      let y = $(x - 1), H = de(x - 1) !== w.threshold, D = y && y.base !== w.base && (a === "endpoint" ? y.comparisonT !== w.comparisonT : y.minimumObservedT !== null && y.minimumObservedT + M + 1 === x);
      if (y && f.length && (H || D)) {
        let j = D ? y.line : w.base + de(x - 1);
        f.push({ t: x, cfs: j }), d.push(f), f = [], j !== w.line && p.push({ t: x, beforeCfs: j, afterCfs: w.line });
      }
    }
    if (f.push({ t: x, cfs: w.line }), b.t === null && w.delta >= w.threshold && !q) {
      let y = w;
      if (g && g.delta < g.threshold && !h.has(x) && de(g.t) === w.threshold) {
        let H = g.t, D = x;
        for (; D - H > 1; ) {
          let j = Math.floor((D + H) / 2), K = $(j);
          !K || K.delta < K.threshold ? H = j : D = j;
        }
        y = $(D) ?? w;
      }
      b = {
        available: !0,
        reason: null,
        t: y.t,
        currentCfs: y.current,
        comparisonCfs: y.base,
        changeCfs: y.delta,
        referenceCfs: y.threshold,
        alreadyReached: y.t === n.t,
        largeAdjustment: r
      };
    }
    g = w;
  }
  f.length && d.push(f), b.t === null && O && !q ? b = { ...$e(null, r), available: !0, reason: null } : b.t === null && q && (b = $e("comparison_coverage_missing", r));
  let U = d.map((x) => {
    let w = [];
    for (let y of x)
      w.length >= 2 && w.at(-2).cfs === w.at(-1).cfs && w.at(-1).cfs === y.cfs && w.pop(), w.push(y);
    return w;
  });
  return { reference: { ...fe(U), steps: p }, crossing: b };
}
function kn(e, t) {
  let n = [e, t];
  for (let r = e + xe; r < t; r += xe) n.push(r);
  let a = n.map((r) => {
    let o = oe(r);
    return o.hour >= 8 && (o.hour < 17 || o.hour === 17 && o.minute === 0 && o.second === 0);
  });
  return a.every(Boolean) ? "inside_08_17" : a.every((r) => !r) ? "outside_08_17" : "spans_both";
}
function Cn(e, t) {
  let n = [];
  for (let a of e.segments) {
    let r = 0;
    for (; r < a.length; ) {
      let o = r;
      for (; o + 1 < a.length && a[o + 1].cfs === a[r].cfs; ) o++;
      let i = a[r - 1], s = a[o + 1];
      if (i && s && i.cfs < a[r].cfs && s.cfs < a[o].cfs && a[o].t > t) {
        let l = r - 1;
        for (; l > 0 && a[l - 1].cfs <= a[l].cfs; ) l--;
        let c = ze(a[l]);
        n.push({
          startT: a[r].t,
          endT: a[o].t,
          cfs: a[r].cfs,
          precedingLow: c,
          riseCfs: a[r].cfs - c.cfs,
          bracketStartT: i.t,
          bracketEndT: s.t,
          clockRange: kn(i.t, s.t)
        });
      }
      r = o + 1;
    }
  }
  return n.sort((a, r) => a.startT - r.startT);
}
function En(e, t, n, a, r, o, i) {
  let s = at(e), l = t?.data;
  if (!l) return s;
  let c = l.issuedT;
  s.issuedT = A(c) ? c : null, s.issueAgeMs = Se(e, c), s.older = s.issueAgeMs !== null && s.issueAgeMs > 12 * R, s.cases.tableVersion = i?.version ?? null, s.cases.trainingCutoff = i?.training_cutoff_utc ?? null;
  let u = (g) => ({
    ...at(e, g),
    issuedT: s.issuedT,
    issueAgeMs: s.issueAgeMs,
    older: s.older,
    cases: { ...s.cases, reason: m(g) }
  });
  if (!A(c)) return u("forecast_issue_missing");
  if (c > e) return u("forecast_issue_future");
  if (e - c > 48 * R) return u("forecast_issue_too_old");
  let h = $t(l.points).filter((g) => g.t <= e + 10 * M), d = Mt(h, Te);
  if (!d.segments.some((g) => g[0].t <= e + Te && g[g.length - 1].t >= e + M))
    return u("forecast_next_day_coverage_missing");
  if (s.available = d.available, s.reason = d.reason, s.raw = d, s.crests = Cn(d, o?.t ?? e), s.nextCrest = s.crests[0] ?? null, s.laterHigherCrests = s.nextCrest ? s.crests.slice(1).filter((g) => g.cfs > s.nextCrest.cfs) : [], !Z(o))
    return s.shifted = te("current_observation_unusable"), s.higherLater.reason = m("current_observation_unusable"), s;
  let p = Ue(d, o.t);
  if (p === null) {
    let g = at(e, "forecast_alignment_unsupported");
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
  let f = Re(o.cfs, p);
  if (!L(f)) return u("non_finite_arithmetic");
  s.offsetCfs = f, s.largeAdjustment = Math.abs(f) > Math.max(10, 0.1 * o.cfs);
  let b = [], O = [];
  for (let g of d.segments) {
    let $ = g.map((x) => ({ t: x.t, cfs: x.cfs + f })), U = Ge($, Te, !0);
    b.push(...U.segments), O.push(...U.exclusions);
  }
  s.shifted = st(fe(b, { gaps: d.gaps, exclusions: O }), o.t, o.t + 72 * R), s.shifted.points.some((g) => g.t > o.t) || (s.shifted = { ...te("non_positive_shifted_flow"), exclusions: O, gaps: d.gaps }), s.freshContext = !s.older && !t.error && !n?.error && e - o.t <= 2 * R, s.higherLater = {
    available: !1,
    reason: m("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: s.largeAdjustment
  };
  let q = s.shifted.points.filter((g) => g.t > o.t);
  if (s.freshContext && q.length) {
    let g = q.reduce(($, U) => U.cfs > $.cfs ? U : $);
    s.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: g.cfs > o.cfs,
      peakCfs: g.cfs,
      peakT: g.t,
      largeAdjustment: s.largeAdjustment
    };
  }
  if (s.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(oe(e).month), !s.cases.wetSeason)
    s.cases.reason = m("historical_cases_off_season"), s.high = te(s.cases.reason), s.low = te(s.cases.reason);
  else if (!i || i.version !== 3 || i.apply_to !== "flow" || !Array.isArray(i.bins) || !i.bins.length)
    s.cases.reason = m("historical_table_unavailable"), s.high = te(s.cases.reason), s.low = te(s.cases.reason);
  else
    try {
      let g = [], $ = [], U = [], x = [];
      for (let w of s.shifted.segments) {
        let y = _t(w, o, i, e), H = w[0]?.t === o.t && o.cfs > 0 ? [ze(o)] : [], D = Ge([...H, ...y.high], Te, !0), j = Ge([...H, ...y.low], Te, !0);
        g.push(...D.segments), $.push(...j.segments), U.push(...D.exclusions), x.push(...j.exclusions);
      }
      s.high = fe(g, { gaps: s.shifted.gaps, exclusions: U }), s.low = fe($, { gaps: s.shifted.gaps, exclusions: x });
      for (let w of ["high", "low"]) s[w].points.some((y) => y.t > o.t) || (s[w] = { ...te("historical_case_values_unsupported"), exclusions: s[w].exclusions, gaps: s[w].gaps });
      s.cases.available = s.high.available || s.low.available, s.cases.reason = s.cases.available ? null : m("historical_case_values_unsupported");
    } catch {
      s.cases.reason = m("historical_table_invalid"), s.high = te(s.cases.reason), s.low = te(s.cases.reason);
    }
  for (let g of ["shifted", "high", "low"])
    for (let $ of ["endpoint", "low"]) {
      let U = Mn(r, s[g], o, $, s.largeAdjustment, a);
      s.crossings[g][$] = U.crossing, g === "shifted" && (s.references[$] = U.reference);
    }
  return s;
}
function Nn(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
  for (let u of n?.conflicts ?? []) A(u) && u <= e && u % R === 0 && r.add(u);
  for (let u of n?.hours ?? [])
    if (!(!A(u.endT) || u.endT > e || u.endT % R !== 0)) {
      if (!L(u.mm) || u.mm < 0) {
        r.add(u.endT);
        continue;
      }
      a.has(u.endT) && a.get(u.endT) !== u.mm ? r.add(u.endT) : a.set(u.endT, u.mm);
    }
  let o = [...a.keys(), ...r], i = o.length ? Math.max(...o) : null, s = Se(e, i), l = wn.map((u) => {
    let h = {
      hours: u,
      available: !1,
      reason: m("radar_unavailable"),
      startT: i === null ? null : i - u * R,
      endT: i,
      ageMs: s,
      mm: null,
      inches: null
    };
    if (i === null) return h;
    let d = 0;
    for (let p = 0; p < u; p++) {
      let f = i - p * R;
      if (r.has(f)) return { ...h, reason: m("radar_conflicting_hour", { endT: f }) };
      if (!a.has(f)) return { ...h, reason: m("radar_missing_hour", { endT: f }) };
      d += a.get(f);
    }
    return L(d) ? { ...h, available: !0, reason: null, mm: d, inches: d / 25.4 } : { ...h, reason: m("non_finite_arithmetic") };
  }), c = l.some((u) => u.available);
  return {
    available: c,
    reason: c ? null : m("radar_windows_unavailable"),
    endT: i,
    generatedT: A(n?.generatedT) ? n.generatedT : null,
    ageMs: s,
    historical: s !== null && s > 2 * R,
    stale: s === null || s > 3 * R,
    windows: l
  };
}
function Ln(e, t) {
  let n = t?.data, a = Se(e, n?.updatedT), r = {
    available: !1,
    reason: m("grid_forecast_unavailable"),
    startT: e,
    endT: e + M,
    updatedT: A(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * R,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return r;
  if (!A(n.updatedT) || n.updatedT > e) return { ...r, reason: m("grid_issue_invalid") };
  let o = (n.periods ?? []).filter((c) => A(c.startT) && A(c.endT) && c.endT > e && c.startT < e + M).sort((c, u) => c.startT - u.startT || c.endT - u.endT), i = e, s = 0, l = !1;
  for (let c of o) {
    if (c.startT >= c.endT || !L(c.mm) || c.mm < 0) return { ...r, reason: m("grid_interval_invalid") };
    let u = Math.max(e, c.startT), h = Math.min(e + M, c.endT);
    if (u < i) return { ...r, reason: m("grid_interval_overlap", { t: u }) };
    if (u > i) return { ...r, reason: m("grid_interval_gap", { startT: i, endT: u }) };
    let d = (h - u) / (c.endT - c.startT);
    s += c.mm * d, l || (l = d !== 1), i = h;
  }
  return i < e + M ? { ...r, reason: m("grid_interval_gap", { startT: i, endT: e + M }) } : L(s) ? { ...r, available: !0, reason: null, mm: s, inches: s / 25.4, prorated: l } : { ...r, reason: m("non_finite_arithmetic") };
}
function On(e, t) {
  let n = t?.data, a = Se(e, t?.lastSuccessAt), r = {
    available: !1,
    reason: m("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * R,
    startT: e,
    endT: e + 2 * M,
    events: []
  };
  if (!n) return r;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...r, reason: m("tide_identity_or_datum_invalid") };
  let o = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set();
  for (let l of n.points ?? []) {
    if (!A(l.t) || l.t < e || l.t > e + 2 * M || !L(l.ft) || !["H", "L"].includes(l.type)) continue;
    let c = o.get(l.t);
    c && (c.ft !== l.ft || c.type !== l.type) && i.add(l.t), o.set(l.t, { t: l.t, ft: l.ft, type: l.type });
  }
  let s = [...o.values()].filter((l) => !i.has(l.t)).sort((l, c) => l.t - c.t);
  return { ...r, available: s.length > 0, reason: s.length ? null : m("tide_events_unavailable"), events: s };
}
function Ct({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!A(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, r = $t(a?.points).filter((b) => b.t <= e), o = r[r.length - 1] ?? null, i = [...r].reverse().find((b) => Z(b)) ?? null, s = Mt(r, he), l = o?.t ?? null, c = Oe(t.gauge, l, e, 2 * R), u = {
    latest: o,
    lastNumericObservation: i,
    points: r,
    segments: s.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: Se(e, l),
    stale: c.stale,
    referenceCfs: A(l) ? de(l) : null,
    endpoint: tt(r, l),
    low: nt(r, l),
    references: { endpoint: Tt(r, l, tt), low: Tt(r, l, nt) },
    direction: Tn(r, o, e, t.gauge),
    history: { endpoint: yt(r, l, tt), low: yt(r, l, nt) }
  }, h = En(e, t.noaa, t.gauge, r, s, o, n), d = Nn(e, t.radar), p = Ln(e, t.grid), f = On(e, t.tides);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: o,
    sources: {
      gauge: c,
      noaa: Oe(t.noaa, h.issuedT, e, 12 * R),
      radar: Oe(t.radar, d.endT, e, 3 * R),
      grid: Oe(t.grid, p.updatedT, e, 12 * R),
      tides: Oe(t.tides, t.tides?.lastSuccessAt, e, 36 * R)
    },
    gauge: u,
    forecast: h,
    rain: { radar: d, grid: p },
    tides: f
  };
}

// site/js/watch-render.js
function Xe(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var v = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), F = (e) => typeof e == "number" && Number.isFinite(e);
function De(e, t = !1) {
  if (!F(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function pe(e, t = !1) {
  if (!F(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function W(e, t = !1) {
  if (!F(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
function P(e, t = !1) {
  return F(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function z(e) {
  if (!F(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function Et(e) {
  return F(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var Nt = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function Y(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(Y).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return Nt[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(Nt, {
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
function ne(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var Lt = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, it = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, ae = (e) => `<time datetime="${F(e) ? new Date(e).toISOString() : ""}">${v(P(e, !0))}</time>`;
function Ot(e) {
  let t = (e?.qualityLabel || e?.quality || "quality unknown").replace(/; no qualifier supplied$/, ""), n = t.toLowerCase() === "provisional" ? "not yet finalized" : t, a = { ice: "ice-affected value", malformed_value: "invalid numeric value", negative_value: "invalid negative flow", conflicting_duplicate: "conflicting readings", unsupported_quality: "unsupported quality flag", quality_flags_unavailable: "quality flags unavailable", approval_unavailable: "approval unavailable" }[typeof e?.reason == "object" ? e.reason?.code : e?.reason];
  return a ? `${n} \xB7 ${a}` : n;
}
function Rt(e) {
  return e?.available ? e.distanceCfs === 0 ? `At ${W(e.referenceCfs)} cfs line` : `${W(Math.abs(e.distanceCfs))} cfs ${e.distanceCfs > 0 ? "below" : "past"} the ${W(e.referenceCfs)} cfs line` : "";
}
function It(e, t = !1) {
  if (!e?.available) {
    let i = [["Before", e?.before], ["After", e?.after]].filter(([, s]) => s);
    return `${v(Y(e?.reason))}${i.length ? "<br>Nearest readings: " + i.map(([s, l]) => `${s} ${ae(l.t)}: ${W(l.cfs)} cfs`).join("; ") + "." : ""}`;
  }
  let n = t ? e.minimum : e.comparison, a = P(n.t, !0), r = a.slice(-3) === P(e.current?.t, !0).slice(-3), o = `<time datetime="${new Date(n.t).toISOString()}" title="${v(P(n.t))}">${v(r ? a.replace(/ PST$| PDT$/, "") : a)}</time>`;
  return `${t ? "Low" : "From"} <strong>${W(n.cfs)} cfs</strong><br>${o}${t || e.elapsedMs === 24 * 36e5 ? "" : `<span class="comparison-interval">${v(z(e.elapsedMs))} earlier</span>`}`;
}
function Rn(e, t, n = !1, a = "") {
  return `<div class="metric"><div class="metric-heading"><h3>${v(t)}</h3><div class="metric-value">${e?.available ? W(e.changeCfs, !0) : "Unavailable"}${e?.available ? "<small> cfs</small>" : ""}</div></div><p class="distance" aria-label="Distance from rolling reference">${v(Rt(e))}</p>${a ? `<p class="metric-note">${v(a)}</p>` : ""}<p>${It(e, n)}</p></div>`;
}
function In(e) {
  let t = e.gauge || {}, n = e.actualCurrentObservation || t.latest, a = t.direction || {}, r = a.available && { rising: "Rising", falling: "Falling", roughly_level: "Roughly level" }[a.label] || "Direction unavailable", o = t.endpoint?.available && t.low?.available && W(t.endpoint.changeCfs, !0) === W(t.low.changeCfs, !0), i = t.endpoint?.approximate ? "About 24-hour change" : "24-hour change", s = t.endpoint?.available ? `<div class="rise-source">${It(t.endpoint, !1)}</div>` : "", l = it("flow", "How flow comparisons work", `<p>Flow means water passing the gauge, in cubic feet per second (cfs). The reading time, source quality and age describe this observation.</p><p><strong>24-hour change</strong> compares the reading nearest 24 elapsed hours earlier (within 15 minutes). <strong>Rise from the 24-hour low</strong> compares the lowest actual reading in that same window. They answer different questions and may differ. Missing readings are not filled; gaps over 30 minutes make the comparison unavailable.</p><p>The descriptive line is ${De(t.referenceCfs)} cfs of rolling change: 400 in November\u2013February, 200 in March\u2013April, and 100 in May\u2013October. This is a planning reference; the official live closure calculation has not been confirmed.</p>`), c = o ? "" : `<div class="metrics">${Rn(t.low, "Rise from 24h low", !0)}</div>`, u = o ? t.endpoint.changeCfs === t.low.changeCfs ? "24h change; same as rise from 24h low" : "Rounds to same value as rise from 24h low" : "", h = F(n?.cfs) ? `${W(n.cfs)} cfs` : "Unavailable", d = e.timeUncertain ? "Age unknown" : `${z(t.ageMs)} old${t.stale ? " \xB7 STALE" : ""}`;
  ne("current", `<div class="flow-row"><div><div class="section-heading flow-heading"><h2>Flow</h2>${Lt("flow", "About flow readings")}<span class="actual-flow flow-number">Actual flow: ${h} \xB7 ${v(d)}</span></div><div class="rise-headline"><span${o ? ' class="equal-label" title="The 24-hour change and rise from the 24-hour low are rounded for display"' : ""}>${o ? u : i}</span><strong class="distance-headline">${t.endpoint?.available ? v(Rt(t.endpoint)) : "24-hour reference unavailable"}</strong><b class="rise-support">24-hour change: ${t.endpoint?.available ? W(t.endpoint.changeCfs, !0) + " cfs" : "unavailable"}</b>${s}</div></div><div class="flow-context"><strong>${v(r)}</strong>${n ? ae(n.t) : ""}<span class="reading-age">${v(Ot(n))}${t.stale && !e.timeUncertain ? " \xB7 STALE" : ""}</span></div></div>${c}<p class="authority">Health authorities decide closures and reopening.</p>${l}`), ne("flow-history", ""), document.getElementById("current").setAttribute("aria-busy", "false");
  let p = F(n?.cfs) ? W(n.cfs) : "Unavailable", f = e.timeUncertain ? "Age unknown" : z(t.ageMs).replace("less than 1 minute", "<1m").replace(" minutes", "m").replace(" minute", "m");
  ne("number-strip", `<span aria-label="Actual flow ${v(h)}, ${v(e.timeUncertain ? "age unknown" : z(t.ageMs) + " old")}${t.stale && !e.timeUncertain ? " and stale" : ""}">Flow (cfs) <strong>${p}</strong><small>${v(f)}${t.stale && !e.timeUncertain ? " \xB7 STALE" : ""}</small></span><span aria-label="Rolling 24-hour change ${t.endpoint?.available ? W(t.endpoint.changeCfs, !0) + " cfs" : "unavailable"}">24h change <strong>${t.endpoint?.available ? W(t.endpoint.changeCfs, !0) : "unavailable"}</strong></span><span aria-label="Rise from 24-hour low ${t.low?.available ? W(t.low.changeCfs, !0) + " cfs" : "unavailable"}">Low rise <strong>${t.low?.available ? W(t.low.changeCfs, !0) : "unavailable"}</strong></span>`);
}
function qn(e, t = !1) {
  return (e || []).map((n) => v(t && ["rate_limited", "rate_limit", "rate_suppression"].includes(typeof n == "string" ? n : n?.code) ? "Saved monitoring updates are temporarily rate-limited; this page only displays saved status." : Y(n))).filter((n, a, r) => r.indexOf(n) === a).join(" ");
}
function Un(e, t, n, a, { publicView: r = !1 } = {}) {
  let o = e.monitor?.summary || {}, i = o.capability || {}, s = o.preparation || {}, l = o.support || {}, u = F(o.supportObservationT) && a - o.supportObservationT > 60 * 6e4 ? { ...i, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: [...i.reasons || [], "observation_older_than_60min"] } : i, h = F(n?.lastCommitAt) ? a - n.lastCommitAt : null, d = !!n?.workerStale || F(h) && h > 12 * 6e4, p = o.standing, f = p?.active === !0 && (p.kind === "correction" || p.state === "rising_again"), b = { unarmed: "No downturn detected yet", tracking: "Watching for a possible downturn", possible_downturn: "Possible downturn \u2014 it may reverse", ended: "Earlier event retained for reference" }[o.phase] || "Turn monitor is starting";
  f && o.phase !== "ended" && (b = "Rising again after a possible downturn"), u.status === "unavailable" || d ? b = "Turn monitoring unavailable" : u.status === "partial" ? b = "New downturn checks unavailable" : u.status === "warming_up" && (b = "Turn checks are warming up");
  let O = e.monitor?.transitions || [], q = (G) => ["downturn", "possible_downturn"].includes(G?.kind), g = o.phase === "ended" && (q(p) ? p : p ? null : Xe(O, q)), $ = g && Xe(O, (G) => q(G) && G.t === (g.t ?? g.observationT)), U = $ && O.some((G) => G.kind === "event_end" && G.event === $.event && G.detected_at === $.detected_at), x = g ? `A possible downturn was recorded at ${ae(g.t ?? g.observationT)} \xB7 ${De(g.cfs ?? Number(g.q))} cfs. The event grouping has ended; this turn remains earlier evidence.${U ? " The turn and event end were recorded in the same check, so no current-turn preview was prepared." : ""}` : F(p?.t) ? `${p.active === !0 ? "" : "Earlier event: "}${p.kind === "correction" || p.state === "rising_again" ? "Rising again after a possible downturn; correction observed" : "Possible downturn recorded"} at ${ae(p.t)} \xB7 ${De(p.cfs)} cfs.${p.active === !0 ? "" : " This is earlier evidence, separate from the current event."}` : "", w = F(s.nextEligibleAt) && s.nextEligibleAt > a ? r ? ` Saved monitoring status is rate-limited until ${P(s.nextEligibleAt, !0)}.` : ` River-warning previews are rate-limited until ${P(s.nextEligibleAt, !0)}.` : "", y = d ? r ? " The published snapshot is old; current monitoring status cannot be confirmed." : " The monitor has not saved a recent check; silence does not mean no turn." : "", H = u.status === "partial" ? " Above-high corrections remain available." : "", D = Ot(t.actualCurrentObservation), j = t.actualCurrentObservation?.eligible === !1 ? `Latest quality: ${D}; this reading cannot support an automatic turn notice.` : "", K = t.gauge?.direction, B = K?.available ? `Measured hour change: ${pe(K.changeCfs, !0)} cfs over ${z(K.elapsedMs)}, from ${pe(K.comparison?.cfs)} to ${pe(K.current?.cfs)} cfs. The roughly-level tolerance is ${pe(K.toleranceCfs)} cfs, an engineering choice, not instrument precision. These hour-change values are rounded for readability.` : Y(K?.reason);
  ne("monitor", `<details><summary><h2>${v(b)}</h2><span>Details</span></summary><p>Experimental checks follow observed river flow. A possible turn can reverse.</p><p>${v(B)}</p><p>${qn([...u.reasons || [], ...s.blockingReasons || []], r)}</p><p>${l.monitoringGapMs ? `Recorded monitoring gap: ${v(z(l.monitoringGapMs))}. ` : ""}These event groupings do not set a sampling deadline or reset a closure rule. ${r ? "Display only \xB7 no alerts sent. This page does not prepare or send alerts." : "Warning delivery is disabled."}</p></details>${x || H || w || y ? `<p class="monitor-fact">${x}${v(H + w + y)}</p>` : ""}${j ? `<p>${v(j)}</p>` : ""}`), document.getElementById("monitor").classList.toggle("attention", u.status === "unavailable" || u.status === "partial" || d);
}
function Dn(e, t) {
  let n = e.forecast || {};
  ne("forecast-age", n.issuedT ? `Issued ${ae(n.issuedT)} \xB7 ${v(e.timeUncertain ? "age unknown" : z(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${v(Y(n.reason))}` : ""}` : `Forecast unavailable. ${v(Y(n.reason))}`);
  let a = [];
  e.sources?.noaa?.error && a.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && a.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${pe(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let r = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  r ? a.push({ text: Y(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && a.push(`Adjusted forecast unavailable. ${Y(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(r && n.cases?.reason?.code === "forecast_alignment_unsupported") && a.push(`Historical cases unavailable. ${Y(n.cases.reason)}`), ne("forecast-problems", a.map((d) => `<p${typeof d == "object" && d.neutral ? ' class="neutral"' : ""}>${v(typeof d == "object" ? d.text : d)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (r && a.length === 1 ? document.querySelector?.(".legend") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let s = n.crossings?.shifted?.[t.reference], l = s?.available ? F(s.t) ? `The adjusted forecast ${s.alreadyReached ? "already meets" : "first reaches"} the reference at ${P(s.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${Y(s?.reason)}`, c = F(n.offsetCfs) ? `Adjustment to the gauge reading: ${pe(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", u = Date.parse(n.cases?.trainingCutoff ?? ""), h = F(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${De(n.cases.tableVersion)}${F(u) ? `; training cutoff ${ae(u)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  ne("forecast-details", it("forecast", "Forecast and chart", `<p>National Weather Service river forecast for SMRW1; available through ${ae(n.raw?.endT)}.</p><p>${v(c)} The original forecast remains visible.</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${v(l)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. They cover the first 72 hours in October\u2013April; later points show the issued forecast alone.</p>${h}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function jn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${P(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : z(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", r = t.windows || [2, 4, 6, 8, 12, 18, 24].map((s) => ({ hours: s, available: !1 })), o = [...new Set(r.filter((s) => !s.available).map((s) => Y(s.reason || t.reason)))], i = it("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over the drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. Radar cannot confirm whether rain has stopped upriver.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  ne("rain", `<div class="section-heading"><h2>Rain</h2>${Lt("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${v(a)}</p><div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${i}<div class="rain-total-grid">${r.map((s) => `<div class="rain-total" aria-label="${s.hours}-hour total ending ${v(P(s.endT ?? t.endT, !0))}, ${v(e.timeUncertain ? "age unknown" : z(s.ageMs ?? t.ageMs) + " old")}"><span>${s.hours} hours</span><strong>${s.available ? Et(s.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${o.length ? `<p class="meta">${o.map(v).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${Et(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${v(Y(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${ae(n.updatedT)} \xB7 ${v(e.timeUncertain ? "age unknown" : z(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function Fn(e, t) {
  let n = e.forecast || {}, a = n.nextCrest, r = a ? [a, ...n.laterHigherCrests || []] : [], o = t.range === "full" ? n.raw?.endT ?? e.nowMs : e.nowMs + (t.range === "day" ? 24 : 72) * 36e5, i = (l) => `<time datetime="${new Date(l).toISOString()}">${v(P(l))}</time>`, s = r.map((l, c) => `<article class="peak-card"><p class="eyebrow">${c === 0 ? e.timeUncertain ? "First listed forecast peak" : "Next local peak" : "Later peak above the first"}</p><h3>${i(l.startT)}${l.endT !== l.startT ? ` to ${i(l.endT)}` : ""}</h3><p class="peak-values"><strong class="peak-flow">${W(l.cfs)} cfs</strong><span>Issued forecast flow</span><span>${W(l.riseCfs, !0)} cfs from prior forecast low</span></p><p class="meta">${l.endT !== l.startT ? "Several forecast readings at this level" : "One forecast reading at this time"}; timing is uncertain.${l.startT > o ? " Outside the selected chart range." : ""}</p>${c === 0 ? '<p class="sampling-lines"><strong>River samples:</strong> around the river peak and afterward, as early as possible; no fixed hours-after-peak deadline.<br><strong>Bay samples:</strong> within six hours after the river peak for a qualifying pollution closure; tide and laboratory availability also matter.</p>' : ""}<details class="peak-resolution"><summary>Surrounding issued times</summary><p>${i(l.bracketStartT)} to ${i(l.bracketEndT)}. ${{ inside_08_17: "Both are between 8 AM and 5 PM", outside_08_17: "Both are outside 8 AM\u20135 PM", spans_both: "This interval spans daytime and overnight hours" }[l.clockRange] || "Clock range unavailable"}.</p></details></article>`).join("");
  ne("peaks", `<div class="section-top"><h2>${e.timeUncertain ? "Peaks in the saved forecast" : "Next river peak"}</h2></div><p class="meta">Peak values use the issued forecast, without a gauge adjustment.${e.timeUncertain ? " Current time is uncertain; these are saved forecast points." : ""}</p>${s ? `<div class="peak-grid">${s}</div>` : '<p class="meta">No supported future peak is identifiable. A rising or level tail does not establish a crest.</p>'}`);
}
function Pn(e) {
  let t = e.tides || {};
  ne("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown." : "Next 48 hours. Retrieved " + v(z(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${ae(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${De(n.ft)}</td></tr>`).join("")}</tbody></table>` : `<p>${v(Y(t.reason))}</p>`}</div>`);
}
function Hn(e, t, n) {
  ne("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", tides: "NOAA Bellingham tide predictions" }).map(([r, o]) => {
    let i = t.sources?.[r] || {}, s = n?.sources?.[r] || {};
    return `<div class="source-row"><strong>${v(o)}</strong>${r === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>Data time: ${ae(i.dataT)} \xB7 ${v(t.timeUncertain ? "age unknown" : z(i.ageMs) + " old")}${i.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${ae(s.lastSuccessAt ?? i.lastSuccessAt)}.${s.error || i.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot saved ${ae(e.createdAt)}. This save time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}
function qt(e, t, n, a, r, o = {}) {
  In(t), Un(e, t, n, r, o), Dn(t, a), jn(t), Fn(t, a), Pn(t), Hn(e, t, n);
  let i = t.gauge?.exclusions || [], s = {};
  for (let l of i) {
    let c = typeof l.reason == "string" ? l.reason : l.reason?.code || "unspecified";
    s[c] = (s[c] || 0) + 1;
  }
  document.getElementById("sources").insertAdjacentHTML("beforeend", `<p>Gauge source exclusions: ${i.length} recorded exclusions${i.length ? ". " + Object.entries(s).map(([l, c]) => `${c} ${v(Y(l))}`).join(" ") : "."} These records do not support automatic notices.</p>`), ne("snapshot-label", `Saved snapshot ${v(e.id)} \xB7 ${v(P(e.createdAt))}`);
}

// site/js/watch-chart.js
var X = Number.isFinite, I = null, Bn = (e, t, n) => X(e?.t) && X(e?.cfs) && e.t >= t && e.t <= n;
function Je(e, t, n) {
  for (let a of e || []) {
    let r = Xe(a, (o) => o.t === t);
    if (r) return r.cfs;
    for (let o = 1; o < a.length; o++) {
      let i = a[o], s = a[o - 1];
      if (s.t < t && i.t > t)
        return i.t - s.t > n ? null : s.cfs + (i.cfs - s.cfs) * (t - s.t) / (i.t - s.t);
    }
  }
  return null;
}
function Ut(e, t, n, a) {
  let r = e.filter((o) => Bn(o, t, n));
  for (let o of [t, n])
    if (!r.some((i) => i.t === o)) {
      let i = Je([e], o, a);
      X(i) && r.push({ t: o, cfs: i });
    }
  return r.sort((o, i) => o.t - i.t);
}
function Wn(e, t, n) {
  return e.map((a, r) => `${r ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function Vn(e, t, n) {
  return (e?.segments || []).map((a) => {
    let r = Ut(a, t, n, 1 / 0);
    for (let o of e.steps || []) {
      if (o.t < t || o.t > n || !a.length || o.t < a[0].t || o.t > a.at(-1).t) continue;
      let i = r.findIndex((l) => l.t >= o.t), s = i < 0 ? r.length : i;
      for (; r[s]?.t === o.t; ) r.splice(s, 1);
      r.splice(s, 0, { t: o.t, cfs: o.beforeCfs }, { t: o.t, cfs: o.afterCfs });
    }
    return r;
  });
}
var Gn = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function ot(e) {
  let t = Object.fromEntries(Gn.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function zn(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - ot(t);
  return t;
}
function Xn(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), r = ot(e), o = ot(t), i = [];
  for (let s of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let l = Math.min(s, 12) * 36e5, c = [];
    for (let h = Math.ceil(r / l) * l; h <= o + 36e5; h += s * 36e5) {
      let d = zn(h);
      d >= e && d <= t && c.push(d);
    }
    if (c.length < 2) continue;
    i = c;
    let u = Math.min(...c.slice(1).map((h, d) => (h - c[d]) / (t - e) * n));
    if (c.length <= a && u >= 40) return c;
  }
  return i.length > 2 ? [i[0], i.at(-1)] : i;
}
function Me(e, t, n) {
  let a = Math.max(1, Math.floor(e.clientWidth)), r = globalThis.innerHeight, o = a < 500 ? 240 : X(r) && r < 500 ? Math.max(180, Math.min(280, r - 80)) : 280, i = { left: Math.min(49, a / 4), right: Math.min(14, a / 4), top: 26, bottom: 38 }, s = i.left, l = a - i.right, c = i.top, u = o - i.bottom, h = t.gauge?.latest?.t, d = Math.round(t.nowMs), p = d - Number(n.past || 24) * 36e5, f = n.range === "full" ? Math.max(d + 36e5, t.forecast?.raw?.endT ?? d + 72 * 36e5) : d + (n.range === "day" ? 24 : 72) * 36e5, b = t.forecast || {}, O = t.gauge?.references?.[n.reference], q = b.references?.[n.reference], g = { segments: [...O?.segments || [], ...q?.segments || []], steps: [...O?.steps || [], ...q?.steps || []] }, $ = [{ key: "observed", name: "Observed river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "NOAA river forecast", segments: b.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Forecast adjusted to current gauge", segments: b.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: b.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: b.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: "Level to meet the rolling 24-hour reference", segments: Vn(g, p, f), gap: 1 / 0 }].map((_) => ({ ..._, visible: _.key === "reference" ? _.segments : _.segments.map((N) => Ut(N, p, f, _.gap)) })), U = $.flatMap((_) => _.visible.flat()).filter((_) => X(_.cfs)), x = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let _ of document.querySelectorAll?.(".legend span") ?? []) {
    let N = x[_.querySelector("i")?.className];
    _.hidden = !!N && !$.some((Ve) => Ve.key === N && Ve.visible.some((Ke) => Ke.length));
  }
  let w = Math.max(10, ...U.map((_) => _.cfs)) * 1.08, y = w / 4, H = Math.pow(10, Math.floor(Math.log10(y))), D = y / H, j = (D <= 1 ? 1 : D <= 2 ? 2 : D <= 5 ? 5 : 10) * H, K = j * 4, B = (_) => s + (_ - p) / (f - p) * (l - s), G = (_) => u - _ / K * (u - c), Qt = Array.from({ length: 5 }, (_, N) => j * N), Kt = Xn(p, f, l - s), en = Qt.map((_) => `<line class="grid" x1="${s}" x2="${l}" y1="${G(_)}" y2="${G(_)}"/><text x="${s - 7}" y="${G(_) + 4}" text-anchor="end">${v(pe(_))}</text>`).join("") + Kt.map((_) => {
    let N = B(_), Ve = N < 24 ? "start" : N > a - 24 ? "end" : "middle", Ke = `<tspan x="${N}">${v(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(_))}</tspan><tspan x="${N}" dy="14">${v(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(_))}</tspan>`;
    return `<text class="x-axis-label" x="${N}" y="${o - 24}" text-anchor="${Ve}">${Ke}</text>`;
  }).join(""), tn = $.map((_) => _.visible.filter((N) => N.length).map((N) => N.length === 1 ? `<circle class="${_.key}" cx="${B(N[0].t)}" cy="${G(N[0].cfs)}" r="2" fill="var(--${_.key === "observed" ? "obs" : _.key})"/>` : `<path class="plot-line ${_.key}" d="${Wn(N, B, G)}"/>`).join("")).join(""), ht = Je(g.segments, p, 1 / 0) ?? Je(g.segments, d, 1 / 0), be = X(ht) ? G(ht) : c + 14;
  be = be - c > 32 ? be - 10 : be + 24, be = Math.max(c + 12, Math.min(u - 6, be));
  let nn = $.find((_) => _.key === "reference")?.visible.flat() || [], Be = nn.reduce((_, N) => !_ || N.t > _.t ? N : _, null), We = Be ? Math.max(s + 4, Math.min(l - 88, B(Be.t) - 84)) : s + 4, pt = be, an = We + 84, sn = X(n.cursorT) && n.cursorT >= p && n.cursorT <= f ? B(n.cursorT) : null, rn = X(h) && h >= p && h <= f ? B(h) : null, on = Be && B(Be.t) - s >= 84, ln = [sn, rn].some((_) => X(_) && _ >= We && _ <= an), cn = l - s < 200 || !on || ln ? "" : `<rect class="reference-label-bg" x="${We}" y="${pt - 12}" width="84" height="16" rx="3"/><text class="reference-label" x="${We + 4}" y="${pt}">Required level</text>`, un = X(h) && h >= p && h <= f ? `<line x1="${B(h)}" x2="${B(h)}" y1="${c}" y2="${u}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(s, Math.min(l - 90, B(h) + 5))}" y="${c - 9}">Latest observed</text>` : "", dn = d >= p && d <= f ? `<line class="now" x1="${B(d)}" x2="${B(d)}" y1="${c}" y2="${u}"/><text x="${Math.min(l - 25, B(d) + 5)}" y="${c + 15}">Now</text>` : "", ye = X(n.cursorT) ? Math.max(p, Math.min(f, n.cursorT)) : null, fn = ye !== null ? `<line class="cursor" x1="${B(ye)}" x2="${B(ye)}" y1="${c}" y2="${u}"/>` : "";
  e.innerHTML = `<svg viewBox="0 0 ${a} ${o}" width="${a}" height="${o}" role="img" aria-label="River flow in cubic feet per second. The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. Observations and forecast paths from ${v(P(p, !0))} through ${v(P(f, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${s}" y="${c}" width="${l - s}" height="${u - c}"/></clipPath></defs>${en}<g clip-path="url(#plot-clip)">${tn}${fn}</g>${cn}${un}${dn}${U.length ? "" : `<text x="${(s + l) / 2}" y="${o / 2}" text-anchor="middle">No supported readings to draw</text>`}</svg>`, I = { lines: $, hasData: U.length > 0, start: p, end: f, left: s, right: l, width: a, host: e };
  let ue = document.getElementById("chart-cursor");
  ue.min = String(p), ue.max = String(f), ue.step = "1", ue.disabled = !I.hasData, ue.style.marginLeft = `${s - 10}px`, ue.style.width = `${l - s + 20}px`;
  let gt = ye ?? Math.max(p, Math.min(f, X(h) ? h : d));
  ue.value = String(Math.round(gt)), ue.setAttribute("aria-valuetext", P(gt)), ye !== null ? Jn(ye) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function Jn(e) {
  if (!I) return;
  let t = I.lines.map((n) => {
    let a = Je(n.visible, e, n.gap);
    return X(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${v(P(e))}</strong><br>${t.map(v).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}`;
}
function Dt(e) {
  if (!I?.hasData) return null;
  let t = I.host.getBoundingClientRect(), n = t.width / I.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - I.left) / (I.right - I.left)));
  return Math.round(I.start + a * (I.end - I.start));
}
function lt() {
  if (!I?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return X(e) ? Math.max(I.start, Math.min(I.end, e)) : null;
}
function jt(e) {
  let t = lt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? I.start : e === "End" ? I.end : X(n[e]) ? Math.max(I.start, Math.min(I.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var Ft = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var Yn = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", Bt = new URL("./", import.meta.url), Wt = "samish.public.preview.packet.v1", Vt = "samish.public.preview.preferences.v1", Ze = 9466848e5, Ee = 41024448e5, we = 5 * 6e4, Gt = 2 * 1024 * 1024, T = (e) => document.getElementById(e), Pe = Number.isFinite;
function Ne() {
  let e = T("number-strip"), t = T("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", Ne, { passive: !0 });
window.addEventListener("resize", Ne);
function ft(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = T(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function ut(e, t, n = !1) {
  let a = T(e), r = T(`${e}-toggle`);
  if (!(!a || !r) && (a.open = t, ft(), Ne(), n)) {
    r.focus({ preventScroll: !0 });
    let o = T("number-strip"), i = o.dataset.visible === "true" ? o.getBoundingClientRect().bottom : 0, s = r.getBoundingClientRect();
    (s.top < i + 8 || s.bottom > innerHeight - 8) && r.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), Ne();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), ut(t.dataset.helpTarget, !T(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), ut(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || T(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), ut(t.id, !1, !0));
});
ft();
var zt = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, Xt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, E = () => {
  throw new Error("invalid_public_packet");
};
function k(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && E(), e;
}
function re(e, t = !1, n = !1, a = !1, r = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !Pe(e) || !n && e < 0 || a && !Number.isInteger(e) || e > r) && E();
}
function S(e, t = !1) {
  re(e, t, !1, !0, Ee), e !== null && e < Ze && E();
}
function Ce(e) {
  typeof e != "boolean" && E();
}
function se(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && E();
}
function ie(e, t, n) {
  (!Array.isArray(e) || e.length > t) && E(), e.forEach(n);
}
var Qn = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], Kn = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], ea = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function dt(e, t = !1) {
  k(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), S(e.t, t), "cfs" in e && re(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && Ce(e[n]);
  "approval" in e && se(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && se(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && se(e[n], ea);
  "reason" in e && se(e.reason, Qn, !0);
}
function je(e, t = !1) {
  e !== null && (k(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), S(e.t), re(e.cfs, !0), t && S(e.eligibleT, !0));
}
function ta(e, t) {
  k(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), S(t.lastAttemptAt, !0), S(t.lastSuccessAt, !0), se(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (k(n, ["points", "exclusions", "coveredWindow"]), ie(n.points, 4096, (a) => dt(a)), ie(n.exclusions, 4096, (a) => dt(a, !0)), n.coveredWindow !== null)) {
      let a = k(n.coveredWindow, ["startT", "endT", "complete"]);
      S(a.startT), S(a.endT), (a.complete !== !0 || a.startT > a.endT) && E();
    }
    if (e === "noaa" && (k(n, ["issuedT", "points", "conflicts"]), S(n.issuedT), ie(n.points, 1024, (a) => {
      k(a, ["t", "cfs"]), S(a.t), re(a.cfs);
    }), ie(n.conflicts, 1024, (a) => S(a))), e === "radar") {
      k(n, ["generatedT", "hours", "conflicts"]), S(n.generatedT);
      let a = (r) => {
        S(r), r % 36e5 && E();
      };
      ie(n.hours, 256, (r) => {
        k(r, ["endT", "mm"]), a(r.endT), re(r.mm, !0);
      }), ie(n.conflicts, 256, a);
    }
    e === "grid" && (k(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), S(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && E(), ie(n.periods, 1024, (a) => {
      k(a, ["startT", "endT", "mm"]), S(a.startT), S(a.endT), re(a.mm, !0), a.endT <= a.startT && E();
    })), e === "tides" && (k(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && E(), ie(n.points, 128, (a) => {
      k(a, ["t", "ft", "type"]), S(a.t), re(a.ft, !1, !0), se(a.type, ["H", "L"]);
    }));
  }
}
function na(e) {
  k(e, ["summary", "transitions"]);
  let t = k(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && E(), S(t.asOf), se(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && dt(t.actualCurrentObservation), S(t.supportObservationT, !0), t.event !== null) {
    let i = k(t.event, ["openedT", "high", "cycle"]);
    S(i.openedT), je(i.high);
    let s = k(i.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    re(s.ordinal, !1, !1, !0, 1e5), S(s.openedT), je(s.high, !0), je(s.low), Ce(s.endingPending);
  }
  if (t.standing !== null) {
    let i = k(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    se(i.kind, ["downturn", "correction"]), se(i.state, ["possible_downturn", "rising_again"]), S(i.t), S(i.detectedAt), re(i.cfs), Ce(i.active), je(i.supportingHigh), je(i.low);
  }
  let n = (i) => ie(i, 16, (s) => se(s, Kn)), a = k(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  se(a.status, ["available", "warming_up", "partial", "unavailable"]), Ce(a.newDownturnAvailable), Ce(a.aboveHighCorrectionAvailable), n(a.reasons);
  let r = k(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(r.blockingReasons), S(r.nextEligibleAt, !0);
  let o = k(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  S(o.lastSuccessfulPollAt, !0), re(o.monitoringGapMs, !0, !1, !1, Ee), re(o.observationAgeMs, !0, !1, !1, Ee), ie(o.missingQuarterHours, 7, (i) => S(i)), Ce(o.clockTrusted), ie(e.transitions, 32, (i) => {
    k(i, ["kind", "t", "cfs", "event", "detected_at"]), se(i.kind, ["downturn", "event_end"]), S(i.t), S(i.detected_at), re(i.cfs), (typeof i.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(i.event)) && E();
  });
}
async function Jt(e) {
  k(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && E();
  let t = new TextEncoder().encode(e.payload);
  t.length > Gt && E(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((i) => i.toString(16).padStart(2, "0")).join("") !== e.sha256 && E();
  let a = JSON.parse(e.payload);
  k(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && E(), S(a.publishedAt);
  let r = k(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (r.schemaVersion !== 1 || typeof r.id != "string" || !/^[a-f0-9]{12}$/.test(r.id)) && E(), S(r.createdAt), a.publishedAt < r.createdAt && E();
  let o = ["gauge", "noaa", "radar", "grid", "tides"];
  return k(r.sources, o), o.forEach((i) => ta(i, r.sources[i])), na(r.monitor), r.monitor.summary.asOf !== r.createdAt && E(), a;
}
var ke = zt(Vt) || {}, C = { range: ["day", "three", "full"].includes(ke.range) ? ke.range : "three", past: ke.past === 48 ? 48 : 24, reference: ke.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(ke.theme) ? ke.theme : null, cursorT: null };
C.theme && (document.documentElement.dataset.theme = C.theme);
var Q = null, He = null, V = null, ct = !1, J = "waiting", ge = null, Fe = null, Ye = !0, me = !1, le = Date.now(), Qe = () => Xt(Vt, { range: C.range, past: C.past, reference: C.reference, theme: C.theme });
function aa() {
  let e = Date.now(), t = ge ? Math.max(0, performance.now() - ge.mono) : 0, n = ge ? ge.lower + t : null, a = ge ? ge.upper + t : null;
  le = Math.max(le, e, a ?? 0, Q?.snapshot.createdAt ?? 0);
  let r = Ye || !ge || e < n - we || e > a + we || e + we < le || Q && Q.snapshot.createdAt > a + we;
  return { now: le, uncertain: r };
}
function Zt() {
  return Fe ? Fe.now + Math.max(0, performance.now() - Fe.mono) : 0;
}
function sa() {
  He && Xt(Wt, { packet: He, greatestNow: le, trustedNow: Zt(), savedDeviceMs: Date.now(), ended: me });
}
function Pt(e) {
  let t = T("connection");
  if (!Q) {
    t.textContent = me ? "Preview ended. No current readings are provided." : J === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - Q.snapshot.createdAt), a = J !== "checked";
  if (!me && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${z(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [me ? "Preview ended. Earlier readings are retained for reference." : a ? J === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : J === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current monitoring is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${P(Q.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${z(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current direction and monitoring availability are withheld." : ""].join(" "), t.className = "connection attention";
}
function ce() {
  let e = aa();
  if (!Q) {
    Pt(e);
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((c) => c.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((c) => [...T(c).querySelectorAll("details:not(.section-help)")].flatMap((u, h) => u.open ? [`${c}:${h}`] : [])), r = Q.snapshot;
  V = Ct({ nowMs: e.now, sources: r.sources, ratioTable: Ft });
  let o = me || e.uncertain || J !== "checked" || e.now - r.createdAt > 12 * 6e4;
  V.timeUncertain = e.uncertain, e.uncertain && (V.forecast.freshContext = !1, V.forecast.higherLater = { ...V.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let i = r.monitor.summary, s = !Pe(i.supportObservationT) || e.now - i.supportObservationT > 60 * 6e4;
  o && (V.gauge.direction = { ...V.gauge.direction, available: !1, reason: { code: me ? "preview_ended" : e.uncertain ? "public_time_uncertain" : J !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" } });
  let l = r;
  if (o || s || !i.support.clockTrusted) {
    let c = [...i.capability.reasons, ...s ? ["observation_older_than_60min"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...i.support.clockTrusted ? [] : ["clock_uncertain"]];
    l = { ...r, monitor: { ...r.monitor, summary: { ...i, capability: { ...i.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: c }, preparation: { ...i.preparation, nextEligibleAt: null } } } };
  }
  qt(l, V, e.uncertain ? null : { lastCommitAt: r.createdAt, workerStale: e.now - r.createdAt > 12 * 6e4 }, C, e.now, { publicView: !0 });
  for (let c of T("forecast-details").querySelectorAll("a")) c.getAttribute("href") === "/data/ratio_table.json" && (c.href = new URL("ratio_table.json", Bt).href, c.textContent = "View the frozen historical-case table");
  a.forEach((c) => {
    let [u, h] = c.split(":"), d = T(u).querySelectorAll("details:not(.section-help)")[Number(h)];
    d && (d.open = !0);
  }), ft(n), document.querySelectorAll("[data-range]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.range === C.range))), T("past").value = String(C.past), T("reference").value = C.reference, Me(T("chart"), V, C), Pt(e), Ne(), sa(), t && T(t) && document.activeElement?.id !== t && T(t).focus({ preventScroll: !0 });
}
async function Yt(e, t = Gt * 2) {
  let n = new AbortController(), a = setTimeout(() => n.abort(), 18e3);
  try {
    let r = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!r.ok) throw new Error("unavailable");
    let o = await r.text();
    return new TextEncoder().encode(o).length > t && E(), { response: r, value: JSON.parse(o) };
  } finally {
    clearTimeout(a);
  }
}
async function ra() {
  let e = new URL("version.json", Bt);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await Yt(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && E(), me = n.state === "ended";
  let a = t.headers.get("Date"), r = t.headers.get("Age"), o = Date.parse(a || "");
  if (!Pe(o) || o < Ze || o > Ee || r === null || !/^\d+$/.test(r)) throw new Error("time_unavailable");
  let i = Number(r);
  if (!Number.isSafeInteger(i) || i > 7 * 86400) throw new Error("time_unavailable");
  let s = o + i * 1e3, l = Date.now();
  l >= o - we && l <= s + we && s - l <= we && (le = Math.max(s, l, Zt(), Q?.snapshot.createdAt ?? 0), Fe = { now: le, mono: performance.now() }), ge = { lower: o, upper: s, mono: performance.now() }, Ye = !1;
}
function ia(e, t) {
  if (Q) {
    let n = Q.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      J = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && E(), J = "checked";
      return;
    }
  }
  Q = e, He = t, J = "checked";
}
async function Le() {
  if (!ct) {
    ct = !0, T("refresh").disabled = !0;
    try {
      let e = new URL(Yn);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([ra(), Yt(e)]);
      if (t[0].status === "rejected" && (Ye = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          ia(await Jt(n), n);
        } catch {
          J = "invalid";
        }
      else J = "offline";
      ce();
    } finally {
      ct = !1, T("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  C.range = e.dataset.range, C.cursorT = null, Qe(), ce();
}));
T("past").addEventListener("change", () => {
  C.past = Number(T("past").value), Qe(), ce();
});
T("reference").addEventListener("change", () => {
  C.reference = T("reference").value, Qe(), ce();
});
T("theme").addEventListener("click", () => {
  let e = C.theme ? C.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  C.theme = e ? "light" : "dark", document.documentElement.dataset.theme = C.theme, Qe();
});
T("refresh").addEventListener("click", Le);
T("chart").addEventListener("pointerdown", (e) => {
  C.cursorT = Dt(e), V && Me(T("chart"), V, C);
});
T("chart-cursor").addEventListener("input", () => {
  C.cursorT = lt(), V && Me(T("chart"), V, C);
});
T("chart-cursor").addEventListener("keydown", (e) => {
  let t = jt(e.key);
  t !== null && (e.preventDefault(), C.cursorT = t, V && Me(T("chart"), V, C));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (J = "waiting", ce(), Le());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (J = "waiting", ce(), Le());
});
window.addEventListener("offline", () => {
  J = "offline", Ye = !0, ce();
});
window.addEventListener("online", Le);
var Ht = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== Ht && (Ht = t, V && Me(T("chart"), V, C), Ne());
}).observe(T("chart"));
async function oa() {
  let e = zt(Wt);
  if (e?.packet)
    try {
      Q = await Jt(e.packet), He = e.packet, Pe(e.greatestNow) && e.greatestNow >= Ze && e.greatestNow <= Ee && (le = Math.max(le, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), Pe(e.trustedNow) && e.trustedNow >= Ze && e.trustedNow <= Ee && (Fe = { now: e.trustedNow, mono: performance.now() }), me = e.ended === !0, J = "offline", ce();
    } catch {
      Q = null, He = null;
    }
  await Le(), setInterval(() => {
    document.hidden || Le();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || ce();
  }, 3e4);
}
oa();
export {
  Ct as buildWatchModel,
  Jt as verifyPublicPacket
};
