// site/js/season.js
var oa = "America/Los_Angeles";
var Ft = null;
function la() {
  return Ft === null && (Ft = new Intl.DateTimeFormat("en-US", {
    timeZone: oa,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), Ft;
}
function oe(e) {
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
function tn(e) {
  let t = oe(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function tt(e, t, n, a = 0, s = 0) {
  let i = Date.UTC(e, t - 1, n, a, s), o = i - tn(i);
  return i - tn(o);
}
function Pe(e) {
  let t = oe(e).month;
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
  return (e && Array.isArray(e.wet_months) ? e.wet_months : ua).includes(oe(t).month);
}
var Ge = (e) => typeof e == "number" && Number.isFinite(e);
function ha(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!Ge(e.rise_floor_cfs) || !Ge(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!Ge(t.lead_lo_h) || !Ge(t.lead_hi_h) || !Ge(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !Ge(a.low_factor) || !Ge(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function nn(e, t, n, a = t.t) {
  let s = [], i = [], o = da(n, a);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: s, low: i, wetSeason: o };
  ha(n);
  let r = n.bins, l = r[r.length - 1].lead_hi_h;
  for (let u of e) {
    let c = (u.t - t.t) / ca;
    if (c <= 0 || c > l) continue;
    let f = fa(r, c);
    if (!f) continue;
    let d, g;
    if (u.cfs >= n.storm_flow_cfs) {
      let h = u.cfs - t.cfs >= n.rise_floor_cfs ? f.rise : f.flat;
      d = u.cfs * h.high_factor, g = u.cfs * h.low_factor;
    } else
      d = u.cfs + f.add_cfs, g = u.cfs - f.add_cfs;
    s.push({ t: u.t, cfs: Math.max(d, u.cfs) }), i.push({ t: u.t, cfs: Math.max(0, Math.min(g, u.cfs)) });
  }
  return { high: s, low: i, wetSeason: o };
}

// site/js/watch-conditions.js
var se = Number.isFinite, Ut = 0.1;
function an(e, t = [], n = []) {
  let a = /* @__PURE__ */ new Map(), s = new Set(n);
  for (let d of t)
    !se(d?.endT) || d.endT % 36e5 || d.endT > e || (!se(d.mm) || d.mm < 0 || a.has(d.endT) && a.get(d.endT) !== d.mm ? s.add(d.endT) : a.set(d.endT, d.mm));
  let i = [...a.keys(), ...s].filter((d) => se(d) && d <= e && d % 36e5 === 0), o = i.length ? Math.max(...i) : null, r = {
    available: !1,
    state: "unknown",
    endT: o,
    thresholdMm: Ut,
    ageMs: o === null ? null : e - o,
    hours: 0,
    sinceT: null,
    transitionKnown: !1,
    leftCensored: null,
    lowerBoundHours: null
  };
  if (o === null || e - o > 3 * 36e5 || s.has(o) || !a.has(o)) return r;
  let l = a.get(o) >= Ut, u = 0, c = o;
  for (; a.has(c) && !s.has(c) && a.get(c) >= Ut === l; )
    u++, c -= 36e5;
  let f = a.has(c) && !s.has(c);
  return {
    ...r,
    available: !0,
    state: l ? f ? "restarted" : "raining" : "paused",
    hours: u,
    sinceT: o - u * 36e5,
    transitionKnown: f,
    leftCensored: !f,
    lowerBoundHours: u,
    latestMm: a.get(o)
  };
}
function sn(e, t, n = null, a = 400, s = null) {
  let i = t?.data, o = e + 240 * 36e5, r = se(n?.cfs) && se(n?.t) && n.t <= e ? { t: n.t, cfs: n.cfs } : null, l = {
    available: !1,
    reason: "Forecast scenarios unavailable",
    issuedT: i?.issuedT ?? null,
    createdT: i?.createdT ?? null,
    startT: e,
    endT: o,
    dataThroughT: null,
    thresholdsCfs: [],
    memberCount: 0,
    excludedCount: 0,
    higherCount: null,
    comparisonHigh: r,
    resolvedCount: 0,
    openEndCount: 0,
    noPeakCount: 0,
    peakStartT: null,
    peakEndT: null,
    thresholdCfs: typeof a == "number" && se(a) && a > 0 ? a : null,
    halfThresholdCfs: typeof a == "number" && se(a) && a > 0 ? a / 2 : null,
    riseCount: null,
    halfRiseCount: null,
    crossings: [],
    halfCrossings: [],
    members: [],
    qualifyingPeakCount: 0,
    unboundedPeakCount: 0,
    crossingStartT: null,
    crossingEndT: null,
    halfCrossingStartT: null,
    halfCrossingEndT: null,
    riseCoverageStartT: null,
    comparisonCoverageStartT: null,
    unscoredInitialRange: null
  };
  if (!i || !se(i.issuedT) || i.issuedT > e || e - i.issuedT > 48 * 36e5 || !Array.isArray(i.members))
    return { ...l, reason: i ? "Forecast scenarios are too old or their issue time is invalid" : l.reason };
  let u = /* @__PURE__ */ new Set(), c = 0, f = 0, d = 0, g = null, h = [], m = [], v = (p) => typeof a == "function" ? a(p) : a;
  if (!se(v(e)) || v(e) <= 0) return { ...l, reason: "Seasonal rise threshold is invalid" };
  l.thresholdCfs = v(e), l.halfThresholdCfs = v(e) / 2;
  let b = /* @__PURE__ */ new Set([v(e)]);
  for (let p of i.members) {
    if (u.has(p.id)) return { ...l, reason: "Conflicting forecast scenario identities" };
    u.add(p.id);
    let _ = (p.points ?? []).filter((A) => se(A?.t)).sort((A, L) => A.t - L.t), I = _.filter((A) => A.t <= e).at(-1), C = _.filter((A) => A.t > e && A.t <= o), x = I ? [I, ...C] : C;
    if (!(I && e - I.t <= 6 * 36e5 && C.length >= 2 && o - C.at(-1).t < 6 * 36e5 && x.every((A, L) => se(A.cfs) && A.cfs >= 0 && (!L || A.t - x[L - 1].t === 6 * 36e5)))) {
      l.excludedCount++;
      continue;
    }
    l.memberCount++, l.dataThroughT = l.dataThroughT === null ? C.at(-1).t : Math.min(l.dataThroughT, C.at(-1).t);
    let P = Math.max(...C.map((A) => A.cfs));
    r && P > r.cfs && c++;
    let k = _.filter((A) => A.t <= o), U = new Map(k.map((A, L) => [A.t, L])), ae = (A) => {
      let L = U.get(A);
      if (L === void 0 || L < 4) return null;
      let R = k.slice(L - 4, L + 1);
      return R.length !== 5 || R.some((ee, ie) => !se(ee.cfs) || ee.cfs < 0 || ie && ee.t - R[ie - 1].t !== 6 * 36e5) ? null : { rise: k[L].cfs - Math.min(...R.map((ee) => ee.cfs)), flowCfs: k[L].cfs };
    }, Ce = -1 / 0, Me = null, Ae = null, he = null, ue = null, D = null, pe = null;
    for (let A of C) {
      let L = ae(A.t);
      if (!L) continue;
      (g === null || A.t < g) && (g = A.t);
      let R = L.rise;
      R > Ce && (Ce = R, Me = A.t, Ae = A.cfs);
      let ee = v(A.t);
      !se(ee) || ee <= 0 || (b.add(ee), R >= ee && he === null && (he = A.t, D = R), R >= ee / 2 && ue === null && (ue = A.t, pe = R));
    }
    he !== null && f++, ue !== null && d++, he !== null && m.push({
      id: p.id,
      t: he,
      leadHours: (he - e) / 36e5,
      riseCfs: D,
      thresholdCfs: v(he),
      flowCfs: ae(he)?.flowCfs
    }), ue !== null && l.halfCrossings.push({
      id: p.id,
      t: ue,
      leadHours: (ue - e) / 36e5,
      riseCfs: pe,
      thresholdCfs: v(ue) / 2,
      flowCfs: ae(ue)?.flowCfs
    });
    let bt = se(s) ? s : x[0].cfs, Z = null, fe = null;
    for (let A = 0; A < k.length; ) {
      let L = A;
      for (; L + 1 < k.length && k[L + 1].cfs === k[A].cfs && k[L + 1].t - k[L].t === 6 * 36e5; ) L++;
      let R = k[L], ee = k[A], ie = k[A - 1], te = k[L + 1], Ke = ie && se(ie.cfs) && ee.t - ie.t === 6 * 36e5 && ie.cfs < R.cfs, Le = te && se(te.cfs) && te.t - R.t === 6 * 36e5 && te.cfs < R.cfs, qe = k.slice(A, L + 1).some((Ne) => {
        let Se = ae(Ne.t);
        return Ne.t > e && Se && Se.rise >= v(Ne.t) / 2;
      });
      if (R.t > e && Ke && (Le || !te) && qe && R.cfs > bt) {
        let Ne = { t: Math.max(ee.t, C[0].t), endT: R.t, cfs: R.cfs };
        te ? (!Z || R.cfs > Z.cfs || R.cfs === Z.cfs && R.t > Z.endT) && (Z = Ne) : (!fe || R.cfs >= fe.cfs) && (fe = Ne);
      }
      A = L + 1;
    }
    fe && (!Z || fe.cfs >= Z.cfs) && (Z = null), Z ? (l.resolvedCount++, l.qualifyingPeakCount++, h.push(Z.t, Z.endT)) : fe ? (l.openEndCount++, l.unboundedPeakCount++) : l.noPeakCount++, l.members.push({
      id: p.id,
      maxRise24hCfs: se(Ce) ? Ce : null,
      maxRiseT: Me,
      maxRiseFlowCfs: Ae,
      firstThresholdCrossingT: he,
      firstThresholdRiseCfs: D,
      firstHalfThresholdCrossingT: ue,
      firstHalfThresholdRiseCfs: pe,
      qualifyingPeakT: Z?.t ?? null,
      qualifyingPeakEndT: Z?.endT ?? null,
      openPeakCfs: fe?.cfs ?? null,
      qualifyingPeakCfs: Z?.cfs ?? null
    });
  }
  return l.memberCount ? {
    ...l,
    available: !0,
    reason: null,
    higherCount: r ? c : null,
    riseCount: f,
    halfRiseCount: d,
    crossings: m,
    thresholdsCfs: [...b].sort((p, _) => p - _),
    crossingStartT: m.length ? Math.min(...m.map((p) => p.t)) : null,
    crossingEndT: m.length ? Math.max(...m.map((p) => p.t)) : null,
    riseCoverageStartT: g,
    comparisonCoverageStartT: g,
    unscoredInitialRange: g > e ? { startT: e, endT: g } : null,
    halfCrossingStartT: l.halfCrossings.length ? Math.min(...l.halfCrossings.map((p) => p.t)) : null,
    halfCrossingEndT: l.halfCrossings.length ? Math.max(...l.halfCrossings.map((p) => p.t)) : null,
    peakStartT: h.length ? Math.min(...h) : null,
    peakEndT: h.length ? Math.max(...h) : null
  } : { ...l, reason: "No complete ten-day forecast scenarios" };
}

// site/js/watch-model.js
var ze = 6e4, W = 60 * ze, j = 24 * W, Ee = 30 * ze, at = 6 * W, Xe = 15 * ze, pa = [2, 4, 6, 8, 12, 18, 24], z = (e) => typeof e == "number" && Number.isFinite(e), F = (e) => z(e) && Math.abs(e) <= 864e13, y = (e, t = {}) => ({ code: e, details: t }), ot = (e, t) => F(t) ? Math.max(0, e - t) : null, ga = (e, t) => Object.prototype.hasOwnProperty.call(e, t), St = (e) => ({ t: e.t, cfs: e.cfs }), re = (e) => e && e.usable !== !1 && z(e.cfs) && e.cfs >= 0;
function rt(e, t) {
  let n = (r) => {
    let [l, u = "0"] = String(r).toLowerCase().split("e"), c = l.includes(".") ? l.length - l.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(l.replace(".", "")), exponent: Number(u) - c };
  }, a = n(e), s = n(t), i = Math.min(a.exponent, s.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - s.coefficient * 10n ** BigInt(s.exponent - i)}e${i}`;
}
function rn(e) {
  let t = z(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : ga(e, "qualifier"), s = {
    t: e.t,
    cfs: t ? e.cfs : null,
    approval: e.approval ?? null,
    qualifierAvailable: a,
    qualityLabel: e.qualityLabel ?? (a ? "Quality metadata supplied" : "Quality flags unavailable"),
    eligible: e.eligible === !0 && n && a,
    usable: n,
    reason: n ? null : typeof e.reason == "object" && e.reason ? e.reason : y(typeof e.reason == "string" ? e.reason : "unusable_observation")
  };
  return a && (s.qualifier = e.qualifier), s;
}
function cn(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !F(n.t)) continue;
    let a = rn(n), s = t.get(n.t);
    s ? JSON.stringify(s) !== JSON.stringify(a) && t.set(n.t, rn({
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
function Ze(e, t) {
  let n = 0, a = e.length;
  for (; n < a; ) {
    let s = n + a >>> 1;
    e[s].t < t ? n = s + 1 : a = s;
  }
  return n;
}
function un(e, t) {
  let n = Ze(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function it(e, t, n = Xe) {
  let { before: a, after: s } = un(e, t), i = s?.t === t ? s : a && (!s || t - a.t <= s.t - t) ? a : s;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function He(e) {
  if (!F(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return Pe(e);
}
function fn(e, t) {
  let n = F(t) ? e[Ze(e, t)] : null, a = F(t) ? t - j : null, s = F(a) ? un(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: y("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: F(t) ? He(t) : null,
    distanceCfs: null,
    reached: null,
    ...s
  };
}
function dn(e, t) {
  let n = rt(e.current.cfs, t.cfs), a = z(n) ? rt(e.referenceCfs, n) : null;
  return !z(n) || !z(a) ? { ...e, comparison: t, reason: y("non_finite_arithmetic") } : {
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
function jt(e, t) {
  let n = fn(e, t);
  if (!re(n.current))
    return { ...n, reason: y(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = it(e, n.targetT);
  return a ? re(a) ? dn(n, a) : { ...n, comparison: a, reason: y("comparison_unusable") } : { ...n, reason: y("comparison_missing", { toleranceMs: Xe }) };
}
function qt(e, t) {
  let n = fn(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: F(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!re(a.current)) return { ...a, reason: y(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let s = it(e, a.targetT);
  if (!s) return { ...a, reason: y("window_start_missing", { toleranceMs: Xe }) };
  if (!re(s)) return { ...a, startSupport: s, reason: y("window_start_unusable") };
  let i = e.slice(Ze(e, a.targetT), Ze(e, t) + 1), o = i.find((c) => !re(c));
  if (o) return { ...a, startSupport: s, reason: y("window_unusable_observation", { t: o.t }) };
  let r = s.t < a.targetT ? [s, ...i] : i, l = 0;
  for (let c = 1; c < r.length; c++) l = Math.max(l, r[c].t - r[c - 1].t);
  if (l > Ee) return {
    ...a,
    startSupport: s,
    maxGapMs: l,
    reason: y("observation_gap", { maxGapMs: l, allowedMs: Ee })
  };
  let u = i.reduce((c, f) => !c || f.cfs < c.cfs ? f : c, null);
  return u ? {
    ...dn(a, u),
    minimum: u,
    startSupport: s,
    maxGapMs: l,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: s, maxGapMs: l, reason: y("window_empty") };
}
function At(e, t, n = !1) {
  let a = [], s = [], i = [], o = [];
  for (let r of e) {
    if (!re(r) || n && r.cfs <= 0) {
      s.length && a.push(s), s = [], o.push({ t: r.t, reason: n && r.cfs <= 0 ? "non_positive_flow" : r.reason?.code ?? "unusable_observation" });
      continue;
    }
    let l = s[s.length - 1];
    l && r.t - l.t > t && (i.push({ startT: l.t, endT: r.t, reason: "unsupported_gap" }), a.push(s), s = []), s.push(St(r));
  }
  return s.length && a.push(s), { segments: a, gaps: i, exclusions: o };
}
function $e(e = "path_unavailable") {
  return {
    available: !1,
    reason: typeof e == "string" ? y(e) : e,
    points: [],
    segments: [],
    startT: null,
    endT: null,
    gaps: [],
    exclusions: []
  };
}
function Fe(e, t = {}) {
  let n = e.filter((s) => s.length).map((s) => s.map(St)), a = n.flat();
  return {
    available: a.length > 0,
    reason: a.length ? null : y("path_unavailable"),
    points: a,
    segments: n,
    startT: a[0]?.t ?? null,
    endT: a[a.length - 1]?.t ?? null,
    gaps: [],
    exclusions: [],
    ...t
  };
}
function hn(e, t = at, n = !1) {
  let a = At(e, t, n);
  return Fe(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function Ve(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Ze(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let s = e[n - 1], i = (t - s.t) / (a.t - s.t), o = (1 - i) * s.cfs + i * a.cfs;
  return z(o) ? o : null;
}
function vt(e, t) {
  for (let n of e.segments) {
    let a = Ve(n, t);
    if (a !== null) return a;
  }
  return null;
}
function Bt(e, t, n) {
  let a = [];
  for (let s of e.segments) {
    let i = Math.max(t, s[0].t), o = Math.min(n, s[s.length - 1].t);
    if (i > o) continue;
    let r = [
      { t: i, cfs: Ve(s, i) },
      ...s.filter((l) => l.t > i && l.t < o),
      ...o > i ? [{ t: o, cfs: Ve(s, o) }] : []
    ];
    a.push(r);
  }
  return Fe(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function nt(e, t, n, a) {
  let s = ot(n, t);
  return {
    available: !!e?.data,
    dataT: F(t) ? t : null,
    ageMs: s,
    stale: s === null || s > a,
    lastAttemptAt: F(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: F(e?.lastSuccessAt) ? e.lastSuccessAt : null,
    error: e?.error ?? null,
    url: e?.url ?? null,
    rawRefs: e?.rawRefs ?? [],
    reasons: [
      ...e?.data ? [] : [y("source_unavailable")],
      ...e?.error ? [y("source_fetch_failed")] : [],
      ...s !== null && s > a ? [y("source_stale", { ageMs: s, maxAgeMs: a })] : []
    ]
  };
}
function ma(e, t, n, a) {
  let s = t ? t.t - 12 * W : null, i = {
    available: !1,
    reason: y("current_observation_unavailable"),
    current: t,
    comparison: null,
    targetT: s,
    elapsedMs: null,
    changeCfs: null,
    approximate: !1,
    asOf: !!(t && n - t.t > 30 * ze)
  };
  if (!re(t)) return { ...i, reason: y(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let o = it(e, s);
  if (!o) return { ...i, reason: y("comparison_missing", { toleranceMs: Xe }) };
  let r = {
    ...i,
    comparison: o,
    elapsedMs: t.t - o.t,
    approximate: o.t !== s
  };
  if (!re(o)) return { ...r, reason: y("comparison_unusable") };
  if (n - t.t > 2 * W) return { ...r, reason: y("gauge_stale") };
  if (a?.error) return { ...r, reason: y("source_fetch_failed") };
  let l = e.slice(Ze(e, o.t), Ze(e, t.t) + 1), u = l.find((d) => !re(d));
  if (u) return { ...r, reason: y("unusable_observation", { t: u.t }) };
  let c = 0;
  for (let d = 1; d < l.length; d++) c = Math.max(c, l[d].t - l[d - 1].t);
  if (c > Ee) return { ...r, reason: y("observation_gap", { maxGapMs: c, allowedMs: Ee }) };
  let f = rt(t.cfs, o.cfs);
  return z(f) ? { ...r, available: !0, reason: null, changeCfs: f } : { ...r, reason: y("non_finite_arithmetic") };
}
function ba(e, t, n, a) {
  let s = {
    available: !1,
    reason: y("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * ze)
  };
  if (!re(t)) return { ...s, reason: y(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = it(e, t.t - W);
  if (!re(i)) return { ...s, comparison: i, reason: y("direction_comparison_unavailable") };
  let o = rt(t.cfs, i.cfs), r = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), l = { ...s, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: r };
  if (!z(o)) return { ...l, changeCfs: null, reason: y("non_finite_arithmetic") };
  if (n - t.t > 2 * W) return { ...l, reason: y("gauge_stale") };
  if (a?.error) return { ...l, reason: y("source_fetch_failed") };
  let u = e.filter((c) => c.t >= i.t && c.t <= t.t);
  return u.some((c) => !re(c)) || u.some((c, f) => f && c.t - u[f - 1].t > Ee) ? { ...l, reason: y("direction_observation_gap") } : {
    ...l,
    available: !0,
    reason: null,
    label: Math.abs(o) <= r ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function on(e, t, n) {
  let a = F(t) ? t - 7 * j : null, s = {
    windowStartT: a,
    windowEndT: F(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!F(t)) return s;
  for (let o of e) {
    if (o.t < a || o.t > t) continue;
    let r = n(e, o.t);
    r.available ? (s.evaluatedCount++, s.coverageStartT ?? (s.coverageStartT = o.t), s.coverageEndT = o.t, r.reached && (s.last = r)) : s.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= a && o.t <= t);
  return s.coverageComplete = s.coverageStartT !== null && s.coverageStartT <= a + Xe && s.coverageEndT >= t - Ee && s.unavailableCount === 0 && !i.some((o, r) => r && o.t - i[r - 1].t > Ee), s;
}
function ln(e, t, n) {
  if (!F(t)) return { ...$e("observations_unavailable"), steps: [] };
  let a = [], s = [], i = [], o = [], r = null;
  for (let l of e) {
    if (l.t < t - 2 * j) continue;
    let u = n(e, l.t), c = u.comparison?.cfs;
    if (!u.available || !z(c + u.referenceCfs)) {
      o.length && a.push(o), o = [], r = null;
      continue;
    }
    if (r && l.t - r.t > Ee && (i.push({ startT: r.t, endT: l.t, reason: "unsupported_gap" }), o.length && a.push(o), o = [], r = null), r) for (let d of Dt(r.t, l.t)) {
      let g = (d - r.t) / (l.t - r.t), h = (1 - g) * r.base + g * c, m = h + He(d - 1), v = h + He(d);
      o.push({ t: d, cfs: m }), a.push(o), o = [{ t: d, cfs: v }], s.push({ t: d, beforeCfs: m, afterCfs: v });
    }
    let f = { t: l.t, cfs: c + u.referenceCfs };
    o.at(-1)?.t !== l.t && o.push(f), r = { t: l.t, base: c };
  }
  return o.length && a.push(o), { ...Fe(a, { gaps: i }), steps: s };
}
function Mt(e, t = "forecast_unavailable") {
  let n = () => $e(t), a = () => ({ endpoint: st(t), low: st(t) });
  return {
    available: !1,
    reason: y(t),
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
    higherLater: { available: !1, reason: y(t), aboveCurrent: null, peakCfs: null, peakT: null, largeAdjustment: !1 },
    cases: {
      available: !1,
      reason: y(t),
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(oe(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function st(e = "path_unavailable", t = !1) {
  return {
    available: !1,
    reason: typeof e == "string" ? y(e) : e,
    t: null,
    currentCfs: null,
    comparisonCfs: null,
    changeCfs: null,
    referenceCfs: null,
    alreadyReached: !1,
    largeAdjustment: t
  };
}
function Dt(e, t) {
  if (!F(e) || !F(t) || e >= t) return [];
  let n = oe(e), a = oe(t), s = [];
  for (let i = n.year; i <= a.year; i++)
    for (let o of [3, 5, 11]) {
      let r = tt(i, o, 1);
      r > e && r <= t && s.push(r);
    }
  return s.sort((i, o) => i - o);
}
function va(e, t, n) {
  let a = Bt(e, n.t - 2 * j, n.t), s = Bt(t, n.t, t.endT ?? n.t), i = a.segments.map((o) => [...o]);
  for (let o of s.segments) {
    let r = o.filter((c) => c.t > n.t);
    if (!r.length) continue;
    let l = i[i.length - 1];
    o[0].t === n.t && l?.[l.length - 1].t === n.t ? l.push(...r) : i.push(r);
  }
  return Fe(i);
}
function pn(e, t) {
  let n = t - j, a = vt(e, t);
  if (a === null) return null;
  let s = vt(e, n);
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
  let o = vt(t, s);
  if (o === null) return null;
  let r = s - j;
  if (r > a.t) {
    let h = pn(e, s);
    return h && h[i] !== null ? { current: o, base: h[i] } : null;
  }
  if (i === "endpoint") {
    let h = it(n, r);
    return re(h) ? { current: o, base: h.cfs, comparisonT: h.t } : null;
  }
  let l = it(n, r);
  if (!re(l)) return null;
  let u = n.filter((h) => h.t >= r && h.t <= a.t), c = l.t < r ? [l, ...u] : u;
  if (!u.length || u.some((h) => !re(h)) || c.some((h, m) => m && h.t - c[m - 1].t > Ee)) return null;
  let f = t.segments.find((h) => h[0].t <= a.t && h[h.length - 1].t >= s);
  if (!f) return null;
  let d = o, g = null;
  for (let h of u) h.cfs <= d && (d = h.cfs, g = h.t);
  for (let h of f) h.t > a.t && h.t <= s && h.cfs < d && (d = h.cfs, g = null);
  return { current: o, base: d, minimumObservedT: g };
}
function _a(e, t, n, a, s) {
  let i = [], o = (r) => {
    r > n && r <= a && i.push(r);
  };
  if (s === "endpoint") {
    for (let r = 1; r < e.length; r++)
      o(Math.floor((e[r - 1].t + e[r].t) / 2) + j + 1);
    for (let r of e)
      o(r.t - Xe + j), o(r.t + Xe + j + 1);
  } else for (let r of e) o(r.t + j + 1);
  return i.filter((r) => r - j <= t.t);
}
function ya(e, t, n, a, s = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let r of e.points)
    for (let l of [r.t, r.t + j]) l >= t && l <= n && i.add(l);
  for (let r of Dt(t, n))
    i.add(r), r - 1 >= t && i.add(r - 1);
  for (let r of s)
    i.add(r), r - 1 >= t && i.add(r - 1);
  let o = [...i].sort((r, l) => r - l);
  for (let r = 1; r < o.length; r++) {
    let l = o[r - 1], u = o[r], c = (l + u) / 2, f = pn(e, c);
    if (!f || a === "low" && f.low === null) {
      i.add(c);
      continue;
    }
    if (a !== "low") continue;
    let d = e.segments.find((m) => m[0].t <= c - j && m[m.length - 1].t >= c);
    if (!d) continue;
    let g = 1 / 0;
    for (let m of d) m.t > c - j && m.t < c && (g = Math.min(g, m.cfs));
    let h = [
      [Ve(d, l - j), Ve(d, u - j)],
      [Ve(d, l), Ve(d, u)],
      ...z(g) ? [[g, g]] : []
    ].filter((m) => m.every(z));
    for (let m = 0; m < h.length; m++) for (let v = m + 1; v < h.length; v++) {
      let b = h[m][0] - h[v][0], p = h[m][1] - h[v][1];
      if (!z(b) || !z(p) || b === p) continue;
      let _ = b / (b - p);
      _ > 0 && _ < 1 && i.add(l + _ * (u - l));
    }
  }
  return [...i].sort((r, l) => r - l);
}
function Ta(e, t, n, a, s, i) {
  if (!t.available) return { reference: { ...$e(t.reason), steps: [] }, crossing: st(t.reason, s) };
  let o = va(e, t, n), r = t.endT, l = n.t, u = _a(i, n, l, r, a), c = ya(o, l, r, a, u), f = /* @__PURE__ */ new Set([...Dt(l, r), ...u]), d = [], g = [], h = [], m = st("comparison_coverage_missing", s), v = 0, b = !1, p = null, _ = (C) => {
    if (vt(t, C) === null) return null;
    let x = wa(o, t, i, n, C, a), S = x?.base;
    if (!x || S === null || !z(S)) return null;
    let P = He(C), k = S + P, U = rt(x.current, S);
    return z(k) && z(U) ? {
      t: C,
      current: x.current,
      base: S,
      line: k,
      delta: U,
      threshold: P,
      comparisonT: x.comparisonT ?? null,
      minimumObservedT: x.minimumObservedT ?? null
    } : null;
  };
  for (let C of c) {
    let x = _(C);
    if (!x) {
      m.t === null && (b = !0), h.length && d.push(h), h = [], p = null;
      continue;
    }
    if (v++, f.has(C)) {
      let S = _(C - 1), P = He(C - 1) !== x.threshold, k = S && S.base !== x.base && (a === "endpoint" ? S.comparisonT !== x.comparisonT : S.minimumObservedT !== null && S.minimumObservedT + j + 1 === C);
      if (S && h.length && (P || k)) {
        let U = k ? S.line : x.base + He(C - 1);
        h.push({ t: C, cfs: U }), d.push(h), h = [], U !== x.line && g.push({ t: C, beforeCfs: U, afterCfs: x.line });
      }
    }
    if (h.push({ t: C, cfs: x.line }), m.t === null && x.delta >= x.threshold && !b) {
      let S = x;
      if (p && p.delta < p.threshold && !f.has(C) && He(p.t) === x.threshold) {
        let P = p.t, k = C;
        for (; k - P > 1; ) {
          let U = Math.floor((k + P) / 2), ae = _(U);
          !ae || ae.delta < ae.threshold ? P = U : k = U;
        }
        S = _(k) ?? x;
      }
      m = {
        available: !0,
        reason: null,
        t: S.t,
        currentCfs: S.current,
        comparisonCfs: S.base,
        changeCfs: S.delta,
        referenceCfs: S.threshold,
        alreadyReached: S.t === n.t,
        largeAdjustment: s
      };
    }
    p = x;
  }
  h.length && d.push(h), m.t === null && v && !b ? m = { ...st(null, s), available: !0, reason: null } : m.t === null && b && (m = st("comparison_coverage_missing", s));
  let I = d.map((C) => {
    let x = [];
    for (let S of C)
      x.length >= 2 && x.at(-2).cfs === x.at(-1).cfs && x.at(-1).cfs === S.cfs && x.pop(), x.push(S);
    return x;
  });
  return { reference: { ...Fe(I), steps: g }, crossing: m };
}
function $a(e, t) {
  let n = [e, t];
  for (let s = e + ze; s < t; s += ze) n.push(s);
  let a = n.map((s) => {
    let i = oe(s);
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
        let l = s - 1;
        for (; l > 0 && a[l - 1].cfs <= a[l].cfs; ) l--;
        let u = St(a[l]);
        n.push({
          startT: a[s].t,
          endT: a[i].t,
          cfs: a[s].cfs,
          precedingLow: u,
          riseCfs: a[s].cfs - u.cfs,
          bracketStartT: o.t,
          bracketEndT: r.t,
          clockRange: $a(o.t, r.t)
        });
      }
      s = i + 1;
    }
  }
  return n.sort((a, s) => a.startT - s.startT);
}
function Ca(e, t, n, a, s, i, o) {
  let r = Mt(e), l = t?.data;
  if (!l) return r;
  let u = l.issuedT;
  r.issuedT = F(u) ? u : null, r.issueAgeMs = ot(e, u), r.older = r.issueAgeMs !== null && r.issueAgeMs > 12 * W, r.cases.tableVersion = o?.version ?? null, r.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let c = (p) => ({
    ...Mt(e, p),
    issuedT: r.issuedT,
    issueAgeMs: r.issueAgeMs,
    older: r.older,
    cases: { ...r.cases, reason: y(p) }
  });
  if (!F(u)) return c("forecast_issue_missing");
  if (u > e) return c("forecast_issue_future");
  if (e - u > 48 * W) return c("forecast_issue_too_old");
  let f = cn(l.points).filter((p) => p.t <= e + 10 * j), d = hn(f, at);
  if (!d.segments.some((p) => p[0].t <= e + at && p[p.length - 1].t >= e + j))
    return c("forecast_next_day_coverage_missing");
  if (r.available = d.available, r.reason = d.reason, r.raw = d, r.crests = xa(d, i?.t ?? e), r.nextCrest = r.crests[0] ?? null, r.laterHigherCrests = r.nextCrest ? r.crests.slice(1).filter((p) => p.cfs > r.nextCrest.cfs) : [], !re(i)) {
    let _ = Mt(e, i ? "current_observation_unusable" : "current_observation_unavailable");
    return {
      ...r,
      shifted: _.shifted,
      high: _.high,
      low: _.low,
      references: _.references,
      crossings: _.crossings,
      higherLater: _.higherLater,
      cases: { ...r.cases, reason: _.cases.reason }
    };
  }
  let g = vt(d, i.t);
  if (g === null) {
    let p = Mt(e, "forecast_alignment_unsupported");
    return {
      ...r,
      shifted: p.shifted,
      high: p.high,
      low: p.low,
      references: p.references,
      crossings: p.crossings,
      higherLater: p.higherLater,
      cases: { ...r.cases, reason: p.cases.reason }
    };
  }
  let h = rt(i.cfs, g);
  if (!z(h)) return c("non_finite_arithmetic");
  r.offsetCfs = h, r.largeAdjustment = Math.abs(h) > Math.max(10, 0.1 * i.cfs);
  let m = [], v = [];
  for (let p of d.segments) {
    let _ = p.map((C) => ({ t: C.t, cfs: C.cfs + h })), I = At(_, at, !0);
    m.push(...I.segments), v.push(...I.exclusions);
  }
  r.shifted = Bt(Fe(m, { gaps: d.gaps, exclusions: v }), i.t, i.t + 72 * W), r.shifted.points.some((p) => p.t > i.t) || (r.shifted = { ...$e("non_positive_shifted_flow"), exclusions: v, gaps: d.gaps }), r.freshContext = !r.older && !t.error && !n?.error && e - i.t <= 2 * W, r.higherLater = {
    available: !1,
    reason: y("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: r.largeAdjustment
  };
  let b = r.shifted.points.filter((p) => p.t > i.t);
  if (r.freshContext && b.length) {
    let p = b.reduce((_, I) => I.cfs > _.cfs ? I : _);
    r.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: p.cfs > i.cfs,
      peakCfs: p.cfs,
      peakT: p.t,
      largeAdjustment: r.largeAdjustment
    };
  }
  if (r.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(oe(e).month), !r.cases.wetSeason)
    r.cases.reason = y("historical_cases_off_season"), r.high = $e(r.cases.reason), r.low = $e(r.cases.reason);
  else if (!o || o.version !== 3 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    r.cases.reason = y("historical_table_unavailable"), r.high = $e(r.cases.reason), r.low = $e(r.cases.reason);
  else
    try {
      let p = [], _ = [], I = [], C = [];
      for (let x of r.shifted.segments) {
        let S = nn(x, i, o, e), P = x[0]?.t === i.t && i.cfs > 0 ? [St(i)] : [], k = At([...P, ...S.high], at, !0), U = At([...P, ...S.low], at, !0);
        p.push(...k.segments), _.push(...U.segments), I.push(...k.exclusions), C.push(...U.exclusions);
      }
      r.high = Fe(p, { gaps: r.shifted.gaps, exclusions: I }), r.low = Fe(_, { gaps: r.shifted.gaps, exclusions: C });
      for (let x of ["high", "low"]) r[x].points.some((S) => S.t > i.t) || (r[x] = { ...$e("historical_case_values_unsupported"), exclusions: r[x].exclusions, gaps: r[x].gaps });
      r.cases.available = r.high.available || r.low.available, r.cases.reason = r.cases.available ? null : y("historical_case_values_unsupported");
    } catch {
      r.cases.reason = y("historical_table_invalid"), r.high = $e(r.cases.reason), r.low = $e(r.cases.reason);
    }
  for (let p of ["shifted", "high", "low"])
    for (let _ of ["endpoint", "low"]) {
      let I = Ta(s, r[p], i, _, r.largeAdjustment, a);
      r.crossings[p][_] = I.crossing, p === "shifted" && (r.references[_] = I.reference);
    }
  return r;
}
function gn(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
  for (let c of n?.conflicts ?? []) F(c) && c <= e && c % W === 0 && s.add(c);
  for (let c of n?.hours ?? [])
    if (!(!F(c.endT) || c.endT > e || c.endT % W !== 0)) {
      if (!z(c.mm) || c.mm < 0) {
        s.add(c.endT);
        continue;
      }
      a.has(c.endT) && a.get(c.endT) !== c.mm ? s.add(c.endT) : a.set(c.endT, c.mm);
    }
  let i = [...a.keys(), ...s], o = i.length ? Math.max(...i) : null, r = ot(e, o), l = pa.map((c) => {
    let f = {
      hours: c,
      available: !1,
      reason: y("radar_unavailable"),
      startT: o === null ? null : o - c * W,
      endT: o,
      ageMs: r,
      mm: null,
      inches: null
    };
    if (o === null) return f;
    let d = 0;
    for (let g = 0; g < c; g++) {
      let h = o - g * W;
      if (s.has(h)) return { ...f, reason: y("radar_conflicting_hour", { endT: h }) };
      if (!a.has(h)) return { ...f, reason: y("radar_missing_hour", { endT: h }) };
      d += a.get(h);
    }
    return z(d) ? { ...f, available: !0, reason: null, mm: d, inches: d / 25.4 } : { ...f, reason: y("non_finite_arithmetic") };
  }), u = l.some((c) => c.available);
  return {
    available: u,
    reason: u ? null : y("radar_windows_unavailable"),
    endT: o,
    generatedT: F(n?.generatedT) ? n.generatedT : null,
    ageMs: r,
    historical: r !== null && r > 2 * W,
    stale: r === null || r > 3 * W,
    windows: l,
    status: an(e, n?.hours ?? [], n?.conflicts ?? []),
    hours: [...new Set(i)].sort((c, f) => c - f).map((c) => ({ endT: c, mm: s.has(c) ? null : a.get(c) ?? null })),
    definitionCode: n?.definitionCode ?? null,
    regions: Object.fromEntries(["upper", "middle", "friday", "lower"].filter((c) => n?.regions?.[c]).map((c) => [c, {
      ...gn(e, { data: { ...n.regions[c], generatedT: n.generatedT } }),
      areaFraction: n.regions[c].areaFraction
    }]))
  };
}
function Ma(e, t) {
  let n = t?.data, a = ot(e, n?.updatedT), s = {
    available: !1,
    reason: y("grid_forecast_unavailable"),
    startT: e,
    endT: e + j,
    updatedT: F(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * W,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return s;
  if (!F(n.updatedT) || n.updatedT > e) return { ...s, reason: y("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((u) => F(u.startT) && F(u.endT) && u.endT > e && u.startT < e + j).sort((u, c) => u.startT - c.startT || u.endT - c.endT), o = e, r = 0, l = !1;
  for (let u of i) {
    if (u.startT >= u.endT || !z(u.mm) || u.mm < 0) return { ...s, reason: y("grid_interval_invalid") };
    let c = Math.max(e, u.startT), f = Math.min(e + j, u.endT);
    if (c < o) return { ...s, reason: y("grid_interval_overlap", { t: c }) };
    if (c > o) return { ...s, reason: y("grid_interval_gap", { startT: o, endT: c }) };
    let d = (f - c) / (u.endT - u.startT);
    r += u.mm * d, l || (l = d !== 1), o = f;
  }
  return o < e + j ? { ...s, reason: y("grid_interval_gap", { startT: o, endT: e + j }) } : z(r) ? { ...s, available: !0, reason: null, mm: r, inches: r / 25.4, prorated: l } : { ...s, reason: y("non_finite_arithmetic") };
}
function Aa(e, t) {
  let n = t?.data, a = ot(e, t?.lastSuccessAt), s = {
    available: !1,
    reason: y("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * W,
    startT: e,
    endT: e + 2 * j,
    events: []
  };
  if (!n) return s;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...s, reason: y("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let l of n.points ?? []) {
    if (!F(l.t) || l.t < e || l.t > e + 2 * j || !z(l.ft) || !["H", "L"].includes(l.type)) continue;
    let u = i.get(l.t);
    u && (u.ft !== l.ft || u.type !== l.type) && o.add(l.t), i.set(l.t, { t: l.t, ft: l.ft, type: l.type });
  }
  let r = [...i.values()].filter((l) => !o.has(l.t)).sort((l, u) => l.t - u.t);
  return { ...s, available: r.length > 0, reason: r.length ? null : y("tide_events_unavailable"), events: r };
}
function mn({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!F(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, s = cn(a?.points).filter((b) => b.t <= e), i = s[s.length - 1] ?? null, o = [...s].reverse().find((b) => re(b)) ?? null, r = hn(s, Ee), l = i?.t ?? null, u = nt(t.gauge, l, e, 2 * W), c = {
    latest: i,
    lastNumericObservation: o,
    points: s,
    segments: r.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: ot(e, l),
    stale: u.stale,
    referenceCfs: F(l) ? He(l) : null,
    endpoint: jt(s, l),
    low: qt(s, l),
    references: { endpoint: ln(s, l, jt), low: ln(s, l, qt) },
    direction: ba(s, i, e, t.gauge),
    twelveHourChange: ma(s, i, e, t.gauge),
    history: { endpoint: on(s, l, jt), low: on(s, l, qt) }
  }, f = Ca(e, t.noaa, t.gauge, s, r, i, n), d = gn(e, t.radar), g = Ma(e, t.grid), h = Aa(e, t.tides), m = i?.eligible && i?.usable && e - i.t >= 0 && e - i.t <= W ? s.filter((b) => b.eligible && b.usable && b.t >= i.t - 9 * j).reduce((b, p) => !b || p.cfs >= b.cfs ? p : b, null) : null, v = sn(e, t.ensemble, m, He, i?.eligible && i?.usable ? i.cfs : null);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: u,
      noaa: nt(t.noaa, f.issuedT, e, 12 * W),
      radar: nt(t.radar, d.endT, e, 3 * W),
      grid: nt(t.grid, g.updatedT, e, 12 * W),
      tides: nt(t.tides, t.tides?.lastSuccessAt, e, 36 * W),
      ensemble: nt(t.ensemble, v.issuedT, e, 48 * W)
    },
    gauge: c,
    forecast: f,
    rain: { radar: d, grid: g },
    tides: h,
    outlook: v
  };
}

// site/js/watch-render.js
function vn(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var M = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), ge = (e) => typeof e == "number" && Number.isFinite(e);
function Sa(e, t = !1) {
  if (!ge(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function ct(e, t = !1) {
  if (!ge(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function le(e, t = !1) {
  if (!ge(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
function ne(e, t = !1) {
  return ge(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function we(e) {
  if (!ge(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function Wt(e) {
  return ge(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var wn = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function ut(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(ut).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return wn[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(wn, {
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
function lt(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var ka = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, _n = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, Oe = (e) => `<time datetime="${ge(e) ? new Date(e).toISOString() : ""}">${M(ne(e, !0))}</time>`;
var Ea = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function Ra(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return ut("public_time_uncertain");
  let a = ut(t);
  return e.timeUncertain && Ea.includes(n) ? `At the snapshot save time: ${a}` : a;
}
function yn(e, t) {
  let n = e.forecast || {}, a = (h) => Ra(e, h);
  lt("forecast-age", n.issuedT ? `Issued ${Oe(n.issuedT)} \xB7 ${M(e.timeUncertain ? "age unknown" : we(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${M(a(n.reason))}` : ""}` : `Forecast unavailable. ${M(a(n.reason))}`);
  let s = [];
  e.sources?.noaa?.error && s.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && s.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${ct(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? s.push({ text: a(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && s.push(`Adjusted forecast unavailable. ${a(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && s.push(`Historical cases unavailable. ${a(n.cases.reason)}`), lt("forecast-problems", s.map((h) => `<p${typeof h == "object" && h.neutral ? ' class="neutral"' : ""}>${M(typeof h == "object" ? h.text : h)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (i && s.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let l = n.crossings?.shifted?.[t.reference], u = l?.available ? ge(l.t) ? `The adjusted forecast ${l.alreadyReached ? "already meets" : "first reaches"} the reference at ${ne(l.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${a(l?.reason)}`, c = ge(n.offsetCfs) ? `Adjustment to the gauge reading: ${ct(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", f = Date.parse(n.cases?.trainingCutoff ?? ""), d = ge(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${Sa(n.cases.tableVersion)}${ge(f) ? `; training cutoff ${Oe(f)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  lt("forecast-details", _n("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier measurements or the adjusted forecast; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${ge(n.raw?.endT) ? `; available through ${Oe(n.raw.endT)}` : ""}.</p><p>${M(c)} ${n.available === !1 ? `The issued forecast is unavailable. ${M(a(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${M(u)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. Cases extend up to 72 hours from the latest reading in October\u2013April. A low case stops when its historical subtraction reaches zero; this does not predict a dry river. Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.</p>${d}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function bn(e, t = !1) {
  if (t || !e?.available) return "Rain status unknown: recent complete hourly data are needed.";
  let n = `${e.hours} complete ${e.hours === 1 ? "hour" : "hours"}`;
  return e.state === "paused" ? `Rain paused${e.transitionKnown ? "" : " or very light"} for ${e.leftCensored ? "at least " : ""}${n} \xB7 below 0.1 mm per hour.` : e.state === "restarted" ? `Rain restarted \xB7 ${n} at or above 0.1 mm per hour.` : `Rain observed in the latest ${n} \xB7 earlier change unknown.`;
}
function La(e, t) {
  let n = e.definitionCode === "wbd_huc12_four_subbasins_v2", a = (n ? ["upper", "middle", "friday", "lower"] : ["upper", "lower"]).filter((l) => e.regions?.[l]), s = n ? { upper: "Upper Samish headwaters", middle: "Middle Samish", friday: "Friday Creek", lower: "Near the gauge" } : { upper: "Upper + middle + Friday Creek", lower: "Lower above gauge" }, i = a.map((l) => {
    let u = e.regions[l], c = u.windows?.find((f) => f.hours === 24);
    return `<article class="rain-region"><h3>${s[l]}</h3><strong>${M(bn(u.status, t))}</strong><p>${c?.available ? `${Wt(c.inches)} in over 24 hours` : "24-hour total unavailable"} \xB7 ${+(u.areaFraction * 100).toFixed(1)}% of the drainage area.</p></article>`;
  }).join(""), o = e.endT, r = Array.from({ length: 24 }, (l, u) => o - (23 - u) * 36e5).map((l) => {
    let u = (c) => {
      let f = c?.hours?.find((d) => d.endT === l)?.mm;
      return ge(f) ? `${f.toFixed(3)}<br><small>${f >= 0.1 ? "Rain" : "Below threshold"}</small>` : "Missing";
    };
    return `<tr><td>${Oe(l)}</td><td>${u(e)}</td>${a.map((c) => `<td>${u(e.regions[c])}</td>`).join("")}</tr>`;
  }).join("");
  return `<div class="rain-status" role="status"><strong>${M(bn(e.status, t))}</strong><p class="meta">Whole drainage area \xB7 \u201Cpaused\u201D means below the display threshold, not dry everywhere.</p></div><div class="rain-regions">${i || '<p class="meta">Rainfall by subarea is unavailable in this snapshot.</p>'}</div>${a.length ? `<p class="meta">${n ? "Four separate watershed areas. \u201CNear the gauge\u201D is the small Lower Samish portion upstream of the gauge; Friday Creek is a separate tributary." : "Older two-area grouping; upper combines Upper Samish, Middle Samish and Friday Creek."} Area averages describe where rain falls, not when it will reach the river.</p>` : ""}${ge(o) ? `<details class="hourly-rain"><summary>Hourly rain by area</summary><p class="meta">Millimetres in each complete hour ending at the listed Pacific time. Rain means at least 0.100 mm (about 0.004 inches); smaller amounts are below threshold. Missing hours remain unknown.</p><div class="rain-table-wrap"><table><thead><tr><th>Hour ending</th><th>Whole area</th>${a.map((l) => `<th>${s[l]}</th>`).join("")}</tr></thead><tbody>${r}</tbody></table></div></details>` : ""}`;
}
function Tn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${ne(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : we(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", s = t.windows || [2, 4, 6, 8, 12, 18, 24].map((r) => ({ hours: r, available: !1 })), i = [...new Set(s.filter((r) => !r.available).map((r) => ut(r.reason || t.reason)))], o = _n("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over each drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. A pause means the area average is below 0.1 millimetres per hour (about 0.004 inches). A restart requires a complete below-threshold hour followed by rain at or above the threshold, with no missing hour between. This display threshold describes radar rain; it does not predict a river crest. Status is withheld when the latest hour is more than three hours old.</p><p>The four areas follow the official Watershed Boundary Dataset: Upper Samish headwaters, Middle Samish, Friday Creek, and the Lower Samish portion above the gauge. About 0.15% of the drainage could not be matched to these four watershed polygons; it remains included in the whole-area total. A saved older snapshot may show the previous two-area grouping, explicitly labelled. Region totals are area averages, not amounts to add together.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  lt("rain", `<div class="section-heading"><h2>Rain</h2>${ka("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${M(a)}</p>${La(t, e.timeUncertain || e.conditionsSuppressed)}<div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${s.map((r) => `<div class="rain-total" aria-label="${r.hours}-hour total ending ${M(ne(r.endT ?? t.endT, !0))}, ${M(e.timeUncertain ? "age unknown" : we(r.ageMs ?? t.ageMs) + " old")}"><span>${r.hours} hours</span><strong>${r.available ? Wt(r.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map(M).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${Wt(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${M(ut(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${Oe(n.updatedT)} \xB7 ${M(e.timeUncertain ? "age unknown" : we(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function $n(e) {
  let t = e.tides || {};
  lt("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + M(we(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${Oe(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${n.ft.toFixed(1)}</td></tr>`).join("")}</tbody></table>` : `<p>${M(ut(t.reason))}</p>`}</div>`);
}
function xn(e, t, n) {
  lt("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", ensemble: "NOAA Hydrologic Ensemble Forecast Service \xB7 Experimental alternative flow scenarios", tides: "NOAA Bellingham tide predictions" }).map(([s, i]) => {
    let o = t.sources?.[s] || {}, r = n?.sources?.[s] || {};
    return `<div class="source-row"><strong>${M(i)}</strong>${s === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>${s === "ensemble" ? "Reference/start time" : "Data time"}: ${Oe(o.dataT)} \xB7 ${M(t.timeUncertain ? "age unknown" : we(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${Oe(r.lastSuccessAt ?? o.lastSuccessAt)}.${r.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot collection began ${Oe(e.createdAt)}. This collection time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}

// site/js/watch-crest-settings.js
var wt = Object.freeze({ releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1, floorCfs: 1, fraction: 62e-4, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), Cn = Object.freeze({ mode: "A", heading: "Observed high \u2014 crest not confirmed", automaticDirectionLabelsEnabled: !1, rejectedDesignSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), Na = Object.freeze({ mode: "B", trendMedianPoints: 5, trendWindowMinutes: 60, comparisonMinutes: 60, nativeIntervalMinutes: 15, persistencePoints: 5, floorCfs: 1, fraction: 62e-4, designSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), Mn = Object.freeze({ floorCfs: 1, fraction: 62e-4, minimumHoursBelowHigh: 6, minimumPeakAgeHours: 12, firstConfirmationDeadlineHours: 18, minimumHistoryBeforePeakHours: 12, minimumDropFraction: 0.05, minimumDropCfs: 2, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), Cs = Object.freeze({
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
}), _t = (e, t = wt) => Math.max(t.floorCfs, e * t.fraction);

// site/js/watch-preview.js
var X = 36e5, kt = 15 * 6e4, J = Number.isFinite;
function _e(e, t) {
  let n = (r) => {
    let [l, u = "0"] = String(r).toLowerCase().split("e"), c = l.includes(".") ? l.length - l.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(l.replace(".", "")), exponent: Number(u) - c };
  }, a = n(e), s = n(t), i = Math.min(a.exponent, s.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - s.coefficient * 10n ** BigInt(s.exponent - i)}e${i}`;
}
var Y = (e) => `<time datetime="${new Date(e).toISOString()}">${M(ne(e, !0))}</time>`, An = (e) => {
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = t % 60;
  return n ? a ? `${n}h ${a}m` : `${n} ${n === 1 ? "hour" : "hours"}` : `${a} ${a === 1 ? "minute" : "minutes"}`;
}, Je = (e, t) => {
  document.getElementById(e).innerHTML = t;
}, kn = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}">\u24D8</button>`, En = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, Ha = `This page does not make a crest call. It shows the observed high and time since it, plus a separate experimental forecast scenario outlook; growers and sampling staff judge whether the river has crested. Automatic crest confirmation is withheld because the tested rules failed real-storm replay. This page shows the actual observed high, its reading time and age, the drop since that high, and a separate clock for time without a material renewed rise. That clock uses the middle value of five actual 15-minute readings spanning the preceding hour; the displayed high and its time remain actual readings. A rebound in this smoothed trend exceeding the larger of ${wt.floorCfs} cfs or ${+(wt.fraction * 100).toFixed(2)}% of the actual high resets the clock to the last increasing trend reading in that upswing. Flat readings and smaller flickers are allowed: this does not mean continuous falling. This allowance was measured from returning fluctuations in November\u2013December 2025 readings, not chosen as a closure or sampling rule. Missing quarter-hours or ineligible readings break the trend clock, with no interpolation.`;
function Oa(e, t) {
  let n = t.trendMedianPoints, a = t.trendWindowMinutes * 6e4;
  if (n !== 5 || a !== X) throw new Error("Unsupported crest trend window");
  return e.map((s, i) => {
    let o = e.slice(Math.max(0, i - n + 1), i + 1), r = o.length === n && o.every((l, u) => l.eligible === !0 && l.usable === !0 && J(l.cfs) && l.t === s.t - a + u * kt);
    return { t: s.t, cfs: r ? o.map((l) => l.cfs).sort((l, u) => l - u)[2] : null, eligible: r, usable: r };
  });
}
function Sn(e, t, n) {
  let a = null, s = null, i = t.t, o = !1, r = !1, l = _t(t.cfs, n);
  for (let u of Oa(e, n))
    if (!(u.t < t.t)) {
      if (!u.eligible) {
        a = null, s = null, o = !1, i = u.t, r = !0;
        continue;
      }
      if (!a) {
        a = u, r || (r = u.t > t.t), i = Math.max(i, u.t), o = !0;
        continue;
      }
      s ? u.cfs > s.cfs ? (i = u.t, s = u, r = !1) : s.cfs - u.cfs > l && (s = null, a = u) : (u.cfs < a.cfs && (a = u), u.cfs - a.cfs > l && (i = u.t, s = u, r = !1));
    }
  return { lastResetT: i, supported: o, startCensored: r };
}
function Ia(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  return { ...Rn(e, { checking: t, suppressed: n, settings: wt }, !1, !0), mode: "observed-facts-only", releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1 };
}
function Pa(e, t = {}) {
  let n = Ia(e, t);
  return { ...n, state: n.state === "checking" || n.state === "unavailable" ? n.state : "observed_high", label: Cn.heading, labelCategory: "neutral", labelMode: "removed" };
}
function Rn(e, { checking: t = !1, suppressed: n = !1, settings: a = Mn } = {}, s, i = !1) {
  let o = e.gauge || {}, r = o.latest, l = (T) => ({ state: t ? "checking" : "unavailable", label: t ? "Checking river readings\u2026" : "Crest status unavailable", why: T, peak: null, high: null, fallMs: null });
  if (t) return l("Verification is in progress.");
  if (n || e.timeUncertain) return l("A current snapshot and current time must be verified first.");
  if (!r || !J(r.cfs) || r.usable !== !0 || r.eligible !== !0) return l("The newest gauge reading is missing or its quality does not support a crest check.");
  if (o.ageMs > X || e.sources?.gauge?.error) return l("The newest eligible reading must be no more than one hour old, with a successful latest retrieval.");
  let u = i ? 216 : 48, c = o.points.filter((T) => T.t >= r.t - u * X && T.t <= r.t).sort((T, $) => T.t - $.t), f = [], d = null;
  for (let T of c) T.eligible === !0 && T.usable === !0 && J(T.cfs) && (!d || T.cfs >= d.cfs) && (d = T);
  let g = d?.t ?? null;
  if (d) for (let T = c.findIndex(($) => $.t === d.t) - 1; T >= 0; T--) {
    let $ = c[T];
    if (!$.eligible || !$.usable || $.cfs !== d.cfs || g - $.t !== kt) break;
    g = $.t;
  }
  let h = c[0]?.t ?? null, m = !!d && !c.some((T) => T.t < d.t && T.eligible && T.usable && J(T.cfs) && T.cfs < d.cfs);
  for (let T = c.length - 1; T >= 0; T--) {
    let $ = c[T];
    if ($.eligible !== !0 || $.usable !== !0 || !J($.cfs) || f.length && f[0].t - $.t > 2 * kt) break;
    f.unshift($);
  }
  if (f.length < 5 || r.t - f[0].t < X)
    return i && d ? { historyStartT: h, highStartT: g, highAtBoundary: m, clockLowerBound: !0, state: "possible", label: "Crest not confirmed \u2014 short reading history", high: d, peak: d, candidateHigh: null, drop: _e(d.cfs, r.cfs), highDropCfs: _e(d.cfs, r.cfs), sincePeakMs: r.t - d.t, sinceHighMs: r.t - d.t, fallMs: null, trendSupported: !1, evidenceStartT: f[0]?.t ?? r.t, hadGap: f[0]?.t > c[0]?.t, bracketed: !1 } : l("At least an hour of uninterrupted eligible observations is needed.");
  let v = f[0], b = v, p = v, _ = v.t, I = null, C = !1, x = !1, S = v, P = null;
  for (let T = 1; T < f.length; T++) {
    let $ = f[T], ke = _t(v.cfs, a), Be = Math.max(a.episodeTurnCfs ?? 2, v.cfs * (a.episodeTurnFraction ?? 0.05));
    if ($.cfs >= v.cfs) {
      $.cfs - b.cfs > ke && v.cfs - b.cfs > ke && (x = !0), C || (C = _e($.cfs, p.cfs) > Math.max(a.capturedRiseCfs, $.cfs * a.capturedRiseFraction)), v = $, b = $, _ = $.t, S = $, P = null;
      continue;
    }
    $.cfs < b.cfs && (b = $);
    let et = $.cfs - b.cfs;
    P ? $.cfs > P.cfs ? (_ = $.t, P = $) : P.cfs - $.cfs > ke && (P = null, S = $) : ($.cfs < S.cfs && (S = $), $.cfs - S.cfs > ke && (_ = $.t, P = $, x = !0)), v.cfs - b.cfs >= Be && et >= Be && (I = v, p = b, v = $, b = $, C = !0, _ = $.t, S = $, P = null);
  }
  let k = a.trendMedianPoints ? Sn(f, v, a) : { lastResetT: _, supported: !0 }, U = _t(v.cfs, a), ae = v.cfs - r.cfs, Ce = r.t - Math.max(v.t, k.lastResetT), Me = r.t - v.t, Ae = f[0].t, he = Ae > c[0].t, ue = f.reduce((T, $) => Math.abs($.t - (r.t - X)) < Math.abs(T.t - (r.t - X)) ? $ : T, f[0]), D = f.reduce((T, $) => Math.abs($.t - (r.t - 2 * X)) < Math.abs(T.t - (r.t - 2 * X)) ? $ : T, f[0]), pe = _e(r.cfs, D.cfs) > 0, bt = f.filter((T) => T.t >= r.t - 6 * X).reduce((T, $) => Math.min(T, $.cfs), r.cfs), Z = _e(r.cfs, ue.cfs) > U || ae <= U && r.t - v.t < X && _e(r.cfs, bt) > U && pe, fe = a.minimumHistoryBeforePeakHours ?? 0, A = v.t - Ae, L = A >= fe * X, R = fe > 0 && !L && Me > (48 - fe) * X, ee = L ? null : R ? `The 48-hour window no longer includes ${fe} hours before this high. Its time and flow remain shown; the earlier crest check has expired.` : `At least ${fe} hours of uninterrupted eligible readings before this high are needed to establish a crest.`, ie = _e(r.cfs, b.cfs) <= U, te = { high: d, earlierPeak: I, peak: v, fallMs: i && !k.supported ? null : Ce, sincePeakMs: Me, sinceHighMs: r.t - d.t, highDropCfs: _e(d.cfs, r.cfs), drop: ae, bracketed: C, evidenceStartT: Ae, hadGap: he, trendSupported: k.supported, peakContextMs: A, contextExpired: R, contextWhy: ee, nearPostPeakLow: ie }, Ke = _e(r.cfs, b.cfs) > U && pe;
  if (i) {
    let T = Sn(f, { ...d, t: g }, a), $ = { ...te, historyStartT: h, highStartT: g, highAtBoundary: m, clockLowerBound: m || T.startCensored, peak: d, candidateHigh: v, drop: _e(d.cfs, r.cfs), sincePeakMs: r.t - d.t, fallMs: T.supported ? r.t - Math.max(g, T.lastResetT) : null, trendSupported: T.supported, contextExpired: !1, contextWhy: null }, ke = r.cfs - b.cfs > U && (Z || Ke), Be = ae <= U && Z, et = ke ? "rising_again" : ae <= U ? Be ? I || x ? "rising_again" : "rising" : "level" : ie && _e(r.cfs, ue.cfs) < 0 && !pe ? "falling_unconfirmed" : "possible";
    return { ...$, state: et, label: { rising: "Rising \u2014 crest not confirmed", rising_again: "Rising again \u2014 crest not confirmed", level: "Little change \u2014 crest not confirmed", falling_unconfirmed: "Falling \u2014 crest not confirmed", possible: "Possible crest \u2014 not confirmed" }[et] };
  }
  if (r.cfs - b.cfs > U && (Z || Ke)) return { ...te, state: "rising_again", label: "Rising again \u2014 crest not confirmed", peak: null };
  if (ae <= U) {
    let T = Z;
    return { ...te, state: T ? I || x ? "rising_again" : "rising" : "level", label: T ? I || x ? "Rising again \u2014 crest not confirmed" : "Rising \u2014 crest not confirmed" : "Little change \u2014 crest not confirmed", peak: null, fallMs: 0 };
  }
  if (!C || !L) return { ...te, bracketed: !1, state: "falling_unbracketed", label: R ? "Falling \u2014 earlier crest check expired" : "Falling \u2014 crest not established" };
  let Le = (a.minimumPeakAgeHours ?? 0) * X, qe = (a.firstConfirmationDeadlineHours ?? 1 / 0) * X, Se = !(_e(r.cfs, ue.cfs) > 0) && ie && k.supported && Me >= Le && Ce >= a.minimumHoursBelowHigh * X && ae >= Math.max(a.minimumDropCfs, v.cfs * a.minimumDropFraction), Ct = null;
  if (Se && Me > qe && (Se = !1, s))
    for (let T of f) {
      if (T.t < v.t + Le || T.t > v.t + qe) continue;
      let $ = Rn({ ...e, gauge: { ...o, points: c.filter((ke) => ke.t <= T.t), latest: T, ageMs: 0 } }, { settings: a }, !1);
      if ($.state === "confirmed" && $.peak.t === v.t) {
        Se = !0, Ct = T.t;
        break;
      }
    }
  return { ...te, evidenceEarnedT: Ct, state: Se ? "confirmed" : "possible", label: Se ? "Observed crest so far" : "Possible crest \u2014 not confirmed" };
}
function Fa(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  if (t) {
    Je("current", '<div class="flow-row"><h2>24-hour rise</h2><p class="checking-readings" role="status">Checking river readings\u2026</p><p class="meta">Verifying the latest snapshot and reading ages.</p></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>'), document.getElementById("current").setAttribute("aria-busy", "true"), Je("number-strip", "<span>Checking river readings\u2026</span>");
    return;
  }
  let a = e.gauge, s = a.endpoint, i = a.latest, o = s.available, r = o && s.elapsedMs === 24 * X, l = o ? le(s.changeCfs, !0) : "Unavailable", u = o ? s.changeCfs < 0 ? "No net 24-hour rise" : s.distanceCfs === 0 ? `At the ${le(s.referenceCfs)} cfs rise trigger` : `${Math.abs(s.distanceCfs) < 0.5 ? "Less than 1" : le(Math.abs(s.distanceCfs))} cfs ${s.distanceCfs > 0 ? "below" : "above"} the ${le(s.referenceCfs)} cfs rise trigger` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", c = e.timeUncertain ? "age unknown" : `${we(a.ageMs)} old${a.stale ? " \xB7 STALE" : ""}`, f = J(i?.cfs) ? `${le(i.cfs)} cfs` : "unavailable", d = n || a.stale || e.timeUncertain, g = o ? `${l} cfs ${d ? "over the 24 hours to this reading" : r ? "in the last 24 hours" : "over about 24 hours"}` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", h = o && s.changeCfs < 0 ? " (a fall; no net rise)" : "", m = a.history?.endpoint?.last, v = o && s.distanceCfs > 0 && m ? `<p class="meta rise-history-note">Rise reference last met ${Y(m.current?.t ?? m.windowEndT)}. Closure status is decided by health authorities.</p>` : "";
  Je("current", `<div class="flow-row"><div class="section-heading flow-heading"><h2>24-hour rise</h2>${kn("flow", "About flow readings")}</div><div class="rise-headline"><strong class="distance-headline">${M(g + h)}</strong><b class="rise-support">${M(u)}</b></div>${v}<div class="preview-flow"><strong class="actual-flow flow-number">Actual flow: ${M(f)} \xB7 ${M(c)}</strong>${i ? Y(i.t) : ""}</div></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>${En("flow", "How flow comparisons work", `<p>Flow is water passing the gauge, in cubic feet per second (cfs). A rise of 400 cfs means an increase of 400, not a river flow of 400.</p><p>The 24-hour rise compares the newest actual reading with the actual reading nearest 24 elapsed hours earlier, within 15 minutes. ${o ? `Comparison: ${le(s.comparison.cfs)} cfs at ${Y(s.comparison.t)}; ${we(s.elapsedMs)} earlier.` : ""} It is not a calendar day. Missing data are not filled.</p><p>Rise trigger shown: 400 cfs November\u2013February, 200 March\u2013April, 100 May\u2013October. Confirm these seasons with the health department.</p><p>Rise from the 24-hour low is ${a.low.available ? le(a.low.changeCfs, !0) + " cfs" : "unavailable"}. It differs from comparing with the reading 24 hours earlier.</p><p>Gauge quality: ${M(i?.qualityLabel || "unknown")}. Provisional readings are not yet finalized and may be revised.</p>`)}`), document.getElementById("current").setAttribute("aria-busy", String(t)), Je("number-strip", `<span>Flow (cfs) <strong>${J(i?.cfs) ? le(i.cfs) : "\u2014"}</strong><small>${M(c)}</small></span><span>24h change <strong>${o ? l : "\u2014"}</strong></span><span>Low rise <strong>${a.low.available ? le(a.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function Ua(e, t) {
  let n = e.peak ?? e.high, a = e.peak ? e.sincePeakMs : e.sinceHighMs, s = n ? `${e.highAtBoundary ? "Highest available reading" : "Observed high"}: <strong>${le(n.cfs)} cfs</strong> \xB7 ${J(e.highStartT) && e.highStartT < n.t ? `${Y(e.highStartT)} to ` : ""}${Y(n.t)}<br>${M(An(a))} before latest reading${e.peak ? `; now ${le(e.drop)} cfs lower` : ""}.` : M(e.why || ""), i = n ? `<p class="meta">Record starts ${Y(e.historyStartT)} \xB7 up to nine days.${e.highAtBoundary ? " This high is at the start of the available evidence; the river may have peaked earlier." : ""}</p>` : "", o = e.peak && e.drop > _t(e.peak.cfs) ? `<p class="crest-fact">${e.trendSupported && J(e.fallMs) ? `<strong>No new rise for ${e.clockLowerBound ? "at least " : ""}${M(An(e.fallMs))}</strong> <span class="clock-qualifier">\xB7 small fluctuations ignored</span>.` : "Renewed-rise clock unavailable: a complete hour of eligible readings is needed."}</p>` : "", r = e.hadGap ? `<p class="meta">Continuous evidence starts ${Y(e.evidenceStartT)} after a gap or unusable reading.</p>` : "", l = t?.available && t.riseCount > 0 ? `<p class="crest-fact"><strong>${t.riseCount} of ${t.memberCount} experimental scenarios reach a seasonal rise trigger in the next ten days.</strong> Dates and limits below; these counts are not odds.</p>` : "";
  Je("monitor", `<div class="crest-top"><h2 data-crest-state="${e.state}" data-crest-mode="observed-facts-only">${M(e.label)}</h2>${kn("crest", "About observed highs and the renewed-rise clock")}</div><p class="crest-fact">${s}</p>${i}${o}${r}${l}<p class="crest-fact crest-guidance">Growers and sampling staff make the crest call.</p>${En("crest", "Observed highs and the renewed-rise clock", `<p>${Ha}</p><p>The observed high is the highest eligible actual reading in the full available record, up to nine days, showing the full uninterrupted plateau when equal highs repeat. The high\u2019s age uses the latest equal reading; the no-new-rise clock can start earlier in that plateau. It is not an all-time high or a final crest verdict. Direction labels are withheld. If no lower reading precedes the high in this record, the earlier peak is unknown.</p><p>Both clocks end at the newest gauge reading. The renewed-rise clock starts at the high or the last material increasing trend reading. A missing quarter-hour breaks trend support; missing time is never counted. A duration whose start is outside the continuous evidence is shown as a lower bound. Freshness and quality checks can withhold the status.</p><p>A crest concerns actual river flow topping out. A closure can already be in place while the river rises. The clocks do not mean continuous falling or establish that a storm has ended.</p>`)}`);
}
function Gt(e, t) {
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
function ja(e, t, n) {
  for (let a of e || []) {
    if (!a.length || a[0].t > t || a[a.length - 1].t < n) continue;
    let s = Gt([a], t), i = Gt([a], n);
    if (!J(s) || !J(i)) continue;
    let o = Math.min(s, i);
    for (let r of a) r.t > t && r.t < n && (o = Math.min(o, r.cfs));
    return o;
  }
  return null;
}
function qa(e) {
  let t = e.gauge?.segments || [], n = e.forecast?.shifted?.segments || [], a = e.gauge?.latest, s = t.find((o) => o[o.length - 1]?.t === a?.t), i = n.find((o) => o[0]?.t === a?.t);
  return !s || !i || s[s.length - 1].cfs !== i[0].cfs ? [] : [[...s, ...i.slice(1)]];
}
function Ln(e) {
  let t = e.forecast || {}, n = Math.max(e.nowMs, e.gauge?.latest?.t ?? e.nowMs), a = t.raw?.endT, s = e.gauge?.latest?.t;
  if (!t.available || !J(a) || e.timeUncertain) return { available: !1, through: a, peaks: [], maxRatio: null, complete: !1 };
  let i = t.raw.segments, o = qa(e), r = J(s) ? s + 24 * X : n, l = /* @__PURE__ */ new Set([n, a, r]);
  for (let b = oe(n).year; b <= oe(a).year; b++) for (let p of [3, 5, 11]) {
    let _ = tt(b, p, 1);
    _ >= n && _ <= a && (l.add(_), l.add(_ - 1));
  }
  for (let b of [...i, ...o]) for (let p of b)
    p.t >= n && p.t <= a && l.add(p.t), p.t + 24 * X >= n && p.t + 24 * X <= a && l.add(p.t + 24 * X);
  for (let b = n; b <= a; b += kt) l.add(b);
  let u = -1 / 0, c = null, f = null, d = !0, g = [];
  for (let b of [...l].filter((p) => p >= n && p <= a).sort((p, _) => p - _)) {
    let p = b <= r ? o : i, _ = Gt(p, b), I = ja(p, b - 24 * X, b);
    if (!J(_) || !J(I)) {
      d = !1;
      continue;
    }
    let C = _e(_, I), x = C / Pe(b);
    g.push({ t: b, rise: C, ratio: x }), x > u && (u = x), (c === null || C > c) && (c = C, f = b);
  }
  let h = (t.crests || []).filter((b) => b.endT > n && g.some((p) => p.t >= Math.max(n, b.precedingLow?.t ?? n) && p.t <= b.endT && p.ratio >= 0.5)), m = i?.[i.length - 1], v = m?.length > 1 && m[m.length - 1].cfs > m[m.length - 2].cfs;
  return { available: g.length > 0, complete: d, through: a, maxRatio: J(u) ? u : null, maxRise: c, maxT: f, peaks: h, risingTail: v };
}
function Ba(e, t, n = Ln(e)) {
  let a = e.forecast || {}, s = e.outlook || {}, i = J(a.raw?.endT) ? Y(a.raw.endT) : "unavailable", o = n.peaks?.find((f) => f.endT > e.nowMs), r = !a.available || e.timeUncertain || e.conditionsSuppressed ? "<p>Main forecast timing unavailable.</p>" : o ? `<p><strong>Next main-forecast peak following a substantial rise:</strong> ${Y(o.startT)}${o.endT !== o.startT ? ` to ${Y(o.endT)}` : ""} \xB7 ${le(o.cfs)} cfs.</p>` : "<p>No peak following a rise of at least half the seasonal trigger is resolved in the single main forecast.</p>", l = n.available ? n.maxRatio < 0.5 ? `${n.complete ? "The single main forecast stays below half the rise trigger" : "Where readings are available, the single main forecast stays below half the rise trigger"} through ${J(n.through) ? ne(n.through) : "its available end"}.` : n.peaks.length ? "" : "The comparison using measured flow and forecasts reaches at least half the seasonal rise trigger; no supported future peak time is identified." : "There are not enough readings to check the forecast rise.", u = e.timeUncertain || e.conditionsSuppressed ? "" : `${l ? `<p>${M(l)}</p>` : ""}${n.available ? `<p class="meta">Largest supported rise from the preceding 24-hour low: ${ct(n.maxRise, !0)} cfs \xB7 ${Y(n.maxT)}. The early comparison includes measured flow and the adjusted forecast.</p>` : ""}${n.risingTail ? '<p class="meta">The main forecast is still rising at its end; its final crest time is unknown.</p>' : ""}${!n.complete && n.available ? '<p class="meta">Missing comparisons do not mean no rise.</p>' : ""}`, c = "<p>Experimental forecast scenarios unavailable.</p>";
  if (e.timeUncertain || e.conditionsSuppressed) c = "<p>Experimental scenarios unavailable until the snapshot and current time are verified.</p>";
  else if (s.available) {
    let f = (h, m) => {
      let v = Math.floor((h - e.nowMs) / (24 * X)), b = Math.ceil((m - e.nowMs) / (24 * X));
      return v === b ? `${v} days ahead` : `${v}\u2013${b} days ahead`;
    }, d = (h, m) => h === m ? Y(h) : `${Y(h)} to ${Y(m)}`;
    c = `<p class="meta">${s.memberCount} complete scenarios \xB7 six-hour readings through ${Y(s.dataThroughT ?? s.endT)}.</p><p class="outlook-range"><strong>${s.riseCount} of ${s.memberCount}</strong> reach the seasonal rise trigger${s.thresholdsCfs?.length > 1 ? "" : ` (${le(s.thresholdCfs)} cfs)`}.</p>`, s.riseCount && (c += `<p>First trigger-reaching times: ${d(s.crossingStartT, s.crossingEndT)} \xB7 <strong>${f(s.crossingStartT, s.crossingEndT)}</strong>.</p>`), c += `<p><strong>${s.halfRiseCount} of ${s.memberCount}</strong> reach at least half the seasonal trigger${s.thresholdsCfs?.length > 1 ? "" : ` (${le(s.halfThresholdCfs)} cfs)`}, including those above.</p>`, s.resolvedCount ? c += `<p><strong>Peak-time range after these substantial rises:</strong> ${d(s.peakStartT, s.peakEndT)} (${s.resolvedCount} scenarios).</p>` : c += "<p>No bounded peak-time range after these substantial rises.</p>", s.openEndCount && (c += `<p>${s.openEndCount} additional scenarios have a substantial rise with the high still open at the window\u2019s end; their peak may be later.</p>`), c += '<p class="meta"><strong>Scenario counts are not odds.</strong> This examines the next ten days; the final reading may be up to six hours short of that window. A rise means flow above the lowest scenario value in the preceding 24 hours. This differs from the exact 24-hour change shown above. Late scenarios can describe another storm.</p>';
    let g = s.comparisonCoverageStartT ?? s.riseCoverageStartT;
    J(g) && g > e.nowMs && (c += `<p class="meta">Complete 24-hour scenario comparisons begin ${Y(g)}; earlier comparisons are unavailable.</p>`), s.excludedCount && (c += `<p class="meta">${s.excludedCount} incomplete scenarios excluded.</p>`), c += `<details><summary>Scenario source and comparison details</summary><p>National Oceanic and Atmospheric Administration (NOAA), Hydrologic Ensemble Forecast Service (HEFS), through its Experimental data service. Reference/start time ${Y(s.issuedT)}; file created ${Y(s.createdT)}. Reference age: ${M(we(e.nowMs - s.issuedT))}.</p>${s.higherCount !== null && s.comparisonHigh ? `<p>${s.higherCount} of ${s.memberCount} scenarios exceed the highest available observed reading of ${le(s.comparisonHigh.cfs)} cfs (${Y(s.comparisonHigh.t)}).</p>` : ""}<p>The peak range includes only scenarios with a rise of at least half the seasonal trigger and a later high above the latest measured flow, bounded by lower forecast readings before and after it. Small bumps are excluded. A high still open at the horizon is outside the bounded range. Missing or conflicting values exclude a scenario; references older than 48 hours are withheld.</p><a href="https://api.water.noaa.gov/about/api" target="_blank" rel="noopener noreferrer">NOAA Experimental scenario service description \u2197</a></details>`;
  } else s.reason && (c = `<p>${M(s.reason)}.</p>`);
  Je("peaks", `<div class="section-top"><h2>Crest outlook</h2></div><p>A later crest remains possible. Neither the observed drop nor these forecasts confirms that the final storm crest has passed.</p><div class="outlook-summary"><h3>Experimental NOAA scenarios</h3>${c}</div><details><summary>Single main NOAA forecast \xB7 through ${J(a.raw?.endT) ? M(ne(a.raw.endT)) : "unavailable"}</summary><p class="meta">National Weather Service official river forecast${J(a.issuedT) ? `, issued ${Y(a.issuedT)}` : ""}. Available through ${i}.</p>${r}${u}<p class="meta">The main forecast is one forecast; the alternative scenario counts above describe the wider range of modeled outcomes.</p></details>`);
}
function Nn(e, t, n, a, s, i = {}) {
  Fa(t, i);
  let o = { ...t, conditionsSuppressed: !!(i.suppressed || i.checking) }, r = Pa(t, i), l = Ln(t);
  Ua(r, t.timeUncertain || o.conditionsSuppressed ? null : t.outlook), yn(t, a), Tn(o);
  let u = document.getElementById("rain");
  u.innerHTML = u.innerHTML.replaceAll("<strong>Unavailable</strong>", '<strong class="unavailable">Unavailable</strong>');
  let c = u.querySelector?.(".station-links"), f = u.querySelector?.(".rain-total-grid");
  c && f && f.insertAdjacentElement("afterend", c), Ba(o, r, l), $n(t), xn(e, t, n);
  let d = document.getElementById("forecast-details");
  d.innerHTML = d.innerHTML.replace("The adjusted forecast first reaches", "Within its first 72 hours, the adjusted forecast first reaches").replace("The adjusted forecast already meets", "Within its first 72 hours, the adjusted forecast already meets").replace("earlier measurements or the adjusted forecast", "earlier measurements or forecast values").replace("Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.", "After 72 hours, the moving rise reference uses only the unchanged official forecast. Adjusted forecasts and past cases still stop at 72 hours; a gap marks any change of basis.").replace("Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.", "The observed high is listed first. The next official forecast peak is shown alongside a separate range across experimental forecast scenarios.");
  let g = document.getElementById("sources");
  g.innerHTML = g.innerHTML.replace("Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.", "Estimated or otherwise unsupported readings cannot confirm an observed crest."), Je("snapshot-label", `Saved snapshot ${M(e.id)} \xB7 ${M(ne(e.createdAt))}`);
}

// site/js/watch-preview-reference.js
var Hn = 36e5, xe = 24 * Hn, Da = 6 * Hn, ye = Number.isFinite, Vt = (e) => ye(e) && Math.abs(e) <= 864e13;
function Wa(e) {
  if (e?.available === !1) return [];
  let t = [];
  for (let n of e?.segments || []) {
    if (!Array.isArray(n) || n.some((i, o) => o && i?.t <= n[o - 1]?.t)) continue;
    let a = [], s = () => {
      a.length && t.push(a), a = [];
    };
    for (let i of n) {
      if (!Vt(i?.t) || !ye(i?.cfs) || i.cfs < 0 || ye(e?.endT) && i.t > e.endT) {
        s();
        continue;
      }
      a.length && i.t - a.at(-1).t > Da && s(), a.push({ t: i.t, cfs: i.cfs });
    }
    s();
  }
  return t;
}
function Ye(e, t) {
  if (!e.length || t < e[0].t || t > e.at(-1).t) return null;
  for (let n = 0; n < e.length; n++) {
    let a = e[n];
    if (t === a.t) return a.cfs;
    if (t < a.t) {
      let s = e[n - 1], i = (t - s.t) / (a.t - s.t), o = (1 - i) * s.cfs + i * a.cfs;
      return ye(o) ? o : null;
    }
  }
  return null;
}
function Ga(e, t) {
  let n = [];
  for (let a = oe(e).year; a <= oe(t).year; a++) for (let s of [3, 5, 11]) {
    let i = tt(a, s, 1);
    i > e && i <= t && n.push(i);
  }
  return n.sort((a, s) => a - s);
}
function Va(e, t) {
  let n = Ye(e, t - xe), a = Ye(e, t);
  if (n === null || a === null) return null;
  let s = Math.min(n, a);
  for (let i of e) i.t > t - xe && i.t < t && (s = Math.min(s, i.cfs));
  return s;
}
function za(e, t, n) {
  let a = /* @__PURE__ */ new Set([t, n]);
  for (let i of e) for (let o of [i.t, i.t + xe]) o > t && o < n && a.add(o);
  let s = [...a].sort((i, o) => i - o);
  for (let i = 1; i < s.length; i++) {
    let o = s[i - 1], r = s[i], l = (o + r) / 2, u = e.filter((f) => f.t > l - xe && f.t < l).reduce((f, d) => Math.min(f, d.cfs), 1 / 0), c = [
      [Ye(e, o - xe), Ye(e, r - xe)],
      [Ye(e, o), Ye(e, r)],
      ...ye(u) ? [[u, u]] : []
    ];
    for (let f = 0; f < c.length; f++) for (let d = f + 1; d < c.length; d++) {
      let g = c[f][0] - c[d][0], h = c[f][1] - c[d][1];
      if (!ye(g) || !ye(h) || g === h) continue;
      let m = Math.max(Math.abs(g), Math.abs(h)), v = g / m / (g / m - h / m);
      v > 0 && v < 1 && a.add(o + v * (r - o));
    }
  }
  return [...a].sort((i, o) => i - o);
}
function Xa(e, t, n, a) {
  let s = (u, c) => {
    let f = a(u);
    return ye(f) && ye(f + c) ? f + c : null;
  };
  if (e === t) {
    let u = s(e, Pe(e));
    return { segments: ye(u) ? [[{ t: e, cfs: u }]] : [], steps: [] };
  }
  let i = Ga(e, t), o = [e, ...i, ...i.at(-1) === t ? [] : [t]], r = [], l = [];
  for (let u = 1; u < o.length; u++) {
    let c = o[u - 1], f = o[u], d = Pe(c), h = [c, ...n.filter((m) => m > c && m < f), f].map((m) => ({ t: m, cfs: s(m, d) }));
    if (h.every((m) => ye(m.cfs)) && r.push(h), i.includes(f)) {
      let m = s(f, d), v = s(f, Pe(f));
      ye(m) && ye(v) && (l.push({ t: f, beforeCfs: m, afterCfs: v }), f === t && r.push([{ t: f, cfs: v }]));
    }
  }
  return { segments: r, steps: l };
}
function On(e, t, n = "endpoint") {
  let a = { available: !1, basis: "official_forecast", segments: [], steps: [], startT: null, endT: null };
  if (!Vt(t) || !Vt(e?.endT) || e.endT <= t || !["endpoint", "low"].includes(n)) return a;
  let s = Wa(e), i = [], o = [], r = t + 1, l = (c, f, d, g) => {
    if (c > f) return;
    let h = Xa(c, f, d, g);
    i.push(...h.segments), o.push(...h.steps);
  };
  if (n === "endpoint")
    for (let c of s) for (let f of s) {
      let d = Math.max(r, c[0].t, f[0].t + xe), g = Math.min(e.endT, c.at(-1).t, f.at(-1).t + xe);
      l(d, g, f.map((h) => h.t + xe), (h) => Ye(f, h - xe));
    }
  else
    for (let c of s) {
      let f = Math.max(r, c[0].t + xe), d = Math.min(e.endT, c.at(-1).t);
      f <= d && l(f, d, za(c, f, d), (g) => Va(c, g));
    }
  i.sort((c, f) => c[0].t - f[0].t);
  let u = i.flat();
  return u.length ? {
    available: !0,
    basis: "official_forecast",
    segments: i,
    steps: o,
    startT: Math.min(...u.map((c) => c.t)),
    endT: Math.max(...u.map((c) => c.t))
  } : a;
}

// site/js/watch-chart.js
var G = Number.isFinite, V = null, Za = (e, t, n) => G(e?.t) && G(e?.cfs) && e.t >= t && e.t <= n;
function Et(e, t, n) {
  for (let a of e || []) {
    let s = vn(a, (i) => i.t === t);
    if (s) return s.cfs;
    for (let i = 1; i < a.length; i++) {
      let o = a[i], r = a[i - 1];
      if (r.t < t && o.t > t)
        return o.t - r.t > n ? null : r.cfs + (o.cfs - r.cfs) * (t - r.t) / (o.t - r.t);
    }
  }
  return null;
}
function Pn(e, t, n, a) {
  let s = e.filter((i) => Za(i, t, n));
  for (let i of [t, n])
    if (!s.some((o) => o.t === i)) {
      let o = Et([e], i, a);
      G(o) && s.push({ t: i, cfs: o });
    }
  return s.sort((i, o) => i.t - o.t);
}
function Ja(e, t, n) {
  return e.map((a, s) => `${s ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function In(e, t, n) {
  return (e?.segments || []).map((a) => {
    let s = Pn(a, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !a.length || i.t < a[0].t || i.t > a.at(-1).t) continue;
      let o = s.findIndex((l) => l.t >= i.t), r = o < 0 ? s.length : o;
      for (; s[r]?.t === i.t; ) s.splice(r, 1);
      s.splice(r, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return s;
  });
}
var Ya = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function zt(e) {
  let t = Object.fromEntries(Ya.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function Qa(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - zt(t);
  return t;
}
function Ka(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), s = zt(e), i = zt(t), o = [];
  for (let r of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let l = Math.min(r, 12) * 36e5, u = [];
    for (let f = Math.ceil(s / l) * l; f <= i + 36e5; f += r * 36e5) {
      let d = Qa(f);
      d >= e && d <= t && u.push(d);
    }
    if (u.length < 2) continue;
    o = u;
    let c = Math.min(...u.slice(1).map((f, d) => (f - u[d]) / (t - e) * n));
    if (u.length <= a && c >= 40) return u;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function Fn(e, t, n, { previewReferenceTail: a = !1, officialReferenceTail: s = null } = {}) {
  let i = Math.max(1, Math.floor(e.clientWidth)), o = globalThis.innerHeight, r = i < 500 ? 240 : G(o) && o < 500 ? Math.max(180, Math.min(280, o - 80)) : 280, l = { left: Math.min(49, i / 4), right: Math.min(14, i / 4), top: 26, bottom: 38 }, u = l.left, c = i - l.right, f = l.top, d = r - l.bottom, g = t.gauge?.latest?.t, h = Math.round(t.nowMs), m = document.getElementById("chart-cursor");
  if (t.timeUncertain && !G(g)) {
    let w = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="${w}"><text x="${i / 2}" y="${r / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${i / 2}" y="${r / 2 + 4}" text-anchor="middle">${i < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let H of document.querySelectorAll?.(".legend span") ?? []) H.hidden = !0;
    V = null, m.min = "0", m.max = "1", m.step = "1", m.value = "0", m.disabled = !0, m.style.marginLeft = `${u - 10}px`, m.style.width = `${c - u + 20}px`, m.setAttribute("aria-valuetext", w), document.getElementById("chart-readout").textContent = w;
    return;
  }
  let v = t.timeUncertain ? g : h, b = v - Number(n.past || 24) * 36e5, p = n.range === "full" ? Math.max(v + 36e5, t.forecast?.raw?.endT ?? v + 72 * 36e5) : v + (n.range === "day" ? 24 : 72) * 36e5, _ = t.forecast || {}, I = t.gauge?.references?.[n.reference], C = _.references?.[n.reference], x = { segments: [...I?.segments || [], ...C?.segments || []], steps: [...I?.steps || [], ...C?.steps || []] }, S = a && G(g) ? s : null, P = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: _.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: _.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: _.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: _.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: a ? "Rise-trigger flow" : "24-hour rise reference", segments: In(x, b, p), gap: 1 / 0 }, ...S ? [{ key: "reference", name: "Official forecast-based rise-trigger flow", basis: "official-forecast", segments: In(S, Math.max(b, S.startT ?? g + 72 * 36e5 + 1), p), gap: 1 / 0 }] : []].map((w) => ({ ...w, visible: w.key === "reference" ? w.segments : w.segments.map((H) => Pn(H, b, p, w.gap)) })), k = P.flatMap((w) => w.visible.flat()).filter((w) => G(w.cfs)), U = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let w of document.querySelectorAll?.(".legend span") ?? []) {
    let H = U[w.querySelector("i")?.className];
    w.hidden = !!H && !P.some((We) => We.key === H && We.visible.some((Pt) => Pt.length));
  }
  let ae = Math.max(10, ...k.map((w) => w.cfs)) * 1.08, Ce = ae / 4, Me = Math.pow(10, Math.floor(Math.log10(Ce))), Ae = Ce / Me, he = (Ae <= 1 ? 1 : Ae <= 2 ? 2 : Ae <= 5 ? 5 : 10) * Me, ue = he * 4, D = (w) => u + (w - b) / (p - b) * (c - u), pe = (w) => d - w / ue * (d - f), bt = Array.from({ length: 5 }, (w, H) => he * H), Z = Ka(b, p, c - u), fe = bt.map((w) => `<line class="grid" x1="${u}" x2="${c}" y1="${pe(w)}" y2="${pe(w)}"/><text x="${u - 7}" y="${pe(w) + 4}" text-anchor="end">${M(ct(w))}</text>`).join("") + Z.map((w) => {
    let H = D(w), We = H < 24 ? "start" : H > i - 24 ? "end" : "middle", Pt = `<tspan x="${H}">${M(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(w))}</tspan><tspan x="${H}" dy="14">${M(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(w))}</tspan>`;
    return `<text class="x-axis-label" x="${H}" y="${r - 24}" text-anchor="${We}">${Pt}</text>`;
  }).join(""), A = P.map((w) => w.visible.filter((H) => H.length).map((H) => H.length === 1 ? `<circle class="${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} cx="${D(H[0].t)}" cy="${pe(H[0].cfs)}" r="2" fill="var(--${w.key === "observed" ? "obs" : w.key})"/>` : `<path class="plot-line ${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} d="${Ja(H, D, pe)}"/>`).join("")).join(""), L = Et(x.segments, b, 1 / 0) ?? Et(x.segments, v, 1 / 0), R = G(L) ? pe(L) : f + 14;
  R = R - f > 32 ? R - 10 : R + 24, R = Math.max(f + 12, Math.min(d - 6, R));
  let ee = P.find((w) => w.key === "reference")?.visible.flat() || [], ie = ee.reduce((w, H) => !w || H.t > w.t ? H : w, null), te = a ? 112 : 84, Ke = a ? "Rise-trigger flow" : "24h rise line", Le = ie ? Math.max(u + 4, Math.min(c - te - 4, D(ie.t) - te)) : u + 4, qe = R, Ne = Le + te, Se = G(n.cursorT) && n.cursorT >= b && n.cursorT <= p ? D(n.cursorT) : null, Ct = G(g) && g >= b && g <= p ? D(g) : null, T = ie && D(ie.t) - u >= te, $ = [Se, Ct].some((w) => G(w) && w >= Le && w <= Ne), ke = c - u < 200 || !T || $ ? "" : `<rect class="reference-label-bg" x="${Le}" y="${qe - 12}" width="${te}" height="16" rx="3"/><text class="reference-label" x="${Le + 4}" y="${qe}">${Ke}</text>`, Be = t.timeUncertain && c - u < 132, et = t.timeUncertain ? Be ? "Last reading" : "Last saved river reading" : "Latest observed", Kt = t.timeUncertain ? Be ? 80 : 132 : 90, ea = G(g) && g >= b && g <= p ? `<line x1="${D(g)}" x2="${D(g)}" y1="${f}" y2="${d}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(u, Math.min(c - Kt, D(g) + 5))}" y="${f - 9}">${et}</text>` : "", ta = !t.timeUncertain && h >= b && h <= p ? `<line class="now" x1="${D(h)}" x2="${D(h)}" y1="${f}" y2="${d}"/><text x="${Math.min(c - 25, D(h) + 5)}" y="${f + 15}">Now</text>` : "", De = G(n.cursorT) ? Math.max(b, Math.min(p, n.cursorT)) : null, na = De !== null ? `<line class="cursor" x1="${D(De)}" x2="${D(De)}" y1="${f}" y2="${d}"/>` : "", Te = G(g) ? g + 72 * 36e5 : null, aa = G(_.raw?.endT) && _.raw.endT > Te && (_.raw?.segments || []).some((w) => w.some((H) => G(H.cfs) && H.t > Te)), en = P.some((w) => ["shifted", "case"].includes(w.key) && w.visible.some((H) => H.length)), Ht = en && n.range === "full" && G(Te) && Te > b && p - Te > 6 * 36e5 && aa, Ot = Ht ? c - D(Te) : 0, sa = a ? "Beyond this limit the forecast and its 24-hour rise reference use official forecast values only, where supported. Adjusted forecasts and past cases stop at 72 hours. The reference changes basis in a separate path." : "Beyond this limit only supported official forecast points can be shown. Adjustments, past cases and moving references are limited to at most 72 hours.", ra = Ht ? `<g class="forecast-horizon"><title>72-hour context limit: ${M(ne(Te, !0))}. ${sa}</title><rect x="${D(Te)}" y="${f}" width="${Ot}" height="${d - f}" fill="currentColor" opacity=".04"/><line x1="${D(Te)}" x2="${D(Te)}" y1="${f}" y2="${d}" stroke="currentColor" stroke-dasharray="3 4" opacity=".55"/>${Ot >= 65 ? `<rect x="${c - 68}" y="${f + 6}" width="67" height="33" rx="3" fill="var(--surface)" opacity=".95"/><text x="${c - 4}" y="${f + 19}" text-anchor="end"><tspan x="${c - 4}">After 72h</tspan><tspan x="${c - 4}" dy="14">Official only</tspan></text>` : ""}</g>` : "", ia = P.some((w) => w.segments.some((H) => H.some((We) => G(We.t) && G(We.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. ${a ? en ? "After the 72-hour limit, any reference shown uses only official forecast values and begins as a separate path. " : "Any future reference shown uses official forecast values only. " : ""}Observations and forecast paths from ${M(ne(b, !0))} through ${M(ne(p, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${u}" y="${f}" width="${c - u}" height="${d - f}"/></clipPath></defs>${fe}<g clip-path="url(#plot-clip)">${ra}${A}${na}</g>${ke}${ea}${ta}${k.length ? "" : `<text x="${(u + c) / 2}" y="${r / 2}" text-anchor="middle">${ia}</text>`}</svg>${Ht && Ot < 65 ? `<p class="meta forecast-horizon-caption">${a ? "After 72h: official forecast and its supported 24-hour reference." : "After 72h: official forecast only, where supported."}</p>` : ""}`, V = { lines: P, hasData: k.length > 0, start: b, end: p, left: u, right: c, width: i, host: e, contextLimit: Te, previewReferenceTail: a }, m.min = String(b), m.max = String(p), m.step = "1", m.disabled = !V.hasData, m.style.marginLeft = `${u - 10}px`, m.style.width = `${c - u + 20}px`;
  let It = De ?? Math.max(b, Math.min(p, G(g) ? g : h));
  m.value = String(Math.round(It)), m.setAttribute("aria-valuetext", t.timeUncertain ? `${De === null ? "Last saved river reading" : "Saved chart selection"}: ${ne(It)}. Current time is unconfirmed.` : ne(It)), De !== null ? es(De) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function es(e) {
  if (!V) return;
  let t = V.lines.map((n) => {
    let a = Et(n.visible, e, n.gap);
    return G(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${M(ne(e))}</strong><br>${t.map(M).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}${G(V.contextLimit) && e > V.contextLimit ? `<br><span class="meta">${V.previewReferenceTail ? "Beyond 72 hours: official forecast values only. The reference uses those forecast values when supported; adjusted forecasts and past cases stop at 72 hours." : "Beyond 72 hours: official forecast only, where supported. Other comparisons are limited to 72 hours."}</span>` : ""}`;
}
function Un(e) {
  if (!V?.hasData) return null;
  let t = V.host.getBoundingClientRect(), n = t.width / V.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - V.left) / (V.right - V.left)));
  return Math.round(V.start + a * (V.end - V.start));
}
function Xt() {
  if (!V?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return G(e) ? Math.max(V.start, Math.min(V.end, e)) : null;
}
function jn(e) {
  let t = Xt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? V.start : e === "End" ? V.end : G(n[e]) ? Math.max(V.start, Math.min(V.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var qn = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var xt = (e, t, n) => Fn(e, t, n, { previewReferenceTail: !0, officialReferenceTail: On(t.forecast.raw, (t.gauge.latest?.t ?? NaN) + (t.forecast.shifted?.available ? 72 * 36e5 : 0), n.reference) }), ns = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", Gn = new URL("./", import.meta.url), Vn = "samish.public.preview.packet.v1", zn = "samish.public.preview.preferences.v1", Rt = 9466848e5, ht = 41024448e5, Qe = 5 * 6e4, Xn = 2 * 1024 * 1024, E = (e) => document.getElementById(e), pt = Number.isFinite;
function gt() {
  let e = E("number-strip"), t = E("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", gt, { passive: !0 });
window.addEventListener("resize", gt);
function Qt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = E(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function Jt(e, t, n = !1) {
  let a = E(e), s = E(`${e}-toggle`);
  if (!(!a || !s) && (a.open = t, Qt(), gt(), n)) {
    s.focus({ preventScroll: !0 });
    let i = E("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, r = s.getBoundingClientRect();
    (r.top < o + 8 || r.bottom > innerHeight - 8) && s.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), gt();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), Jt(t.dataset.helpTarget, !E(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), Jt(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || E(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), Jt(t.id, !1, !0));
});
Qt();
var Zn = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, Jn = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, q = () => {
  throw new Error("invalid_public_packet");
};
function O(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && q(), e;
}
function be(e, t = !1, n = !1, a = !1, s = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !pt(e) || !n && e < 0 || a && !Number.isInteger(e) || e > s) && q();
}
function N(e, t = !1) {
  be(e, t, !1, !0, ht), e !== null && e < Rt && q();
}
function dt(e) {
  typeof e != "boolean" && q();
}
function de(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && q();
}
function me(e, t, n) {
  (!Array.isArray(e) || e.length > t) && q(), e.forEach(n);
}
var as = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], ss = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], rs = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function Yt(e, t = !1) {
  O(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), N(e.t, t), "cfs" in e && be(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && dt(e[n]);
  "approval" in e && de(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && de(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && de(e[n], rs);
  "reason" in e && de(e.reason, as, !0);
}
function yt(e, t = !1) {
  e !== null && (O(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), N(e.t), be(e.cfs, !0), t && N(e.eligibleT, !0));
}
function Bn(e, t) {
  O(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), N(t.lastAttemptAt, !0), N(t.lastSuccessAt, !0), de(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (O(n, ["points", "exclusions", "coveredWindow"]), me(n.points, 4096, (a) => Yt(a)), me(n.exclusions, 4096, (a) => Yt(a, !0)), n.coveredWindow !== null)) {
      let a = O(n.coveredWindow, ["startT", "endT", "complete"]);
      N(a.startT), N(a.endT), (a.complete !== !0 || a.startT > a.endT) && q();
    }
    if (e === "noaa" && (O(n, ["issuedT", "points", "conflicts"], ["sourceCode"]), "sourceCode" in n && de(n.sourceCode, ["nwrfc_textplot", "nwps_stageflow"]), N(n.issuedT), me(n.points, 1024, (a) => {
      O(a, ["t", "cfs"]), N(a.t), be(a.cfs);
    }), me(n.conflicts, 1024, (a) => N(a))), e === "radar") {
      O(n, ["generatedT", "hours", "conflicts"], ["definitionCode", "regions"]), N(n.generatedT);
      let a = (i) => {
        N(i), i % 36e5 && q();
      }, s = (i) => me(i, 256, (o) => {
        O(o, ["endT", "mm"]), a(o.endT), be(o.mm, !0);
      });
      if (s(n.hours), me(n.conflicts, 256, a), "regions" in n) {
        de(n.definitionCode, ["wbd_huc12_upper_middle_friday_vs_lower_v1", "wbd_huc12_four_subbasins_v2"]);
        let i = n.definitionCode === "wbd_huc12_four_subbasins_v2" ? { upper: 0.28262613994476493, middle: 0.2623816064352527, friday: 0.4230969851947867, lower: 0.03040672516131746 } : { upper: 0.9621456571845356, lower: 0.03785426796335805 };
        O(n.regions, Object.keys(i));
        let o = 0;
        for (let [r, l] of Object.entries(n.regions))
          O(l, ["areaFraction", "hours", "conflicts"]), be(l.areaFraction, !1, !1, !1, 1), Math.abs(l.areaFraction - i[r]) > 1e-9 && q(), o += l.areaFraction, s(l.hours), me(l.conflicts, 256, a);
        Math.abs(o - Object.values(i).reduce((r, l) => r + l, 0)) > 1e-9 && q();
      } else "definitionCode" in n && q();
    }
    if (e === "ensemble") {
      O(n, ["issuedT", "createdT", "archiveCreatedT", "sourceCode", "members"]), N(n.issuedT), N(n.createdT), N(n.archiveCreatedT), de(n.sourceCode, ["noaa_hefs"]);
      let a = /* @__PURE__ */ new Set();
      me(n.members, 100, (s) => {
        O(s, ["id", "points"]), (typeof s.id != "string" || !/^\d{4}$/.test(s.id) || a.has(s.id)) && q(), a.add(s.id), me(s.points, 256, (i) => {
          O(i, ["t", "cfs"]), N(i.t), be(i.cfs, !0);
        });
      });
    }
    e === "grid" && (O(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), N(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && q(), me(n.periods, 1024, (a) => {
      O(a, ["startT", "endT", "mm"]), N(a.startT), N(a.endT), be(a.mm, !0), a.endT <= a.startT && q();
    })), e === "tides" && (O(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && q(), me(n.points, 128, (a) => {
      O(a, ["t", "ft", "type"]), N(a.t), be(a.ft, !1, !0), de(a.type, ["H", "L"]);
    }));
  }
}
function is(e) {
  O(e, ["summary", "transitions"]);
  let t = O(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && q(), N(t.asOf), de(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && Yt(t.actualCurrentObservation), N(t.supportObservationT, !0), t.event !== null) {
    let o = O(t.event, ["openedT", "high", "cycle"]);
    N(o.openedT), yt(o.high);
    let r = O(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    be(r.ordinal, !1, !1, !0, 1e5), N(r.openedT), yt(r.high, !0), yt(r.low), dt(r.endingPending);
  }
  if (t.standing !== null) {
    let o = O(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    de(o.kind, ["downturn", "correction"]), de(o.state, ["possible_downturn", "rising_again"]), N(o.t), N(o.detectedAt), be(o.cfs), dt(o.active), yt(o.supportingHigh), yt(o.low);
  }
  let n = (o) => me(o, 16, (r) => de(r, ss)), a = O(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  de(a.status, ["available", "warming_up", "partial", "unavailable"]), dt(a.newDownturnAvailable), dt(a.aboveHighCorrectionAvailable), n(a.reasons);
  let s = O(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(s.blockingReasons), N(s.nextEligibleAt, !0);
  let i = O(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  N(i.lastSuccessfulPollAt, !0), be(i.monitoringGapMs, !0, !1, !1, ht), be(i.observationAgeMs, !0, !1, !1, ht), me(i.missingQuarterHours, 7, (o) => N(o)), dt(i.clockTrusted), me(e.transitions, 32, (o) => {
    O(o, ["kind", "t", "cfs", "event", "detected_at"]), de(o.kind, ["downturn", "event_end"]), N(o.t), N(o.detected_at), be(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && q();
  });
}
async function Yn(e) {
  O(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && q();
  let t = new TextEncoder().encode(e.payload);
  t.length > Xn && q(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && q();
  let a = JSON.parse(e.payload);
  O(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && q(), N(a.publishedAt);
  let s = O(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (s.schemaVersion !== 1 || typeof s.id != "string" || !/^[a-f0-9]{12}$/.test(s.id)) && q(), N(s.createdAt), a.publishedAt < s.createdAt && q();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return O(s.sources, i, ["ensemble"]), i.forEach((o) => Bn(o, s.sources[o])), "ensemble" in s.sources && Bn("ensemble", s.sources.ensemble), is(s.monitor), s.monitor.summary.asOf !== s.createdAt && q(), a;
}
var ft = Zn(zn) || {}, B = { range: ["day", "three", "full"].includes(ft.range) ? ft.range : "full", past: ft.past === 48 ? 48 : 24, reference: ft.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(ft.theme) ? ft.theme : null, cursorT: null };
B.theme && (document.documentElement.dataset.theme = B.theme);
var ve = null, $t = null, Q = null, Zt = !1, K = "waiting", Ue = null, Tt = null, Lt = !0, je = !1, Ie = Date.now(), Nt = () => Jn(zn, { range: B.range, past: B.past, reference: B.reference, theme: B.theme });
function os() {
  let e = Date.now(), t = Ue ? Math.max(0, performance.now() - Ue.mono) : 0, n = Ue ? Ue.lower + t : null, a = Ue ? Ue.upper + t : null;
  Ie = Math.max(Ie, e, a ?? 0, ve?.snapshot.createdAt ?? 0);
  let s = Lt || !Ue || e < n - Qe || e > a + Qe || e + Qe < Ie || ve && ve.snapshot.createdAt > a + Qe;
  return { now: Ie, uncertain: s };
}
function Qn() {
  return Tt ? Tt.now + Math.max(0, performance.now() - Tt.mono) : 0;
}
function ls() {
  $t && Jn(Vn, { packet: $t, greatestNow: Ie, trustedNow: Qn(), savedDeviceMs: Date.now(), ended: je });
}
function Dn(e) {
  let t = E("connection");
  if (K === "waiting") {
    t.textContent = "Checking the public snapshot and current time\u2026", t.className = "connection";
    return;
  }
  if (!ve) {
    t.textContent = je ? "Preview ended. No current readings are provided." : K === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - ve.snapshot.createdAt), a = K !== "checked";
  if (!je && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${we(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [je ? "Preview ended. Earlier readings are retained for reference." : a ? K === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : K === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current crest status is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${ne(ve.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${we(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current crest status is withheld." : ""].join(" "), t.className = "connection attention";
}
function Re() {
  let e = os();
  if (!ve) {
    Dn(e);
    let c = K === "waiting";
    E("current").textContent = c ? "Checking river readings\u2026" : "No verified river readings available.", E("current").setAttribute("aria-busy", String(c)), E("monitor").textContent = c ? "" : "Crest status unavailable until readings can be verified.";
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((c) => c.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((c) => [...E(c).querySelectorAll("details:not(.section-help)")].flatMap((f, d) => f.open ? [`${c}:${d}`] : [])), s = ve.snapshot, i = e.uncertain ? s.createdAt : e.now;
  Q = mn({ nowMs: i, sources: s.sources, ratioTable: qn });
  let o = je || e.uncertain || K !== "checked" || e.now - s.createdAt > 12 * 6e4;
  Q.timeUncertain = e.uncertain, e.uncertain && (Q.forecast.freshContext = !1, Q.forecast.higherLater = { ...Q.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let r = s.monitor.summary, l = !pt(r.supportObservationT) || i - r.supportObservationT > 60 * 6e4;
  if (o) {
    let c = { code: je ? "preview_ended" : e.uncertain ? "public_time_uncertain" : K !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" };
    Q.gauge.direction = { ...Q.gauge.direction, available: !1, reason: c }, Q.gauge.twelveHourChange = { ...Q.gauge.twelveHourChange, available: !1, reason: c };
  }
  let u = s;
  if (o || l || !r.support.clockTrusted) {
    let c = [...r.capability.reasons, ...l ? [pt(r.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...r.support.clockTrusted ? [] : ["clock_uncertain"]];
    u = { ...s, monitor: { ...s.monitor, summary: { ...r, capability: { ...r.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: c }, preparation: { ...r.preparation, nextEligibleAt: null } } } };
  }
  Nn(u, Q, e.uncertain ? null : { lastCommitAt: s.createdAt, workerStale: e.now - s.createdAt > 12 * 6e4 }, B, i, { checking: K === "waiting", suppressed: o });
  for (let c of E("forecast-details").querySelectorAll("a")) c.getAttribute("href") === "/data/ratio_table.json" && (c.href = new URL("ratio_table.json", Gn).href, c.textContent = "View the frozen historical-case table");
  a.forEach((c) => {
    let [f, d] = c.split(":"), g = E(f).querySelectorAll("details:not(.section-help)")[Number(d)];
    g && (g.open = !0);
  }), Qt(n), document.querySelectorAll("[data-range]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.range === B.range))), E("past").value = String(B.past), E("reference").value = B.reference, xt(E("chart"), Q, B), Dn(e), gt(), ls(), t && E(t) && document.activeElement?.id !== t && E(t).focus({ preventScroll: !0 });
}
async function Kn(e, t = Xn * 2) {
  let n = new AbortController(), a = setTimeout(() => n.abort(), 18e3);
  try {
    let s = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!s.ok) throw new Error("unavailable");
    let i = await s.text();
    return new TextEncoder().encode(i).length > t && q(), { response: s, value: JSON.parse(i) };
  } finally {
    clearTimeout(a);
  }
}
async function cs() {
  let e = new URL("version.json", Gn);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await Kn(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && q(), je = n.state === "ended";
  let a = t.headers.get("Date"), s = t.headers.get("Age"), i = Date.parse(a || "");
  if (!pt(i) || i < Rt || i > ht || s !== null && !/^\d+$/.test(s)) throw new Error("time_unavailable");
  let o = s === null ? 0 : Number(s);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let r = i, l = Date.now();
  l >= i - Qe && l <= r + Qe && r - l <= Qe && (Ie = Math.max(r, l, Qn(), ve?.snapshot.createdAt ?? 0), Tt = { now: Ie, mono: performance.now() }), Ue = { lower: i, upper: r, mono: performance.now() }, Lt = !1;
}
function us(e, t) {
  if (ve) {
    let n = ve.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      K = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && q(), K = "checked";
      return;
    }
  }
  ve = e, $t = t, K = "checked";
}
async function mt() {
  if (!Zt) {
    Zt = !0, E("refresh").disabled = !0, K === "waiting" && Re();
    try {
      let e = new URL(ns);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([cs(), Kn(e)]);
      if (t[0].status === "rejected" && (Lt = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          us(await Yn(n), n);
        } catch {
          K = "invalid";
        }
      else K = "offline";
      Re();
    } finally {
      Zt = !1, E("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  B.range = e.dataset.range, B.cursorT = null, Nt(), Re();
}));
E("past").addEventListener("change", () => {
  B.past = Number(E("past").value), Nt(), Re();
});
E("reference").addEventListener("change", () => {
  B.reference = E("reference").value, Nt(), Re();
});
E("theme").addEventListener("click", () => {
  let e = B.theme ? B.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  B.theme = e ? "light" : "dark", document.documentElement.dataset.theme = B.theme, Nt();
});
E("refresh").addEventListener("click", mt);
E("chart").addEventListener("pointerdown", (e) => {
  B.cursorT = Un(e), Q && xt(E("chart"), Q, B);
});
E("chart-cursor").addEventListener("input", () => {
  B.cursorT = Xt(), Q && xt(E("chart"), Q, B);
});
E("chart-cursor").addEventListener("keydown", (e) => {
  let t = jn(e.key);
  t !== null && (e.preventDefault(), B.cursorT = t, Q && xt(E("chart"), Q, B));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (K = "waiting", Re(), mt());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (K = "waiting", Re(), mt());
});
window.addEventListener("offline", () => {
  K = "offline", Lt = !0, Re();
});
window.addEventListener("online", mt);
var Wn = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== Wn && (Wn = t, Q && xt(E("chart"), Q, B), gt());
}).observe(E("chart"));
async function fs() {
  let e = Zn(Vn);
  if (e?.packet)
    try {
      ve = await Yn(e.packet), $t = e.packet, pt(e.greatestNow) && e.greatestNow >= Rt && e.greatestNow <= ht && (Ie = Math.max(Ie, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), pt(e.trustedNow) && e.trustedNow >= Rt && e.trustedNow <= ht && (Tt = { now: e.trustedNow, mono: performance.now() }), je = e.ended === !0, K = "waiting", Re();
    } catch {
      ve = null, $t = null;
    }
  await mt(), setInterval(() => {
    document.hidden || mt();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || Re();
  }, 3e4);
}
fs();
export {
  mn as buildWatchModel,
  Yn as verifyPublicPacket
};
