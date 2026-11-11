// site/js/season.js
var An = "America/Los_Angeles";
var ct = null;
function Sn() {
  return ct === null && (ct = new Intl.DateTimeFormat("en-US", {
    timeZone: An,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), ct;
}
function ue(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of Sn().formatToParts(new Date(e)))
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
function At(e) {
  let t = ue(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function St(e, t, n, a = 0, r = 0) {
  let i = Date.UTC(e, t - 1, n, a, r), o = i - At(i);
  return i - At(o);
}
function Mt(e) {
  let t = ue(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var Mn = 3600 * 1e3, kn = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function Cn(e, t) {
  for (let n = 0; n < e.length; n++) {
    let a = e[n], r = n === e.length - 1;
    if (t >= a.lead_lo_h && (t < a.lead_hi_h || r && t === a.lead_hi_h)) return a;
  }
  return null;
}
function En(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : kn).includes(ue(t).month);
}
var $e = (e) => typeof e == "number" && Number.isFinite(e);
function Nn(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!$e(e.rise_floor_cfs) || !$e(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!$e(t.lead_lo_h) || !$e(t.lead_hi_h) || !$e(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !$e(a.low_factor) || !$e(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function kt(e, t, n, a = t.t) {
  let r = [], i = [], o = En(n, a);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: r, low: i, wetSeason: o };
  Nn(n);
  let s = n.bins, l = s[s.length - 1].lead_hi_h;
  for (let u of e) {
    let c = (u.t - t.t) / Mn;
    if (c <= 0 || c > l) continue;
    let p = Cn(s, c);
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
var xe = 6e4, O = 60 * xe, C = 24 * O, de = 30 * xe, ke = 6 * O, Ae = 15 * xe, Ln = [2, 4, 6, 8, 12, 18, 24], R = (e) => typeof e == "number" && Number.isFinite(e), M = (e) => R(e) && Math.abs(e) <= 864e13, v = (e, t = {}) => ({ code: e, details: t }), Le = (e, t) => M(t) ? Math.max(0, e - t) : null, On = (e, t) => Object.prototype.hasOwnProperty.call(e, t), Ye = (e) => ({ t: e.t, cfs: e.cfs }), G = (e) => e && e.usable !== !1 && R(e.cfs) && e.cfs >= 0;
function Ee(e, t) {
  let n = (s) => {
    let [l, u = "0"] = String(s).toLowerCase().split("e"), c = l.includes(".") ? l.length - l.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(l.replace(".", "")), exponent: Number(u) - c };
  }, a = n(e), r = n(t), i = Math.min(a.exponent, r.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - r.coefficient * 10n ** BigInt(r.exponent - i)}e${i}`;
}
function Ct(e) {
  let t = R(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : On(e, "qualifier"), r = {
    t: e.t,
    cfs: t ? e.cfs : null,
    approval: e.approval ?? null,
    qualifierAvailable: a,
    qualityLabel: e.qualityLabel ?? (a ? "Quality metadata supplied" : "Quality flags unavailable"),
    eligible: e.eligible === !0 && n && a,
    usable: n,
    reason: n ? null : typeof e.reason == "object" && e.reason ? e.reason : v(typeof e.reason == "string" ? e.reason : "unusable_observation")
  };
  return a && (r.qualifier = e.qualifier), r;
}
function Lt(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !M(n.t)) continue;
    let a = Ct(n), r = t.get(n.t);
    r ? JSON.stringify(r) !== JSON.stringify(a) && t.set(n.t, Ct({
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
function Se(e, t) {
  let n = 0, a = e.length;
  for (; n < a; ) {
    let r = n + a >>> 1;
    e[r].t < t ? n = r + 1 : a = r;
  }
  return n;
}
function Ot(e, t) {
  let n = Se(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function Ne(e, t, n = Ae) {
  let { before: a, after: r } = Ot(e, t), i = r?.t === t ? r : a && (!r || t - a.t <= r.t - t) ? a : r;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function ge(e) {
  if (!M(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return Mt(e);
}
function Rt(e, t) {
  let n = M(t) ? e[Se(e, t)] : null, a = M(t) ? t - C : null, r = M(a) ? Ot(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: v("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: M(t) ? ge(t) : null,
    distanceCfs: null,
    reached: null,
    ...r
  };
}
function Ut(e, t) {
  let n = Ee(e.current.cfs, t.cfs), a = R(n) ? Ee(e.referenceCfs, n) : null;
  return !R(n) || !R(a) ? { ...e, comparison: t, reason: v("non_finite_arithmetic") } : {
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
function ut(e, t) {
  let n = Rt(e, t);
  if (!G(n.current))
    return { ...n, reason: v(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = Ne(e, n.targetT);
  return a ? G(a) ? Ut(n, a) : { ...n, comparison: a, reason: v("comparison_unusable") } : { ...n, reason: v("comparison_missing", { toleranceMs: Ae }) };
}
function dt(e, t) {
  let n = Rt(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: M(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!G(a.current)) return { ...a, reason: v(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let r = Ne(e, a.targetT);
  if (!r) return { ...a, reason: v("window_start_missing", { toleranceMs: Ae }) };
  if (!G(r)) return { ...a, startSupport: r, reason: v("window_start_unusable") };
  let i = e.slice(Se(e, a.targetT), Se(e, t) + 1), o = i.find((c) => !G(c));
  if (o) return { ...a, startSupport: r, reason: v("window_unusable_observation", { t: o.t }) };
  let s = r.t < a.targetT ? [r, ...i] : i, l = 0;
  for (let c = 1; c < s.length; c++) l = Math.max(l, s[c].t - s[c - 1].t);
  if (l > de) return {
    ...a,
    startSupport: r,
    maxGapMs: l,
    reason: v("observation_gap", { maxGapMs: l, allowedMs: de })
  };
  let u = i.reduce((c, p) => !c || p.cfs < c.cfs ? p : c, null);
  return u ? {
    ...Ut(a, u),
    minimum: u,
    startSupport: r,
    maxGapMs: l,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: r, maxGapMs: l, reason: v("window_empty") };
}
function Ze(e, t, n = !1) {
  let a = [], r = [], i = [], o = [];
  for (let s of e) {
    if (!G(s) || n && s.cfs <= 0) {
      r.length && a.push(r), r = [], o.push({ t: s.t, reason: n && s.cfs <= 0 ? "non_positive_flow" : s.reason?.code ?? "unusable_observation" });
      continue;
    }
    let l = r[r.length - 1];
    l && s.t - l.t > t && (i.push({ startT: l.t, endT: s.t, reason: "unsupported_gap" }), a.push(r), r = []), r.push(Ye(s));
  }
  return r.length && a.push(r), { segments: a, gaps: i, exclusions: o };
}
function oe(e = "path_unavailable") {
  return {
    available: !1,
    reason: typeof e == "string" ? v(e) : e,
    points: [],
    segments: [],
    startT: null,
    endT: null,
    gaps: [],
    exclusions: []
  };
}
function me(e, t = {}) {
  let n = e.filter((r) => r.length).map((r) => r.map(Ye)), a = n.flat();
  return {
    available: a.length > 0,
    reason: a.length ? null : v("path_unavailable"),
    points: a,
    segments: n,
    startT: a[0]?.t ?? null,
    endT: a[a.length - 1]?.t ?? null,
    gaps: [],
    exclusions: [],
    ...t
  };
}
function It(e, t = ke, n = !1) {
  let a = Ze(e, t, n);
  return me(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function Te(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Se(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let r = e[n - 1], i = (t - r.t) / (a.t - r.t), o = (1 - i) * r.cfs + i * a.cfs;
  return R(o) ? o : null;
}
function Fe(e, t) {
  for (let n of e.segments) {
    let a = Te(n, t);
    if (a !== null) return a;
  }
  return null;
}
function ft(e, t, n) {
  let a = [];
  for (let r of e.segments) {
    let i = Math.max(t, r[0].t), o = Math.min(n, r[r.length - 1].t);
    if (i > o) continue;
    let s = [
      { t: i, cfs: Te(r, i) },
      ...r.filter((l) => l.t > i && l.t < o),
      ...o > i ? [{ t: o, cfs: Te(r, o) }] : []
    ];
    a.push(s);
  }
  return me(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function je(e, t, n, a) {
  let r = Le(n, t);
  return {
    available: !!e?.data,
    dataT: M(t) ? t : null,
    ageMs: r,
    stale: r === null || r > a,
    lastAttemptAt: M(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: M(e?.lastSuccessAt) ? e.lastSuccessAt : null,
    error: e?.error ?? null,
    url: e?.url ?? null,
    rawRefs: e?.rawRefs ?? [],
    reasons: [
      ...e?.data ? [] : [v("source_unavailable")],
      ...e?.error ? [v("source_fetch_failed")] : [],
      ...r !== null && r > a ? [v("source_stale", { ageMs: r, maxAgeMs: a })] : []
    ]
  };
}
function Rn(e, t, n, a) {
  let r = t ? t.t - 12 * O : null, i = {
    available: !1,
    reason: v("current_observation_unavailable"),
    current: t,
    comparison: null,
    targetT: r,
    elapsedMs: null,
    changeCfs: null,
    approximate: !1,
    asOf: !!(t && n - t.t > 30 * xe)
  };
  if (!G(t)) return { ...i, reason: v(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let o = Ne(e, r);
  if (!o) return { ...i, reason: v("comparison_missing", { toleranceMs: Ae }) };
  let s = {
    ...i,
    comparison: o,
    elapsedMs: t.t - o.t,
    approximate: o.t !== r
  };
  if (!G(o)) return { ...s, reason: v("comparison_unusable") };
  if (n - t.t > 2 * O) return { ...s, reason: v("gauge_stale") };
  if (a?.error) return { ...s, reason: v("source_fetch_failed") };
  let l = e.slice(Se(e, o.t), Se(e, t.t) + 1), u = l.find((h) => !G(h));
  if (u) return { ...s, reason: v("unusable_observation", { t: u.t }) };
  let c = 0;
  for (let h = 1; h < l.length; h++) c = Math.max(c, l[h].t - l[h - 1].t);
  if (c > de) return { ...s, reason: v("observation_gap", { maxGapMs: c, allowedMs: de }) };
  let p = Ee(t.cfs, o.cfs);
  return R(p) ? { ...s, available: !0, reason: null, changeCfs: p } : { ...s, reason: v("non_finite_arithmetic") };
}
function Un(e, t, n, a) {
  let r = {
    available: !1,
    reason: v("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * xe)
  };
  if (!G(t)) return { ...r, reason: v(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = Ne(e, t.t - O);
  if (!G(i)) return { ...r, comparison: i, reason: v("direction_comparison_unavailable") };
  let o = Ee(t.cfs, i.cfs), s = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), l = { ...r, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: s };
  if (!R(o)) return { ...l, changeCfs: null, reason: v("non_finite_arithmetic") };
  if (n - t.t > 2 * O) return { ...l, reason: v("gauge_stale") };
  if (a?.error) return { ...l, reason: v("source_fetch_failed") };
  let u = e.filter((c) => c.t >= i.t && c.t <= t.t);
  return u.some((c) => !G(c)) || u.some((c, p) => p && c.t - u[p - 1].t > de) ? { ...l, reason: v("direction_observation_gap") } : {
    ...l,
    available: !0,
    reason: null,
    label: Math.abs(o) <= s ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function Et(e, t, n) {
  let a = M(t) ? t - 7 * C : null, r = {
    windowStartT: a,
    windowEndT: M(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!M(t)) return r;
  for (let o of e) {
    if (o.t < a || o.t > t) continue;
    let s = n(e, o.t);
    s.available ? (r.evaluatedCount++, r.coverageStartT ?? (r.coverageStartT = o.t), r.coverageEndT = o.t, s.reached && (r.last = s)) : r.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= a && o.t <= t);
  return r.coverageComplete = r.coverageStartT !== null && r.coverageStartT <= a + Ae && r.coverageEndT >= t - de && r.unavailableCount === 0 && !i.some((o, s) => s && o.t - i[s - 1].t > de), r;
}
function Nt(e, t, n) {
  if (!M(t)) return { ...oe("observations_unavailable"), steps: [] };
  let a = [], r = [], i = [], o = [], s = null;
  for (let l of e) {
    if (l.t < t - 2 * C) continue;
    let u = n(e, l.t), c = u.comparison?.cfs;
    if (!u.available || !R(c + u.referenceCfs)) {
      o.length && a.push(o), o = [], s = null;
      continue;
    }
    if (s && l.t - s.t > de && (i.push({ startT: s.t, endT: l.t, reason: "unsupported_gap" }), o.length && a.push(o), o = [], s = null), s) for (let h of ht(s.t, l.t)) {
      let d = (h - s.t) / (l.t - s.t), f = (1 - d) * s.base + d * c, g = f + ge(h - 1), x = f + ge(h);
      o.push({ t: h, cfs: g }), a.push(o), o = [{ t: h, cfs: x }], r.push({ t: h, beforeCfs: g, afterCfs: x });
    }
    let p = { t: l.t, cfs: c + u.referenceCfs };
    o.at(-1)?.t !== l.t && o.push(p), s = { t: l.t, base: c };
  }
  return o.length && a.push(o), { ...me(a, { gaps: i }), steps: r };
}
function Je(e, t = "forecast_unavailable") {
  let n = () => oe(t), a = () => ({ endpoint: Ce(t), low: Ce(t) });
  return {
    available: !1,
    reason: v(t),
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
    higherLater: { available: !1, reason: v(t), aboveCurrent: null, peakCfs: null, peakT: null, largeAdjustment: !1 },
    cases: {
      available: !1,
      reason: v(t),
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(ue(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function Ce(e = "path_unavailable", t = !1) {
  return {
    available: !1,
    reason: typeof e == "string" ? v(e) : e,
    t: null,
    currentCfs: null,
    comparisonCfs: null,
    changeCfs: null,
    referenceCfs: null,
    alreadyReached: !1,
    largeAdjustment: t
  };
}
function ht(e, t) {
  if (!M(e) || !M(t) || e >= t) return [];
  let n = ue(e), a = ue(t), r = [];
  for (let i = n.year; i <= a.year; i++)
    for (let o of [3, 5, 11]) {
      let s = St(i, o, 1);
      s > e && s <= t && r.push(s);
    }
  return r.sort((i, o) => i - o);
}
function In(e, t, n) {
  let a = ft(e, n.t - 2 * C, n.t), r = ft(t, n.t, t.endT ?? n.t), i = a.segments.map((o) => [...o]);
  for (let o of r.segments) {
    let s = o.filter((c) => c.t > n.t);
    if (!s.length) continue;
    let l = i[i.length - 1];
    o[0].t === n.t && l?.[l.length - 1].t === n.t ? l.push(...s) : i.push(s);
  }
  return me(i);
}
function qt(e, t) {
  let n = t - C, a = Fe(e, t);
  if (a === null) return null;
  let r = Fe(e, n);
  if (r === null) return null;
  let i = e.segments.find((s) => s[0].t <= n && s[s.length - 1].t >= t), o = null;
  if (i) {
    o = r;
    for (let s of i) s.t > n && s.t <= t && (o = Math.min(o, s.cfs));
    o = Math.min(o, a);
  }
  return { current: a, endpoint: r, low: o };
}
function qn(e, t, n, a, r, i) {
  let o = Fe(t, r);
  if (o === null) return null;
  let s = r - C;
  if (s > a.t) {
    let f = qt(e, r);
    return f && f[i] !== null ? { current: o, base: f[i] } : null;
  }
  if (i === "endpoint") {
    let f = Ne(n, s);
    return G(f) ? { current: o, base: f.cfs, comparisonT: f.t } : null;
  }
  let l = Ne(n, s);
  if (!G(l)) return null;
  let u = n.filter((f) => f.t >= s && f.t <= a.t), c = l.t < s ? [l, ...u] : u;
  if (!u.length || u.some((f) => !G(f)) || c.some((f, g) => g && f.t - c[g - 1].t > de)) return null;
  let p = t.segments.find((f) => f[0].t <= a.t && f[f.length - 1].t >= r);
  if (!p) return null;
  let h = o, d = null;
  for (let f of u) f.cfs <= h && (h = f.cfs, d = f.t);
  for (let f of p) f.t > a.t && f.t <= r && f.cfs < h && (h = f.cfs, d = null);
  return { current: o, base: h, minimumObservedT: d };
}
function Dn(e, t, n, a, r) {
  let i = [], o = (s) => {
    s > n && s <= a && i.push(s);
  };
  if (r === "endpoint") {
    for (let s = 1; s < e.length; s++)
      o(Math.floor((e[s - 1].t + e[s].t) / 2) + C + 1);
    for (let s of e)
      o(s.t - Ae + C), o(s.t + Ae + C + 1);
  } else for (let s of e) o(s.t + C + 1);
  return i.filter((s) => s - C <= t.t);
}
function Pn(e, t, n, a, r = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let s of e.points)
    for (let l of [s.t, s.t + C]) l >= t && l <= n && i.add(l);
  for (let s of ht(t, n))
    i.add(s), s - 1 >= t && i.add(s - 1);
  for (let s of r)
    i.add(s), s - 1 >= t && i.add(s - 1);
  let o = [...i].sort((s, l) => s - l);
  for (let s = 1; s < o.length; s++) {
    let l = o[s - 1], u = o[s], c = (l + u) / 2, p = qt(e, c);
    if (!p || a === "low" && p.low === null) {
      i.add(c);
      continue;
    }
    if (a !== "low") continue;
    let h = e.segments.find((g) => g[0].t <= c - C && g[g.length - 1].t >= c);
    if (!h) continue;
    let d = 1 / 0;
    for (let g of h) g.t > c - C && g.t < c && (d = Math.min(d, g.cfs));
    let f = [
      [Te(h, l - C), Te(h, u - C)],
      [Te(h, l), Te(h, u)],
      ...R(d) ? [[d, d]] : []
    ].filter((g) => g.every(R));
    for (let g = 0; g < f.length; g++) for (let x = g + 1; x < f.length; x++) {
      let L = f[g][0] - f[x][0], m = f[g][1] - f[x][1];
      if (!R(L) || !R(m) || L === m) continue;
      let y = L / (L - m);
      y > 0 && y < 1 && i.add(l + y * (u - l));
    }
  }
  return [...i].sort((s, l) => s - l);
}
function jn(e, t, n, a, r, i) {
  if (!t.available) return { reference: { ...oe(t.reason), steps: [] }, crossing: Ce(t.reason, r) };
  let o = In(e, t, n), s = t.endT, l = n.t, u = Dn(i, n, l, s, a), c = Pn(o, l, s, a, u), p = /* @__PURE__ */ new Set([...ht(l, s), ...u]), h = [], d = [], f = [], g = Ce("comparison_coverage_missing", r), x = 0, L = !1, m = null, y = ($) => {
    if (Fe(t, $) === null) return null;
    let w = qn(o, t, i, n, $, a), T = w?.base;
    if (!w || T === null || !R(T)) return null;
    let V = ge($), W = T + V, H = Ee(w.current, T);
    return R(W) && R(H) ? {
      t: $,
      current: w.current,
      base: T,
      line: W,
      delta: H,
      threshold: V,
      comparisonT: w.comparisonT ?? null,
      minimumObservedT: w.minimumObservedT ?? null
    } : null;
  };
  for (let $ of c) {
    let w = y($);
    if (!w) {
      g.t === null && (L = !0), f.length && h.push(f), f = [], m = null;
      continue;
    }
    if (x++, p.has($)) {
      let T = y($ - 1), V = ge($ - 1) !== w.threshold, W = T && T.base !== w.base && (a === "endpoint" ? T.comparisonT !== w.comparisonT : T.minimumObservedT !== null && T.minimumObservedT + C + 1 === $);
      if (T && f.length && (V || W)) {
        let H = W ? T.line : w.base + ge($ - 1);
        f.push({ t: $, cfs: H }), h.push(f), f = [], H !== w.line && d.push({ t: $, beforeCfs: H, afterCfs: w.line });
      }
    }
    if (f.push({ t: $, cfs: w.line }), g.t === null && w.delta >= w.threshold && !L) {
      let T = w;
      if (m && m.delta < m.threshold && !p.has($) && ge(m.t) === w.threshold) {
        let V = m.t, W = $;
        for (; W - V > 1; ) {
          let H = Math.floor((W + V) / 2), X = y(H);
          !X || X.delta < X.threshold ? V = H : W = H;
        }
        T = y(W) ?? w;
      }
      g = {
        available: !0,
        reason: null,
        t: T.t,
        currentCfs: T.current,
        comparisonCfs: T.base,
        changeCfs: T.delta,
        referenceCfs: T.threshold,
        alreadyReached: T.t === n.t,
        largeAdjustment: r
      };
    }
    m = w;
  }
  f.length && h.push(f), g.t === null && x && !L ? g = { ...Ce(null, r), available: !0, reason: null } : g.t === null && L && (g = Ce("comparison_coverage_missing", r));
  let F = h.map(($) => {
    let w = [];
    for (let T of $)
      w.length >= 2 && w.at(-2).cfs === w.at(-1).cfs && w.at(-1).cfs === T.cfs && w.pop(), w.push(T);
    return w;
  });
  return { reference: { ...me(F), steps: d }, crossing: g };
}
function Fn(e, t) {
  let n = [e, t];
  for (let r = e + xe; r < t; r += xe) n.push(r);
  let a = n.map((r) => {
    let i = ue(r);
    return i.hour >= 8 && (i.hour < 17 || i.hour === 17 && i.minute === 0 && i.second === 0);
  });
  return a.every(Boolean) ? "inside_08_17" : a.every((r) => !r) ? "outside_08_17" : "spans_both";
}
function Hn(e, t) {
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
        let u = Ye(a[l]);
        n.push({
          startT: a[r].t,
          endT: a[i].t,
          cfs: a[r].cfs,
          precedingLow: u,
          riseCfs: a[r].cfs - u.cfs,
          bracketStartT: o.t,
          bracketEndT: s.t,
          clockRange: Fn(o.t, s.t)
        });
      }
      r = i + 1;
    }
  }
  return n.sort((a, r) => a.startT - r.startT);
}
function Bn(e, t, n, a, r, i, o) {
  let s = Je(e), l = t?.data;
  if (!l) return s;
  let u = l.issuedT;
  s.issuedT = M(u) ? u : null, s.issueAgeMs = Le(e, u), s.older = s.issueAgeMs !== null && s.issueAgeMs > 12 * O, s.cases.tableVersion = o?.version ?? null, s.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let c = (m) => ({
    ...Je(e, m),
    issuedT: s.issuedT,
    issueAgeMs: s.issueAgeMs,
    older: s.older,
    cases: { ...s.cases, reason: v(m) }
  });
  if (!M(u)) return c("forecast_issue_missing");
  if (u > e) return c("forecast_issue_future");
  if (e - u > 48 * O) return c("forecast_issue_too_old");
  let p = Lt(l.points).filter((m) => m.t <= e + 10 * C), h = It(p, ke);
  if (!h.segments.some((m) => m[0].t <= e + ke && m[m.length - 1].t >= e + C))
    return c("forecast_next_day_coverage_missing");
  if (s.available = h.available, s.reason = h.reason, s.raw = h, s.crests = Hn(h, i?.t ?? e), s.nextCrest = s.crests[0] ?? null, s.laterHigherCrests = s.nextCrest ? s.crests.slice(1).filter((m) => m.cfs > s.nextCrest.cfs) : [], !G(i)) {
    let y = Je(e, i ? "current_observation_unusable" : "current_observation_unavailable");
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
  let d = Fe(h, i.t);
  if (d === null) {
    let m = Je(e, "forecast_alignment_unsupported");
    return {
      ...s,
      shifted: m.shifted,
      high: m.high,
      low: m.low,
      references: m.references,
      crossings: m.crossings,
      higherLater: m.higherLater,
      cases: { ...s.cases, reason: m.cases.reason }
    };
  }
  let f = Ee(i.cfs, d);
  if (!R(f)) return c("non_finite_arithmetic");
  s.offsetCfs = f, s.largeAdjustment = Math.abs(f) > Math.max(10, 0.1 * i.cfs);
  let g = [], x = [];
  for (let m of h.segments) {
    let y = m.map(($) => ({ t: $.t, cfs: $.cfs + f })), F = Ze(y, ke, !0);
    g.push(...F.segments), x.push(...F.exclusions);
  }
  s.shifted = ft(me(g, { gaps: h.gaps, exclusions: x }), i.t, i.t + 72 * O), s.shifted.points.some((m) => m.t > i.t) || (s.shifted = { ...oe("non_positive_shifted_flow"), exclusions: x, gaps: h.gaps }), s.freshContext = !s.older && !t.error && !n?.error && e - i.t <= 2 * O, s.higherLater = {
    available: !1,
    reason: v("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: s.largeAdjustment
  };
  let L = s.shifted.points.filter((m) => m.t > i.t);
  if (s.freshContext && L.length) {
    let m = L.reduce((y, F) => F.cfs > y.cfs ? F : y);
    s.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: m.cfs > i.cfs,
      peakCfs: m.cfs,
      peakT: m.t,
      largeAdjustment: s.largeAdjustment
    };
  }
  if (s.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(ue(e).month), !s.cases.wetSeason)
    s.cases.reason = v("historical_cases_off_season"), s.high = oe(s.cases.reason), s.low = oe(s.cases.reason);
  else if (!o || o.version !== 3 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    s.cases.reason = v("historical_table_unavailable"), s.high = oe(s.cases.reason), s.low = oe(s.cases.reason);
  else
    try {
      let m = [], y = [], F = [], $ = [];
      for (let w of s.shifted.segments) {
        let T = kt(w, i, o, e), V = w[0]?.t === i.t && i.cfs > 0 ? [Ye(i)] : [], W = Ze([...V, ...T.high], ke, !0), H = Ze([...V, ...T.low], ke, !0);
        m.push(...W.segments), y.push(...H.segments), F.push(...W.exclusions), $.push(...H.exclusions);
      }
      s.high = me(m, { gaps: s.shifted.gaps, exclusions: F }), s.low = me(y, { gaps: s.shifted.gaps, exclusions: $ });
      for (let w of ["high", "low"]) s[w].points.some((T) => T.t > i.t) || (s[w] = { ...oe("historical_case_values_unsupported"), exclusions: s[w].exclusions, gaps: s[w].gaps });
      s.cases.available = s.high.available || s.low.available, s.cases.reason = s.cases.available ? null : v("historical_case_values_unsupported");
    } catch {
      s.cases.reason = v("historical_table_invalid"), s.high = oe(s.cases.reason), s.low = oe(s.cases.reason);
    }
  for (let m of ["shifted", "high", "low"])
    for (let y of ["endpoint", "low"]) {
      let F = jn(r, s[m], i, y, s.largeAdjustment, a);
      s.crossings[m][y] = F.crossing, m === "shifted" && (s.references[y] = F.reference);
    }
  return s;
}
function Wn(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
  for (let c of n?.conflicts ?? []) M(c) && c <= e && c % O === 0 && r.add(c);
  for (let c of n?.hours ?? [])
    if (!(!M(c.endT) || c.endT > e || c.endT % O !== 0)) {
      if (!R(c.mm) || c.mm < 0) {
        r.add(c.endT);
        continue;
      }
      a.has(c.endT) && a.get(c.endT) !== c.mm ? r.add(c.endT) : a.set(c.endT, c.mm);
    }
  let i = [...a.keys(), ...r], o = i.length ? Math.max(...i) : null, s = Le(e, o), l = Ln.map((c) => {
    let p = {
      hours: c,
      available: !1,
      reason: v("radar_unavailable"),
      startT: o === null ? null : o - c * O,
      endT: o,
      ageMs: s,
      mm: null,
      inches: null
    };
    if (o === null) return p;
    let h = 0;
    for (let d = 0; d < c; d++) {
      let f = o - d * O;
      if (r.has(f)) return { ...p, reason: v("radar_conflicting_hour", { endT: f }) };
      if (!a.has(f)) return { ...p, reason: v("radar_missing_hour", { endT: f }) };
      h += a.get(f);
    }
    return R(h) ? { ...p, available: !0, reason: null, mm: h, inches: h / 25.4 } : { ...p, reason: v("non_finite_arithmetic") };
  }), u = l.some((c) => c.available);
  return {
    available: u,
    reason: u ? null : v("radar_windows_unavailable"),
    endT: o,
    generatedT: M(n?.generatedT) ? n.generatedT : null,
    ageMs: s,
    historical: s !== null && s > 2 * O,
    stale: s === null || s > 3 * O,
    windows: l
  };
}
function Gn(e, t) {
  let n = t?.data, a = Le(e, n?.updatedT), r = {
    available: !1,
    reason: v("grid_forecast_unavailable"),
    startT: e,
    endT: e + C,
    updatedT: M(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * O,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return r;
  if (!M(n.updatedT) || n.updatedT > e) return { ...r, reason: v("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((u) => M(u.startT) && M(u.endT) && u.endT > e && u.startT < e + C).sort((u, c) => u.startT - c.startT || u.endT - c.endT), o = e, s = 0, l = !1;
  for (let u of i) {
    if (u.startT >= u.endT || !R(u.mm) || u.mm < 0) return { ...r, reason: v("grid_interval_invalid") };
    let c = Math.max(e, u.startT), p = Math.min(e + C, u.endT);
    if (c < o) return { ...r, reason: v("grid_interval_overlap", { t: c }) };
    if (c > o) return { ...r, reason: v("grid_interval_gap", { startT: o, endT: c }) };
    let h = (p - c) / (u.endT - u.startT);
    s += u.mm * h, l || (l = h !== 1), o = p;
  }
  return o < e + C ? { ...r, reason: v("grid_interval_gap", { startT: o, endT: e + C }) } : R(s) ? { ...r, available: !0, reason: null, mm: s, inches: s / 25.4, prorated: l } : { ...r, reason: v("non_finite_arithmetic") };
}
function Vn(e, t) {
  let n = t?.data, a = Le(e, t?.lastSuccessAt), r = {
    available: !1,
    reason: v("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * O,
    startT: e,
    endT: e + 2 * C,
    events: []
  };
  if (!n) return r;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...r, reason: v("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let l of n.points ?? []) {
    if (!M(l.t) || l.t < e || l.t > e + 2 * C || !R(l.ft) || !["H", "L"].includes(l.type)) continue;
    let u = i.get(l.t);
    u && (u.ft !== l.ft || u.type !== l.type) && o.add(l.t), i.set(l.t, { t: l.t, ft: l.ft, type: l.type });
  }
  let s = [...i.values()].filter((l) => !o.has(l.t)).sort((l, u) => l.t - u.t);
  return { ...r, available: s.length > 0, reason: s.length ? null : v("tide_events_unavailable"), events: s };
}
function Dt({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!M(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, r = Lt(a?.points).filter((g) => g.t <= e), i = r[r.length - 1] ?? null, o = [...r].reverse().find((g) => G(g)) ?? null, s = It(r, de), l = i?.t ?? null, u = je(t.gauge, l, e, 2 * O), c = {
    latest: i,
    lastNumericObservation: o,
    points: r,
    segments: s.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: Le(e, l),
    stale: u.stale,
    referenceCfs: M(l) ? ge(l) : null,
    endpoint: ut(r, l),
    low: dt(r, l),
    references: { endpoint: Nt(r, l, ut), low: Nt(r, l, dt) },
    direction: Un(r, i, e, t.gauge),
    twelveHourChange: Rn(r, i, e, t.gauge),
    history: { endpoint: Et(r, l, ut), low: Et(r, l, dt) }
  }, p = Bn(e, t.noaa, t.gauge, r, s, i, n), h = Wn(e, t.radar), d = Gn(e, t.grid), f = Vn(e, t.tides);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: u,
      noaa: je(t.noaa, p.issuedT, e, 12 * O),
      radar: je(t.radar, h.endT, e, 3 * O),
      grid: je(t.grid, d.updatedT, e, 12 * O),
      tides: je(t.tides, t.tides?.lastSuccessAt, e, 36 * O)
    },
    gauge: c,
    forecast: p,
    rain: { radar: h, grid: d },
    tides: f
  };
}

// site/js/watch-render.js
function Ke(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var b = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), j = (e) => typeof e == "number" && Number.isFinite(e);
function He(e, t = !1) {
  if (!j(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function le(e, t = !1) {
  if (!j(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function Z(e, t = !1) {
  if (!j(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
var pt = (e, t = !1) => b(Z(e, t)).replace(/,/g, ",<wbr>");
function P(e, t = !1) {
  return j(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function z(e) {
  if (!j(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function Pt(e) {
  return j(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var jt = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function ne(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(ne).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return jt[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(jt, {
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
function te(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var Ft = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, gt = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, ae = (e) => `<time datetime="${j(e) ? new Date(e).toISOString() : ""}">${b(P(e, !0))}</time>`;
function Qe(e) {
  let t = (e?.qualityLabel || e?.quality || "quality unknown").replace(/; no qualifier supplied$/, ""), n = t.toLowerCase() === "provisional" ? "not yet finalized" : t, a = { ice: "ice-affected value", malformed_value: "invalid numeric value", negative_value: "invalid negative flow", conflicting_duplicate: "conflicting readings", unsupported_quality: "unsupported quality flag", quality_flags_unavailable: "quality flags unavailable", approval_unavailable: "approval unavailable" }[typeof e?.reason == "object" ? e.reason?.code : e?.reason];
  return a ? `${n} \xB7 ${a}` : n;
}
function Ht(e) {
  return e?.available ? e.distanceCfs === 0 ? `At ${Z(e.referenceCfs)} cfs line` : `${Z(Math.abs(e.distanceCfs))} cfs ${e.distanceCfs > 0 ? "below" : "past"} the ${Z(e.referenceCfs)} cfs line` : "";
}
function Bt(e, t = !1) {
  if (!e?.available) {
    let o = [["Before", e?.before], ["After", e?.after]].filter(([, s]) => s);
    return `${b(ne(e?.reason))}${o.length ? "<br>Nearest readings: " + o.map(([s, l]) => `${s} ${ae(l.t)}: ${Z(l.cfs)} cfs`).join("; ") + "." : ""}`;
  }
  let n = t ? e.minimum : e.comparison, a = P(n.t, !0), r = a.slice(-3) === P(e.current?.t, !0).slice(-3), i = `<time datetime="${new Date(n.t).toISOString()}" title="${b(P(n.t))}">${b(r ? a.replace(/ PST$| PDT$/, "") : a)}</time>`;
  return `${t ? "Low" : "From"} <strong>${Z(n.cfs)} cfs</strong><br>${i}${t || e.elapsedMs === 24 * 36e5 ? "" : `<span class="comparison-interval">${b(z(e.elapsedMs))} earlier</span>`}`;
}
function zn(e, t, n = !1, a = "") {
  return `<div class="metric"><div class="metric-heading"><h3>${b(t)}</h3><div class="metric-value${e?.available ? "" : " unavailable"}">${e?.available ? Z(e.changeCfs, !0) : "Unavailable"}${e?.available ? "<small> cfs</small>" : ""}</div></div><p class="distance" aria-label="Distance from rolling reference">${b(Ht(e))}</p>${a ? `<p class="metric-note">${b(a)}</p>` : ""}<p>${Bt(e, n)}</p></div>`;
}
function Xn(e) {
  let t = e.gauge || {}, n = e.actualCurrentObservation || t.latest, a = t.direction || {}, r = a.available && { rising: "Rising", falling: "Falling", roughly_level: "Roughly level" }[a.label] || "Direction unavailable", i = t.endpoint?.available && t.low?.available && Z(t.endpoint.changeCfs, !0) === Z(t.low.changeCfs, !0), o = t.endpoint?.approximate ? "About 24-hour change" : "24-hour change", s = t.endpoint?.available ? `<div class="rise-source">${Bt(t.endpoint, !1)}</div>` : "", l = gt("flow", "How flow comparisons work", `<p>Flow means water passing the gauge, in cubic feet per second (cfs). The reading time, source quality and age describe this observation.</p><p><strong>24-hour change</strong> compares the reading nearest 24 elapsed hours earlier (within 15 minutes). <strong>Rise from the 24-hour low</strong> compares the lowest actual reading in that same window. They answer different questions and may differ. Missing readings are not filled; gaps over 30 minutes make the comparison unavailable.</p><p>The descriptive line is ${He(t.referenceCfs)} cfs of rolling change: 400 in November\u2013February, 200 in March\u2013April, and 100 in May\u2013October. This is a planning reference; the official live closure calculation has not been confirmed.</p>`), u = i ? "" : `<div class="metrics">${zn(t.low, "Rise from 24h low", !0)}</div>`, c = i ? t.endpoint.changeCfs === t.low.changeCfs ? "24h change; same as rise from 24h low" : "Rounds to same value as rise from 24h low" : "", p = j(n?.cfs) ? `${Z(n.cfs)} cfs` : "Unavailable", h = e.timeUncertain ? "Age unknown" : `${z(t.ageMs)} old${t.stale ? " \xB7 STALE" : ""}`;
  te("current", `<div class="flow-row"><div><div class="section-heading flow-heading"><h2>Flow</h2>${Ft("flow", "About flow readings")}<span class="actual-flow flow-number">Actual flow: ${p} \xB7 ${b(h)}</span></div><div class="rise-headline"><span${i ? ' class="equal-label" title="The 24-hour change and rise from the 24-hour low are rounded for display"' : ""}>${i ? c : o}</span><strong class="distance-headline">${t.endpoint?.available ? b(Ht(t.endpoint)) : "24-hour reference unavailable"}</strong><b class="rise-support">24-hour change: ${t.endpoint?.available ? Z(t.endpoint.changeCfs, !0) + " cfs" : "unavailable"}</b>${s}</div></div><div class="flow-context"><strong title="Measured change over approximately one hour">${b(r)}</strong>${n ? ae(n.t) : ""}<span class="reading-age">${b(Qe(n))}${t.stale && !e.timeUncertain ? " \xB7 STALE" : ""}</span></div></div>${u}<p class="authority">Health authorities decide closures and reopening.</p>${l}`), te("flow-history", ""), document.getElementById("current").setAttribute("aria-busy", "false");
  let d = j(n?.cfs) ? pt(n.cfs) : "\u2014", f = e.timeUncertain ? "Age unknown" : z(t.ageMs).replace("less than 1 minute", "<1m").replace(" minutes", "m").replace(" minute", "m");
  te("number-strip", `<span aria-label="Actual flow ${b(p)}, ${b(e.timeUncertain ? "age unknown" : z(t.ageMs) + " old")}${t.stale && !e.timeUncertain ? " and stale" : ""}">Flow (cfs) <strong>${d}</strong><small>${b(f)}${t.stale && !e.timeUncertain ? " \xB7 STALE" : ""}</small></span><span aria-label="Rolling 24-hour change ${t.endpoint?.available ? Z(t.endpoint.changeCfs, !0) + " cfs" : "unavailable"}">24h change <strong>${t.endpoint?.available ? pt(t.endpoint.changeCfs, !0) : "\u2014"}</strong></span><span aria-label="Rise from 24-hour low ${t.low?.available ? Z(t.low.changeCfs, !0) + " cfs" : "unavailable"}">Low rise <strong>${t.low?.available ? pt(t.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function Jn(e, t = !1) {
  return (e || []).map((n) => b(t && ["rate_limited", "rate_limit", "rate_suppression"].includes(typeof n == "string" ? n : n?.code) ? "Saved monitoring updates are temporarily rate-limited; this page only displays saved status." : ne(n))).filter((n, a, r) => r.indexOf(n) === a).join(" ");
}
function Zn(e, t, n, a, { publicView: r = !1 } = {}) {
  let i = e.monitor?.summary || {}, o = i.capability || {}, s = i.preparation || {}, l = i.support || {}, c = j(i.supportObservationT) && a - i.supportObservationT > 60 * 6e4 ? { ...o, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: [...o.reasons || [], "observation_older_than_60min"] } : o, p = j(n?.lastCommitAt) ? a - n.lastCommitAt : null, h = !!n?.workerStale || j(p) && p > 12 * 6e4, d = i.standing, f = d?.active === !0 && (d.kind === "correction" || d.state === "rising_again"), g = { unarmed: "No downturn detected yet", tracking: "Watching for a turn", possible_downturn: "Possible downturn \u2014 it may reverse", ended: "Earlier event retained for reference" }[i.phase] || "Turn monitor is starting";
  f && i.phase !== "ended" && (g = "Rising again after a possible downturn"), c.status === "unavailable" || h ? g = "Turn monitoring unavailable" : c.status === "partial" ? g = "New downturn checks unavailable" : c.status === "warming_up" && (g = "Turn checks are warming up");
  let x = e.monitor?.transitions || [], L = (K) => ["downturn", "possible_downturn"].includes(K?.kind), m = i.phase === "ended" && (L(d) ? d : d ? null : Ke(x, L)), y = m && Ke(x, (K) => L(K) && K.t === (m.t ?? m.observationT)), F = y && x.some((K) => K.kind === "event_end" && K.event === y.event && K.detected_at === y.detected_at), $ = m ? `A possible downturn was recorded at ${ae(m.t ?? m.observationT)} \xB7 ${He(m.cfs ?? Number(m.q))} cfs. The event grouping has ended; this turn remains earlier evidence.${F ? " The turn and event end were recorded in the same check, so no current-turn preview was prepared." : ""}` : j(d?.t) ? `${d.active === !0 ? "" : "Earlier event: "}${d.kind === "correction" || d.state === "rising_again" ? "Rising again after a possible downturn; correction observed" : "Possible downturn recorded"} at ${ae(d.t)} \xB7 ${He(d.cfs)} cfs.${d.active === !0 ? "" : " This is earlier evidence, separate from the current event."}` : "", w = j(s.nextEligibleAt) && s.nextEligibleAt > a ? r ? ` Saved monitoring status is rate-limited until ${P(s.nextEligibleAt, !0)}.` : ` River-warning previews are rate-limited until ${P(s.nextEligibleAt, !0)}.` : "", T = h ? r ? " The published snapshot is old; current monitoring status cannot be confirmed." : " The monitor has not saved a recent check; silence does not mean no turn." : "", V = c.status === "partial" ? " Above-high corrections remain available." : "", W = Qe(t.actualCurrentObservation), H = t.actualCurrentObservation?.eligible === !1 ? `Latest quality: ${W}; this reading cannot support an automatic turn notice.` : "", X = t.gauge?.direction, Ve = X?.available ? `Measured hour change: ${le(X.changeCfs, !0)} cfs over ${z(X.elapsedMs)}, from ${le(X.comparison?.cfs)} to ${le(X.current?.cfs)} cfs. The roughly-level tolerance is ${le(X.toleranceCfs)} cfs, an engineering choice, not instrument precision. These hour-change values are rounded for readability.` : ne(X?.reason), J = t.gauge?.twelveHourChange, D = !t.timeUncertain && J?.available, pe = D ? `${J.approximate ? "About " : ""}12h net: ${le(J.changeCfs, !0)} cfs` : "12h net unavailable", st = D ? `Net observed change over ${z(J.elapsedMs)}: ${le(J.comparison.cfs)} cfs at ${P(J.comparison.t, !0)} to ${le(J.current.cfs)} cfs at ${P(J.current.t, !0)}. This can include rises and dips; it is not time spent continuously falling. Endpoint quality: ${Qe(J.comparison)}; ${Qe(J.current)}. ${(t.gauge?.points || []).some((K) => K.t >= J.comparison.t && K.t <= J.current.t && K.eligible === !1) ? "Includes readings that cannot support automatic turn checks. " : ""}Provisional or estimated values may be revised.` : `12-hour net change unavailable. ${t.timeUncertain ? ne("public_time_uncertain") : ne(J?.reason)}`;
  te("monitor", `<details><summary><h2>${b(g)}</h2><span id="twelve-hour-change">${b(pe)} \xB7 Details</span></summary><p>Experimental checks follow observed river flow. A possible turn can reverse.</p><p>${b(Ve)}</p><p id="twelve-hour-detail">${b(st)}</p><p>${Jn([...c.reasons || [], ...s.blockingReasons || []], r)}</p><p>${l.monitoringGapMs ? `Recorded monitoring gap: ${b(z(l.monitoringGapMs))}. ` : ""}These event groupings do not set a sampling deadline or reset a closure rule. ${r ? "Display only \xB7 no alerts sent. This page does not prepare or send alerts." : "Warning delivery is disabled."}</p></details>${$ || V || w || T ? `<p class="monitor-fact">${$}${b(V + w + T)}</p>` : ""}${H ? `<p>${b(H)}</p>` : ""}`), document.getElementById("monitor").classList.toggle("attention", c.status === "unavailable" || c.status === "partial" || h);
}
var Yn = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function Wt(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return ne("public_time_uncertain");
  let a = ne(t);
  return e.timeUncertain && Yn.includes(n) ? `At the snapshot save time: ${a}` : a;
}
function Qn(e, t) {
  let n = e.forecast || {}, a = (f) => Wt(e, f);
  te("forecast-age", n.issuedT ? `Issued ${ae(n.issuedT)} \xB7 ${b(e.timeUncertain ? "age unknown" : z(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${b(a(n.reason))}` : ""}` : `Forecast unavailable. ${b(a(n.reason))}`);
  let r = [];
  e.sources?.noaa?.error && r.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && r.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${le(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? r.push({ text: a(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && r.push(`Adjusted forecast unavailable. ${a(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && r.push(`Historical cases unavailable. ${a(n.cases.reason)}`), te("forecast-problems", r.map((f) => `<p${typeof f == "object" && f.neutral ? ' class="neutral"' : ""}>${b(typeof f == "object" ? f.text : f)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (i && r.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let l = n.crossings?.shifted?.[t.reference], u = l?.available ? j(l.t) ? `The adjusted forecast ${l.alreadyReached ? "already meets" : "first reaches"} the reference at ${P(l.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${a(l?.reason)}`, c = j(n.offsetCfs) ? `Adjustment to the gauge reading: ${le(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", p = Date.parse(n.cases?.trainingCutoff ?? ""), h = j(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${He(n.cases.tableVersion)}${j(p) ? `; training cutoff ${ae(p)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  te("forecast-details", gt("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier measurements or the adjusted forecast; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${j(n.raw?.endT) ? `; available through ${ae(n.raw.endT)}` : ""}.</p><p>${b(c)} ${n.available === !1 ? `The issued forecast is unavailable. ${b(a(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${b(u)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. Cases extend up to 72 hours from the latest reading in October\u2013April. A low case stops when its historical subtraction reaches zero; this does not predict a dry river. Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.</p>${h}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function Kn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${P(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : z(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", r = t.windows || [2, 4, 6, 8, 12, 18, 24].map((s) => ({ hours: s, available: !1 })), i = [...new Set(r.filter((s) => !s.available).map((s) => ne(s.reason || t.reason)))], o = gt("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over the drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. Radar cannot confirm whether rain has stopped upriver.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  te("rain", `<div class="section-heading"><h2>Rain</h2>${Ft("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${b(a)}</p><div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${r.map((s) => `<div class="rain-total" aria-label="${s.hours}-hour total ending ${b(P(s.endT ?? t.endT, !0))}, ${b(e.timeUncertain ? "age unknown" : z(s.ageMs ?? t.ageMs) + " old")}"><span>${s.hours} hours</span><strong>${s.available ? Pt(s.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map(b).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${Pt(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${b(ne(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${ae(n.updatedT)} \xB7 ${b(e.timeUncertain ? "age unknown" : z(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function ea(e, t) {
  let n = e.forecast || {};
  if (n.available === !1) {
    te("peaks", `<div class="section-top"><h2>Forecast peaks unavailable</h2></div><p class="meta">${b(Wt(e, n.reason))}</p>`);
    return;
  }
  let a = Array.isArray(n.crests) ? n.crests : [n.nextCrest, ...n.laterHigherCrests || []].filter(Boolean), r = Math.max(e.nowMs, e.gauge?.latest?.t ?? -1 / 0), i = [...a].filter((d) => e.timeUncertain || d.endT > r).sort((d, f) => d.startT - f.startT), o = i[0], s = o ? [o, ...i.slice(1).filter((d) => d.cfs > o.cfs)] : [], l = !e.timeUncertain && o && o.startT <= e.nowMs && o.endT > e.nowMs, u = e.timeUncertain ? e.gauge?.latest?.t : e.nowMs, c = j(u) ? t.range === "full" ? Math.max(u + 36e5, n.raw?.endT ?? u + 72 * 36e5) : u + (t.range === "day" ? 24 : 72) * 36e5 : 1 / 0, p = (d) => `<time datetime="${new Date(d).toISOString()}">${b(P(d))}</time>`, h = s.map((d, f) => `<article class="peak-card"><p class="eyebrow">${f === 0 ? e.timeUncertain ? "First listed forecast peak" : l ? "Forecast plateau in progress" : "Next local peak" : "Later peak above the first"}</p><h3>${p(d.startT)}${d.endT !== d.startT ? ` to ${p(d.endT)}` : ""}</h3><p class="peak-values"><strong class="peak-flow">${Z(d.cfs)} cfs</strong><span>Issued forecast flow</span><span>${Z(d.riseCfs, !0)} cfs from prior forecast low</span></p><p class="meta">${d.endT !== d.startT ? "Several forecast readings at this level" : "One forecast reading at this time"}; timing is uncertain.${f === 0 && l ? " This forecast plateau spans the current time; its end is still ahead." : ""}${d.startT > c ? " Outside the selected chart range." : ""}</p>${f === 0 ? '<p class="sampling-lines"><strong>River samples:</strong> around the river peak and afterward, as early as possible; no fixed hours-after-peak deadline.<br><strong>Bay samples:</strong> within six hours after the river peak for a qualifying pollution closure; tide and laboratory availability also matter.</p>' : ""}<details class="peak-resolution"><summary>Surrounding issued times</summary><p>${p(d.bracketStartT)} to ${p(d.bracketEndT)}. ${{ inside_08_17: "Both are between 8 AM and 5 PM", outside_08_17: "Both are outside 8 AM\u20135 PM", spans_both: "This interval spans daytime and overnight hours" }[d.clockRange] || "Clock range unavailable"}.</p></details></article>`).join("");
  te("peaks", `<div class="section-top"><h2>${e.timeUncertain ? "Peaks in the saved forecast" : l ? "Forecast peak in progress" : "Next river peak"}</h2></div><p class="meta">Peak values use the issued forecast, without a gauge adjustment.${e.timeUncertain ? " Current time is uncertain; these are saved forecast points." : ""}</p>${h ? `<div class="peak-grid">${h}</div>` : `<p class="meta">${e.timeUncertain ? "No supported peak is identifiable in this saved forecast." : "No supported upcoming peak is identifiable."} A rising or level tail does not establish a crest.</p>`}`);
}
function ta(e) {
  let t = e.tides || {};
  te("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + b(z(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${ae(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${He(n.ft)}</td></tr>`).join("")}</tbody></table>` : `<p>${b(ne(t.reason))}</p>`}</div>`);
}
function na(e, t, n) {
  te("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", tides: "NOAA Bellingham tide predictions" }).map(([r, i]) => {
    let o = t.sources?.[r] || {}, s = n?.sources?.[r] || {};
    return `<div class="source-row"><strong>${b(i)}</strong>${r === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>Data time: ${ae(o.dataT)} \xB7 ${b(t.timeUncertain ? "age unknown" : z(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${ae(s.lastSuccessAt ?? o.lastSuccessAt)}.${s.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot saved ${ae(e.createdAt)}. This save time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}
function Gt(e, t, n, a, r, i = {}) {
  Xn(t), Zn(e, t, n, r, i), Qn(t, a), Kn(t), ea(t, a), ta(t), na(e, t, n);
  let o = t.gauge?.exclusions || [], s = {};
  for (let l of o) {
    let u = typeof l.reason == "string" ? l.reason : l.reason?.code || "unspecified";
    s[u] = (s[u] || 0) + 1;
  }
  document.getElementById("sources").insertAdjacentHTML("beforeend", `<p>Gauge source exclusions: ${o.length} recorded exclusions${o.length ? ". " + Object.entries(s).map(([l, u]) => `${u} ${b(ne(l))}`).join(" ") : "."} These records do not support automatic notices.</p>`), te("snapshot-label", `Saved snapshot ${b(e.id)} \xB7 ${b(P(e.createdAt))}`);
}

// site/js/watch-chart.js
var U = Number.isFinite, I = null, aa = (e, t, n) => U(e?.t) && U(e?.cfs) && e.t >= t && e.t <= n;
function et(e, t, n) {
  for (let a of e || []) {
    let r = Ke(a, (i) => i.t === t);
    if (r) return r.cfs;
    for (let i = 1; i < a.length; i++) {
      let o = a[i], s = a[i - 1];
      if (s.t < t && o.t > t)
        return o.t - s.t > n ? null : s.cfs + (o.cfs - s.cfs) * (t - s.t) / (o.t - s.t);
    }
  }
  return null;
}
function Vt(e, t, n, a) {
  let r = e.filter((i) => aa(i, t, n));
  for (let i of [t, n])
    if (!r.some((o) => o.t === i)) {
      let o = et([e], i, a);
      U(o) && r.push({ t: i, cfs: o });
    }
  return r.sort((i, o) => i.t - o.t);
}
function sa(e, t, n) {
  return e.map((a, r) => `${r ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function ra(e, t, n) {
  return (e?.segments || []).map((a) => {
    let r = Vt(a, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !a.length || i.t < a[0].t || i.t > a.at(-1).t) continue;
      let o = r.findIndex((l) => l.t >= i.t), s = o < 0 ? r.length : o;
      for (; r[s]?.t === i.t; ) r.splice(s, 1);
      r.splice(s, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return r;
  });
}
var ia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function mt(e) {
  let t = Object.fromEntries(ia.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function oa(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - mt(t);
  return t;
}
function la(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), r = mt(e), i = mt(t), o = [];
  for (let s of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let l = Math.min(s, 12) * 36e5, u = [];
    for (let p = Math.ceil(r / l) * l; p <= i + 36e5; p += s * 36e5) {
      let h = oa(p);
      h >= e && h <= t && u.push(h);
    }
    if (u.length < 2) continue;
    o = u;
    let c = Math.min(...u.slice(1).map((p, h) => (p - u[h]) / (t - e) * n));
    if (u.length <= a && c >= 40) return u;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function Oe(e, t, n) {
  let a = Math.max(1, Math.floor(e.clientWidth)), r = globalThis.innerHeight, i = a < 500 ? 240 : U(r) && r < 500 ? Math.max(180, Math.min(280, r - 80)) : 280, o = { left: Math.min(49, a / 4), right: Math.min(14, a / 4), top: 26, bottom: 38 }, s = o.left, l = a - o.right, u = o.top, c = i - o.bottom, p = t.gauge?.latest?.t, h = Math.round(t.nowMs), d = document.getElementById("chart-cursor");
  if (t.timeUncertain && !U(p)) {
    let _ = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${a} ${i}" width="${a}" height="${i}" role="img" aria-label="${_}"><text x="${a / 2}" y="${i / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${a / 2}" y="${i / 2 + 4}" text-anchor="middle">${a < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let S of document.querySelectorAll?.(".legend span") ?? []) S.hidden = !0;
    I = null, d.min = "0", d.max = "1", d.step = "1", d.value = "0", d.disabled = !0, d.style.marginLeft = `${s - 10}px`, d.style.width = `${l - s + 20}px`, d.setAttribute("aria-valuetext", _), document.getElementById("chart-readout").textContent = _;
    return;
  }
  let f = t.timeUncertain ? p : h, g = f - Number(n.past || 24) * 36e5, x = n.range === "full" ? Math.max(f + 36e5, t.forecast?.raw?.endT ?? f + 72 * 36e5) : f + (n.range === "day" ? 24 : 72) * 36e5, L = t.forecast || {}, m = t.gauge?.references?.[n.reference], y = L.references?.[n.reference], F = { segments: [...m?.segments || [], ...y?.segments || []], steps: [...m?.steps || [], ...y?.steps || []] }, $ = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: L.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: L.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: L.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: L.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: "24-hour rise reference", segments: ra(F, g, x), gap: 1 / 0 }].map((_) => ({ ..._, visible: _.key === "reference" ? _.segments : _.segments.map((S) => Vt(S, g, x, _.gap)) })), w = $.flatMap((_) => _.visible.flat()).filter((_) => U(_.cfs)), T = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let _ of document.querySelectorAll?.(".legend span") ?? []) {
    let S = T[_.querySelector("i")?.className];
    _.hidden = !!S && !$.some((ye) => ye.key === S && ye.visible.some((lt) => lt.length));
  }
  let V = Math.max(10, ...w.map((_) => _.cfs)) * 1.08, W = V / 4, H = Math.pow(10, Math.floor(Math.log10(W))), X = W / H, Ve = (X <= 1 ? 1 : X <= 2 ? 2 : X <= 5 ? 5 : 10) * H, J = Ve * 4, D = (_) => s + (_ - g) / (x - g) * (l - s), pe = (_) => c - _ / J * (c - u), st = Array.from({ length: 5 }, (_, S) => Ve * S), K = la(g, x, l - s), ln = st.map((_) => `<line class="grid" x1="${s}" x2="${l}" y1="${pe(_)}" y2="${pe(_)}"/><text x="${s - 7}" y="${pe(_) + 4}" text-anchor="end">${b(le(_))}</text>`).join("") + K.map((_) => {
    let S = D(_), ye = S < 24 ? "start" : S > a - 24 ? "end" : "middle", lt = `<tspan x="${S}">${b(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(_))}</tspan><tspan x="${S}" dy="14">${b(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(_))}</tspan>`;
    return `<text class="x-axis-label" x="${S}" y="${i - 24}" text-anchor="${ye}">${lt}</text>`;
  }).join(""), cn = $.map((_) => _.visible.filter((S) => S.length).map((S) => S.length === 1 ? `<circle class="${_.key}" cx="${D(S[0].t)}" cy="${pe(S[0].cfs)}" r="2" fill="var(--${_.key === "observed" ? "obs" : _.key})"/>` : `<path class="plot-line ${_.key}" d="${sa(S, D, pe)}"/>`).join("")).join(""), $t = et(F.segments, g, 1 / 0) ?? et(F.segments, f, 1 / 0), _e = U($t) ? pe($t) : u + 14;
  _e = _e - u > 32 ? _e - 10 : _e + 24, _e = Math.max(u + 12, Math.min(c - 6, _e));
  let un = $.find((_) => _.key === "reference")?.visible.flat() || [], ze = un.reduce((_, S) => !_ || S.t > _.t ? S : _, null), Xe = ze ? Math.max(s + 4, Math.min(l - 88, D(ze.t) - 84)) : s + 4, Tt = _e, dn = Xe + 84, fn = U(n.cursorT) && n.cursorT >= g && n.cursorT <= x ? D(n.cursorT) : null, hn = U(p) && p >= g && p <= x ? D(p) : null, pn = ze && D(ze.t) - s >= 84, gn = [fn, hn].some((_) => U(_) && _ >= Xe && _ <= dn), mn = l - s < 200 || !pn || gn ? "" : `<rect class="reference-label-bg" x="${Xe}" y="${Tt - 12}" width="84" height="16" rx="3"/><text class="reference-label" x="${Xe + 4}" y="${Tt}">24h rise line</text>`, xt = t.timeUncertain && l - s < 132, vn = t.timeUncertain ? xt ? "Last reading" : "Last saved river reading" : "Latest observed", bn = t.timeUncertain ? xt ? 80 : 132 : 90, _n = U(p) && p >= g && p <= x ? `<line x1="${D(p)}" x2="${D(p)}" y1="${u}" y2="${c}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(s, Math.min(l - bn, D(p) + 5))}" y="${u - 9}">${vn}</text>` : "", wn = !t.timeUncertain && h >= g && h <= x ? `<line class="now" x1="${D(h)}" x2="${D(h)}" y1="${u}" y2="${c}"/><text x="${Math.min(l - 25, D(h) + 5)}" y="${u + 15}">Now</text>` : "", we = U(n.cursorT) ? Math.max(g, Math.min(x, n.cursorT)) : null, yn = we !== null ? `<line class="cursor" x1="${D(we)}" x2="${D(we)}" y1="${u}" y2="${c}"/>` : "", ie = U(p) ? p + 72 * 36e5 : null, $n = U(L.raw?.endT) && L.raw.endT > ie && (L.raw?.segments || []).some((_) => _.some((S) => U(S.cfs) && S.t > ie)), rt = n.range === "full" && U(ie) && ie > g && x - ie > 6 * 36e5 && $n, it = rt ? l - D(ie) : 0, Tn = rt ? `<g class="forecast-horizon"><title>72-hour context limit: ${b(P(ie, !0))}. Beyond this limit only supported official forecast points can be shown. Adjustments, past cases and moving references are limited to at most 72 hours.</title><rect x="${D(ie)}" y="${u}" width="${it}" height="${c - u}" fill="currentColor" opacity=".04"/><line x1="${D(ie)}" x2="${D(ie)}" y1="${u}" y2="${c}" stroke="currentColor" stroke-dasharray="3 4" opacity=".55"/>${it >= 65 ? `<rect x="${l - 68}" y="${u + 6}" width="67" height="33" rx="3" fill="var(--surface)" opacity=".95"/><text x="${l - 4}" y="${u + 19}" text-anchor="end"><tspan x="${l - 4}">After 72h</tspan><tspan x="${l - 4}" dy="14">Official only</tspan></text>` : ""}</g>` : "", xn = $.some((_) => _.segments.some((S) => S.some((ye) => U(ye.t) && U(ye.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${a} ${i}" width="${a}" height="${i}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. Observations and forecast paths from ${b(P(g, !0))} through ${b(P(x, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${s}" y="${u}" width="${l - s}" height="${c - u}"/></clipPath></defs>${ln}<g clip-path="url(#plot-clip)">${Tn}${cn}${yn}</g>${mn}${_n}${wn}${w.length ? "" : `<text x="${(s + l) / 2}" y="${i / 2}" text-anchor="middle">${xn}</text>`}</svg>${rt && it < 65 ? '<p class="meta forecast-horizon-caption">After 72h: official forecast only, where supported.</p>' : ""}`, I = { lines: $, hasData: w.length > 0, start: g, end: x, left: s, right: l, width: a, host: e, contextLimit: ie }, d.min = String(g), d.max = String(x), d.step = "1", d.disabled = !I.hasData, d.style.marginLeft = `${s - 10}px`, d.style.width = `${l - s + 20}px`;
  let ot = we ?? Math.max(g, Math.min(x, U(p) ? p : h));
  d.value = String(Math.round(ot)), d.setAttribute("aria-valuetext", t.timeUncertain ? `${we === null ? "Last saved river reading" : "Saved chart selection"}: ${P(ot)}. Current time is unconfirmed.` : P(ot)), we !== null ? ca(we) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function ca(e) {
  if (!I) return;
  let t = I.lines.map((n) => {
    let a = et(n.visible, e, n.gap);
    return U(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${b(P(e))}</strong><br>${t.map(b).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}${U(I.contextLimit) && e > I.contextLimit ? '<br><span class="meta">Beyond 72 hours: official forecast only, where supported. Other comparisons are limited to 72 hours.</span>' : ""}`;
}
function zt(e) {
  if (!I?.hasData) return null;
  let t = I.host.getBoundingClientRect(), n = t.width / I.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - I.left) / (I.right - I.left)));
  return Math.round(I.start + a * (I.end - I.start));
}
function vt() {
  if (!I?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return U(e) ? Math.max(I.start, Math.min(I.end, e)) : null;
}
function Xt(e) {
  let t = vt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? I.start : e === "End" ? I.end : U(n[e]) ? Math.max(I.start, Math.min(I.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var Jt = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var da = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", Qt = new URL("./", import.meta.url), Kt = "samish.public.preview.packet.v1", en = "samish.public.preview.preferences.v1", tt = 9466848e5, Ie = 41024448e5, Me = 5 * 6e4, tn = 2 * 1024 * 1024, A = (e) => document.getElementById(e), qe = Number.isFinite;
function De() {
  let e = A("number-strip"), t = A("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", De, { passive: !0 });
window.addEventListener("resize", De);
function yt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = A(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function _t(e, t, n = !1) {
  let a = A(e), r = A(`${e}-toggle`);
  if (!(!a || !r) && (a.open = t, yt(), De(), n)) {
    r.focus({ preventScroll: !0 });
    let i = A("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, s = r.getBoundingClientRect();
    (s.top < o + 8 || s.bottom > innerHeight - 8) && r.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), De();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), _t(t.dataset.helpTarget, !A(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), _t(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || A(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), _t(t.id, !1, !0));
});
yt();
var nn = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, an = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, q = () => {
  throw new Error("invalid_public_packet");
};
function E(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && q(), e;
}
function re(e, t = !1, n = !1, a = !1, r = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !qe(e) || !n && e < 0 || a && !Number.isInteger(e) || e > r) && q();
}
function k(e, t = !1) {
  re(e, t, !1, !0, Ie), e !== null && e < tt && q();
}
function Ue(e) {
  typeof e != "boolean" && q();
}
function se(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && q();
}
function ce(e, t, n) {
  (!Array.isArray(e) || e.length > t) && q(), e.forEach(n);
}
var fa = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], ha = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], pa = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function wt(e, t = !1) {
  E(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), k(e.t, t), "cfs" in e && re(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && Ue(e[n]);
  "approval" in e && se(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && se(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && se(e[n], pa);
  "reason" in e && se(e.reason, fa, !0);
}
function Be(e, t = !1) {
  e !== null && (E(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), k(e.t), re(e.cfs, !0), t && k(e.eligibleT, !0));
}
function ga(e, t) {
  E(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), k(t.lastAttemptAt, !0), k(t.lastSuccessAt, !0), se(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (E(n, ["points", "exclusions", "coveredWindow"]), ce(n.points, 4096, (a) => wt(a)), ce(n.exclusions, 4096, (a) => wt(a, !0)), n.coveredWindow !== null)) {
      let a = E(n.coveredWindow, ["startT", "endT", "complete"]);
      k(a.startT), k(a.endT), (a.complete !== !0 || a.startT > a.endT) && q();
    }
    if (e === "noaa" && (E(n, ["issuedT", "points", "conflicts"]), k(n.issuedT), ce(n.points, 1024, (a) => {
      E(a, ["t", "cfs"]), k(a.t), re(a.cfs);
    }), ce(n.conflicts, 1024, (a) => k(a))), e === "radar") {
      E(n, ["generatedT", "hours", "conflicts"]), k(n.generatedT);
      let a = (r) => {
        k(r), r % 36e5 && q();
      };
      ce(n.hours, 256, (r) => {
        E(r, ["endT", "mm"]), a(r.endT), re(r.mm, !0);
      }), ce(n.conflicts, 256, a);
    }
    e === "grid" && (E(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), k(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && q(), ce(n.periods, 1024, (a) => {
      E(a, ["startT", "endT", "mm"]), k(a.startT), k(a.endT), re(a.mm, !0), a.endT <= a.startT && q();
    })), e === "tides" && (E(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && q(), ce(n.points, 128, (a) => {
      E(a, ["t", "ft", "type"]), k(a.t), re(a.ft, !1, !0), se(a.type, ["H", "L"]);
    }));
  }
}
function ma(e) {
  E(e, ["summary", "transitions"]);
  let t = E(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && q(), k(t.asOf), se(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && wt(t.actualCurrentObservation), k(t.supportObservationT, !0), t.event !== null) {
    let o = E(t.event, ["openedT", "high", "cycle"]);
    k(o.openedT), Be(o.high);
    let s = E(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    re(s.ordinal, !1, !1, !0, 1e5), k(s.openedT), Be(s.high, !0), Be(s.low), Ue(s.endingPending);
  }
  if (t.standing !== null) {
    let o = E(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    se(o.kind, ["downturn", "correction"]), se(o.state, ["possible_downturn", "rising_again"]), k(o.t), k(o.detectedAt), re(o.cfs), Ue(o.active), Be(o.supportingHigh), Be(o.low);
  }
  let n = (o) => ce(o, 16, (s) => se(s, ha)), a = E(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  se(a.status, ["available", "warming_up", "partial", "unavailable"]), Ue(a.newDownturnAvailable), Ue(a.aboveHighCorrectionAvailable), n(a.reasons);
  let r = E(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(r.blockingReasons), k(r.nextEligibleAt, !0);
  let i = E(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  k(i.lastSuccessfulPollAt, !0), re(i.monitoringGapMs, !0, !1, !1, Ie), re(i.observationAgeMs, !0, !1, !1, Ie), ce(i.missingQuarterHours, 7, (o) => k(o)), Ue(i.clockTrusted), ce(e.transitions, 32, (o) => {
    E(o, ["kind", "t", "cfs", "event", "detected_at"]), se(o.kind, ["downturn", "event_end"]), k(o.t), k(o.detected_at), re(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && q();
  });
}
async function sn(e) {
  E(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && q();
  let t = new TextEncoder().encode(e.payload);
  t.length > tn && q(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && q();
  let a = JSON.parse(e.payload);
  E(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && q(), k(a.publishedAt);
  let r = E(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (r.schemaVersion !== 1 || typeof r.id != "string" || !/^[a-f0-9]{12}$/.test(r.id)) && q(), k(r.createdAt), a.publishedAt < r.createdAt && q();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return E(r.sources, i), i.forEach((o) => ga(o, r.sources[o])), ma(r.monitor), r.monitor.summary.asOf !== r.createdAt && q(), a;
}
var Re = nn(en) || {}, N = { range: ["day", "three", "full"].includes(Re.range) ? Re.range : "three", past: Re.past === 48 ? 48 : 24, reference: Re.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(Re.theme) ? Re.theme : null, cursorT: null };
N.theme && (document.documentElement.dataset.theme = N.theme);
var ee = null, Ge = null, B = null, bt = !1, Q = "waiting", ve = null, We = null, nt = !0, be = !1, fe = Date.now(), at = () => an(en, { range: N.range, past: N.past, reference: N.reference, theme: N.theme });
function va() {
  let e = Date.now(), t = ve ? Math.max(0, performance.now() - ve.mono) : 0, n = ve ? ve.lower + t : null, a = ve ? ve.upper + t : null;
  fe = Math.max(fe, e, a ?? 0, ee?.snapshot.createdAt ?? 0);
  let r = nt || !ve || e < n - Me || e > a + Me || e + Me < fe || ee && ee.snapshot.createdAt > a + Me;
  return { now: fe, uncertain: r };
}
function rn() {
  return We ? We.now + Math.max(0, performance.now() - We.mono) : 0;
}
function ba() {
  Ge && an(Kt, { packet: Ge, greatestNow: fe, trustedNow: rn(), savedDeviceMs: Date.now(), ended: be });
}
function Zt(e) {
  let t = A("connection");
  if (!ee) {
    t.textContent = be ? "Preview ended. No current readings are provided." : Q === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - ee.snapshot.createdAt), a = Q !== "checked";
  if (!be && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${z(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [be ? "Preview ended. Earlier readings are retained for reference." : a ? Q === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : Q === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current monitoring is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${P(ee.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${z(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current direction and monitoring availability are withheld." : ""].join(" "), t.className = "connection attention";
}
function he() {
  let e = va();
  if (!ee) {
    Zt(e);
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((c) => c.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((c) => [...A(c).querySelectorAll("details:not(.section-help)")].flatMap((p, h) => p.open ? [`${c}:${h}`] : [])), r = ee.snapshot, i = e.uncertain ? r.createdAt : e.now;
  B = Dt({ nowMs: i, sources: r.sources, ratioTable: Jt });
  let o = be || e.uncertain || Q !== "checked" || e.now - r.createdAt > 12 * 6e4;
  B.timeUncertain = e.uncertain, e.uncertain && (B.forecast.freshContext = !1, B.forecast.higherLater = { ...B.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let s = r.monitor.summary, l = !qe(s.supportObservationT) || i - s.supportObservationT > 60 * 6e4;
  if (o) {
    let c = { code: be ? "preview_ended" : e.uncertain ? "public_time_uncertain" : Q !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" };
    B.gauge.direction = { ...B.gauge.direction, available: !1, reason: c }, B.gauge.twelveHourChange = { ...B.gauge.twelveHourChange, available: !1, reason: c };
  }
  let u = r;
  if (o || l || !s.support.clockTrusted) {
    let c = [...s.capability.reasons, ...l ? [qe(s.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...s.support.clockTrusted ? [] : ["clock_uncertain"]];
    u = { ...r, monitor: { ...r.monitor, summary: { ...s, capability: { ...s.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: c }, preparation: { ...s.preparation, nextEligibleAt: null } } } };
  }
  Gt(u, B, e.uncertain ? null : { lastCommitAt: r.createdAt, workerStale: e.now - r.createdAt > 12 * 6e4 }, N, i, { publicView: !0 });
  for (let c of A("forecast-details").querySelectorAll("a")) c.getAttribute("href") === "/data/ratio_table.json" && (c.href = new URL("ratio_table.json", Qt).href, c.textContent = "View the frozen historical-case table");
  a.forEach((c) => {
    let [p, h] = c.split(":"), d = A(p).querySelectorAll("details:not(.section-help)")[Number(h)];
    d && (d.open = !0);
  }), yt(n), document.querySelectorAll("[data-range]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.range === N.range))), A("past").value = String(N.past), A("reference").value = N.reference, Oe(A("chart"), B, N), Zt(e), De(), ba(), t && A(t) && document.activeElement?.id !== t && A(t).focus({ preventScroll: !0 });
}
async function on(e, t = tn * 2) {
  let n = new AbortController(), a = setTimeout(() => n.abort(), 18e3);
  try {
    let r = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!r.ok) throw new Error("unavailable");
    let i = await r.text();
    return new TextEncoder().encode(i).length > t && q(), { response: r, value: JSON.parse(i) };
  } finally {
    clearTimeout(a);
  }
}
async function _a() {
  let e = new URL("version.json", Qt);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await on(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && q(), be = n.state === "ended";
  let a = t.headers.get("Date"), r = t.headers.get("Age"), i = Date.parse(a || "");
  if (!qe(i) || i < tt || i > Ie || r !== null && !/^\d+$/.test(r)) throw new Error("time_unavailable");
  let o = r === null ? 0 : Number(r);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let s = i + o * 1e3, l = Date.now();
  l >= i - Me && l <= s + Me && s - l <= Me && (fe = Math.max(s, l, rn(), ee?.snapshot.createdAt ?? 0), We = { now: fe, mono: performance.now() }), ve = { lower: i, upper: s, mono: performance.now() }, nt = !1;
}
function wa(e, t) {
  if (ee) {
    let n = ee.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      Q = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && q(), Q = "checked";
      return;
    }
  }
  ee = e, Ge = t, Q = "checked";
}
async function Pe() {
  if (!bt) {
    bt = !0, A("refresh").disabled = !0;
    try {
      let e = new URL(da);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([_a(), on(e)]);
      if (t[0].status === "rejected" && (nt = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          wa(await sn(n), n);
        } catch {
          Q = "invalid";
        }
      else Q = "offline";
      he();
    } finally {
      bt = !1, A("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  N.range = e.dataset.range, N.cursorT = null, at(), he();
}));
A("past").addEventListener("change", () => {
  N.past = Number(A("past").value), at(), he();
});
A("reference").addEventListener("change", () => {
  N.reference = A("reference").value, at(), he();
});
A("theme").addEventListener("click", () => {
  let e = N.theme ? N.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  N.theme = e ? "light" : "dark", document.documentElement.dataset.theme = N.theme, at();
});
A("refresh").addEventListener("click", Pe);
A("chart").addEventListener("pointerdown", (e) => {
  N.cursorT = zt(e), B && Oe(A("chart"), B, N);
});
A("chart-cursor").addEventListener("input", () => {
  N.cursorT = vt(), B && Oe(A("chart"), B, N);
});
A("chart-cursor").addEventListener("keydown", (e) => {
  let t = Xt(e.key);
  t !== null && (e.preventDefault(), N.cursorT = t, B && Oe(A("chart"), B, N));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (Q = "waiting", he(), Pe());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (Q = "waiting", he(), Pe());
});
window.addEventListener("offline", () => {
  Q = "offline", nt = !0, he();
});
window.addEventListener("online", Pe);
var Yt = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== Yt && (Yt = t, B && Oe(A("chart"), B, N), De());
}).observe(A("chart"));
async function ya() {
  let e = nn(Kt);
  if (e?.packet)
    try {
      ee = await sn(e.packet), Ge = e.packet, qe(e.greatestNow) && e.greatestNow >= tt && e.greatestNow <= Ie && (fe = Math.max(fe, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), qe(e.trustedNow) && e.trustedNow >= tt && e.trustedNow <= Ie && (We = { now: e.trustedNow, mono: performance.now() }), be = e.ended === !0, Q = "offline", he();
    } catch {
      ee = null, Ge = null;
    }
  await Pe(), setInterval(() => {
    document.hidden || Pe();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || he();
  }, 3e4);
}
ya();
export {
  Dt as buildWatchModel,
  sn as verifyPublicPacket
};
