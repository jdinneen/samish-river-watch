// site/js/season.js
var ls = "America/Los_Angeles";
var Ft = null;
function cs() {
  return Ft === null && (Ft = new Intl.DateTimeFormat("en-US", {
    timeZone: ls,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), Ft;
}
function he(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of cs().formatToParts(new Date(e)))
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
function nn(e) {
  let t = he(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function rt(e, t, n, s = 0, a = 0) {
  let i = Date.UTC(e, t - 1, n, s, a), o = i - nn(i);
  return i - nn(o);
}
function Ee(e) {
  let t = he(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var us = 3600 * 1e3, fs = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function jt(e, t) {
  for (let n = 0; n < e.length; n++) {
    let s = e[n], a = n === e.length - 1;
    if (t >= s.lead_lo_h && (t < s.lead_hi_h || a && t === s.lead_hi_h)) return s;
  }
  return null;
}
function ds(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : fs).includes(he(t).month);
}
var Ve = (e) => typeof e == "number" && Number.isFinite(e);
function hs(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!Ve(e.rise_floor_cfs) || !Ve(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!Ve(t.lead_lo_h) || !Ve(t.lead_hi_h) || !Ve(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let s = t[n];
      if (!s || !Ve(s.low_factor) || !Ve(s.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function sn(e, t, n, s = t.t) {
  let a = [], i = [], o = ds(n, s);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: a, low: i, wetSeason: o };
  hs(n);
  let r = n.bins, c = r[r.length - 1].lead_hi_h;
  for (let u of e) {
    let l = (u.t - t.t) / us;
    if (l <= 0 || l > c) continue;
    let d = jt(r, l);
    if (!d) continue;
    let f, p;
    if (u.cfs >= n.storm_flow_cfs) {
      let h = u.cfs - t.cfs >= n.rise_floor_cfs ? d.rise : d.flat;
      f = u.cfs * h.high_factor, p = u.cfs * h.low_factor;
    } else
      f = u.cfs + d.add_cfs, p = u.cfs - d.add_cfs;
    a.push({ t: u.t, cfs: Math.max(f, u.cfs) }), i.push({ t: u.t, cfs: Math.max(0, Math.min(p, u.cfs)) });
  }
  return { high: a, low: i, wetSeason: o };
}

// site/js/watch-conditions.js
var ue = Number.isFinite, Bt = 0.1;
function an(e, t = [], n = []) {
  let s = /* @__PURE__ */ new Map(), a = new Set(n);
  for (let f of t)
    !ue(f?.endT) || f.endT % 36e5 || f.endT > e || (!ue(f.mm) || f.mm < 0 || s.has(f.endT) && s.get(f.endT) !== f.mm ? a.add(f.endT) : s.set(f.endT, f.mm));
  let i = [...s.keys(), ...a].filter((f) => ue(f) && f <= e && f % 36e5 === 0), o = i.length ? Math.max(...i) : null, r = {
    available: !1,
    state: "unknown",
    endT: o,
    thresholdMm: Bt,
    ageMs: o === null ? null : e - o,
    hours: 0,
    sinceT: null,
    transitionKnown: !1,
    leftCensored: null,
    lowerBoundHours: null
  };
  if (o === null || e - o > 3 * 36e5 || a.has(o) || !s.has(o)) return r;
  let c = s.get(o) >= Bt, u = 0, l = o;
  for (; s.has(l) && !a.has(l) && s.get(l) >= Bt === c; )
    u++, l -= 36e5;
  let d = s.has(l) && !a.has(l);
  return {
    ...r,
    available: !0,
    state: c ? d ? "restarted" : "raining" : "paused",
    hours: u,
    sinceT: o - u * 36e5,
    transitionKnown: d,
    leftCensored: !d,
    lowerBoundHours: u,
    latestMm: s.get(o)
  };
}
function rn(e, t, n = null, s = 400, a = null) {
  let i = t?.data, o = e + 240 * 36e5, r = ue(n?.cfs) && ue(n?.t) && n.t <= e ? { t: n.t, cfs: n.cfs } : null, c = {
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
    thresholdCfs: typeof s == "number" && ue(s) && s > 0 ? s : null,
    halfThresholdCfs: typeof s == "number" && ue(s) && s > 0 ? s / 2 : null,
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
  if (!i || !ue(i.issuedT) || i.issuedT > e || e - i.issuedT > 48 * 36e5 || !Array.isArray(i.members))
    return { ...c, reason: i ? "Forecast scenarios are too old or their issue time is invalid" : c.reason };
  let u = /* @__PURE__ */ new Set(), l = 0, d = 0, f = 0, p = null, h = [], g = [], b = (_) => typeof s == "function" ? s(_) : s;
  if (!ue(b(e)) || b(e) <= 0) return { ...c, reason: "Seasonal rise threshold is invalid" };
  c.thresholdCfs = b(e), c.halfThresholdCfs = b(e) / 2;
  let v = /* @__PURE__ */ new Set([b(e)]);
  for (let _ of i.members) {
    if (u.has(_.id)) return { ...c, reason: "Conflicting forecast scenario identities" };
    u.add(_.id);
    let m = (_.points ?? []).filter((R) => ue(R?.t)).sort((R, U) => R.t - U.t), A = m.filter((R) => R.t <= e).at(-1), y = m.filter((R) => R.t > e && R.t <= o), $ = A ? [A, ...y] : y;
    if (!(A && e - A.t <= 6 * 36e5 && y.length >= 2 && o - y.at(-1).t < 6 * 36e5 && $.every((R, U) => ue(R.cfs) && R.cfs >= 0 && (!U || R.t - $[U - 1].t === 6 * 36e5)))) {
      c.excludedCount++;
      continue;
    }
    c.memberCount++, c.dataThroughT = c.dataThroughT === null ? y.at(-1).t : Math.min(c.dataThroughT, y.at(-1).t);
    let H = Math.max(...y.map((R) => R.cfs));
    r && H > r.cfs && l++;
    let L = m.filter((R) => R.t <= o), I = new Map(L.map((R, U) => [R.t, U])), ee = (R) => {
      let U = I.get(R);
      if (U === void 0 || U < 4) return null;
      let O = L.slice(U - 4, U + 1);
      return O.length !== 5 || O.some((le, de) => !ue(le.cfs) || le.cfs < 0 || de && le.t - O[de - 1].t !== 6 * 36e5) ? null : { rise: L[U].cfs - Math.min(...O.map((le) => le.cfs)), flowCfs: L[U].cfs };
    }, E = -1 / 0, S = null, P = null, K = null, te = null, j = null, ne = null;
    for (let R of y) {
      let U = ee(R.t);
      if (!U) continue;
      (p === null || R.t < p) && (p = R.t);
      let O = U.rise;
      O > E && (E = O, S = R.t, P = R.cfs);
      let le = b(R.t);
      !ue(le) || le <= 0 || (v.add(le), O >= le && K === null && (K = R.t, j = O), O >= le / 2 && te === null && (te = R.t, ne = O));
    }
    K !== null && d++, te !== null && f++, K !== null && g.push({
      id: _.id,
      t: K,
      leadHours: (K - e) / 36e5,
      riseCfs: j,
      thresholdCfs: b(K),
      flowCfs: ee(K)?.flowCfs
    }), te !== null && c.halfCrossings.push({
      id: _.id,
      t: te,
      leadHours: (te - e) / 36e5,
      riseCfs: ne,
      thresholdCfs: b(te) / 2,
      flowCfs: ee(te)?.flowCfs
    });
    let vt = ue(a) ? a : $[0].cfs, ae = null, be = null;
    for (let R = 0; R < L.length; ) {
      let U = R;
      for (; U + 1 < L.length && L[U + 1].cfs === L[R].cfs && L[U + 1].t - L[U].t === 6 * 36e5; ) U++;
      let O = L[U], le = L[R], de = L[R - 1], ce = L[U + 1], st = de && ue(de.cfs) && le.t - de.t === 6 * 36e5 && de.cfs < O.cfs, Ne = ce && ue(ce.cfs) && ce.t - O.t === 6 * 36e5 && ce.cfs < O.cfs, De = L.slice(R, U + 1).some((Oe) => {
        let Se = ee(Oe.t);
        return Oe.t > e && Se && Se.rise >= b(Oe.t) / 2;
      });
      if (O.t > e && st && (Ne || !ce) && De && O.cfs > vt) {
        let Oe = { t: Math.max(le.t, y[0].t), endT: O.t, cfs: O.cfs };
        ce ? (!ae || O.cfs > ae.cfs || O.cfs === ae.cfs && O.t > ae.endT) && (ae = Oe) : (!be || O.cfs >= be.cfs) && (be = Oe);
      }
      R = U + 1;
    }
    be && (!ae || be.cfs >= ae.cfs) && (ae = null), ae ? (c.resolvedCount++, c.qualifyingPeakCount++, h.push(ae.t, ae.endT)) : be ? (c.openEndCount++, c.unboundedPeakCount++) : c.noPeakCount++, c.members.push({
      id: _.id,
      maxRise24hCfs: ue(E) ? E : null,
      maxRiseT: S,
      maxRiseFlowCfs: P,
      firstThresholdCrossingT: K,
      firstThresholdRiseCfs: j,
      firstHalfThresholdCrossingT: te,
      firstHalfThresholdRiseCfs: ne,
      qualifyingPeakT: ae?.t ?? null,
      qualifyingPeakEndT: ae?.endT ?? null,
      openPeakCfs: be?.cfs ?? null,
      qualifyingPeakCfs: ae?.cfs ?? null
    });
  }
  return c.memberCount ? {
    ...c,
    available: !0,
    reason: null,
    higherCount: r ? l : null,
    riseCount: d,
    halfRiseCount: f,
    crossings: g,
    thresholdsCfs: [...v].sort((_, m) => _ - m),
    crossingStartT: g.length ? Math.min(...g.map((_) => _.t)) : null,
    crossingEndT: g.length ? Math.max(...g.map((_) => _.t)) : null,
    riseCoverageStartT: p,
    comparisonCoverageStartT: p,
    unscoredInitialRange: p > e ? { startT: e, endT: p } : null,
    halfCrossingStartT: c.halfCrossings.length ? Math.min(...c.halfCrossings.map((_) => _.t)) : null,
    halfCrossingEndT: c.halfCrossings.length ? Math.max(...c.halfCrossings.map((_) => _.t)) : null,
    peakStartT: h.length ? Math.min(...h) : null,
    peakEndT: h.length ? Math.max(...h) : null
  } : { ...c, reason: "No complete ten-day forecast scenarios" };
}

// site/js/watch-crest-settings.js
var wt = Object.freeze({ releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1, floorCfs: 1, fraction: 62e-4, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), on = Object.freeze({ mode: "A", heading: "Observed high \u2014 crest not confirmed", automaticDirectionLabelsEnabled: !1, rejectedDesignSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), ps = Object.freeze({ mode: "B", trendMedianPoints: 5, trendWindowMinutes: 60, comparisonMinutes: 60, nativeIntervalMinutes: 15, persistencePoints: 5, floorCfs: 1, fraction: 62e-4, designSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), ln = Object.freeze({ floorCfs: 1, fraction: 62e-4, minimumHoursBelowHigh: 6, minimumPeakAgeHours: 12, firstConfirmationDeadlineHours: 18, minimumHistoryBeforePeakHours: 12, minimumDropFraction: 0.05, minimumDropCfs: 2, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), $a = Object.freeze({
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
}), ze = (e, t = wt) => Math.max(t.floorCfs, e * t.fraction);

// site/js/watch-model.js
var Fe = 6e4, q = 60 * Fe, V = 24 * q, Re = 30 * Fe, Xe = 6 * q, gs = 3 * q, Je = 15 * Fe, ms = [2, 4, 6, 8, 12, 18, 24], z = (e) => typeof e == "number" && Number.isFinite(e), W = (e) => z(e) && Math.abs(e) <= 864e13, T = (e, t = {}) => ({ code: e, details: t }), ct = (e, t) => W(t) ? Math.max(0, e - t) : null, bs = (e, t) => Object.prototype.hasOwnProperty.call(e, t), St = (e) => ({ t: e.t, cfs: e.cfs }), fe = (e) => e && e.usable !== !1 && z(e.cfs) && e.cfs >= 0;
function Ye(e, t) {
  let n = (r) => {
    let [c, u = "0"] = String(r).toLowerCase().split("e"), l = c.includes(".") ? c.length - c.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(c.replace(".", "")), exponent: Number(u) - l };
  }, s = n(e), a = n(t), i = Math.min(s.exponent, a.exponent);
  return +`${s.coefficient * 10n ** BigInt(s.exponent - i) - a.coefficient * 10n ** BigInt(a.exponent - i)}e${i}`;
}
function cn(e) {
  let t = z(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, s = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : bs(e, "qualifier"), a = {
    t: e.t,
    cfs: t ? e.cfs : null,
    approval: e.approval ?? null,
    qualifierAvailable: s,
    qualityLabel: e.qualityLabel ?? (s ? "Quality metadata supplied" : "Quality flags unavailable"),
    eligible: e.eligible === !0 && n && s,
    usable: n,
    reason: n ? null : typeof e.reason == "object" && e.reason ? e.reason : T(typeof e.reason == "string" ? e.reason : "unusable_observation")
  };
  return s && (a.qualifier = e.qualifier), a;
}
function dn(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !W(n.t)) continue;
    let s = cn(n), a = t.get(n.t);
    a ? JSON.stringify(a) !== JSON.stringify(s) && t.set(n.t, cn({
      t: n.t,
      cfs: null,
      usable: !1,
      eligible: !1,
      qualityLabel: "Conflicting readings at this time",
      reason: "conflicting_duplicate"
    })) : t.set(n.t, s);
  }
  return [...t.values()].sort((n, s) => n.t - s.t);
}
function Qe(e, t) {
  let n = 0, s = e.length;
  for (; n < s; ) {
    let a = n + s >>> 1;
    e[a].t < t ? n = a + 1 : s = a;
  }
  return n;
}
function hn(e, t) {
  let n = Qe(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function lt(e, t, n = Je) {
  let { before: s, after: a } = hn(e, t), i = a?.t === t ? a : s && (!a || t - s.t <= a.t - t) ? s : a;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function He(e) {
  if (!W(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return Ee(e);
}
function pn(e, t) {
  let n = W(t) ? e[Qe(e, t)] : null, s = W(t) ? t - V : null, a = W(s) ? hn(e, s) : { before: null, after: null };
  return {
    available: !1,
    reason: T("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: s,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: W(t) ? He(t) : null,
    distanceCfs: null,
    reached: null,
    ...a
  };
}
function gn(e, t) {
  let n = Ye(e.current.cfs, t.cfs), s = z(n) ? Ye(e.referenceCfs, n) : null;
  return !z(n) || !z(s) ? { ...e, comparison: t, reason: T("non_finite_arithmetic") } : {
    ...e,
    available: !0,
    reason: null,
    comparison: t,
    elapsedMs: e.current.t - t.t,
    approximate: t.t !== e.targetT,
    changeCfs: n,
    distanceCfs: s,
    reached: n >= e.referenceCfs
  };
}
function Dt(e, t) {
  let n = pn(e, t);
  if (!fe(n.current))
    return { ...n, reason: T(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let s = lt(e, n.targetT);
  return s ? fe(s) ? gn(n, s) : { ...n, comparison: s, reason: T("comparison_unusable") } : { ...n, reason: T("comparison_missing", { toleranceMs: Je }) };
}
function qt(e, t) {
  let n = pn(e, t), s = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: W(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!fe(s.current)) return { ...s, reason: T(s.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = lt(e, s.targetT);
  if (!a) return { ...s, reason: T("window_start_missing", { toleranceMs: Je }) };
  if (!fe(a)) return { ...s, startSupport: a, reason: T("window_start_unusable") };
  let i = e.slice(Qe(e, s.targetT), Qe(e, t) + 1), o = i.find((l) => !fe(l));
  if (o) return { ...s, startSupport: a, reason: T("window_unusable_observation", { t: o.t }) };
  let r = a.t < s.targetT ? [a, ...i] : i, c = 0;
  for (let l = 1; l < r.length; l++) c = Math.max(c, r[l].t - r[l - 1].t);
  if (c > Re) return {
    ...s,
    startSupport: a,
    maxGapMs: c,
    reason: T("observation_gap", { maxGapMs: c, allowedMs: Re })
  };
  let u = i.reduce((l, d) => !l || d.cfs < l.cfs ? d : l, null);
  return u ? {
    ...gn(s, u),
    minimum: u,
    startSupport: a,
    maxGapMs: c,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...s, startSupport: a, maxGapMs: c, reason: T("window_empty") };
}
function At(e, t, n = !1) {
  let s = [], a = [], i = [], o = [];
  for (let r of e) {
    if (!fe(r) || n && r.cfs <= 0) {
      a.length && s.push(a), a = [], o.push({ t: r.t, reason: n && r.cfs <= 0 ? "non_positive_flow" : r.reason?.code ?? "unusable_observation" });
      continue;
    }
    let c = a[a.length - 1];
    c && r.t - c.t > t && (i.push({ startT: c.t, endT: r.t, reason: "unsupported_gap" }), s.push(a), a = []), a.push(St(r));
  }
  return a.length && s.push(a), { segments: s, gaps: i, exclusions: o };
}
function Ce(e = "path_unavailable") {
  return {
    available: !1,
    reason: typeof e == "string" ? T(e) : e,
    points: [],
    segments: [],
    startT: null,
    endT: null,
    gaps: [],
    exclusions: []
  };
}
function Ue(e, t = {}) {
  let n = e.filter((a) => a.length).map((a) => a.map(St)), s = n.flat();
  return {
    available: s.length > 0,
    reason: s.length ? null : T("path_unavailable"),
    points: s,
    segments: n,
    startT: s[0]?.t ?? null,
    endT: s[s.length - 1]?.t ?? null,
    gaps: [],
    exclusions: [],
    ...t
  };
}
function mn(e, t = Xe, n = !1) {
  let s = At(e, t, n);
  return Ue(s.segments, { gaps: s.gaps, exclusions: s.exclusions });
}
function Ze(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Qe(e, t), s = e[n];
  if (s.t === t) return s.cfs;
  let a = e[n - 1], i = (t - a.t) / (s.t - a.t), o = (1 - i) * a.cfs + i * s.cfs;
  return z(o) ? o : null;
}
function _t(e, t) {
  for (let n of e.segments) {
    let s = Ze(n, t);
    if (s !== null) return s;
  }
  return null;
}
function Wt(e, t, n) {
  let s = [];
  for (let a of e.segments) {
    let i = Math.max(t, a[0].t), o = Math.min(n, a[a.length - 1].t);
    if (i > o) continue;
    let r = [
      { t: i, cfs: Ze(a, i) },
      ...a.filter((c) => c.t > i && c.t < o),
      ...o > i ? [{ t: o, cfs: Ze(a, o) }] : []
    ];
    s.push(r);
  }
  return Ue(s, { gaps: e.gaps, exclusions: e.exclusions });
}
function it(e, t, n, s) {
  let a = ct(n, t);
  return {
    available: !!e?.data,
    dataT: W(t) ? t : null,
    ageMs: a,
    stale: a === null || a > s,
    lastAttemptAt: W(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: W(e?.lastSuccessAt) ? e.lastSuccessAt : null,
    error: e?.error ?? null,
    url: e?.url ?? null,
    rawRefs: e?.rawRefs ?? [],
    reasons: [
      ...e?.data ? [] : [T("source_unavailable")],
      ...e?.error ? [T("source_fetch_failed")] : [],
      ...a !== null && a > s ? [T("source_stale", { ageMs: a, maxAgeMs: s })] : []
    ]
  };
}
function vs(e, t, n, s) {
  let a = t ? t.t - 12 * q : null, i = {
    available: !1,
    reason: T("current_observation_unavailable"),
    current: t,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    changeCfs: null,
    approximate: !1,
    asOf: !!(t && n - t.t > 30 * Fe)
  };
  if (!fe(t)) return { ...i, reason: T(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let o = lt(e, a);
  if (!o) return { ...i, reason: T("comparison_missing", { toleranceMs: Je }) };
  let r = {
    ...i,
    comparison: o,
    elapsedMs: t.t - o.t,
    approximate: o.t !== a
  };
  if (!fe(o)) return { ...r, reason: T("comparison_unusable") };
  if (n - t.t > 2 * q) return { ...r, reason: T("gauge_stale") };
  if (s?.error) return { ...r, reason: T("source_fetch_failed") };
  let c = e.slice(Qe(e, o.t), Qe(e, t.t) + 1), u = c.find((f) => !fe(f));
  if (u) return { ...r, reason: T("unusable_observation", { t: u.t }) };
  let l = 0;
  for (let f = 1; f < c.length; f++) l = Math.max(l, c[f].t - c[f - 1].t);
  if (l > Re) return { ...r, reason: T("observation_gap", { maxGapMs: l, allowedMs: Re }) };
  let d = Ye(t.cfs, o.cfs);
  return z(d) ? { ...r, available: !0, reason: null, changeCfs: d } : { ...r, reason: T("non_finite_arithmetic") };
}
function ws(e, t, n, s) {
  let a = {
    available: !1,
    reason: T("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * Fe)
  };
  if (!fe(t)) return { ...a, reason: T(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = lt(e, t.t - q);
  if (!fe(i)) return { ...a, comparison: i, reason: T("direction_comparison_unavailable") };
  let o = Ye(t.cfs, i.cfs), r = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), c = { ...a, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: r };
  if (!z(o)) return { ...c, changeCfs: null, reason: T("non_finite_arithmetic") };
  if (n - t.t > 2 * q) return { ...c, reason: T("gauge_stale") };
  if (s?.error) return { ...c, reason: T("source_fetch_failed") };
  let u = e.filter((l) => l.t >= i.t && l.t <= t.t);
  return u.some((l) => !fe(l)) || u.some((l, d) => d && l.t - u[d - 1].t > Re) ? { ...c, reason: T("direction_observation_gap") } : {
    ...c,
    available: !0,
    reason: null,
    label: Math.abs(o) <= r ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function un(e, t, n) {
  let s = W(t) ? t - 7 * V : null, a = {
    windowStartT: s,
    windowEndT: W(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!W(t)) return a;
  for (let o of e) {
    if (o.t < s || o.t > t) continue;
    let r = n(e, o.t);
    r.available ? (a.evaluatedCount++, a.coverageStartT ?? (a.coverageStartT = o.t), a.coverageEndT = o.t, r.reached && (a.last = r)) : a.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= s && o.t <= t);
  return a.coverageComplete = a.coverageStartT !== null && a.coverageStartT <= s + Je && a.coverageEndT >= t - Re && a.unavailableCount === 0 && !i.some((o, r) => r && o.t - i[r - 1].t > Re), a;
}
function fn(e, t, n) {
  if (!W(t)) return { ...Ce("observations_unavailable"), steps: [] };
  let s = [], a = [], i = [], o = [], r = null;
  for (let c of e) {
    if (c.t < t - 2 * V) continue;
    let u = n(e, c.t), l = u.comparison?.cfs;
    if (!u.available || !z(l + u.referenceCfs)) {
      o.length && s.push(o), o = [], r = null;
      continue;
    }
    if (r && c.t - r.t > Re && (i.push({ startT: r.t, endT: c.t, reason: "unsupported_gap" }), o.length && s.push(o), o = [], r = null), r) for (let f of Gt(r.t, c.t)) {
      let p = (f - r.t) / (c.t - r.t), h = (1 - p) * r.base + p * l, g = h + He(f - 1), b = h + He(f);
      o.push({ t: f, cfs: g }), s.push(o), o = [{ t: f, cfs: b }], a.push({ t: f, beforeCfs: g, afterCfs: b });
    }
    let d = { t: c.t, cfs: l + u.referenceCfs };
    o.at(-1)?.t !== c.t && o.push(d), r = { t: c.t, base: l };
  }
  return o.length && s.push(o), { ...Ue(s, { gaps: i }), steps: a };
}
function Ct(e, t = "forecast_unavailable") {
  let n = () => Ce(t), s = () => ({ endpoint: ot(t), low: ot(t) });
  return {
    available: !1,
    reason: T(t),
    issuedT: null,
    issueAgeMs: null,
    older: !1,
    freshContext: !1,
    offsetCfs: null,
    largeAdjustment: !1,
    provisionalAlignment: null,
    raw: n(),
    shifted: n(),
    high: n(),
    low: n(),
    references: { endpoint: { ...n(), steps: [] }, low: { ...n(), steps: [] } },
    crossings: { shifted: s(), high: s(), low: s() },
    crests: [],
    nextCrest: null,
    laterHigherCrests: [],
    higherLater: { available: !1, reason: T(t), aboveCurrent: null, peakCfs: null, peakT: null, largeAdjustment: !1 },
    cases: {
      available: !1,
      reason: T(t),
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(he(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function ot(e = "path_unavailable", t = !1) {
  return {
    available: !1,
    reason: typeof e == "string" ? T(e) : e,
    t: null,
    currentCfs: null,
    comparisonCfs: null,
    changeCfs: null,
    referenceCfs: null,
    alreadyReached: !1,
    largeAdjustment: t
  };
}
function Gt(e, t) {
  if (!W(e) || !W(t) || e >= t) return [];
  let n = he(e), s = he(t), a = [];
  for (let i = n.year; i <= s.year; i++)
    for (let o of [3, 5, 11]) {
      let r = rt(i, o, 1);
      r > e && r <= t && a.push(r);
    }
  return a.sort((i, o) => i - o);
}
function _s(e, t, n) {
  let s = Wt(e, n.t - 2 * V, n.t), a = Wt(t, n.t, t.endT ?? n.t), i = s.segments.map((o) => [...o]);
  for (let o of a.segments) {
    let r = o.filter((l) => l.t > n.t);
    if (!r.length) continue;
    let c = i[i.length - 1];
    o[0].t === n.t && c?.[c.length - 1].t === n.t ? c.push(...r) : i.push(r);
  }
  return Ue(i);
}
function bn(e, t) {
  let n = t - V, s = _t(e, t);
  if (s === null) return null;
  let a = _t(e, n);
  if (a === null) return null;
  let i = e.segments.find((r) => r[0].t <= n && r[r.length - 1].t >= t), o = null;
  if (i) {
    o = a;
    for (let r of i) r.t > n && r.t <= t && (o = Math.min(o, r.cfs));
    o = Math.min(o, s);
  }
  return { current: s, endpoint: a, low: o };
}
function ys(e, t, n, s, a, i) {
  let o = _t(t, a);
  if (o === null) return null;
  let r = a - V;
  if (r > s.t) {
    let h = bn(e, a);
    return h && h[i] !== null ? { current: o, base: h[i] } : null;
  }
  if (i === "endpoint") {
    let h = lt(n, r);
    return fe(h) ? { current: o, base: h.cfs, comparisonT: h.t } : null;
  }
  let c = lt(n, r);
  if (!fe(c)) return null;
  let u = n.filter((h) => h.t >= r && h.t <= s.t), l = c.t < r ? [c, ...u] : u;
  if (!u.length || u.some((h) => !fe(h)) || l.some((h, g) => g && h.t - l[g - 1].t > Re)) return null;
  let d = t.segments.find((h) => h[0].t <= s.t && h[h.length - 1].t >= a);
  if (!d) return null;
  let f = o, p = null;
  for (let h of u) h.cfs <= f && (f = h.cfs, p = h.t);
  for (let h of d) h.t > s.t && h.t <= a && h.cfs < f && (f = h.cfs, p = null);
  return { current: o, base: f, minimumObservedT: p };
}
function Ts(e, t, n, s, a) {
  let i = [], o = (r) => {
    r > n && r <= s && i.push(r);
  };
  if (a === "endpoint") {
    for (let r = 1; r < e.length; r++)
      o(Math.floor((e[r - 1].t + e[r].t) / 2) + V + 1);
    for (let r of e)
      o(r.t - Je + V), o(r.t + Je + V + 1);
  } else for (let r of e) o(r.t + V + 1);
  return i.filter((r) => r - V <= t.t);
}
function $s(e, t, n, s, a = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let r of e.points)
    for (let c of [r.t, r.t + V]) c >= t && c <= n && i.add(c);
  for (let r of Gt(t, n))
    i.add(r), r - 1 >= t && i.add(r - 1);
  for (let r of a)
    i.add(r), r - 1 >= t && i.add(r - 1);
  let o = [...i].sort((r, c) => r - c);
  for (let r = 1; r < o.length; r++) {
    let c = o[r - 1], u = o[r], l = (c + u) / 2, d = bn(e, l);
    if (!d || s === "low" && d.low === null) {
      i.add(l);
      continue;
    }
    if (s !== "low") continue;
    let f = e.segments.find((g) => g[0].t <= l - V && g[g.length - 1].t >= l);
    if (!f) continue;
    let p = 1 / 0;
    for (let g of f) g.t > l - V && g.t < l && (p = Math.min(p, g.cfs));
    let h = [
      [Ze(f, c - V), Ze(f, u - V)],
      [Ze(f, c), Ze(f, u)],
      ...z(p) ? [[p, p]] : []
    ].filter((g) => g.every(z));
    for (let g = 0; g < h.length; g++) for (let b = g + 1; b < h.length; b++) {
      let v = h[g][0] - h[b][0], _ = h[g][1] - h[b][1];
      if (!z(v) || !z(_) || v === _) continue;
      let m = v / (v - _);
      m > 0 && m < 1 && i.add(c + m * (u - c));
    }
  }
  return [...i].sort((r, c) => r - c);
}
function xs(e, t, n, s, a, i) {
  if (!t.available) return { reference: { ...Ce(t.reason), steps: [] }, crossing: ot(t.reason, a) };
  let o = _s(e, t, n), r = t.endT, c = n.t, u = Ts(i, n, c, r, s), l = $s(o, c, r, s, u), d = /* @__PURE__ */ new Set([...Gt(c, r), ...u]), f = [], p = [], h = [], g = ot("comparison_coverage_missing", a), b = 0, v = !1, _ = null, m = (y) => {
    if (_t(t, y) === null) return null;
    let $ = ys(o, t, i, n, y, s), C = $?.base;
    if (!$ || C === null || !z(C)) return null;
    let H = He(y), L = C + H, I = Ye($.current, C);
    return z(L) && z(I) ? {
      t: y,
      current: $.current,
      base: C,
      line: L,
      delta: I,
      threshold: H,
      comparisonT: $.comparisonT ?? null,
      minimumObservedT: $.minimumObservedT ?? null
    } : null;
  };
  for (let y of l) {
    let $ = m(y);
    if (!$) {
      g.t === null && (v = !0), h.length && f.push(h), h = [], _ = null;
      continue;
    }
    if (b++, d.has(y)) {
      let C = m(y - 1), H = He(y - 1) !== $.threshold, L = C && C.base !== $.base && (s === "endpoint" ? C.comparisonT !== $.comparisonT : C.minimumObservedT !== null && C.minimumObservedT + V + 1 === y);
      if (C && h.length && (H || L)) {
        let I = L ? C.line : $.base + He(y - 1);
        h.push({ t: y, cfs: I }), f.push(h), h = [], I !== $.line && p.push({ t: y, beforeCfs: I, afterCfs: $.line });
      }
    }
    if (h.push({ t: y, cfs: $.line }), g.t === null && $.delta >= $.threshold && !v) {
      let C = $;
      if (_ && _.delta < _.threshold && !d.has(y) && He(_.t) === $.threshold) {
        let H = _.t, L = y;
        for (; L - H > 1; ) {
          let I = Math.floor((L + H) / 2), ee = m(I);
          !ee || ee.delta < ee.threshold ? H = I : L = I;
        }
        C = m(L) ?? $;
      }
      g = {
        available: !0,
        reason: null,
        t: C.t,
        currentCfs: C.current,
        comparisonCfs: C.base,
        changeCfs: C.delta,
        referenceCfs: C.threshold,
        alreadyReached: C.t === n.t,
        largeAdjustment: a
      };
    }
    _ = $;
  }
  h.length && f.push(h), g.t === null && b && !v ? g = { ...ot(null, a), available: !0, reason: null } : g.t === null && v && (g = ot("comparison_coverage_missing", a));
  let A = f.map((y) => {
    let $ = [];
    for (let C of y)
      $.length >= 2 && $.at(-2).cfs === $.at(-1).cfs && $.at(-1).cfs === C.cfs && $.pop(), $.push(C);
    return $;
  });
  return { reference: { ...Ue(A), steps: p }, crossing: g };
}
function Ms(e, t, n, s) {
  if (s.version !== 4) return e;
  let a = new Map(t.map((i) => [i.t, i.cfs]));
  return e.map((i) => {
    let o = a.get(i.t), r = jt(s.bins, (i.t - n.t) / q);
    if (!z(o) || !r) throw new Error("low case point has no aligned flow or lead bin");
    if (!z(r.sub_cfs) || r.sub_cfs < 0) throw new Error("table v4 bin needs a non-negative sub_cfs");
    return o >= s.storm_flow_cfs ? i : { t: i.t, cfs: Math.max(0, Math.min(o, n.cfs) - r.sub_cfs) };
  });
}
function Cs(e, t) {
  let n = new Map(e.filter((a) => a.usable === !0 && a.eligible === !0).map((a) => [a.t, a.cfs])), s = ze(t.cfs);
  for (let a = 1; a <= 4; a++) {
    let i = n.get(t.t - a * 15 * Fe);
    if (!z(i) || Math.abs(t.cfs - i) > s) return !1;
  }
  return !0;
}
function As(e, t) {
  let n = [e, t];
  for (let a = e + Fe; a < t; a += Fe) n.push(a);
  let s = n.map((a) => {
    let i = he(a);
    return i.hour >= 8 && (i.hour < 17 || i.hour === 17 && i.minute === 0 && i.second === 0);
  });
  return s.every(Boolean) ? "inside_08_17" : s.every((a) => !a) ? "outside_08_17" : "spans_both";
}
function Ss(e, t) {
  let n = [];
  for (let s of e.segments) {
    let a = 0;
    for (; a < s.length; ) {
      let i = a;
      for (; i + 1 < s.length && s[i + 1].cfs === s[a].cfs; ) i++;
      let o = s[a - 1], r = s[i + 1];
      if (o && r && o.cfs < s[a].cfs && r.cfs < s[i].cfs && s[i].t > t) {
        let c = a - 1;
        for (; c > 0 && s[c - 1].cfs <= s[c].cfs; ) c--;
        let u = St(s[c]);
        n.push({
          startT: s[a].t,
          endT: s[i].t,
          cfs: s[a].cfs,
          precedingLow: u,
          riseCfs: s[a].cfs - u.cfs,
          bracketStartT: o.t,
          bracketEndT: r.t,
          clockRange: As(o.t, r.t)
        });
      }
      a = i + 1;
    }
  }
  return n.sort((s, a) => s.startT - a.startT);
}
function ks(e, t, n, s, a, i, o) {
  let r = Ct(e), c = t?.data;
  if (!c) return r;
  let u = c.issuedT;
  r.issuedT = W(u) ? u : null, r.issueAgeMs = ct(e, u), r.older = r.issueAgeMs !== null && r.issueAgeMs > 12 * q, r.cases.tableVersion = o?.version ?? null, r.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let l = (m) => ({
    ...Ct(e, m),
    issuedT: r.issuedT,
    issueAgeMs: r.issueAgeMs,
    older: r.older,
    cases: { ...r.cases, reason: T(m) }
  });
  if (!W(u)) return l("forecast_issue_missing");
  if (u > e) return l("forecast_issue_future");
  if (e - u > 48 * q) return l("forecast_issue_too_old");
  let d = dn(c.points).filter((m) => m.t <= e + 10 * V), f = mn(d, Xe);
  if (!f.segments.some((m) => m[0].t <= e + Xe && m[m.length - 1].t >= e + V))
    return l("forecast_next_day_coverage_missing");
  if (r.available = f.available, r.reason = f.reason, r.raw = f, r.crests = Ss(f, i?.t ?? e), r.nextCrest = r.crests[0] ?? null, r.laterHigherCrests = r.nextCrest ? r.crests.slice(1).filter((m) => m.cfs > r.nextCrest.cfs) : [], !fe(i)) {
    let A = Ct(e, i ? "current_observation_unusable" : "current_observation_unavailable");
    return {
      ...r,
      shifted: A.shifted,
      high: A.high,
      low: A.low,
      references: A.references,
      crossings: A.crossings,
      higherLater: A.higherLater,
      cases: { ...r.cases, reason: A.cases.reason }
    };
  }
  let p = _t(f, i.t), h = null;
  if (p === null) {
    let m = f.segments[0]?.[0], A = m && !(c.points ?? []).some((y) => z(y?.t) && y.t < m.t);
    m && A && i.t < m.t && m.t - i.t <= gs && m.t - u <= Xe && i.t >= u - q && e - i.t <= 2 * q && !t.error && !n?.error && !(Math.abs(Ye(i.cfs, m.cfs)) > Math.max(10, 0.1 * i.cfs)) && Cs(s, i) && (p = m.cfs, h = { firstT: m.t, firstCfs: m.cfs });
  }
  if (p === null) {
    let m = Ct(e, "forecast_alignment_unsupported");
    return {
      ...r,
      shifted: m.shifted,
      high: m.high,
      low: m.low,
      references: m.references,
      crossings: m.crossings,
      higherLater: m.higherLater,
      cases: { ...r.cases, reason: m.cases.reason }
    };
  }
  let g = Ye(i.cfs, p);
  if (!z(g)) return l("non_finite_arithmetic");
  r.offsetCfs = g, r.largeAdjustment = Math.abs(g) > Math.max(10, 0.1 * i.cfs);
  let b = [], v = [];
  for (let m of f.segments) {
    let A = m.map(($) => ({ t: $.t, cfs: $.cfs + g })), y = At(A, Xe, !0);
    b.push(...y.segments), v.push(...y.exclusions);
  }
  if (r.provisionalAlignment = h, h && i.cfs > 0) {
    let m = b.find((A) => A[0]?.t === h.firstT);
    m && m.unshift({ t: i.t, cfs: i.cfs });
  }
  r.shifted = Wt(Ue(b, { gaps: f.gaps, exclusions: v }), i.t, i.t + 72 * q), r.shifted.points.some((m) => m.t > i.t) || (r.shifted = { ...Ce("non_positive_shifted_flow"), exclusions: v, gaps: f.gaps }), r.freshContext = !r.older && !t.error && !n?.error && e - i.t <= 2 * q, r.higherLater = {
    available: !1,
    reason: T("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: r.largeAdjustment
  };
  let _ = r.shifted.points.filter((m) => m.t > i.t);
  if (r.freshContext && _.length) {
    let m = _.reduce((A, y) => y.cfs > A.cfs ? y : A);
    r.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: m.cfs > i.cfs,
      peakCfs: m.cfs,
      peakT: m.t,
      largeAdjustment: r.largeAdjustment
    };
  }
  if (r.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(he(e).month), !r.cases.wetSeason)
    r.cases.reason = T("historical_cases_off_season"), r.high = Ce(r.cases.reason), r.low = Ce(r.cases.reason);
  else if (!o || o.version !== 3 && o.version !== 4 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    r.cases.reason = T("historical_table_unavailable"), r.high = Ce(r.cases.reason), r.low = Ce(r.cases.reason);
  else
    try {
      let m = [], A = [], y = [], $ = [];
      for (let C of r.shifted.segments) {
        let H = sn(C, i, o, e), L = C[0]?.t === i.t && i.cfs > 0 ? [St(i)] : [], I = At([...L, ...H.high], Xe, !0), ee = At([...L, ...Ms(H.low, C, i, o)], Xe, !0);
        m.push(...I.segments), A.push(...ee.segments), y.push(...I.exclusions), $.push(...ee.exclusions);
      }
      r.high = Ue(m, { gaps: r.shifted.gaps, exclusions: y }), r.low = Ue(A, { gaps: r.shifted.gaps, exclusions: $ });
      for (let C of ["high", "low"]) r[C].points.some((H) => H.t > i.t) || (r[C] = { ...Ce("historical_case_values_unsupported"), exclusions: r[C].exclusions, gaps: r[C].gaps });
      r.cases.available = r.high.available || r.low.available, r.cases.reason = r.cases.available ? null : T("historical_case_values_unsupported");
    } catch {
      r.cases.reason = T("historical_table_invalid"), r.high = Ce(r.cases.reason), r.low = Ce(r.cases.reason);
    }
  for (let m of ["shifted", "high", "low"])
    for (let A of ["endpoint", "low"]) {
      let y = xs(a, r[m], i, A, r.largeAdjustment, s);
      r.crossings[m][A] = y.crossing, m === "shifted" && (r.references[A] = y.reference);
    }
  return r;
}
function vn(e, t) {
  let n = t?.data, s = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set();
  for (let l of n?.conflicts ?? []) W(l) && l <= e && l % q === 0 && a.add(l);
  for (let l of n?.hours ?? [])
    if (!(!W(l.endT) || l.endT > e || l.endT % q !== 0)) {
      if (!z(l.mm) || l.mm < 0) {
        a.add(l.endT);
        continue;
      }
      s.has(l.endT) && s.get(l.endT) !== l.mm ? a.add(l.endT) : s.set(l.endT, l.mm);
    }
  let i = [...s.keys(), ...a], o = i.length ? Math.max(...i) : null, r = ct(e, o), c = ms.map((l) => {
    let d = {
      hours: l,
      available: !1,
      reason: T("radar_unavailable"),
      startT: o === null ? null : o - l * q,
      endT: o,
      ageMs: r,
      mm: null,
      inches: null
    };
    if (o === null) return d;
    let f = 0;
    for (let p = 0; p < l; p++) {
      let h = o - p * q;
      if (a.has(h)) return { ...d, reason: T("radar_conflicting_hour", { endT: h }) };
      if (!s.has(h)) return { ...d, reason: T("radar_missing_hour", { endT: h }) };
      f += s.get(h);
    }
    return z(f) ? { ...d, available: !0, reason: null, mm: f, inches: f / 25.4 } : { ...d, reason: T("non_finite_arithmetic") };
  }), u = c.some((l) => l.available);
  return {
    available: u,
    reason: u ? null : T("radar_windows_unavailable"),
    endT: o,
    generatedT: W(n?.generatedT) ? n.generatedT : null,
    ageMs: r,
    historical: r !== null && r > 2 * q,
    stale: r === null || r > 3 * q,
    windows: c,
    status: an(e, n?.hours ?? [], n?.conflicts ?? []),
    hours: [...new Set(i)].sort((l, d) => l - d).map((l) => ({ endT: l, mm: a.has(l) ? null : s.get(l) ?? null })),
    definitionCode: n?.definitionCode ?? null,
    regions: Object.fromEntries(["upper", "middle", "friday", "lower"].filter((l) => n?.regions?.[l]).map((l) => [l, {
      ...vn(e, { data: { ...n.regions[l], generatedT: n.generatedT } }),
      areaFraction: n.regions[l].areaFraction
    }]))
  };
}
function Es(e, t) {
  let n = t?.data, s = ct(e, n?.updatedT), a = {
    available: !1,
    reason: T("grid_forecast_unavailable"),
    startT: e,
    endT: e + V,
    updatedT: W(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: s,
    stale: s === null || s > 12 * q,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return a;
  if (!W(n.updatedT) || n.updatedT > e) return { ...a, reason: T("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((u) => W(u.startT) && W(u.endT) && u.endT > e && u.startT < e + V).sort((u, l) => u.startT - l.startT || u.endT - l.endT), o = e, r = 0, c = !1;
  for (let u of i) {
    if (u.startT >= u.endT || !z(u.mm) || u.mm < 0) return { ...a, reason: T("grid_interval_invalid") };
    let l = Math.max(e, u.startT), d = Math.min(e + V, u.endT);
    if (l < o) return { ...a, reason: T("grid_interval_overlap", { t: l }) };
    if (l > o) return { ...a, reason: T("grid_interval_gap", { startT: o, endT: l }) };
    let f = (d - l) / (u.endT - u.startT);
    r += u.mm * f, c || (c = f !== 1), o = d;
  }
  return o < e + V ? { ...a, reason: T("grid_interval_gap", { startT: o, endT: e + V }) } : z(r) ? { ...a, available: !0, reason: null, mm: r, inches: r / 25.4, prorated: c } : { ...a, reason: T("non_finite_arithmetic") };
}
function Rs(e, t) {
  let n = t?.data, s = ct(e, t?.lastSuccessAt), a = {
    available: !1,
    reason: T("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: s,
    stale: s === null || s > 36 * q,
    startT: e,
    endT: e + 2 * V,
    events: []
  };
  if (!n) return a;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...a, reason: T("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let c of n.points ?? []) {
    if (!W(c.t) || c.t < e || c.t > e + 2 * V || !z(c.ft) || !["H", "L"].includes(c.type)) continue;
    let u = i.get(c.t);
    u && (u.ft !== c.ft || u.type !== c.type) && o.add(c.t), i.set(c.t, { t: c.t, ft: c.ft, type: c.type });
  }
  let r = [...i.values()].filter((c) => !o.has(c.t)).sort((c, u) => c.t - u.t);
  return { ...a, available: r.length > 0, reason: r.length ? null : T("tide_events_unavailable"), events: r };
}
function wn({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!W(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let s = t.gauge?.data, a = dn(s?.points).filter((v) => v.t <= e), i = a[a.length - 1] ?? null, o = [...a].reverse().find((v) => fe(v)) ?? null, r = mn(a, Re), c = i?.t ?? null, u = it(t.gauge, c, e, 2 * q), l = {
    latest: i,
    lastNumericObservation: o,
    points: a,
    segments: r.segments,
    exclusions: s?.exclusions ?? [],
    coveredWindow: s?.coveredWindow ?? null,
    ageMs: ct(e, c),
    stale: u.stale,
    referenceCfs: W(c) ? He(c) : null,
    endpoint: Dt(a, c),
    low: qt(a, c),
    references: { endpoint: fn(a, c, Dt), low: fn(a, c, qt) },
    direction: ws(a, i, e, t.gauge),
    twelveHourChange: vs(a, i, e, t.gauge),
    history: { endpoint: un(a, c, Dt), low: un(a, c, qt) }
  }, d = ks(e, t.noaa, t.gauge, a, r, i, n), f = vn(e, t.radar), p = Es(e, t.grid), h = Rs(e, t.tides), g = i?.eligible && i?.usable && e - i.t >= 0 && e - i.t <= q ? a.filter((v) => v.eligible && v.usable && v.t >= i.t - 9 * V).reduce((v, _) => !v || _.cfs >= v.cfs ? _ : v, null) : null, b = rn(e, t.ensemble, g, He, i?.eligible && i?.usable ? i.cfs : null);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: u,
      noaa: it(t.noaa, d.issuedT, e, 12 * q),
      radar: it(t.radar, f.endT, e, 3 * q),
      grid: it(t.grid, p.updatedT, e, 12 * q),
      tides: it(t.tides, t.tides?.lastSuccessAt, e, 36 * q),
      ensemble: it(t.ensemble, b.issuedT, e, 48 * q)
    },
    gauge: l,
    forecast: d,
    rain: { radar: f, grid: p },
    tides: h,
    outlook: b
  };
}

// site/js/watch-render.js
function yn(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var k = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), pe = (e) => typeof e == "number" && Number.isFinite(e);
function Ls(e, t = !1) {
  if (!pe(e)) return "Unavailable";
  let n = Math.abs(e), s = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${s}` : s;
}
function Ke(e, t = !1) {
  if (!pe(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function ge(e, t = !1) {
  if (!pe(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
function re(e, t = !1) {
  return pe(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function $e(e) {
  if (!pe(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), s = Math.floor(n / 24);
  return s ? `${s}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function Vt(e) {
  return pe(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var Tn = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function ft(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(ft).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return Tn[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(Tn, {
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
function ut(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var Ns = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, $n = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, Ie = (e) => `<time datetime="${pe(e) ? new Date(e).toISOString() : ""}">${k(re(e, !0))}</time>`;
var Os = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function Hs(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return ft("public_time_uncertain");
  let s = ft(t);
  return e.timeUncertain && Os.includes(n) ? `At the snapshot save time: ${s}` : s;
}
function xn(e, t) {
  let n = e.forecast || {}, s = (g) => Hs(e, g);
  ut("forecast-age", n.issuedT ? `Issued ${Ie(n.issuedT)} \xB7 ${k(e.timeUncertain ? "age unknown" : $e(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${k(s(n.reason))}` : ""}` : `Forecast unavailable. ${k(s(n.reason))}`);
  let a = [];
  e.sources?.noaa?.error && a.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && a.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${Ke(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? a.push({ text: s(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && a.push(`Adjusted forecast unavailable. ${s(n.shifted.reason)}`);
  let o = n.available && n.shifted?.available === !0 && pe(n.provisionalAlignment?.firstT);
  o && a.push({ text: `This forecast\u2019s first value is for ${re(n.provisionalAlignment.firstT, !0)}. The river was steady over the hour before the latest reading and that value is close to it, so until a reading reaches that time the adjusted line and past cases are matched to that value. They can shift.`, neutral: !0 }), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && a.push(`Historical cases unavailable. ${s(n.cases.reason)}`), ut("forecast-problems", a.map((g) => `<p${typeof g == "object" && g.neutral ? ' class="neutral"' : ""}>${k(typeof g == "object" ? g.text : g)}</p>`).join(""));
  let r = document.getElementById("forecast-problems");
  ((i || o) && a.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", r);
  let u = n.crossings?.shifted?.[t.reference], l = o ? "Crossing times are not given until a gauge reading reaches this forecast\u2019s first value." : u?.available ? pe(u.t) ? `The adjusted forecast ${u.alreadyReached ? "already meets" : "first reaches"} the reference at ${re(u.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${s(u?.reason)}`, d = pe(n.offsetCfs) ? `Adjustment to the gauge reading: ${Ke(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", f = Date.parse(n.cases?.trainingCutoff ?? ""), p = pe(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${Ls(n.cases.tableVersion)}${pe(f) ? `; training cutoff ${Ie(f)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  ut("forecast-details", $n("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast. Just after a new forecast, before its first value, it is matched to that first value instead when the river has been steady for an hour and the two are close; the page says so. Otherwise it is not drawn until a reading reaches that time.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds. Below 150 cfs the low case shows a forecast rise not arriving: it stays just under the lower of the adjusted forecast and the latest reading. At 150 cfs the rule changes, so the low case can step there; that step is not a turn in the river.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier measurements or the adjusted forecast; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${pe(n.raw?.endT) ? `; available through ${Ie(n.raw.endT)}` : ""}.</p><p>${k(d)} ${n.available === !1 ? `The issued forecast is unavailable. ${k(s(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${k(l)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. Cases extend up to 72 hours from the latest reading in October\u2013April. A low case stops when its historical subtraction reaches zero; this does not predict a dry river. Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.</p>${p}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function _n(e, t = !1) {
  if (t || !e?.available) return "Rain status unknown: recent complete hourly data are needed.";
  let n = `${e.hours} complete ${e.hours === 1 ? "hour" : "hours"}`;
  return e.state === "paused" ? `Rain paused or very light for ${e.leftCensored ? "at least " : ""}${n} \xB7 below 0.1 mm per hour.` : e.state === "restarted" ? `Rain restarted \xB7 ${n} at or above 0.1 mm per hour.` : `Rain observed in the latest ${n} \xB7 earlier change unknown.`;
}
function Is(e, t) {
  let n = e.definitionCode === "wbd_huc12_four_subbasins_v2", s = (n ? ["upper", "middle", "friday", "lower"] : ["upper", "lower"]).filter((l) => e.regions?.[l]), a = n ? { upper: "Upper Samish headwaters", middle: "Middle Samish", friday: "Friday Creek", lower: "Near the gauge" } : { upper: "Upper + middle + Friday Creek", lower: "Lower above gauge" }, i = s.map((l) => {
    let d = e.regions[l], f = d.windows?.find((p) => p.hours === 24);
    return `<article class="rain-region"><h3>${a[l]}</h3><strong>${k(_n(d.status, t))}</strong><p>${f?.available ? `${Vt(f.inches)} in over 24 hours` : "24-hour total unavailable"} \xB7 ${+(d.areaFraction * 100).toFixed(1)}% of the drainage area.</p></article>`;
  }).join(""), o = e.endT, r = [e, ...s.map((l) => e.regions[l])].flatMap((l) => l?.hours ?? []).filter((l) => pe(l?.endT) && l.endT <= o), c = Math.max(24, r.length ? Math.round((o - Math.min(...r.map((l) => l.endT))) / 36e5) + 1 : 24), u = Array.from({ length: c }, (l, d) => o - (c - 1 - d) * 36e5).map((l) => {
    let d = (f) => {
      let p = f?.hours?.find((h) => h.endT === l)?.mm;
      return pe(p) ? `${p.toFixed(3)}<br><small>${p >= 0.1 ? "Rain" : "Below threshold"}</small>` : "Missing";
    };
    return `<tr><td>${Ie(l)}</td><td>${d(e)}</td>${s.map((f) => `<td>${d(e.regions[f])}</td>`).join("")}</tr>`;
  }).join("");
  return `<div class="rain-status" role="status"><strong>${k(_n(e.status, t))}</strong><p class="meta">Whole drainage area \xB7 \u201Cpaused\u201D means below the display threshold, not dry everywhere.</p></div><div class="rain-regions">${i || '<p class="meta">Rainfall by subarea is unavailable in this snapshot.</p>'}</div>${s.length ? `<p class="meta">${n ? "Four separate watershed areas. \u201CNear the gauge\u201D is the small Lower Samish portion upstream of the gauge; Friday Creek is a separate tributary." : "Older two-area grouping; upper combines Upper Samish, Middle Samish and Friday Creek."} Area averages describe where rain falls, not when it will reach the river.</p>` : ""}${pe(o) ? `<details class="hourly-rain"><summary>Hourly rain by area</summary><p class="meta">Millimetres in each complete hour ending at the listed Pacific time. Rain means at least 0.100 mm (about 0.004 inches); smaller amounts are below threshold. Missing hours remain unknown.</p><div class="rain-table-wrap"><table><thead><tr><th>Hour ending</th><th>Whole area</th>${s.map((l) => `<th>${a[l]}</th>`).join("")}</tr></thead><tbody>${u}</tbody></table></div></details>` : ""}`;
}
function Mn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, s = t.endT ? `All totals end ${re(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : $e(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", a = t.windows || [2, 4, 6, 8, 12, 18, 24].map((r) => ({ hours: r, available: !1 })), i = [...new Set(a.filter((r) => !r.available).map((r) => ft(r.reason || t.reason)))], o = $n("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over each drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. A pause means the area average is below 0.1 millimetres per hour (about 0.004 inches). A restart requires a complete below-threshold hour followed by rain at or above the threshold, with no missing hour between. This display threshold describes radar rain; it does not predict a river crest. Status is withheld when the latest hour is more than three hours old.</p><p>The four areas follow the official Watershed Boundary Dataset: Upper Samish headwaters, Middle Samish, Friday Creek, and the Lower Samish portion above the gauge. About 0.15% of the drainage could not be matched to these four watershed polygons; it remains included in the whole-area total. A saved older snapshot may show the previous two-area grouping, explicitly labelled. Region totals are area averages, not amounts to add together.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  ut("rain", `<div class="section-heading"><h2>Rain</h2>${Ns("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${k(s)}</p>${Is(t, e.timeUncertain || e.conditionsSuppressed)}<div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${a.map((r) => `<div class="rain-total" aria-label="${r.hours}-hour total ending ${k(re(r.endT ?? t.endT, !0))}, ${k(e.timeUncertain ? "age unknown" : $e(r.ageMs ?? t.ageMs) + " old")}"><span>${r.hours} hours</span><strong>${r.available ? Vt(r.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map(k).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${Vt(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${k(ft(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${Ie(n.updatedT)} \xB7 ${k(e.timeUncertain ? "age unknown" : $e(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function Cn(e) {
  let t = e.tides || {};
  ut("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + k($e(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${Ie(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${n.ft.toFixed(1)}</td></tr>`).join("")}</tbody></table>` : `<p>${k(ft(t.reason))}</p>`}</div>`);
}
function An(e, t, n) {
  ut("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", ensemble: "NOAA Hydrologic Ensemble Forecast Service \xB7 Experimental alternative flow scenarios", tides: "NOAA Bellingham tide predictions" }).map(([a, i]) => {
    let o = t.sources?.[a] || {}, r = n?.sources?.[a] || {};
    return `<div class="source-row"><strong>${k(i)}</strong>${a === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>${a === "ensemble" ? "Reference/start time" : "Data time"}: ${Ie(o.dataT)} \xB7 ${k(t.timeUncertain ? "age unknown" : $e(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${Ie(r.lastSuccessAt ?? o.lastSuccessAt)}.${r.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot collection began ${Ie(e.createdAt)}. This collection time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}

// site/js/watch-preview.js
var J = 36e5, kt = 15 * 6e4, G = Number.isFinite;
function we(e, t) {
  let n = (r) => {
    let [c, u = "0"] = String(r).toLowerCase().split("e"), l = c.includes(".") ? c.length - c.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(c.replace(".", "")), exponent: Number(u) - l };
  }, s = n(e), a = n(t), i = Math.min(s.exponent, a.exponent);
  return +`${s.coefficient * 10n ** BigInt(s.exponent - i) - a.coefficient * 10n ** BigInt(a.exponent - i)}e${i}`;
}
var se = (e) => `<time datetime="${new Date(e).toISOString()}">${k(re(e, !0))}</time>`, Sn = (e) => {
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), s = t % 60;
  return n ? s ? `${n}h ${s}m` : `${n} ${n === 1 ? "hour" : "hours"}` : `${s} ${s === 1 ? "minute" : "minutes"}`;
}, et = (e, t) => {
  document.getElementById(e).innerHTML = t;
}, En = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}">\u24D8</button>`, Rn = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, Ps = `This page does not make a crest call. It shows the observed high and time since it, plus a separate experimental forecast scenario outlook; growers and sampling staff judge whether the river has crested. Automatic crest confirmation is withheld because the tested rules failed real-storm replay. This page shows the actual observed high, its reading time and age, the drop since that high, and a separate clock for time without a material renewed rise. That clock uses the middle value of five actual 15-minute readings spanning the preceding hour; the displayed high and its time remain actual readings. A rebound in this smoothed trend exceeding the larger of ${wt.floorCfs} cfs or ${+(wt.fraction * 100).toFixed(2)}% of the actual high resets the clock to the last increasing trend reading in that upswing. Flat readings and smaller flickers are allowed: this does not mean continuous falling. This allowance was measured from returning fluctuations in November\u2013December 2025 readings, not chosen as a closure or sampling rule. Missing quarter-hours or ineligible readings break the trend clock, with no interpolation.`;
function Us(e, t) {
  let n = t.trendMedianPoints, s = t.trendWindowMinutes * 6e4;
  if (n !== 5 || s !== J) throw new Error("Unsupported crest trend window");
  return e.map((a, i) => {
    let o = e.slice(Math.max(0, i - n + 1), i + 1), r = o.length === n && o.every((c, u) => c.eligible === !0 && c.usable === !0 && G(c.cfs) && c.t === a.t - s + u * kt);
    return { t: a.t, cfs: r ? o.map((c) => c.cfs).sort((c, u) => c - u)[2] : null, eligible: r, usable: r };
  });
}
function kn(e, t, n) {
  let s = null, a = null, i = t.t, o = !1, r = !1, c = ze(t.cfs, n);
  for (let u of Us(e, n))
    if (!(u.t < t.t)) {
      if (!u.eligible) {
        s = null, a = null, o = !1, i = u.t, r = !0;
        continue;
      }
      if (!s) {
        s = u, r || (r = u.t > t.t), i = Math.max(i, u.t), o = !0;
        continue;
      }
      a ? u.cfs > a.cfs ? (i = u.t, a = u, r = !1) : a.cfs - u.cfs > c && (a = null, s = u) : (u.cfs < s.cfs && (s = u), u.cfs - s.cfs > c && (i = u.t, a = u, r = !1));
    }
  return { lastResetT: i, supported: o, startCensored: r };
}
function Fs(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  return { ...Ln(e, { checking: t, suppressed: n, settings: wt }, !1, !0), mode: "observed-facts-only", releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1 };
}
function js(e, t = {}) {
  let n = Fs(e, t);
  return { ...n, state: n.state === "checking" || n.state === "unavailable" ? n.state : "observed_high", label: on.heading, labelCategory: "neutral", labelMode: "removed" };
}
function Ln(e, { checking: t = !1, suppressed: n = !1, settings: s = ln } = {}, a, i = !1) {
  let o = e.gauge || {}, r = o.latest, c = (x) => ({ state: t ? "checking" : "unavailable", label: t ? "Checking river readings\u2026" : "Crest status unavailable", why: x, peak: null, high: null, fallMs: null });
  if (t) return c("Verification is in progress.");
  if (n || e.timeUncertain) return c("A current snapshot and current time must be verified first.");
  if (!r || !G(r.cfs) || r.usable !== !0 || r.eligible !== !0) return c("The newest gauge reading is missing or its quality does not support a crest check.");
  if (o.ageMs > J || e.sources?.gauge?.error) return c("The newest eligible reading must be no more than one hour old, with a successful latest retrieval.");
  let u = i ? 216 : 48, l = o.points.filter((x) => x.t >= r.t - u * J && x.t <= r.t).sort((x, M) => x.t - M.t), d = [], f = null;
  for (let x of l) x.eligible === !0 && x.usable === !0 && G(x.cfs) && (!f || x.cfs >= f.cfs) && (f = x);
  let p = f?.t ?? null;
  if (f) for (let x = l.findIndex((M) => M.t === f.t) - 1; x >= 0; x--) {
    let M = l[x];
    if (!M.eligible || !M.usable || M.cfs !== f.cfs || p - M.t !== kt) break;
    p = M.t;
  }
  let h = l[0]?.t ?? null, g = !!f && !l.some((x) => x.t < f.t && x.eligible && x.usable && G(x.cfs) && x.cfs < f.cfs);
  for (let x = l.length - 1; x >= 0; x--) {
    let M = l[x];
    if (M.eligible !== !0 || M.usable !== !0 || !G(M.cfs) || d.length && d[0].t - M.t > 2 * kt) break;
    d.unshift(M);
  }
  if (d.length < 5 || r.t - d[0].t < J)
    return i && f ? { historyStartT: h, highStartT: p, highAtBoundary: g, clockLowerBound: !0, state: "possible", label: "Crest not confirmed \u2014 short reading history", high: f, peak: f, candidateHigh: null, drop: we(f.cfs, r.cfs), highDropCfs: we(f.cfs, r.cfs), sincePeakMs: r.t - f.t, sinceHighMs: r.t - f.t, fallMs: null, trendSupported: !1, evidenceStartT: d[0]?.t ?? r.t, hadGap: d[0]?.t > l[0]?.t, bracketed: !1 } : c("At least an hour of uninterrupted eligible observations is needed.");
  let b = d[0], v = b, _ = b, m = b.t, A = null, y = !1, $ = !1, C = b, H = null;
  for (let x = 1; x < d.length; x++) {
    let M = d[x], ke = ze(b.cfs, s), qe = Math.max(s.episodeTurnCfs ?? 2, b.cfs * (s.episodeTurnFraction ?? 0.05));
    if (M.cfs >= b.cfs) {
      M.cfs - v.cfs > ke && b.cfs - v.cfs > ke && ($ = !0), y || (y = we(M.cfs, _.cfs) > Math.max(s.capturedRiseCfs, M.cfs * s.capturedRiseFraction)), b = M, v = M, m = M.t, C = M, H = null;
      continue;
    }
    M.cfs < v.cfs && (v = M);
    let at = M.cfs - v.cfs;
    H ? M.cfs > H.cfs ? (m = M.t, H = M) : H.cfs - M.cfs > ke && (H = null, C = M) : (M.cfs < C.cfs && (C = M), M.cfs - C.cfs > ke && (m = M.t, H = M, $ = !0)), b.cfs - v.cfs >= qe && at >= qe && (A = b, _ = v, b = M, v = M, y = !0, m = M.t, C = M, H = null);
  }
  let L = s.trendMedianPoints ? kn(d, b, s) : { lastResetT: m, supported: !0 }, I = ze(b.cfs, s), ee = b.cfs - r.cfs, E = r.t - Math.max(b.t, L.lastResetT), S = r.t - b.t, P = d[0].t, K = P > l[0].t, te = d.reduce((x, M) => Math.abs(M.t - (r.t - J)) < Math.abs(x.t - (r.t - J)) ? M : x, d[0]), j = d.reduce((x, M) => Math.abs(M.t - (r.t - 2 * J)) < Math.abs(x.t - (r.t - 2 * J)) ? M : x, d[0]), ne = we(r.cfs, j.cfs) > 0, vt = d.filter((x) => x.t >= r.t - 6 * J).reduce((x, M) => Math.min(x, M.cfs), r.cfs), ae = we(r.cfs, te.cfs) > I || ee <= I && r.t - b.t < J && we(r.cfs, vt) > I && ne, be = s.minimumHistoryBeforePeakHours ?? 0, R = b.t - P, U = R >= be * J, O = be > 0 && !U && S > (48 - be) * J, le = U ? null : O ? `The 48-hour window no longer includes ${be} hours before this high. Its time and flow remain shown; the earlier crest check has expired.` : `At least ${be} hours of uninterrupted eligible readings before this high are needed to establish a crest.`, de = we(r.cfs, v.cfs) <= I, ce = { high: f, earlierPeak: A, peak: b, fallMs: i && !L.supported ? null : E, sincePeakMs: S, sinceHighMs: r.t - f.t, highDropCfs: we(f.cfs, r.cfs), drop: ee, bracketed: y, evidenceStartT: P, hadGap: K, trendSupported: L.supported, peakContextMs: R, contextExpired: O, contextWhy: le, nearPostPeakLow: de }, st = we(r.cfs, v.cfs) > I && ne;
  if (i) {
    let x = kn(d, { ...f, t: p }, s), M = { ...ce, historyStartT: h, highStartT: p, highAtBoundary: g, clockLowerBound: g || x.startCensored, peak: f, candidateHigh: b, drop: we(f.cfs, r.cfs), sincePeakMs: r.t - f.t, fallMs: x.supported ? r.t - Math.max(p, x.lastResetT) : null, trendSupported: x.supported, contextExpired: !1, contextWhy: null }, ke = r.cfs - v.cfs > I && (ae || st), qe = ee <= I && ae, at = ke ? "rising_again" : ee <= I ? qe ? A || $ ? "rising_again" : "rising" : "level" : de && we(r.cfs, te.cfs) < 0 && !ne ? "falling_unconfirmed" : "possible";
    return { ...M, state: at, label: { rising: "Rising \u2014 crest not confirmed", rising_again: "Rising again \u2014 crest not confirmed", level: "Little change \u2014 crest not confirmed", falling_unconfirmed: "Falling \u2014 crest not confirmed", possible: "Possible crest \u2014 not confirmed" }[at] };
  }
  if (r.cfs - v.cfs > I && (ae || st)) return { ...ce, state: "rising_again", label: "Rising again \u2014 crest not confirmed", peak: null };
  if (ee <= I) {
    let x = ae;
    return { ...ce, state: x ? A || $ ? "rising_again" : "rising" : "level", label: x ? A || $ ? "Rising again \u2014 crest not confirmed" : "Rising \u2014 crest not confirmed" : "Little change \u2014 crest not confirmed", peak: null, fallMs: 0 };
  }
  if (!y || !U) return { ...ce, bracketed: !1, state: "falling_unbracketed", label: O ? "Falling \u2014 earlier crest check expired" : "Falling \u2014 crest not established" };
  let Ne = (s.minimumPeakAgeHours ?? 0) * J, De = (s.firstConfirmationDeadlineHours ?? 1 / 0) * J, Se = !(we(r.cfs, te.cfs) > 0) && de && L.supported && S >= Ne && E >= s.minimumHoursBelowHigh * J && ee >= Math.max(s.minimumDropCfs, b.cfs * s.minimumDropFraction), Mt = null;
  if (Se && S > De && (Se = !1, a))
    for (let x of d) {
      if (x.t < b.t + Ne || x.t > b.t + De) continue;
      let M = Ln({ ...e, gauge: { ...o, points: l.filter((ke) => ke.t <= x.t), latest: x, ageMs: 0 } }, { settings: s }, !1);
      if (M.state === "confirmed" && M.peak.t === b.t) {
        Se = !0, Mt = x.t;
        break;
      }
    }
  return { ...ce, evidenceEarnedT: Mt, state: Se ? "confirmed" : "possible", label: Se ? "Observed crest so far" : "Possible crest \u2014 not confirmed" };
}
function Bs(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  if (t) {
    et("current", '<div class="flow-row"><h2>24-hour rise</h2><p class="checking-readings" role="status">Checking river readings\u2026</p><p class="meta">Verifying the latest snapshot and reading ages.</p></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>'), document.getElementById("current").setAttribute("aria-busy", "true"), et("number-strip", "<span>Checking river readings\u2026</span>");
    return;
  }
  let s = e.gauge, a = s.endpoint, i = s.latest, o = a.available, r = o && a.elapsedMs === 24 * J, c = o ? ge(a.changeCfs, !0) : "Unavailable", u = o ? a.changeCfs < 0 ? "No net 24-hour rise" : a.distanceCfs === 0 ? `At the ${ge(a.referenceCfs)} cfs rise trigger` : `${Math.abs(a.distanceCfs) < 0.5 ? "Less than 1" : ge(Math.abs(a.distanceCfs))} cfs ${a.distanceCfs > 0 ? "below" : "above"} the ${ge(a.referenceCfs)} cfs rise trigger` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", l = e.timeUncertain ? "age unknown" : `${$e(s.ageMs)} old${s.stale ? " \xB7 STALE" : ""}`, d = G(i?.cfs) ? `${ge(i.cfs)} cfs` : "unavailable", f = n || s.stale || e.timeUncertain, p = o ? `${c} cfs ${f ? "over the 24 hours to this reading" : r ? "in the last 24 hours" : "over about 24 hours"}` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", h = o && a.changeCfs < 0 ? " (a fall; no net rise)" : "", g = s.history?.endpoint?.last, b = o && a.distanceCfs > 0 && g ? `<p class="meta rise-history-note">Rise reference last met ${se(g.current?.t ?? g.windowEndT)}. Closure status is decided by health authorities.</p>` : "";
  et("current", `<div class="flow-row"><div class="section-heading flow-heading"><h2>24-hour rise</h2>${En("flow", "About flow readings")}</div><div class="rise-headline"><strong class="distance-headline">${k(p + h)}</strong><b class="rise-support">${k(u)}</b></div>${b}<div class="preview-flow"><strong class="actual-flow flow-number">Actual flow: ${k(d)} \xB7 ${k(l)}</strong>${i ? se(i.t) : ""}</div></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>${Rn("flow", "How flow comparisons work", `<p>Flow is water passing the gauge, in cubic feet per second (cfs). A rise of 400 cfs means an increase of 400, not a river flow of 400.</p><p>The 24-hour rise compares the newest actual reading with the actual reading nearest 24 elapsed hours earlier, within 15 minutes. ${o ? `Comparison: ${ge(a.comparison.cfs)} cfs at ${se(a.comparison.t)}; ${$e(a.elapsedMs)} earlier.` : ""} It is not a calendar day. Missing data are not filled.</p><p>Rise trigger shown: 400 cfs November\u2013February, 200 March\u2013April, 100 May\u2013October. Confirm these seasons with the health department.</p><p>Rise from the 24-hour low is ${s.low.available ? ge(s.low.changeCfs, !0) + " cfs" : "unavailable"}. It differs from comparing with the reading 24 hours earlier.</p><p>Gauge quality: ${k(i?.qualityLabel || "unknown")}. Provisional readings are not yet finalized and may be revised.</p>`)}`), document.getElementById("current").setAttribute("aria-busy", String(t)), et("number-strip", `<span>Flow (cfs) <strong>${G(i?.cfs) ? ge(i.cfs) : "\u2014"}</strong><small>${k(l)}</small></span><span>24h change <strong>${o ? c : "\u2014"}</strong></span><span>Low rise <strong>${s.low.available ? ge(s.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function Ds(e, t) {
  let n = e.peak ?? e.high, s = e.peak ? e.sincePeakMs : e.sinceHighMs, a = n ? `${e.highAtBoundary ? "Highest available reading" : "Observed high"}: <strong>${ge(n.cfs)} cfs</strong> \xB7 ${G(e.highStartT) && e.highStartT < n.t ? `${se(e.highStartT)} to ` : ""}${se(n.t)}<br>${k(Sn(s))} before latest reading${e.peak ? `; now ${ge(e.drop)} cfs lower` : ""}.` : k(e.why || ""), i = n ? `<p class="meta">Record starts ${se(e.historyStartT)} \xB7 up to nine days.${e.highAtBoundary ? " This high is at the start of the available evidence; the river may have peaked earlier." : ""}</p>` : "", o = e.peak && e.drop > ze(e.peak.cfs) ? `<p class="crest-fact">${e.trendSupported && G(e.fallMs) ? `<strong>No new rise for ${e.clockLowerBound ? "at least " : ""}${k(Sn(e.fallMs))}</strong> <span class="clock-qualifier">\xB7 small fluctuations ignored</span>.` : "Renewed-rise clock unavailable: a complete hour of eligible readings is needed."}</p>` : "", r = e.hadGap ? `<p class="meta">Continuous evidence starts ${se(e.evidenceStartT)} after a gap or unusable reading.</p>` : "", c = t?.available && t.riseCount > 0 ? `<p class="crest-fact"><strong>${t.riseCount} of ${t.memberCount} experimental scenarios reach a seasonal rise trigger in the next ten days.</strong> Dates and limits below; these counts are not odds.</p>` : "";
  et("monitor", `<div class="crest-top"><h2 data-crest-state="${e.state}" data-crest-mode="observed-facts-only">${k(e.label)}</h2>${En("crest", "About observed highs and the renewed-rise clock")}</div><p class="crest-fact">${a}</p>${i}${o}${r}${c}<p class="crest-fact crest-guidance">Growers and sampling staff make the crest call.</p>${Rn("crest", "Observed highs and the renewed-rise clock", `<p>${Ps}</p><p>The observed high is the highest eligible actual reading in the full available record, up to nine days, showing the full uninterrupted plateau when equal highs repeat. The high\u2019s age uses the latest equal reading; the no-new-rise clock can start earlier in that plateau. It is not an all-time high or a final crest verdict. Direction labels are withheld. If no lower reading precedes the high in this record, the earlier peak is unknown.</p><p>Both clocks end at the newest gauge reading. The renewed-rise clock starts at the high or the last material increasing trend reading. A missing quarter-hour breaks trend support; missing time is never counted. A duration whose start is outside the continuous evidence is shown as a lower bound. Freshness and quality checks can withhold the status.</p><p>A crest concerns actual river flow topping out. A closure can already be in place while the river rises. The clocks do not mean continuous falling or establish that a storm has ended.</p>`)}`);
}
function Et(e, t) {
  for (let n of e || [])
    if (!(!n.length || t < n[0].t || t > n[n.length - 1].t))
      for (let s = 0; s < n.length; s++) {
        if (n[s].t === t) return n[s].cfs;
        if (s && n[s].t > t) {
          let a = n[s - 1], i = n[s];
          return a.cfs + (i.cfs - a.cfs) * (t - a.t) / (i.t - a.t);
        }
      }
  return null;
}
function qs(e, t, n) {
  for (let s of e || []) {
    if (!s.length || s[0].t > t || s[s.length - 1].t < n) continue;
    let a = Et([s], t), i = Et([s], n);
    if (!G(a) || !G(i)) continue;
    let o = Math.min(a, i);
    for (let r of s) r.t > t && r.t < n && (o = Math.min(o, r.cfs));
    return o;
  }
  return null;
}
function Ws(e) {
  let t = e.gauge?.segments || [], n = e.forecast?.shifted?.segments || [], s = e.gauge?.latest, a = t.find((o) => o[o.length - 1]?.t === s?.t), i = n.find((o) => o[0]?.t === s?.t);
  return !a || !i || Math.abs(a[a.length - 1].cfs - i[0].cfs) > 1e-6 ? [] : [[...a, ...i.slice(1)]];
}
function Nn(e) {
  let t = e.forecast || {}, n = Math.max(e.nowMs, e.gauge?.latest?.t ?? e.nowMs), s = t.raw?.endT, a = e.gauge?.latest?.t;
  if (!t.available || !G(s) || e.timeUncertain) return { available: !1, through: s, peaks: [], maxRatio: null, complete: !1 };
  let i = t.raw.segments, o = Ws(e), r = G(a) ? a + 24 * J : n, c = /* @__PURE__ */ new Set([n, s, r]);
  for (let E = he(n).year; E <= he(s).year; E++) for (let S of [3, 5, 11]) {
    let P = rt(E, S, 1);
    P >= n && P <= s && (c.add(P), c.add(P - 1));
  }
  for (let E of [...i, ...o]) for (let S of E)
    S.t >= n && S.t <= s && c.add(S.t), S.t + 24 * J >= n && S.t + 24 * J <= s && c.add(S.t + 24 * J);
  for (let E = n; E <= s; E += kt) c.add(E);
  let u = -1 / 0, l = null, d = null, f = !0, p = null, h = null, g = null, b = null, v = [];
  for (let E of [...c].filter((S) => S >= n && S <= s).sort((S, P) => S - P)) {
    let S = E <= r, P = S ? o : i, K = Et(P, E), te = qs(P, E - 24 * J, E);
    if (!G(K) || !G(te)) {
      f = !1;
      continue;
    }
    let j = we(K, te), ne = j / Ee(E);
    v.push({ t: E, rise: j, ratio: ne }), ne > u && (u = ne), (l === null || j > l) && (l = j, d = E), S ? ((p === null || ne > p) && (p = ne), (h === null || j > h) && (h = j, g = E)) : (b === null || ne > b) && (b = ne);
  }
  let _ = (E, S) => {
    let P = S.cfs, K = Et([E], S.t - 24 * J);
    G(K) && (P = Math.min(P, K));
    for (let te of E) te.t >= S.t - 24 * J && te.t < S.t && (P = Math.min(P, te.cfs));
    return we(S.cfs, P);
  }, m = null, A = null, y = null, $ = /* @__PURE__ */ new Map();
  for (let E of i) for (let S of E) {
    let P = _(E, S);
    if ($.set(S.t, P), S.t <= n || S.t > s) continue;
    let K = P / Ee(S.t);
    (m === null || K > m) && (m = K), (A === null || P > A) && (A = P, y = S.t);
  }
  let C = o.length > 0 && !G(t.provisionalAlignment?.firstT), H = (E) => [...$].some(([S, P]) => S > n && S >= (E.precedingLow?.t ?? E.startT) && S <= E.endT && P / Ee(S) >= 0.5), L = (t.crests || []).filter((E) => E.endT > n && (H(E) || C && v.some((S) => S.t >= Math.max(n, E.precedingLow?.t ?? n) && S.t <= E.endT && S.ratio >= 0.5))), I = i?.[i.length - 1], ee = I?.length > 1 && I[I.length - 1].cfs > I[I.length - 2].cfs;
  return { available: v.length > 0, complete: f, through: s, maxRatio: G(u) ? u : null, maxRise: l, maxT: d, peaks: L, risingTail: ee, adjustedBasis: C, ownMaxRatio: m, ownMaxRise: A, ownMaxT: y, dayMaxRatio: p, dayMaxRise: h, dayMaxT: g, laterMaxRatio: b };
}
function Gs(e, t, n = Nn(e)) {
  let s = e.forecast || {}, a = e.outlook || {}, i = G(s.raw?.endT) ? se(s.raw.endT) : "unavailable", o = n.peaks?.find((v) => v.endT > e.nowMs), r = s.available && G(s.provisionalAlignment?.firstT), c = G(n.ownMaxRatio) && n.ownMaxRatio >= 0.5 || G(n.laterMaxRatio) && n.laterMaxRatio >= 0.5, u = G(n.dayMaxRatio) && n.dayMaxRatio >= 0.5, l = r ? `This forecast\u2019s first value is for ${se(s.provisionalAlignment.firstT)}. Until a gauge reading reaches that time, this page does not say how large a rise the main forecast shows.` : "The first-day comparison is unavailable, so this page does not say how large a rise the main forecast shows.", d = (v) => Math.abs(v) < 0.05 ? 0 : v, f = G(n.ownMaxRise) ? `<p class="meta">Largest rise within the issued forecast, from its own low in the preceding 24 hours: ${Ke(d(n.ownMaxRise), !0)} cfs \xB7 ${se(n.ownMaxT)}.</p>` : "", p = !s.available || e.timeUncertain || e.conditionsSuppressed ? "<p>Main forecast timing unavailable.</p>" : !n.adjustedBasis && !o ? c ? "<p>Within the issued main forecast a rise reaches at least half the seasonal rise trigger; no future peak time is identified.</p>" : `<p>${l}</p>` : o ? `<p><strong>Next main-forecast peak following a substantial rise:</strong> ${se(o.startT)}${o.endT !== o.startT ? ` to ${se(o.endT)}` : ""} \xB7 ${ge(o.cfs)} cfs.</p>` : "<p>No peak following a rise of at least half the seasonal trigger is resolved in the single main forecast.</p>", h = n.available ? !u && !c ? `${n.complete ? "No rise in the single main forecast reaches half the rise trigger" : "Where readings are available, no rise in the single main forecast reaches half the rise trigger"} through ${G(n.through) ? re(n.through) : "its available end"}, counted within the issued forecast or from measured flow and the adjusted forecast.` : n.peaks.length ? "" : c ? "Within the issued main forecast a rise reaches at least half the seasonal rise trigger; no supported future peak time is identified." : "The comparison using measured flow and forecasts reaches at least half the seasonal rise trigger; no supported future peak time is identified." : "There are not enough readings to check the forecast rise.", g = e.timeUncertain || e.conditionsSuppressed ? "" : n.adjustedBasis ? `${h ? `<p>${k(h)}</p>` : ""}${G(n.dayMaxRise) ? `<p class="meta">Largest rise from the preceding 24-hour low in the first day, counted from measured flow and the adjusted forecast: ${Ke(d(n.dayMaxRise), !0)} cfs \xB7 ${se(n.dayMaxT)}.</p>` : ""}${f}${n.risingTail ? '<p class="meta">The main forecast is still rising at its end; its final crest time is unknown.</p>' : ""}${!n.complete && n.available ? '<p class="meta">Missing comparisons do not mean no rise.</p>' : ""}` : `${c ? f : ""}${n.risingTail ? '<p class="meta">The main forecast is still rising at its end; its final crest time is unknown.</p>' : ""}`, b = "<p>Experimental forecast scenarios unavailable.</p>";
  if (e.timeUncertain || e.conditionsSuppressed) b = "<p>Experimental scenarios unavailable until the snapshot and current time are verified.</p>";
  else if (a.available) {
    let v = (A, y) => {
      let $ = Math.floor((A - e.nowMs) / (24 * J)), C = Math.ceil((y - e.nowMs) / (24 * J));
      return $ === C ? `${$} days ahead` : `${$}\u2013${C} days ahead`;
    }, _ = (A, y) => A === y ? se(A) : `${se(A)} to ${se(y)}`;
    b = `<p class="meta">${a.memberCount} complete scenarios \xB7 six-hour readings through ${se(a.dataThroughT ?? a.endT)}.</p><p class="outlook-range"><strong>${a.riseCount} of ${a.memberCount}</strong> reach the seasonal rise trigger${a.thresholdsCfs?.length > 1 ? "" : ` (${ge(a.thresholdCfs)} cfs)`}.</p>`, a.riseCount && (b += `<p>First trigger-reaching times: ${_(a.crossingStartT, a.crossingEndT)} \xB7 <strong>${v(a.crossingStartT, a.crossingEndT)}</strong>.</p>`), b += `<p><strong>${a.halfRiseCount} of ${a.memberCount}</strong> reach at least half the seasonal trigger${a.thresholdsCfs?.length > 1 ? "" : ` (${ge(a.halfThresholdCfs)} cfs)`}, including those above.</p>`, a.resolvedCount ? b += `<p><strong>Peak-time range after these substantial rises:</strong> ${_(a.peakStartT, a.peakEndT)} (${a.resolvedCount} ${a.resolvedCount === 1 ? "scenario" : "scenarios"}).</p>` : b += "<p>No bounded peak-time range after these substantial rises.</p>", a.openEndCount && (b += `<p>${a.openEndCount} additional ${a.openEndCount === 1 ? "scenario has" : "scenarios have"} a substantial rise with the high still open at the window\u2019s end; ${a.openEndCount === 1 ? "its" : "their"} peak may be later.</p>`), b += '<p class="meta"><strong>Scenario counts are not odds.</strong> This examines the next ten days; the final reading may be up to six hours short of that window. A rise means flow above the lowest scenario value in the preceding 24 hours. This differs from the exact 24-hour change shown above. Late scenarios can describe another storm.</p>';
    let m = a.comparisonCoverageStartT ?? a.riseCoverageStartT;
    G(m) && m > e.nowMs && (b += `<p class="meta">Complete 24-hour scenario comparisons begin ${se(m)}; earlier comparisons are unavailable.</p>`), a.excludedCount && (b += `<p class="meta">${a.excludedCount} incomplete scenarios excluded.</p>`), b += `<details><summary>Scenario source and comparison details</summary><p>National Oceanic and Atmospheric Administration (NOAA), Hydrologic Ensemble Forecast Service (HEFS), through its Experimental data service. Reference/start time ${se(a.issuedT)}; file created ${se(a.createdT)}. Reference age: ${k($e(e.nowMs - a.issuedT))}.</p>${a.higherCount !== null && a.comparisonHigh ? `<p>${a.higherCount} of ${a.memberCount} scenarios exceed the highest available observed reading of ${ge(a.comparisonHigh.cfs)} cfs (${se(a.comparisonHigh.t)}).</p>` : ""}<p>The peak range includes only scenarios with a rise of at least half the seasonal trigger and a later high above the latest measured flow, bounded by lower forecast readings before and after it. Small bumps are excluded. A high still open at the horizon is outside the bounded range. Missing or conflicting values exclude a scenario; references older than 48 hours are withheld.</p><a href="https://api.water.noaa.gov/about/api" target="_blank" rel="noopener noreferrer">NOAA Experimental scenario service description \u2197</a></details>`;
  } else a.reason && (b = `<p>${k(a.reason)}.</p>`);
  et("peaks", `<div class="section-top"><h2>Crest outlook</h2></div><p>A later crest remains possible. Neither the observed drop nor these forecasts confirms that the final storm crest has passed.</p><div class="outlook-summary"><h3>Experimental NOAA scenarios</h3>${b}</div><details><summary>Single main NOAA forecast \xB7 through ${G(s.raw?.endT) ? k(re(s.raw.endT)) : "unavailable"}</summary><p class="meta">National Weather Service official river forecast${G(s.issuedT) ? `, issued ${se(s.issuedT)}` : ""}. Available through ${i}.</p>${p}${g}<p class="meta">The main forecast is one forecast; the alternative scenario counts above describe the wider range of modeled outcomes.</p></details>`);
}
function On(e, t, n, s, a, i = {}) {
  Bs(t, i);
  let o = { ...t, conditionsSuppressed: !!(i.suppressed || i.checking) }, r = js(t, i), c = Nn(t);
  Ds(r, t.timeUncertain || o.conditionsSuppressed ? null : t.outlook), xn(t, s), Mn(o);
  let u = document.getElementById("rain");
  u.innerHTML = u.innerHTML.replaceAll("<strong>Unavailable</strong>", '<strong class="unavailable">Unavailable</strong>');
  let l = u.querySelector?.(".station-links"), d = u.querySelector?.(".rain-total-grid");
  l && d && d.insertAdjacentElement("afterend", l), Gs(o, r, c), Cn(t), An(e, t, n);
  let f = document.getElementById("forecast-details");
  f.innerHTML = f.innerHTML.replace("The adjusted forecast first reaches", "Within its first 72 hours, the adjusted forecast first reaches").replace("The adjusted forecast already meets", "Within its first 72 hours, the adjusted forecast already meets").replace("earlier measurements or the adjusted forecast", "earlier measurements or forecast values").replace("Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.", "After 72 hours, the moving rise reference uses only the unchanged official forecast. Adjusted forecasts and past cases still stop at 72 hours; a gap marks any change of basis.").replace("Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.", "The observed high is listed first. The next official forecast peak is shown alongside a separate range across experimental forecast scenarios.");
  let p = document.getElementById("sources");
  p.innerHTML = p.innerHTML.replace("Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.", "Estimated or otherwise unsupported readings cannot confirm an observed crest."), et("snapshot-label", `Saved snapshot ${k(e.id)} \xB7 ${k(re(e.createdAt))}`);
}

// site/js/watch-preview-reference.js
var Hn = 36e5, Ae = 24 * Hn, Vs = 6 * Hn, xe = Number.isFinite, zt = (e) => xe(e) && Math.abs(e) <= 864e13;
function zs(e) {
  if (e?.available === !1) return [];
  let t = [];
  for (let n of e?.segments || []) {
    if (!Array.isArray(n) || n.some((i, o) => o && i?.t <= n[o - 1]?.t)) continue;
    let s = [], a = () => {
      s.length && t.push(s), s = [];
    };
    for (let i of n) {
      if (!zt(i?.t) || !xe(i?.cfs) || i.cfs < 0 || xe(e?.endT) && i.t > e.endT) {
        a();
        continue;
      }
      s.length && i.t - s.at(-1).t > Vs && a(), s.push({ t: i.t, cfs: i.cfs });
    }
    a();
  }
  return t;
}
function tt(e, t) {
  if (!e.length || t < e[0].t || t > e.at(-1).t) return null;
  for (let n = 0; n < e.length; n++) {
    let s = e[n];
    if (t === s.t) return s.cfs;
    if (t < s.t) {
      let a = e[n - 1], i = (t - a.t) / (s.t - a.t), o = (1 - i) * a.cfs + i * s.cfs;
      return xe(o) ? o : null;
    }
  }
  return null;
}
function Xs(e, t) {
  let n = [];
  for (let s = he(e).year; s <= he(t).year; s++) for (let a of [3, 5, 11]) {
    let i = rt(s, a, 1);
    i > e && i <= t && n.push(i);
  }
  return n.sort((s, a) => s - a);
}
function Zs(e, t) {
  let n = tt(e, t - Ae), s = tt(e, t);
  if (n === null || s === null) return null;
  let a = Math.min(n, s);
  for (let i of e) i.t > t - Ae && i.t < t && (a = Math.min(a, i.cfs));
  return a;
}
function Js(e, t, n) {
  let s = /* @__PURE__ */ new Set([t, n]);
  for (let i of e) for (let o of [i.t, i.t + Ae]) o > t && o < n && s.add(o);
  let a = [...s].sort((i, o) => i - o);
  for (let i = 1; i < a.length; i++) {
    let o = a[i - 1], r = a[i], c = (o + r) / 2, u = e.filter((d) => d.t > c - Ae && d.t < c).reduce((d, f) => Math.min(d, f.cfs), 1 / 0), l = [
      [tt(e, o - Ae), tt(e, r - Ae)],
      [tt(e, o), tt(e, r)],
      ...xe(u) ? [[u, u]] : []
    ];
    for (let d = 0; d < l.length; d++) for (let f = d + 1; f < l.length; f++) {
      let p = l[d][0] - l[f][0], h = l[d][1] - l[f][1];
      if (!xe(p) || !xe(h) || p === h) continue;
      let g = Math.max(Math.abs(p), Math.abs(h)), b = p / g / (p / g - h / g);
      b > 0 && b < 1 && s.add(o + b * (r - o));
    }
  }
  return [...s].sort((i, o) => i - o);
}
function Ys(e, t, n, s) {
  let a = (u, l) => {
    let d = s(u);
    return xe(d) && xe(d + l) ? d + l : null;
  };
  if (e === t) {
    let u = a(e, Ee(e));
    return { segments: xe(u) ? [[{ t: e, cfs: u }]] : [], steps: [] };
  }
  let i = Xs(e, t), o = [e, ...i, ...i.at(-1) === t ? [] : [t]], r = [], c = [];
  for (let u = 1; u < o.length; u++) {
    let l = o[u - 1], d = o[u], f = Ee(l), h = [l, ...n.filter((g) => g > l && g < d), d].map((g) => ({ t: g, cfs: a(g, f) }));
    if (h.every((g) => xe(g.cfs)) && r.push(h), i.includes(d)) {
      let g = a(d, f), b = a(d, Ee(d));
      xe(g) && xe(b) && (c.push({ t: d, beforeCfs: g, afterCfs: b }), d === t && r.push([{ t: d, cfs: b }]));
    }
  }
  return { segments: r, steps: c };
}
function In(e, t, n = "endpoint") {
  let s = { available: !1, basis: "official_forecast", segments: [], steps: [], startT: null, endT: null };
  if (!zt(t) || !zt(e?.endT) || e.endT <= t || !["endpoint", "low"].includes(n)) return s;
  let a = zs(e), i = [], o = [], r = t + 1, c = (l, d, f, p) => {
    if (l > d) return;
    let h = Ys(l, d, f, p);
    i.push(...h.segments), o.push(...h.steps);
  };
  if (n === "endpoint")
    for (let l of a) for (let d of a) {
      let f = Math.max(r, l[0].t, d[0].t + Ae), p = Math.min(e.endT, l.at(-1).t, d.at(-1).t + Ae);
      c(f, p, d.map((h) => h.t + Ae), (h) => tt(d, h - Ae));
    }
  else
    for (let l of a) {
      let d = Math.max(r, l[0].t + Ae), f = Math.min(e.endT, l.at(-1).t);
      d <= f && c(d, f, Js(l, d, f), (p) => Zs(l, p));
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
  } : s;
}

// site/js/watch-chart.js
var Y = Number.isFinite, Q = null, Qs = (e, t, n) => Y(e?.t) && Y(e?.cfs) && e.t >= t && e.t <= n;
function Rt(e, t, n) {
  for (let s of e || []) {
    let a = yn(s, (i) => i.t === t);
    if (a) return a.cfs;
    for (let i = 1; i < s.length; i++) {
      let o = s[i], r = s[i - 1];
      if (r.t < t && o.t > t)
        return o.t - r.t > n ? null : r.cfs + (o.cfs - r.cfs) * (t - r.t) / (o.t - r.t);
    }
  }
  return null;
}
function Un(e, t, n, s) {
  let a = e.filter((i) => Qs(i, t, n));
  for (let i of [t, n])
    if (!a.some((o) => o.t === i)) {
      let o = Rt([e], i, s);
      Y(o) && a.push({ t: i, cfs: o });
    }
  return a.sort((i, o) => i.t - o.t);
}
function Ks(e, t, n) {
  return e.map((s, a) => `${a ? "L" : "M"}${t(s.t).toFixed(2)},${n(s.cfs).toFixed(2)}`).join(" ");
}
function Pn(e, t, n) {
  return (e?.segments || []).map((s) => {
    let a = Un(s, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !s.length || i.t < s[0].t || i.t > s.at(-1).t) continue;
      let o = a.findIndex((c) => c.t >= i.t), r = o < 0 ? a.length : o;
      for (; a[r]?.t === i.t; ) a.splice(r, 1);
      a.splice(r, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return a;
  });
}
var ea = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function Xt(e) {
  let t = Object.fromEntries(ea.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function ta(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - Xt(t);
  return t;
}
function na(e, t, n) {
  let s = Math.max(2, Math.floor(n / 70) + 1), a = Xt(e), i = Xt(t), o = [];
  for (let r of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let c = Math.min(r, 12) * 36e5, u = [];
    for (let d = Math.ceil(a / c) * c; d <= i + 36e5; d += r * 36e5) {
      let f = ta(d);
      f >= e && f <= t && u.push(f);
    }
    if (u.length < 2) continue;
    o = u;
    let l = Math.min(...u.slice(1).map((d, f) => (d - u[f]) / (t - e) * n));
    if (u.length <= s && l >= 40) return u;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function Fn(e, t, n, { previewReferenceTail: s = !1, officialReferenceTail: a = null } = {}) {
  let i = Math.max(1, Math.floor(e.clientWidth)), o = globalThis.innerHeight, r = i < 500 ? 240 : Y(o) && o < 500 ? Math.max(180, Math.min(280, o - 80)) : 280, c = { left: Math.min(49, i / 4), right: Math.min(14, i / 4), top: 26, bottom: 38 }, u = c.left, l = i - c.right, d = c.top, f = r - c.bottom, p = t.gauge?.latest?.t, h = Math.round(t.nowMs), g = document.getElementById("chart-cursor");
  if (t.timeUncertain && !Y(p)) {
    let w = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="${w}"><text x="${i / 2}" y="${r / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${i / 2}" y="${r / 2 + 4}" text-anchor="middle">${i < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let B of document.querySelectorAll?.(".legend span") ?? []) B.hidden = !0;
    Q = null, g.min = "0", g.max = "1", g.step = "1", g.value = "0", g.disabled = !0, g.style.marginLeft = `${u - 10}px`, g.style.width = `${l - u + 20}px`, g.setAttribute("aria-valuetext", w), document.getElementById("chart-readout").textContent = w;
    return;
  }
  let b = t.timeUncertain ? p : h, v = b - Number(n.past || 24) * 36e5, _ = n.range === "full" ? Math.max(b + 36e5, t.forecast?.raw?.endT ?? b + 72 * 36e5) : b + (n.range === "day" ? 24 : 72) * 36e5, m = t.forecast || {}, A = t.gauge?.references?.[n.reference], y = m.references?.[n.reference], $ = { segments: [...A?.segments || [], ...y?.segments || []], steps: [...A?.steps || [], ...y?.steps || []] }, C = s && Y(p) ? a : null, H = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: m.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: m.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: m.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: m.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: s ? "Rise-trigger flow" : "24-hour rise reference", segments: Pn($, v, _), gap: 1 / 0 }, ...C ? [{ key: "reference", name: "Official forecast-based rise-trigger flow", basis: "official-forecast", segments: Pn(C, Math.max(v, C.startT ?? p + 72 * 36e5 + 1), _), gap: 1 / 0 }] : []].map((w) => ({ ...w, visible: w.key === "reference" ? w.segments : w.segments.map((B) => Un(B, v, _, w.gap)) })), L = H.flatMap((w) => w.visible.flat()).filter((w) => Y(w.cfs)), I = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let w of document.querySelectorAll?.(".legend span") ?? []) {
    let B = I[w.querySelector("i")?.className];
    w.hidden = !!B && !H.some((Ge) => Ge.key === B && Ge.visible.some((Ut) => Ut.length));
  }
  let ee = Math.max(10, ...L.map((w) => w.cfs)) * 1.08, E = ee / 4, S = Math.pow(10, Math.floor(Math.log10(E))), P = E / S, K = (P <= 1 ? 1 : P <= 2 ? 2 : P <= 5 ? 5 : 10) * S, te = K * 4, j = (w) => u + (w - v) / (_ - v) * (l - u), ne = (w) => f - w / te * (f - d), vt = Array.from({ length: 5 }, (w, B) => K * B), ae = na(v, _, l - u), be = vt.map((w) => `<line class="grid" x1="${u}" x2="${l}" y1="${ne(w)}" y2="${ne(w)}"/><text x="${u - 7}" y="${ne(w) + 4}" text-anchor="end">${k(Ke(w))}</text>`).join("") + ae.map((w) => {
    let B = j(w), Ge = B < 24 ? "start" : B > i - 24 ? "end" : "middle", Ut = `<tspan x="${B}">${k(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(w))}</tspan><tspan x="${B}" dy="14">${k(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(w))}</tspan>`;
    return `<text class="x-axis-label" x="${B}" y="${r - 24}" text-anchor="${Ge}">${Ut}</text>`;
  }).join(""), R = H.map((w) => w.visible.filter((B) => B.length).map((B) => B.length === 1 ? `<circle class="${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} cx="${j(B[0].t)}" cy="${ne(B[0].cfs)}" r="2" fill="var(--${w.key === "observed" ? "obs" : w.key})"/>` : `<path class="plot-line ${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} d="${Ks(B, j, ne)}"/>`).join("")).join(""), U = Rt($.segments, v, 1 / 0) ?? Rt($.segments, b, 1 / 0), O = Y(U) ? ne(U) : d + 14;
  O = O - d > 32 ? O - 10 : O + 24, O = Math.max(d + 12, Math.min(f - 6, O));
  let le = H.find((w) => w.key === "reference")?.visible.flat() || [], de = le.reduce((w, B) => !w || B.t > w.t ? B : w, null), ce = s ? 112 : 84, st = s ? "Rise-trigger flow" : "24h rise line", Ne = de ? Math.max(u + 4, Math.min(l - ce - 4, j(de.t) - ce)) : u + 4, De = O, Oe = Ne + ce, Se = Y(n.cursorT) && n.cursorT >= v && n.cursorT <= _ ? j(n.cursorT) : null, Mt = Y(p) && p >= v && p <= _ ? j(p) : null, x = de && j(de.t) - u >= ce, M = [Se, Mt].some((w) => Y(w) && w >= Ne && w <= Oe), ke = l - u < 200 || !x || M ? "" : `<rect class="reference-label-bg" x="${Ne}" y="${De - 12}" width="${ce}" height="16" rx="3"/><text class="reference-label" x="${Ne + 4}" y="${De}">${st}</text>`, qe = t.timeUncertain && l - u < 132, at = t.timeUncertain ? qe ? "Last reading" : "Last saved river reading" : "Latest observed", en = t.timeUncertain ? qe ? 80 : 132 : 90, ts = Y(p) && p >= v && p <= _ ? `<line x1="${j(p)}" x2="${j(p)}" y1="${d}" y2="${f}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(u, Math.min(l - en, j(p) + 5))}" y="${d - 9}">${at}</text>` : "", ns = !t.timeUncertain && h >= v && h <= _ ? `<line class="now" x1="${j(h)}" x2="${j(h)}" y1="${d}" y2="${f}"/><text x="${Math.min(l - 25, j(h) + 5)}" y="${d + 15}">Now</text>` : "", We = Y(n.cursorT) ? Math.max(v, Math.min(_, n.cursorT)) : null, ss = We !== null ? `<line class="cursor" x1="${j(We)}" x2="${j(We)}" y1="${d}" y2="${f}"/>` : "", Me = Y(p) ? p + 72 * 36e5 : null, as = Y(m.raw?.endT) && m.raw.endT > Me && (m.raw?.segments || []).some((w) => w.some((B) => Y(B.cfs) && B.t > Me)), tn = H.some((w) => ["shifted", "case"].includes(w.key) && w.visible.some((B) => B.length)), Ht = tn && n.range === "full" && Y(Me) && Me > v && _ - Me > 6 * 36e5 && as, It = Ht ? l - j(Me) : 0, rs = s ? "Beyond this limit the forecast and its 24-hour rise reference use official forecast values only, where supported. Adjusted forecasts and past cases stop at 72 hours. The reference changes basis in a separate path." : "Beyond this limit only supported official forecast points can be shown. Adjustments, past cases and moving references are limited to at most 72 hours.", is = Ht ? `<g class="forecast-horizon"><title>72-hour context limit: ${k(re(Me, !0))}. ${rs}</title><rect x="${j(Me)}" y="${d}" width="${It}" height="${f - d}" fill="currentColor" opacity=".04"/><line x1="${j(Me)}" x2="${j(Me)}" y1="${d}" y2="${f}" stroke="currentColor" stroke-dasharray="3 4" opacity=".55"/>${It >= 65 ? `<rect x="${l - 68}" y="${d + 6}" width="67" height="33" rx="3" fill="var(--surface)" opacity=".95"/><text x="${l - 4}" y="${d + 19}" text-anchor="end"><tspan x="${l - 4}">After 72h</tspan><tspan x="${l - 4}" dy="14">Official only</tspan></text>` : ""}</g>` : "", os = H.some((w) => w.segments.some((B) => B.some((Ge) => Y(Ge.t) && Y(Ge.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. ${s ? tn ? "After the 72-hour limit, any reference shown uses only official forecast values and begins as a separate path. " : "Any future reference shown uses official forecast values only. " : ""}Observations and forecast paths from ${k(re(v, !0))} through ${k(re(_, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${u}" y="${d}" width="${l - u}" height="${f - d}"/></clipPath></defs>${be}<g clip-path="url(#plot-clip)">${is}${R}${ss}</g>${ke}${ts}${ns}${L.length ? "" : `<text x="${(u + l) / 2}" y="${r / 2}" text-anchor="middle">${os}</text>`}</svg>${Ht && It < 65 ? `<p class="meta forecast-horizon-caption">${s ? "After 72h: official forecast and its supported 24-hour reference." : "After 72h: official forecast only, where supported."}</p>` : ""}`, Q = { lines: H, hasData: L.length > 0, start: v, end: _, left: u, right: l, width: i, host: e, contextLimit: Me, previewReferenceTail: s }, g.min = String(v), g.max = String(_), g.step = "1", g.disabled = !Q.hasData, g.style.marginLeft = `${u - 10}px`, g.style.width = `${l - u + 20}px`;
  let Pt = We ?? Math.max(v, Math.min(_, Y(p) ? p : h));
  g.value = String(Math.round(Pt)), g.setAttribute("aria-valuetext", t.timeUncertain ? `${We === null ? "Last saved river reading" : "Saved chart selection"}: ${re(Pt)}. Current time is unconfirmed.` : re(Pt)), We !== null ? sa(We) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function sa(e) {
  if (!Q) return;
  let t = Q.lines.map((n) => {
    let s = Rt(n.visible, e, n.gap);
    return Y(s) ? `${n.name}: ${Math.round(s).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${k(re(e))}</strong><br>${t.map(k).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}${Y(Q.contextLimit) && e > Q.contextLimit ? `<br><span class="meta">${Q.previewReferenceTail ? "Beyond 72 hours: official forecast values only. The reference uses those forecast values when supported; adjusted forecasts and past cases stop at 72 hours." : "Beyond 72 hours: official forecast only, where supported. Other comparisons are limited to 72 hours."}</span>` : ""}`;
}
function jn(e) {
  if (!Q?.hasData) return null;
  let t = Q.host.getBoundingClientRect(), n = t.width / Q.width, s = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - Q.left) / (Q.right - Q.left)));
  return Math.round(Q.start + s * (Q.end - Q.start));
}
function Zt() {
  if (!Q?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return Y(e) ? Math.max(Q.start, Math.min(Q.end, e)) : null;
}
function Bn(e) {
  let t = Zt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? Q.start : e === "End" ? Q.end : Y(n[e]) ? Math.max(Q.start, Math.min(Q.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var Dn = { name: "Historical river forecast cases", version: 4, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, sub_cfs: 2.3, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, sub_cfs: 3.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, sub_cfs: 5.1, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, sub_cfs: 5.9, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, sub_cfs: 6.3, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, sub_cfs: 7.3, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var xt = (e, t, n) => Fn(e, t, n, { previewReferenceTail: !0, officialReferenceTail: In(t.forecast.raw, (t.gauge.latest?.t ?? NaN) + (t.forecast.shifted?.available ? 72 * 36e5 : 0), n.reference) }), ra = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", Vn = new URL("./", import.meta.url), zn = "samish.public.preview.packet.v1", Xn = "samish.public.preview.preferences.v1", Lt = 9466848e5, pt = 41024448e5, nt = 5 * 6e4, Zn = 2 * 1024 * 1024, N = (e) => document.getElementById(e), gt = Number.isFinite;
function mt() {
  let e = N("number-strip"), t = N("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", mt, { passive: !0 });
window.addEventListener("resize", mt);
function Kt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = N(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let s = n.querySelector("button[data-help-close]");
    s && !s.id && (s.id = `${n.id}-close`);
  });
}
function Yt(e, t, n = !1) {
  let s = N(e), a = N(`${e}-toggle`);
  if (!(!s || !a) && (s.open = t, Kt(), mt(), n)) {
    a.focus({ preventScroll: !0 });
    let i = N("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, r = a.getBoundingClientRect();
    (r.top < o + 8 || r.bottom > innerHeight - 8) && a.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), mt();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), Yt(t.dataset.helpTarget, !N(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), Yt(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || N(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), Yt(t.id, !1, !0));
});
Kt();
var Jn = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, Yn = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, X = () => {
  throw new Error("invalid_public_packet");
};
function D(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((s) => !Object.prototype.hasOwnProperty.call(e, s)) || Object.keys(e).some((s) => ![...t, ...n].includes(s))) && X(), e;
}
function ye(e, t = !1, n = !1, s = !1, a = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !gt(e) || !n && e < 0 || s && !Number.isInteger(e) || e > a) && X();
}
function F(e, t = !1) {
  ye(e, t, !1, !0, pt), e !== null && e < Lt && X();
}
function ht(e) {
  typeof e != "boolean" && X();
}
function ve(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && X();
}
function _e(e, t, n) {
  (!Array.isArray(e) || e.length > t) && X(), e.forEach(n);
}
var ia = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], oa = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], la = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function Qt(e, t = !1) {
  D(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), F(e.t, t), "cfs" in e && ye(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && ht(e[n]);
  "approval" in e && ve(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && ve(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && ve(e[n], la);
  "reason" in e && ve(e.reason, ia, !0);
}
function yt(e, t = !1) {
  e !== null && (D(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), F(e.t), ye(e.cfs, !0), t && F(e.eligibleT, !0));
}
function qn(e, t) {
  D(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), F(t.lastAttemptAt, !0), F(t.lastSuccessAt, !0), ve(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (D(n, ["points", "exclusions", "coveredWindow"]), _e(n.points, 4096, (s) => Qt(s)), _e(n.exclusions, 4096, (s) => Qt(s, !0)), n.coveredWindow !== null)) {
      let s = D(n.coveredWindow, ["startT", "endT", "complete"]);
      F(s.startT), F(s.endT), (s.complete !== !0 || s.startT > s.endT) && X();
    }
    if (e === "noaa" && (D(n, ["issuedT", "points", "conflicts"], ["sourceCode"]), "sourceCode" in n && ve(n.sourceCode, ["nwrfc_textplot", "nwps_stageflow"]), F(n.issuedT), _e(n.points, 1024, (s) => {
      D(s, ["t", "cfs"]), F(s.t), ye(s.cfs);
    }), _e(n.conflicts, 1024, (s) => F(s))), e === "radar") {
      D(n, ["generatedT", "hours", "conflicts"], ["definitionCode", "regions"]), F(n.generatedT);
      let s = (i) => {
        F(i), i % 36e5 && X();
      }, a = (i) => _e(i, 256, (o) => {
        D(o, ["endT", "mm"]), s(o.endT), ye(o.mm, !0);
      });
      if (a(n.hours), _e(n.conflicts, 256, s), "regions" in n) {
        ve(n.definitionCode, ["wbd_huc12_upper_middle_friday_vs_lower_v1", "wbd_huc12_four_subbasins_v2"]);
        let i = n.definitionCode === "wbd_huc12_four_subbasins_v2" ? { upper: 0.28262613994476493, middle: 0.2623816064352527, friday: 0.4230969851947867, lower: 0.03040672516131746 } : { upper: 0.9621456571845356, lower: 0.03785426796335805 };
        D(n.regions, Object.keys(i));
        let o = 0;
        for (let [r, c] of Object.entries(n.regions))
          D(c, ["areaFraction", "hours", "conflicts"]), ye(c.areaFraction, !1, !1, !1, 1), Math.abs(c.areaFraction - i[r]) > 1e-9 && X(), o += c.areaFraction, a(c.hours), _e(c.conflicts, 256, s);
        Math.abs(o - Object.values(i).reduce((r, c) => r + c, 0)) > 1e-9 && X();
      } else "definitionCode" in n && X();
    }
    if (e === "ensemble") {
      D(n, ["issuedT", "createdT", "archiveCreatedT", "sourceCode", "members"]), F(n.issuedT), F(n.createdT), F(n.archiveCreatedT), ve(n.sourceCode, ["noaa_hefs"]);
      let s = /* @__PURE__ */ new Set();
      _e(n.members, 100, (a) => {
        D(a, ["id", "points"]), (typeof a.id != "string" || !/^\d{4}$/.test(a.id) || s.has(a.id)) && X(), s.add(a.id), _e(a.points, 256, (i) => {
          D(i, ["t", "cfs"]), F(i.t), ye(i.cfs, !0);
        });
      });
    }
    e === "grid" && (D(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), F(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && X(), _e(n.periods, 1024, (s) => {
      D(s, ["startT", "endT", "mm"]), F(s.startT), F(s.endT), ye(s.mm, !0), s.endT <= s.startT && X();
    })), e === "tides" && (D(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && X(), _e(n.points, 128, (s) => {
      D(s, ["t", "ft", "type"]), F(s.t), ye(s.ft, !1, !0), ve(s.type, ["H", "L"]);
    }));
  }
}
function ca(e) {
  D(e, ["summary", "transitions"]);
  let t = D(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && X(), F(t.asOf), ve(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && Qt(t.actualCurrentObservation), F(t.supportObservationT, !0), t.event !== null) {
    let o = D(t.event, ["openedT", "high", "cycle"]);
    F(o.openedT), yt(o.high);
    let r = D(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    ye(r.ordinal, !1, !1, !0, 1e5), F(r.openedT), yt(r.high, !0), yt(r.low), ht(r.endingPending);
  }
  if (t.standing !== null) {
    let o = D(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    ve(o.kind, ["downturn", "correction"]), ve(o.state, ["possible_downturn", "rising_again"]), F(o.t), F(o.detectedAt), ye(o.cfs), ht(o.active), yt(o.supportingHigh), yt(o.low);
  }
  let n = (o) => _e(o, 16, (r) => ve(r, oa)), s = D(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  ve(s.status, ["available", "warming_up", "partial", "unavailable"]), ht(s.newDownturnAvailable), ht(s.aboveHighCorrectionAvailable), n(s.reasons);
  let a = D(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(a.blockingReasons), F(a.nextEligibleAt, !0);
  let i = D(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  F(i.lastSuccessfulPollAt, !0), ye(i.monitoringGapMs, !0, !1, !1, pt), ye(i.observationAgeMs, !0, !1, !1, pt), _e(i.missingQuarterHours, 7, (o) => F(o)), ht(i.clockTrusted), _e(e.transitions, 32, (o) => {
    D(o, ["kind", "t", "cfs", "event", "detected_at"]), ve(o.kind, ["downturn", "event_end"]), F(o.t), F(o.detected_at), ye(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && X();
  });
}
async function Qn(e) {
  D(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && X();
  let t = new TextEncoder().encode(e.payload);
  t.length > Zn && X(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && X();
  let s = JSON.parse(e.payload);
  D(s, ["schemaVersion", "publishedAt", "snapshot"]), s.schemaVersion !== 1 && X(), F(s.publishedAt);
  let a = D(s.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (a.schemaVersion !== 1 || typeof a.id != "string" || !/^[a-f0-9]{12}$/.test(a.id)) && X(), F(a.createdAt), s.publishedAt < a.createdAt && X();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return D(a.sources, i, ["ensemble"]), i.forEach((o) => qn(o, a.sources[o])), "ensemble" in a.sources && qn("ensemble", a.sources.ensemble), ca(a.monitor), a.monitor.summary.asOf !== a.createdAt && X(), s;
}
var dt = Jn(Xn) || {}, Z = { range: ["day", "three", "full"].includes(dt.range) ? dt.range : "full", past: dt.past === 48 ? 48 : 24, reference: dt.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(dt.theme) ? dt.theme : null, cursorT: null };
Z.theme && (document.documentElement.dataset.theme = Z.theme);
var Te = null, $t = null, ie = null, Jt = !1, oe = "waiting", je = null, Tt = null, Nt = !0, Be = !1, Pe = Date.now(), Ot = () => Yn(Xn, { range: Z.range, past: Z.past, reference: Z.reference, theme: Z.theme });
function ua() {
  let e = Date.now(), t = je ? Math.max(0, performance.now() - je.mono) : 0, n = je ? je.lower + t : null, s = je ? je.upper + t : null;
  Pe = Math.max(Pe, e, s ?? 0, Te?.snapshot.createdAt ?? 0);
  let a = Nt || !je || e < n - nt || e > s + nt || e + nt < Pe || Te && Te.snapshot.createdAt > s + nt;
  return { now: Pe, uncertain: a };
}
function Kn() {
  return Tt ? Tt.now + Math.max(0, performance.now() - Tt.mono) : 0;
}
function fa() {
  $t && Yn(zn, { packet: $t, greatestNow: Pe, trustedNow: Kn(), savedDeviceMs: Date.now(), ended: Be });
}
function Wn(e) {
  let t = N("connection");
  if (oe === "waiting") {
    t.textContent = "Checking the public snapshot and current time\u2026", t.className = "connection";
    return;
  }
  if (!Te) {
    t.textContent = Be ? "Preview ended. No current readings are provided." : oe === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - Te.snapshot.createdAt), s = oe !== "checked";
  if (!Be && !s && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${$e(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [Be ? "Preview ended. Earlier readings are retained for reference." : s ? oe === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : oe === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current crest status is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${re(Te.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${$e(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current crest status is withheld." : ""].join(" "), t.className = "connection attention";
}
function Le() {
  let e = ua();
  if (!Te) {
    Wn(e);
    let l = oe === "waiting";
    N("current").textContent = l ? "Checking river readings\u2026" : "No verified river readings available.", N("current").setAttribute("aria-busy", String(l)), N("monitor").textContent = l ? "" : "Crest status unavailable until readings can be verified.";
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((l) => l.id)), s = ["monitor", "forecast-details", "peaks"].flatMap((l) => [...N(l).querySelectorAll("details:not(.section-help)")].flatMap((d, f) => d.open ? [`${l}:${f}`] : [])), a = Te.snapshot, i = e.uncertain ? a.createdAt : e.now;
  ie = wn({ nowMs: i, sources: a.sources, ratioTable: Dn });
  let o = Be || e.uncertain || oe !== "checked" || e.now - a.createdAt > 12 * 6e4;
  ie.timeUncertain = e.uncertain, e.uncertain && (ie.forecast.freshContext = !1, ie.forecast.higherLater = { ...ie.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let r = a.monitor.summary, c = !gt(r.supportObservationT) || i - r.supportObservationT > 60 * 6e4;
  if (o) {
    let l = { code: Be ? "preview_ended" : e.uncertain ? "public_time_uncertain" : oe !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" };
    ie.gauge.direction = { ...ie.gauge.direction, available: !1, reason: l }, ie.gauge.twelveHourChange = { ...ie.gauge.twelveHourChange, available: !1, reason: l };
  }
  let u = a;
  if (o || c || !r.support.clockTrusted) {
    let l = [...r.capability.reasons, ...c ? [gt(r.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...r.support.clockTrusted ? [] : ["clock_uncertain"]];
    u = { ...a, monitor: { ...a.monitor, summary: { ...r, capability: { ...r.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: l }, preparation: { ...r.preparation, nextEligibleAt: null } } } };
  }
  On(u, ie, e.uncertain ? null : { lastCommitAt: a.createdAt, workerStale: e.now - a.createdAt > 12 * 6e4 }, Z, i, { checking: oe === "waiting", suppressed: o });
  for (let l of N("forecast-details").querySelectorAll("a")) l.getAttribute("href") === "/data/ratio_table.json" && (l.href = new URL("ratio_table.json", Vn).href, l.textContent = "View the frozen historical-case table");
  s.forEach((l) => {
    let [d, f] = l.split(":"), p = N(d).querySelectorAll("details:not(.section-help)")[Number(f)];
    p && (p.open = !0);
  }), Kt(n), document.querySelectorAll("[data-range]").forEach((l) => l.setAttribute("aria-pressed", String(l.dataset.range === Z.range))), N("past").value = String(Z.past), N("reference").value = Z.reference, xt(N("chart"), ie, Z), Wn(e), mt(), fa(), t && N(t) && document.activeElement?.id !== t && N(t).focus({ preventScroll: !0 });
}
async function es(e, t = Zn * 2) {
  let n = new AbortController(), s = setTimeout(() => n.abort(), 18e3);
  try {
    let a = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!a.ok) throw new Error("unavailable");
    let i = await a.text();
    return new TextEncoder().encode(i).length > t && X(), { response: a, value: JSON.parse(i) };
  } finally {
    clearTimeout(s);
  }
}
async function da() {
  let e = new URL("version.json", Vn);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await es(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && X(), Be = n.state === "ended";
  let s = t.headers.get("Date"), a = t.headers.get("Age"), i = Date.parse(s || "");
  if (!gt(i) || i < Lt || i > pt || a !== null && !/^\d+$/.test(a)) throw new Error("time_unavailable");
  let o = a === null ? 0 : Number(a);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let r = i, c = Date.now();
  c >= i - nt && c <= r + nt && r - c <= nt && (Pe = Math.max(r, c, Kn(), Te?.snapshot.createdAt ?? 0), Tt = { now: Pe, mono: performance.now() }), je = { lower: i, upper: r, mono: performance.now() }, Nt = !1;
}
function ha(e, t) {
  if (Te) {
    let n = Te.snapshot, s = e.snapshot;
    if (s.createdAt < n.createdAt || s.createdAt === n.createdAt && s.id < n.id) {
      oe = "older";
      return;
    }
    if (s.id === n.id) {
      (s.createdAt !== n.createdAt || JSON.stringify(s) !== JSON.stringify(n)) && X(), oe = "checked";
      return;
    }
  }
  Te = e, $t = t, oe = "checked";
}
async function bt() {
  if (!Jt) {
    Jt = !0, N("refresh").disabled = !0, oe === "waiting" && Le();
    try {
      let e = new URL(ra);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([da(), es(e)]);
      if (t[0].status === "rejected" && (Nt = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          ha(await Qn(n), n);
        } catch {
          oe = "invalid";
        }
      else oe = "offline";
      Le();
    } finally {
      Jt = !1, N("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  Z.range = e.dataset.range, Z.cursorT = null, Ot(), Le();
}));
N("past").addEventListener("change", () => {
  Z.past = Number(N("past").value), Ot(), Le();
});
N("reference").addEventListener("change", () => {
  Z.reference = N("reference").value, Ot(), Le();
});
N("theme").addEventListener("click", () => {
  let e = Z.theme ? Z.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  Z.theme = e ? "light" : "dark", document.documentElement.dataset.theme = Z.theme, Ot();
});
N("refresh").addEventListener("click", bt);
N("chart").addEventListener("pointerdown", (e) => {
  Z.cursorT = jn(e), ie && xt(N("chart"), ie, Z);
});
N("chart-cursor").addEventListener("input", () => {
  Z.cursorT = Zt(), ie && xt(N("chart"), ie, Z);
});
N("chart-cursor").addEventListener("keydown", (e) => {
  let t = Bn(e.key);
  t !== null && (e.preventDefault(), Z.cursorT = t, ie && xt(N("chart"), ie, Z));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (oe = "waiting", Le(), bt());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (oe = "waiting", Le(), bt());
});
window.addEventListener("offline", () => {
  oe = "offline", Nt = !0, Le();
});
window.addEventListener("online", bt);
var Gn = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== Gn && (Gn = t, ie && xt(N("chart"), ie, Z), mt());
}).observe(N("chart"));
async function pa() {
  let e = Jn(zn);
  if (e?.packet)
    try {
      Te = await Qn(e.packet), $t = e.packet, gt(e.greatestNow) && e.greatestNow >= Lt && e.greatestNow <= pt && (Pe = Math.max(Pe, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), gt(e.trustedNow) && e.trustedNow >= Lt && e.trustedNow <= pt && (Tt = { now: e.trustedNow, mono: performance.now() }), Be = e.ended === !0, oe = "waiting", Le();
    } catch {
      Te = null, $t = null;
    }
  await bt(), setInterval(() => {
    document.hidden || bt();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || Le();
  }, 3e4);
}
pa();
export {
  wn as buildWatchModel,
  Qn as verifyPublicPacket
};
