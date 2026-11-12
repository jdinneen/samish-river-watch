// site/js/season.js
var ea = "America/Los_Angeles";
var Rt = null;
function ta() {
  return Rt === null && (Rt = new Intl.DateTimeFormat("en-US", {
    timeZone: ea,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), Rt;
}
function Y(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of ta().formatToParts(new Date(e)))
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
function Jt(e) {
  let t = Y(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function Ge(e, t, n, a = 0, r = 0) {
  let i = Date.UTC(e, t - 1, n, a, r), o = i - Jt(i);
  return i - Jt(o);
}
function we(e) {
  let t = Y(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var na = 3600 * 1e3, aa = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function sa(e, t) {
  for (let n = 0; n < e.length; n++) {
    let a = e[n], r = n === e.length - 1;
    if (t >= a.lead_lo_h && (t < a.lead_hi_h || r && t === a.lead_hi_h)) return a;
  }
  return null;
}
function ra(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : aa).includes(Y(t).month);
}
var Ne = (e) => typeof e == "number" && Number.isFinite(e);
function ia(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!Ne(e.rise_floor_cfs) || !Ne(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!Ne(t.lead_lo_h) || !Ne(t.lead_hi_h) || !Ne(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !Ne(a.low_factor) || !Ne(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function Yt(e, t, n, a = t.t) {
  let r = [], i = [], o = ra(n, a);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: r, low: i, wetSeason: o };
  ia(n);
  let s = n.bins, c = s[s.length - 1].lead_hi_h;
  for (let u of e) {
    let l = (u.t - t.t) / na;
    if (l <= 0 || l > c) continue;
    let f = sa(s, l);
    if (!f) continue;
    let d, g;
    if (u.cfs >= n.storm_flow_cfs) {
      let h = u.cfs - t.cfs >= n.rise_floor_cfs ? f.rise : f.flat;
      d = u.cfs * h.high_factor, g = u.cfs * h.low_factor;
    } else
      d = u.cfs + f.add_cfs, g = u.cfs - f.add_cfs;
    r.push({ t: u.t, cfs: Math.max(d, u.cfs) }), i.push({ t: u.t, cfs: Math.max(0, Math.min(g, u.cfs)) });
  }
  return { high: r, low: i, wetSeason: o };
}

// site/js/watch-model.js
var Oe = 6e4, D = 60 * Oe, R = 24 * D, pe = 30 * Oe, Ve = 6 * D, Ie = 15 * Oe, oa = [2, 4, 6, 8, 12, 18, 24], F = (e) => typeof e == "number" && Number.isFinite(e), E = (e) => F(e) && Math.abs(e) <= 864e13, v = (e, t = {}) => ({ code: e, details: t }), Je = (e, t) => E(t) ? Math.max(0, e - t) : null, la = (e, t) => Object.prototype.hasOwnProperty.call(e, t), Tt = (e) => ({ t: e.t, cfs: e.cfs }), X = (e) => e && e.usable !== !1 && F(e.cfs) && e.cfs >= 0;
function Xe(e, t) {
  let n = (s) => {
    let [c, u = "0"] = String(s).toLowerCase().split("e"), l = c.includes(".") ? c.length - c.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(c.replace(".", "")), exponent: Number(u) - l };
  }, a = n(e), r = n(t), i = Math.min(a.exponent, r.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - r.coefficient * 10n ** BigInt(r.exponent - i)}e${i}`;
}
function Qt(e) {
  let t = F(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : la(e, "qualifier"), r = {
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
function tn(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !E(n.t)) continue;
    let a = Qt(n), r = t.get(n.t);
    r ? JSON.stringify(r) !== JSON.stringify(a) && t.set(n.t, Qt({
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
    let r = n + a >>> 1;
    e[r].t < t ? n = r + 1 : a = r;
  }
  return n;
}
function nn(e, t) {
  let n = Pe(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function Ze(e, t, n = Ie) {
  let { before: a, after: r } = nn(e, t), i = r?.t === t ? r : a && (!r || t - a.t <= r.t - t) ? a : r;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function _e(e) {
  if (!E(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return we(e);
}
function an(e, t) {
  let n = E(t) ? e[Pe(e, t)] : null, a = E(t) ? t - R : null, r = E(a) ? nn(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: v("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: E(t) ? _e(t) : null,
    distanceCfs: null,
    reached: null,
    ...r
  };
}
function sn(e, t) {
  let n = Xe(e.current.cfs, t.cfs), a = F(n) ? Xe(e.referenceCfs, n) : null;
  return !F(n) || !F(a) ? { ...e, comparison: t, reason: v("non_finite_arithmetic") } : {
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
function Ot(e, t) {
  let n = an(e, t);
  if (!X(n.current))
    return { ...n, reason: v(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = Ze(e, n.targetT);
  return a ? X(a) ? sn(n, a) : { ...n, comparison: a, reason: v("comparison_unusable") } : { ...n, reason: v("comparison_missing", { toleranceMs: Ie }) };
}
function It(e, t) {
  let n = an(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: E(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!X(a.current)) return { ...a, reason: v(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let r = Ze(e, a.targetT);
  if (!r) return { ...a, reason: v("window_start_missing", { toleranceMs: Ie }) };
  if (!X(r)) return { ...a, startSupport: r, reason: v("window_start_unusable") };
  let i = e.slice(Pe(e, a.targetT), Pe(e, t) + 1), o = i.find((l) => !X(l));
  if (o) return { ...a, startSupport: r, reason: v("window_unusable_observation", { t: o.t }) };
  let s = r.t < a.targetT ? [r, ...i] : i, c = 0;
  for (let l = 1; l < s.length; l++) c = Math.max(c, s[l].t - s[l - 1].t);
  if (c > pe) return {
    ...a,
    startSupport: r,
    maxGapMs: c,
    reason: v("observation_gap", { maxGapMs: c, allowedMs: pe })
  };
  let u = i.reduce((l, f) => !l || f.cfs < l.cfs ? f : l, null);
  return u ? {
    ...sn(a, u),
    minimum: u,
    startSupport: r,
    maxGapMs: c,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: r, maxGapMs: c, reason: v("window_empty") };
}
function $t(e, t, n = !1) {
  let a = [], r = [], i = [], o = [];
  for (let s of e) {
    if (!X(s) || n && s.cfs <= 0) {
      r.length && a.push(r), r = [], o.push({ t: s.t, reason: n && s.cfs <= 0 ? "non_positive_flow" : s.reason?.code ?? "unusable_observation" });
      continue;
    }
    let c = r[r.length - 1];
    c && s.t - c.t > t && (i.push({ startT: c.t, endT: s.t, reason: "unsupported_gap" }), a.push(r), r = []), r.push(Tt(s));
  }
  return r.length && a.push(r), { segments: a, gaps: i, exclusions: o };
}
function ce(e = "path_unavailable") {
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
function ye(e, t = {}) {
  let n = e.filter((r) => r.length).map((r) => r.map(Tt)), a = n.flat();
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
function rn(e, t = Ve, n = !1) {
  let a = $t(e, t, n);
  return ye(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function Re(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Pe(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let r = e[n - 1], i = (t - r.t) / (a.t - r.t), o = (1 - i) * r.cfs + i * a.cfs;
  return F(o) ? o : null;
}
function ut(e, t) {
  for (let n of e.segments) {
    let a = Re(n, t);
    if (a !== null) return a;
  }
  return null;
}
function Pt(e, t, n) {
  let a = [];
  for (let r of e.segments) {
    let i = Math.max(t, r[0].t), o = Math.min(n, r[r.length - 1].t);
    if (i > o) continue;
    let s = [
      { t: i, cfs: Re(r, i) },
      ...r.filter((c) => c.t > i && c.t < o),
      ...o > i ? [{ t: o, cfs: Re(r, o) }] : []
    ];
    a.push(s);
  }
  return ye(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function ct(e, t, n, a) {
  let r = Je(n, t);
  return {
    available: !!e?.data,
    dataT: E(t) ? t : null,
    ageMs: r,
    stale: r === null || r > a,
    lastAttemptAt: E(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: E(e?.lastSuccessAt) ? e.lastSuccessAt : null,
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
function ca(e, t, n, a) {
  let r = t ? t.t - 12 * D : null, i = {
    available: !1,
    reason: v("current_observation_unavailable"),
    current: t,
    comparison: null,
    targetT: r,
    elapsedMs: null,
    changeCfs: null,
    approximate: !1,
    asOf: !!(t && n - t.t > 30 * Oe)
  };
  if (!X(t)) return { ...i, reason: v(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let o = Ze(e, r);
  if (!o) return { ...i, reason: v("comparison_missing", { toleranceMs: Ie }) };
  let s = {
    ...i,
    comparison: o,
    elapsedMs: t.t - o.t,
    approximate: o.t !== r
  };
  if (!X(o)) return { ...s, reason: v("comparison_unusable") };
  if (n - t.t > 2 * D) return { ...s, reason: v("gauge_stale") };
  if (a?.error) return { ...s, reason: v("source_fetch_failed") };
  let c = e.slice(Pe(e, o.t), Pe(e, t.t) + 1), u = c.find((d) => !X(d));
  if (u) return { ...s, reason: v("unusable_observation", { t: u.t }) };
  let l = 0;
  for (let d = 1; d < c.length; d++) l = Math.max(l, c[d].t - c[d - 1].t);
  if (l > pe) return { ...s, reason: v("observation_gap", { maxGapMs: l, allowedMs: pe }) };
  let f = Xe(t.cfs, o.cfs);
  return F(f) ? { ...s, available: !0, reason: null, changeCfs: f } : { ...s, reason: v("non_finite_arithmetic") };
}
function ua(e, t, n, a) {
  let r = {
    available: !1,
    reason: v("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * Oe)
  };
  if (!X(t)) return { ...r, reason: v(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = Ze(e, t.t - D);
  if (!X(i)) return { ...r, comparison: i, reason: v("direction_comparison_unavailable") };
  let o = Xe(t.cfs, i.cfs), s = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), c = { ...r, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: s };
  if (!F(o)) return { ...c, changeCfs: null, reason: v("non_finite_arithmetic") };
  if (n - t.t > 2 * D) return { ...c, reason: v("gauge_stale") };
  if (a?.error) return { ...c, reason: v("source_fetch_failed") };
  let u = e.filter((l) => l.t >= i.t && l.t <= t.t);
  return u.some((l) => !X(l)) || u.some((l, f) => f && l.t - u[f - 1].t > pe) ? { ...c, reason: v("direction_observation_gap") } : {
    ...c,
    available: !0,
    reason: null,
    label: Math.abs(o) <= s ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function Kt(e, t, n) {
  let a = E(t) ? t - 7 * R : null, r = {
    windowStartT: a,
    windowEndT: E(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!E(t)) return r;
  for (let o of e) {
    if (o.t < a || o.t > t) continue;
    let s = n(e, o.t);
    s.available ? (r.evaluatedCount++, r.coverageStartT ?? (r.coverageStartT = o.t), r.coverageEndT = o.t, s.reached && (r.last = s)) : r.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= a && o.t <= t);
  return r.coverageComplete = r.coverageStartT !== null && r.coverageStartT <= a + Ie && r.coverageEndT >= t - pe && r.unavailableCount === 0 && !i.some((o, s) => s && o.t - i[s - 1].t > pe), r;
}
function en(e, t, n) {
  if (!E(t)) return { ...ce("observations_unavailable"), steps: [] };
  let a = [], r = [], i = [], o = [], s = null;
  for (let c of e) {
    if (c.t < t - 2 * R) continue;
    let u = n(e, c.t), l = u.comparison?.cfs;
    if (!u.available || !F(l + u.referenceCfs)) {
      o.length && a.push(o), o = [], s = null;
      continue;
    }
    if (s && c.t - s.t > pe && (i.push({ startT: s.t, endT: c.t, reason: "unsupported_gap" }), o.length && a.push(o), o = [], s = null), s) for (let d of Ut(s.t, c.t)) {
      let g = (d - s.t) / (c.t - s.t), h = (1 - g) * s.base + g * l, m = h + _e(d - 1), A = h + _e(d);
      o.push({ t: d, cfs: m }), a.push(o), o = [{ t: d, cfs: A }], r.push({ t: d, beforeCfs: m, afterCfs: A });
    }
    let f = { t: c.t, cfs: l + u.referenceCfs };
    o.at(-1)?.t !== c.t && o.push(f), s = { t: c.t, base: l };
  }
  return o.length && a.push(o), { ...ye(a, { gaps: i }), steps: r };
}
function yt(e, t = "forecast_unavailable") {
  let n = () => ce(t), a = () => ({ endpoint: ze(t), low: ze(t) });
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
      wetSeason: [1, 2, 3, 4, 10, 11, 12].includes(Y(e).month),
      maxLeadHours: 72,
      tableVersion: null,
      trainingCutoff: null
    }
  };
}
function ze(e = "path_unavailable", t = !1) {
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
function Ut(e, t) {
  if (!E(e) || !E(t) || e >= t) return [];
  let n = Y(e), a = Y(t), r = [];
  for (let i = n.year; i <= a.year; i++)
    for (let o of [3, 5, 11]) {
      let s = Ge(i, o, 1);
      s > e && s <= t && r.push(s);
    }
  return r.sort((i, o) => i - o);
}
function fa(e, t, n) {
  let a = Pt(e, n.t - 2 * R, n.t), r = Pt(t, n.t, t.endT ?? n.t), i = a.segments.map((o) => [...o]);
  for (let o of r.segments) {
    let s = o.filter((l) => l.t > n.t);
    if (!s.length) continue;
    let c = i[i.length - 1];
    o[0].t === n.t && c?.[c.length - 1].t === n.t ? c.push(...s) : i.push(s);
  }
  return ye(i);
}
function on(e, t) {
  let n = t - R, a = ut(e, t);
  if (a === null) return null;
  let r = ut(e, n);
  if (r === null) return null;
  let i = e.segments.find((s) => s[0].t <= n && s[s.length - 1].t >= t), o = null;
  if (i) {
    o = r;
    for (let s of i) s.t > n && s.t <= t && (o = Math.min(o, s.cfs));
    o = Math.min(o, a);
  }
  return { current: a, endpoint: r, low: o };
}
function da(e, t, n, a, r, i) {
  let o = ut(t, r);
  if (o === null) return null;
  let s = r - R;
  if (s > a.t) {
    let h = on(e, r);
    return h && h[i] !== null ? { current: o, base: h[i] } : null;
  }
  if (i === "endpoint") {
    let h = Ze(n, s);
    return X(h) ? { current: o, base: h.cfs, comparisonT: h.t } : null;
  }
  let c = Ze(n, s);
  if (!X(c)) return null;
  let u = n.filter((h) => h.t >= s && h.t <= a.t), l = c.t < s ? [c, ...u] : u;
  if (!u.length || u.some((h) => !X(h)) || l.some((h, m) => m && h.t - l[m - 1].t > pe)) return null;
  let f = t.segments.find((h) => h[0].t <= a.t && h[h.length - 1].t >= r);
  if (!f) return null;
  let d = o, g = null;
  for (let h of u) h.cfs <= d && (d = h.cfs, g = h.t);
  for (let h of f) h.t > a.t && h.t <= r && h.cfs < d && (d = h.cfs, g = null);
  return { current: o, base: d, minimumObservedT: g };
}
function ha(e, t, n, a, r) {
  let i = [], o = (s) => {
    s > n && s <= a && i.push(s);
  };
  if (r === "endpoint") {
    for (let s = 1; s < e.length; s++)
      o(Math.floor((e[s - 1].t + e[s].t) / 2) + R + 1);
    for (let s of e)
      o(s.t - Ie + R), o(s.t + Ie + R + 1);
  } else for (let s of e) o(s.t + R + 1);
  return i.filter((s) => s - R <= t.t);
}
function pa(e, t, n, a, r = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let s of e.points)
    for (let c of [s.t, s.t + R]) c >= t && c <= n && i.add(c);
  for (let s of Ut(t, n))
    i.add(s), s - 1 >= t && i.add(s - 1);
  for (let s of r)
    i.add(s), s - 1 >= t && i.add(s - 1);
  let o = [...i].sort((s, c) => s - c);
  for (let s = 1; s < o.length; s++) {
    let c = o[s - 1], u = o[s], l = (c + u) / 2, f = on(e, l);
    if (!f || a === "low" && f.low === null) {
      i.add(l);
      continue;
    }
    if (a !== "low") continue;
    let d = e.segments.find((m) => m[0].t <= l - R && m[m.length - 1].t >= l);
    if (!d) continue;
    let g = 1 / 0;
    for (let m of d) m.t > l - R && m.t < l && (g = Math.min(g, m.cfs));
    let h = [
      [Re(d, c - R), Re(d, u - R)],
      [Re(d, c), Re(d, u)],
      ...F(g) ? [[g, g]] : []
    ].filter((m) => m.every(F));
    for (let m = 0; m < h.length; m++) for (let A = m + 1; A < h.length; A++) {
      let w = h[m][0] - h[A][0], p = h[m][1] - h[A][1];
      if (!F(w) || !F(p) || w === p) continue;
      let y = w / (w - p);
      y > 0 && y < 1 && i.add(c + y * (u - c));
    }
  }
  return [...i].sort((s, c) => s - c);
}
function ga(e, t, n, a, r, i) {
  if (!t.available) return { reference: { ...ce(t.reason), steps: [] }, crossing: ze(t.reason, r) };
  let o = fa(e, t, n), s = t.endT, c = n.t, u = ha(i, n, c, s, a), l = pa(o, c, s, a, u), f = /* @__PURE__ */ new Set([...Ut(c, s), ...u]), d = [], g = [], h = [], m = ze("comparison_coverage_missing", r), A = 0, w = !1, p = null, y = (k) => {
    if (ut(t, k) === null) return null;
    let _ = da(o, t, i, n, k, a), M = _?.base;
    if (!_ || M === null || !F(M)) return null;
    let B = _e(k), q = M + B, G = Xe(_.current, M);
    return F(q) && F(G) ? {
      t: k,
      current: _.current,
      base: M,
      line: q,
      delta: G,
      threshold: B,
      comparisonT: _.comparisonT ?? null,
      minimumObservedT: _.minimumObservedT ?? null
    } : null;
  };
  for (let k of l) {
    let _ = y(k);
    if (!_) {
      m.t === null && (w = !0), h.length && d.push(h), h = [], p = null;
      continue;
    }
    if (A++, f.has(k)) {
      let M = y(k - 1), B = _e(k - 1) !== _.threshold, q = M && M.base !== _.base && (a === "endpoint" ? M.comparisonT !== _.comparisonT : M.minimumObservedT !== null && M.minimumObservedT + R + 1 === k);
      if (M && h.length && (B || q)) {
        let G = q ? M.line : _.base + _e(k - 1);
        h.push({ t: k, cfs: G }), d.push(h), h = [], G !== _.line && g.push({ t: k, beforeCfs: G, afterCfs: _.line });
      }
    }
    if (h.push({ t: k, cfs: _.line }), m.t === null && _.delta >= _.threshold && !w) {
      let M = _;
      if (p && p.delta < p.threshold && !f.has(k) && _e(p.t) === _.threshold) {
        let B = p.t, q = k;
        for (; q - B > 1; ) {
          let G = Math.floor((q + B) / 2), Me = y(G);
          !Me || Me.delta < Me.threshold ? B = G : q = G;
        }
        M = y(q) ?? _;
      }
      m = {
        available: !0,
        reason: null,
        t: M.t,
        currentCfs: M.current,
        comparisonCfs: M.base,
        changeCfs: M.delta,
        referenceCfs: M.threshold,
        alreadyReached: M.t === n.t,
        largeAdjustment: r
      };
    }
    p = _;
  }
  h.length && d.push(h), m.t === null && A && !w ? m = { ...ze(null, r), available: !0, reason: null } : m.t === null && w && (m = ze("comparison_coverage_missing", r));
  let N = d.map((k) => {
    let _ = [];
    for (let M of k)
      _.length >= 2 && _.at(-2).cfs === _.at(-1).cfs && _.at(-1).cfs === M.cfs && _.pop(), _.push(M);
    return _;
  });
  return { reference: { ...ye(N), steps: g }, crossing: m };
}
function ma(e, t) {
  let n = [e, t];
  for (let r = e + Oe; r < t; r += Oe) n.push(r);
  let a = n.map((r) => {
    let i = Y(r);
    return i.hour >= 8 && (i.hour < 17 || i.hour === 17 && i.minute === 0 && i.second === 0);
  });
  return a.every(Boolean) ? "inside_08_17" : a.every((r) => !r) ? "outside_08_17" : "spans_both";
}
function ba(e, t) {
  let n = [];
  for (let a of e.segments) {
    let r = 0;
    for (; r < a.length; ) {
      let i = r;
      for (; i + 1 < a.length && a[i + 1].cfs === a[r].cfs; ) i++;
      let o = a[r - 1], s = a[i + 1];
      if (o && s && o.cfs < a[r].cfs && s.cfs < a[i].cfs && a[i].t > t) {
        let c = r - 1;
        for (; c > 0 && a[c - 1].cfs <= a[c].cfs; ) c--;
        let u = Tt(a[c]);
        n.push({
          startT: a[r].t,
          endT: a[i].t,
          cfs: a[r].cfs,
          precedingLow: u,
          riseCfs: a[r].cfs - u.cfs,
          bracketStartT: o.t,
          bracketEndT: s.t,
          clockRange: ma(o.t, s.t)
        });
      }
      r = i + 1;
    }
  }
  return n.sort((a, r) => a.startT - r.startT);
}
function va(e, t, n, a, r, i, o) {
  let s = yt(e), c = t?.data;
  if (!c) return s;
  let u = c.issuedT;
  s.issuedT = E(u) ? u : null, s.issueAgeMs = Je(e, u), s.older = s.issueAgeMs !== null && s.issueAgeMs > 12 * D, s.cases.tableVersion = o?.version ?? null, s.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let l = (p) => ({
    ...yt(e, p),
    issuedT: s.issuedT,
    issueAgeMs: s.issueAgeMs,
    older: s.older,
    cases: { ...s.cases, reason: v(p) }
  });
  if (!E(u)) return l("forecast_issue_missing");
  if (u > e) return l("forecast_issue_future");
  if (e - u > 48 * D) return l("forecast_issue_too_old");
  let f = tn(c.points).filter((p) => p.t <= e + 10 * R), d = rn(f, Ve);
  if (!d.segments.some((p) => p[0].t <= e + Ve && p[p.length - 1].t >= e + R))
    return l("forecast_next_day_coverage_missing");
  if (s.available = d.available, s.reason = d.reason, s.raw = d, s.crests = ba(d, i?.t ?? e), s.nextCrest = s.crests[0] ?? null, s.laterHigherCrests = s.nextCrest ? s.crests.slice(1).filter((p) => p.cfs > s.nextCrest.cfs) : [], !X(i)) {
    let y = yt(e, i ? "current_observation_unusable" : "current_observation_unavailable");
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
  let g = ut(d, i.t);
  if (g === null) {
    let p = yt(e, "forecast_alignment_unsupported");
    return {
      ...s,
      shifted: p.shifted,
      high: p.high,
      low: p.low,
      references: p.references,
      crossings: p.crossings,
      higherLater: p.higherLater,
      cases: { ...s.cases, reason: p.cases.reason }
    };
  }
  let h = Xe(i.cfs, g);
  if (!F(h)) return l("non_finite_arithmetic");
  s.offsetCfs = h, s.largeAdjustment = Math.abs(h) > Math.max(10, 0.1 * i.cfs);
  let m = [], A = [];
  for (let p of d.segments) {
    let y = p.map((k) => ({ t: k.t, cfs: k.cfs + h })), N = $t(y, Ve, !0);
    m.push(...N.segments), A.push(...N.exclusions);
  }
  s.shifted = Pt(ye(m, { gaps: d.gaps, exclusions: A }), i.t, i.t + 72 * D), s.shifted.points.some((p) => p.t > i.t) || (s.shifted = { ...ce("non_positive_shifted_flow"), exclusions: A, gaps: d.gaps }), s.freshContext = !s.older && !t.error && !n?.error && e - i.t <= 2 * D, s.higherLater = {
    available: !1,
    reason: v("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: s.largeAdjustment
  };
  let w = s.shifted.points.filter((p) => p.t > i.t);
  if (s.freshContext && w.length) {
    let p = w.reduce((y, N) => N.cfs > y.cfs ? N : y);
    s.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: p.cfs > i.cfs,
      peakCfs: p.cfs,
      peakT: p.t,
      largeAdjustment: s.largeAdjustment
    };
  }
  if (s.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(Y(e).month), !s.cases.wetSeason)
    s.cases.reason = v("historical_cases_off_season"), s.high = ce(s.cases.reason), s.low = ce(s.cases.reason);
  else if (!o || o.version !== 3 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    s.cases.reason = v("historical_table_unavailable"), s.high = ce(s.cases.reason), s.low = ce(s.cases.reason);
  else
    try {
      let p = [], y = [], N = [], k = [];
      for (let _ of s.shifted.segments) {
        let M = Yt(_, i, o, e), B = _[0]?.t === i.t && i.cfs > 0 ? [Tt(i)] : [], q = $t([...B, ...M.high], Ve, !0), G = $t([...B, ...M.low], Ve, !0);
        p.push(...q.segments), y.push(...G.segments), N.push(...q.exclusions), k.push(...G.exclusions);
      }
      s.high = ye(p, { gaps: s.shifted.gaps, exclusions: N }), s.low = ye(y, { gaps: s.shifted.gaps, exclusions: k });
      for (let _ of ["high", "low"]) s[_].points.some((M) => M.t > i.t) || (s[_] = { ...ce("historical_case_values_unsupported"), exclusions: s[_].exclusions, gaps: s[_].gaps });
      s.cases.available = s.high.available || s.low.available, s.cases.reason = s.cases.available ? null : v("historical_case_values_unsupported");
    } catch {
      s.cases.reason = v("historical_table_invalid"), s.high = ce(s.cases.reason), s.low = ce(s.cases.reason);
    }
  for (let p of ["shifted", "high", "low"])
    for (let y of ["endpoint", "low"]) {
      let N = ga(r, s[p], i, y, s.largeAdjustment, a);
      s.crossings[p][y] = N.crossing, p === "shifted" && (s.references[y] = N.reference);
    }
  return s;
}
function wa(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
  for (let l of n?.conflicts ?? []) E(l) && l <= e && l % D === 0 && r.add(l);
  for (let l of n?.hours ?? [])
    if (!(!E(l.endT) || l.endT > e || l.endT % D !== 0)) {
      if (!F(l.mm) || l.mm < 0) {
        r.add(l.endT);
        continue;
      }
      a.has(l.endT) && a.get(l.endT) !== l.mm ? r.add(l.endT) : a.set(l.endT, l.mm);
    }
  let i = [...a.keys(), ...r], o = i.length ? Math.max(...i) : null, s = Je(e, o), c = oa.map((l) => {
    let f = {
      hours: l,
      available: !1,
      reason: v("radar_unavailable"),
      startT: o === null ? null : o - l * D,
      endT: o,
      ageMs: s,
      mm: null,
      inches: null
    };
    if (o === null) return f;
    let d = 0;
    for (let g = 0; g < l; g++) {
      let h = o - g * D;
      if (r.has(h)) return { ...f, reason: v("radar_conflicting_hour", { endT: h }) };
      if (!a.has(h)) return { ...f, reason: v("radar_missing_hour", { endT: h }) };
      d += a.get(h);
    }
    return F(d) ? { ...f, available: !0, reason: null, mm: d, inches: d / 25.4 } : { ...f, reason: v("non_finite_arithmetic") };
  }), u = c.some((l) => l.available);
  return {
    available: u,
    reason: u ? null : v("radar_windows_unavailable"),
    endT: o,
    generatedT: E(n?.generatedT) ? n.generatedT : null,
    ageMs: s,
    historical: s !== null && s > 2 * D,
    stale: s === null || s > 3 * D,
    windows: c
  };
}
function _a(e, t) {
  let n = t?.data, a = Je(e, n?.updatedT), r = {
    available: !1,
    reason: v("grid_forecast_unavailable"),
    startT: e,
    endT: e + R,
    updatedT: E(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * D,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return r;
  if (!E(n.updatedT) || n.updatedT > e) return { ...r, reason: v("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((u) => E(u.startT) && E(u.endT) && u.endT > e && u.startT < e + R).sort((u, l) => u.startT - l.startT || u.endT - l.endT), o = e, s = 0, c = !1;
  for (let u of i) {
    if (u.startT >= u.endT || !F(u.mm) || u.mm < 0) return { ...r, reason: v("grid_interval_invalid") };
    let l = Math.max(e, u.startT), f = Math.min(e + R, u.endT);
    if (l < o) return { ...r, reason: v("grid_interval_overlap", { t: l }) };
    if (l > o) return { ...r, reason: v("grid_interval_gap", { startT: o, endT: l }) };
    let d = (f - l) / (u.endT - u.startT);
    s += u.mm * d, c || (c = d !== 1), o = f;
  }
  return o < e + R ? { ...r, reason: v("grid_interval_gap", { startT: o, endT: e + R }) } : F(s) ? { ...r, available: !0, reason: null, mm: s, inches: s / 25.4, prorated: c } : { ...r, reason: v("non_finite_arithmetic") };
}
function ya(e, t) {
  let n = t?.data, a = Je(e, t?.lastSuccessAt), r = {
    available: !1,
    reason: v("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * D,
    startT: e,
    endT: e + 2 * R,
    events: []
  };
  if (!n) return r;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...r, reason: v("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let c of n.points ?? []) {
    if (!E(c.t) || c.t < e || c.t > e + 2 * R || !F(c.ft) || !["H", "L"].includes(c.type)) continue;
    let u = i.get(c.t);
    u && (u.ft !== c.ft || u.type !== c.type) && o.add(c.t), i.set(c.t, { t: c.t, ft: c.ft, type: c.type });
  }
  let s = [...i.values()].filter((c) => !o.has(c.t)).sort((c, u) => c.t - u.t);
  return { ...r, available: s.length > 0, reason: s.length ? null : v("tide_events_unavailable"), events: s };
}
function ln({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!E(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, r = tn(a?.points).filter((m) => m.t <= e), i = r[r.length - 1] ?? null, o = [...r].reverse().find((m) => X(m)) ?? null, s = rn(r, pe), c = i?.t ?? null, u = ct(t.gauge, c, e, 2 * D), l = {
    latest: i,
    lastNumericObservation: o,
    points: r,
    segments: s.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: Je(e, c),
    stale: u.stale,
    referenceCfs: E(c) ? _e(c) : null,
    endpoint: Ot(r, c),
    low: It(r, c),
    references: { endpoint: en(r, c, Ot), low: en(r, c, It) },
    direction: ua(r, i, e, t.gauge),
    twelveHourChange: ca(r, i, e, t.gauge),
    history: { endpoint: Kt(r, c, Ot), low: Kt(r, c, It) }
  }, f = va(e, t.noaa, t.gauge, r, s, i, n), d = wa(e, t.radar), g = _a(e, t.grid), h = ya(e, t.tides);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: u,
      noaa: ct(t.noaa, f.issuedT, e, 12 * D),
      radar: ct(t.radar, d.endT, e, 3 * D),
      grid: ct(t.grid, g.updatedT, e, 12 * D),
      tides: ct(t.tides, t.tides?.lastSuccessAt, e, 36 * D)
    },
    gauge: l,
    forecast: f,
    rain: { radar: d, grid: g },
    tides: h
  };
}

// site/js/watch-render.js
function un(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var $ = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), re = (e) => typeof e == "number" && Number.isFinite(e);
function fn(e, t = !1) {
  if (!re(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function Qe(e, t = !1) {
  if (!re(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function Z(e, t = !1) {
  if (!re(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
function Q(e, t = !1) {
  return re(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function ne(e) {
  if (!re(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function cn(e) {
  return re(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var dn = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function Ke(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(Ke).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return dn[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(dn, {
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
function Ye(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var $a = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, hn = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, $e = (e) => `<time datetime="${re(e) ? new Date(e).toISOString() : ""}">${$(Q(e, !0))}</time>`;
var Ta = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function xa(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return Ke("public_time_uncertain");
  let a = Ke(t);
  return e.timeUncertain && Ta.includes(n) ? `At the snapshot save time: ${a}` : a;
}
function pn(e, t) {
  let n = e.forecast || {}, a = (h) => xa(e, h);
  Ye("forecast-age", n.issuedT ? `Issued ${$e(n.issuedT)} \xB7 ${$(e.timeUncertain ? "age unknown" : ne(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${$(a(n.reason))}` : ""}` : `Forecast unavailable. ${$(a(n.reason))}`);
  let r = [];
  e.sources?.noaa?.error && r.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && r.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${Qe(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? r.push({ text: a(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && r.push(`Adjusted forecast unavailable. ${a(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && r.push(`Historical cases unavailable. ${a(n.cases.reason)}`), Ye("forecast-problems", r.map((h) => `<p${typeof h == "object" && h.neutral ? ' class="neutral"' : ""}>${$(typeof h == "object" ? h.text : h)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (i && r.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let c = n.crossings?.shifted?.[t.reference], u = c?.available ? re(c.t) ? `The adjusted forecast ${c.alreadyReached ? "already meets" : "first reaches"} the reference at ${Q(c.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${a(c?.reason)}`, l = re(n.offsetCfs) ? `Adjustment to the gauge reading: ${Qe(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", f = Date.parse(n.cases?.trainingCutoff ?? ""), d = re(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${fn(n.cases.tableVersion)}${re(f) ? `; training cutoff ${$e(f)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  Ye("forecast-details", hn("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier measurements or the adjusted forecast; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${re(n.raw?.endT) ? `; available through ${$e(n.raw.endT)}` : ""}.</p><p>${$(l)} ${n.available === !1 ? `The issued forecast is unavailable. ${$(a(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${$(u)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. Cases extend up to 72 hours from the latest reading in October\u2013April. A low case stops when its historical subtraction reaches zero; this does not predict a dry river. Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.</p>${d}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function gn(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${Q(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : ne(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", r = t.windows || [2, 4, 6, 8, 12, 18, 24].map((s) => ({ hours: s, available: !1 })), i = [...new Set(r.filter((s) => !s.available).map((s) => Ke(s.reason || t.reason)))], o = hn("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over the drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. Radar cannot confirm whether rain has stopped upriver.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  Ye("rain", `<div class="section-heading"><h2>Rain</h2>${$a("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${$(a)}</p><div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${r.map((s) => `<div class="rain-total" aria-label="${s.hours}-hour total ending ${$(Q(s.endT ?? t.endT, !0))}, ${$(e.timeUncertain ? "age unknown" : ne(s.ageMs ?? t.ageMs) + " old")}"><span>${s.hours} hours</span><strong>${s.available ? cn(s.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map($).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${cn(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${$(Ke(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${$e(n.updatedT)} \xB7 ${$(e.timeUncertain ? "age unknown" : ne(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function mn(e) {
  let t = e.tides || {};
  Ye("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + $(ne(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${$e(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${fn(n.ft)}</td></tr>`).join("")}</tbody></table>` : `<p>${$(Ke(t.reason))}</p>`}</div>`);
}
function bn(e, t, n) {
  Ye("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", tides: "NOAA Bellingham tide predictions" }).map(([r, i]) => {
    let o = t.sources?.[r] || {}, s = n?.sources?.[r] || {};
    return `<div class="source-row"><strong>${$(i)}</strong>${r === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>Data time: ${$e(o.dataT)} \xB7 ${$(t.timeUncertain ? "age unknown" : ne(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${$e(s.lastSuccessAt ?? o.lastSuccessAt)}.${s.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot saved ${$e(e.createdAt)}. This save time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}

// site/js/watch-crest-settings.js
var ft = Object.freeze({ releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1, floorCfs: 1, fraction: 62e-4, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), Ht = Object.freeze({ mode: "A", heading: "Observed high \u2014 crest not confirmed", automaticDirectionLabelsEnabled: !1, rejectedDesignSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), Ma = Object.freeze({ mode: "B", trendMedianPoints: 5, trendWindowMinutes: 60, comparisonMinutes: 60, nativeIntervalMinutes: 15, persistencePoints: 5, floorCfs: 1, fraction: 62e-4, designSha256: "7e1abe8dc96061a37c4059c9b13ab4cecc3a12c4a332160e8f29822427ef1f98" }), vn = Object.freeze({ floorCfs: 1, fraction: 62e-4, minimumHoursBelowHigh: 6, minimumPeakAgeHours: 12, firstConfirmationDeadlineHours: 18, minimumHistoryBeforePeakHours: 12, minimumDropFraction: 0.05, minimumDropCfs: 2, trendMedianPoints: 5, trendWindowMinutes: 60, episodeTurnFraction: 0.05, episodeTurnCfs: 2, capturedRiseFraction: 0.01, capturedRiseCfs: 2 }), ms = Object.freeze({
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
}), dt = (e, t = ft) => Math.max(t.floorCfs, e * t.fraction);

// site/js/watch-preview.js
var W = 36e5, Ft = 15 * 6e4, K = Number.isFinite;
function ae(e, t) {
  let n = (s) => {
    let [c, u = "0"] = String(s).toLowerCase().split("e"), l = c.includes(".") ? c.length - c.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(c.replace(".", "")), exponent: Number(u) - l };
  }, a = n(e), r = n(t), i = Math.min(a.exponent, r.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - r.coefficient * 10n ** BigInt(r.exponent - i)}e${i}`;
}
var J = (e) => `<time datetime="${new Date(e).toISOString()}">${$(Q(e, !0))}</time>`, ht = (e) => {
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = t % 60;
  return n ? a ? `${n}h ${a}m` : `${n} ${n === 1 ? "hour" : "hours"}` : `${a} ${a === 1 ? "minute" : "minutes"}`;
}, Ue = (e, t) => {
  document.getElementById(e).innerHTML = t;
}, _n = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}">\u24D8</button>`, yn = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, Aa = `This page does not make a crest call. It shows the observed high and the time since it; growers and sampling staff judge whether the river has crested. Automatic crest confirmation is withheld because the tested rules failed real-storm replay. This page shows the actual observed high, its reading time and age, the drop since that high, and a separate clock for time without a material renewed rise. That clock uses the middle value of five actual 15-minute readings spanning the preceding hour; the displayed high and its time remain actual readings. A rebound in this smoothed trend exceeding the larger of ${ft.floorCfs} cfs or ${+(ft.fraction * 100).toFixed(2)}% of the actual high resets the clock to the last increasing trend reading in that upswing. Flat readings and smaller flickers are allowed: this does not mean continuous falling. This allowance was measured from returning fluctuations in November\u2013December 2025 readings, not chosen as a closure or sampling rule. Missing quarter-hours or ineligible readings break the trend clock, with no interpolation.`;
function ka(e, t) {
  let n = t.trendMedianPoints, a = t.trendWindowMinutes * 6e4;
  if (n !== 5 || a !== W) throw new Error("Unsupported crest trend window");
  return e.map((r, i) => {
    let o = e.slice(Math.max(0, i - n + 1), i + 1), s = o.length === n && o.every((c, u) => c.eligible === !0 && c.usable === !0 && K(c.cfs) && c.t === r.t - a + u * Ft);
    return { t: r.t, cfs: s ? o.map((c) => c.cfs).sort((c, u) => c - u)[2] : null, eligible: s, usable: s };
  });
}
function wn(e, t, n) {
  let a = null, r = null, i = t.t, o = !1, s = dt(t.cfs, n);
  for (let c of ka(e, n))
    if (!(c.t < t.t)) {
      if (!c.eligible) {
        a = null, r = null, o = !1, i = c.t;
        continue;
      }
      if (!a) {
        a = c, i = Math.max(i, c.t), o = !0;
        continue;
      }
      r ? c.cfs > r.cfs ? (i = c.t, r = c) : r.cfs - c.cfs > s && (r = null, a = c) : (c.cfs < a.cfs && (a = c), c.cfs - a.cfs > s && (i = c.t, r = c));
    }
  return { lastResetT: i, supported: o };
}
function Sa(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  return { ...$n(e, { checking: t, suppressed: n, settings: ft }, !1, !0), mode: "observed-facts-only", releaseMode: "observed-facts-only", automaticConfirmationEnabled: !1 };
}
function Ca(e, t = {}) {
  let n = Sa(e, t);
  return { ...n, state: n.state === "checking" || n.state === "unavailable" ? n.state : "observed_high", label: Ht.heading, labelCategory: "neutral", labelMode: "removed" };
}
function $n(e, { checking: t = !1, suppressed: n = !1, settings: a = vn } = {}, r, i = !1) {
  let o = e.gauge || {}, s = o.latest, c = (x) => ({ state: t ? "checking" : "unavailable", label: t ? "Checking river readings\u2026" : "Crest status unavailable", why: x, peak: null, high: null, fallMs: null });
  if (t) return c("Verification is in progress.");
  if (n || e.timeUncertain) return c("A current snapshot and current time must be verified first.");
  if (!s || !K(s.cfs) || s.usable !== !0 || s.eligible !== !0) return c("The newest gauge reading is missing or its quality does not support a crest check.");
  if (o.ageMs > W || e.sources?.gauge?.error) return c("The newest eligible reading must be no more than one hour old, with a successful latest retrieval.");
  let u = o.points.filter((x) => x.t >= s.t - 48 * W && x.t <= s.t), l = [], f = null;
  for (let x of u) x.eligible === !0 && x.usable === !0 && K(x.cfs) && (!f || x.cfs >= f.cfs) && (f = x);
  for (let x = u.length - 1; x >= 0; x--) {
    let T = u[x];
    if (T.eligible !== !0 || T.usable !== !0 || !K(T.cfs) || l.length && l[0].t - T.t > 2 * Ft) break;
    l.unshift(T);
  }
  if (l.length < 5 || s.t - l[0].t < W)
    return i && f ? { state: "possible", label: "Crest not confirmed \u2014 short reading history", high: f, peak: f, candidateHigh: null, drop: ae(f.cfs, s.cfs), highDropCfs: ae(f.cfs, s.cfs), sincePeakMs: s.t - f.t, sinceHighMs: s.t - f.t, fallMs: null, trendSupported: !1, evidenceStartT: l[0]?.t ?? s.t, hadGap: l[0]?.t > u[0]?.t, bracketed: !1 } : c("At least an hour of uninterrupted eligible observations is needed.");
  let d = l[0], g = d, h = d, m = d.t, A = null, w = !1, p = !1, y = d, N = null;
  for (let x = 1; x < l.length; x++) {
    let T = l[x], he = dt(d.cfs, a), Be = Math.max(a.episodeTurnCfs ?? 2, d.cfs * (a.episodeTurnFraction ?? 0.05));
    if (T.cfs >= d.cfs) {
      T.cfs - g.cfs > he && d.cfs - g.cfs > he && (p = !0), w || (w = ae(T.cfs, h.cfs) > Math.max(a.capturedRiseCfs, T.cfs * a.capturedRiseFraction)), d = T, g = T, m = T.t, y = T, N = null;
      continue;
    }
    T.cfs < g.cfs && (g = T);
    let We = T.cfs - g.cfs;
    N ? T.cfs > N.cfs ? (m = T.t, N = T) : N.cfs - T.cfs > he && (N = null, y = T) : (T.cfs < y.cfs && (y = T), T.cfs - y.cfs > he && (m = T.t, N = T, p = !0)), d.cfs - g.cfs >= Be && We >= Be && (A = d, h = g, d = T, g = T, w = !0, m = T.t, y = T, N = null);
  }
  let k = a.trendMedianPoints ? wn(l, d, a) : { lastResetT: m, supported: !0 }, _ = dt(d.cfs, a), M = d.cfs - s.cfs, B = s.t - Math.max(d.t, k.lastResetT), q = s.t - d.t, G = l[0].t, Me = G > u[0].t, Fe = l.reduce((x, T) => Math.abs(T.t - (s.t - W)) < Math.abs(x.t - (s.t - W)) ? T : x, l[0]), vt = l.reduce((x, T) => Math.abs(T.t - (s.t - 2 * W)) < Math.abs(x.t - (s.t - 2 * W)) ? T : x, l[0]), Ae = ae(s.cfs, vt.cfs) > 0, wt = l.filter((x) => x.t >= s.t - 6 * W).reduce((x, T) => Math.min(x, T.cfs), s.cfs), je = ae(s.cfs, Fe.cfs) > _ || M <= _ && s.t - d.t < W && ae(s.cfs, wt) > _ && Ae, P = a.minimumHistoryBeforePeakHours ?? 0, me = d.t - G, it = me >= P * W, ot = P > 0 && !it && q > (48 - P) * W, St = it ? null : ot ? `The 48-hour window no longer includes ${P} hours before this high. Its time and flow remain shown; the earlier crest check has expired.` : `At least ${P} hours of uninterrupted eligible readings before this high are needed to establish a crest.`, lt = ae(s.cfs, g.cfs) <= _, ve = { high: f, earlierPeak: A, peak: d, fallMs: i && !k.supported ? null : B, sincePeakMs: q, sinceHighMs: s.t - f.t, highDropCfs: ae(f.cfs, s.cfs), drop: M, bracketed: w, evidenceStartT: G, hadGap: Me, trendSupported: k.supported, peakContextMs: me, contextExpired: ot, contextWhy: St, nearPostPeakLow: lt }, de = ae(s.cfs, g.cfs) > _ && Ae;
  if (i) {
    let x = wn(l, f, a), T = { ...ve, peak: f, candidateHigh: d, drop: ae(f.cfs, s.cfs), sincePeakMs: s.t - f.t, fallMs: x.supported ? s.t - Math.max(f.t, x.lastResetT) : null, trendSupported: x.supported, contextExpired: !1, contextWhy: null }, he = s.cfs - g.cfs > _ && (je || de), Be = M <= _ && je, We = he ? "rising_again" : M <= _ ? Be ? A || p ? "rising_again" : "rising" : "level" : lt && ae(s.cfs, Fe.cfs) < 0 && !Ae ? "falling_unconfirmed" : "possible";
    return { ...T, state: We, label: { rising: "Rising \u2014 crest not confirmed", rising_again: "Rising again \u2014 crest not confirmed", level: "Little change \u2014 crest not confirmed", falling_unconfirmed: "Falling \u2014 crest not confirmed", possible: "Possible crest \u2014 not confirmed" }[We] };
  }
  if (s.cfs - g.cfs > _ && (je || de)) return { ...ve, state: "rising_again", label: "Rising again \u2014 crest not confirmed", peak: null };
  if (M <= _) {
    let x = je;
    return { ...ve, state: x ? A || p ? "rising_again" : "rising" : "level", label: x ? A || p ? "Rising again \u2014 crest not confirmed" : "Rising \u2014 crest not confirmed" : "Little change \u2014 crest not confirmed", peak: null, fallMs: 0 };
  }
  if (!w || !it) return { ...ve, bracketed: !1, state: "falling_unbracketed", label: ot ? "Falling \u2014 earlier crest check expired" : "Falling \u2014 crest not established" };
  let _t = (a.minimumPeakAgeHours ?? 0) * W, ke = (a.firstConfirmationDeadlineHours ?? 1 / 0) * W, Se = !(ae(s.cfs, Fe.cfs) > 0) && lt && k.supported && q >= _t && B >= a.minimumHoursBelowHigh * W && M >= Math.max(a.minimumDropCfs, d.cfs * a.minimumDropFraction), Ce = null;
  if (Se && q > ke && (Se = !1, r))
    for (let x of l) {
      if (x.t < d.t + _t || x.t > d.t + ke) continue;
      let T = $n({ ...e, gauge: { ...o, points: u.filter((he) => he.t <= x.t), latest: x, ageMs: 0 } }, { settings: a }, !1);
      if (T.state === "confirmed" && T.peak.t === d.t) {
        Se = !0, Ce = x.t;
        break;
      }
    }
  return { ...ve, evidenceEarnedT: Ce, state: Se ? "confirmed" : "possible", label: Se ? "Observed crest so far" : "Possible crest \u2014 not confirmed" };
}
function Ea(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  if (t) {
    Ue("current", '<div class="flow-row"><h2>24-hour rise</h2><p class="checking-readings" role="status">Checking river readings\u2026</p><p class="meta">Verifying the latest snapshot and reading ages.</p></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>'), document.getElementById("current").setAttribute("aria-busy", "true"), Ue("number-strip", "<span>Checking river readings\u2026</span>");
    return;
  }
  let a = e.gauge, r = a.endpoint, i = a.latest, o = r.available, s = o && r.elapsedMs === 24 * W, c = o ? Z(r.changeCfs, !0) : "Unavailable", u = o ? r.changeCfs < 0 ? "No net 24-hour rise" : r.distanceCfs === 0 ? `At the ${Z(r.referenceCfs)} cfs rise trigger` : `${Math.abs(r.distanceCfs) < 0.5 ? "Less than 1" : Z(Math.abs(r.distanceCfs))} cfs ${r.distanceCfs > 0 ? "below" : "above"} the ${Z(r.referenceCfs)} cfs rise trigger` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", l = e.timeUncertain ? "age unknown" : `${ne(a.ageMs)} old${a.stale ? " \xB7 STALE" : ""}`, f = K(i?.cfs) ? `${Z(i.cfs)} cfs` : "unavailable", d = n || a.stale || e.timeUncertain, g = o ? `${c} cfs ${d ? "over the 24 hours to this reading" : s ? "in the last 24 hours" : "over about 24 hours"}` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", h = o && r.changeCfs < 0 ? " (a fall; no net rise)" : "", m = a.history?.endpoint?.last, A = o && r.distanceCfs > 0 && m ? `<p class="meta rise-history-note">Rise reference last met ${J(m.current?.t ?? m.windowEndT)}. Closure status is decided by health authorities.</p>` : "";
  Ue("current", `<div class="flow-row"><div class="section-heading flow-heading"><h2>24-hour rise</h2>${_n("flow", "About flow readings")}</div><div class="rise-headline"><strong class="distance-headline">${$(g + h)}</strong><b class="rise-support">${$(u)}</b></div>${A}<div class="preview-flow"><strong class="actual-flow flow-number">Actual flow: ${$(f)} \xB7 ${$(l)}</strong>${i ? J(i.t) : ""}</div></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>${yn("flow", "How flow comparisons work", `<p>Flow is water passing the gauge, in cubic feet per second (cfs). A rise of 400 cfs means an increase of 400, not a river flow of 400.</p><p>The 24-hour rise compares the newest actual reading with the actual reading nearest 24 elapsed hours earlier, within 15 minutes. ${o ? `Comparison: ${Z(r.comparison.cfs)} cfs at ${J(r.comparison.t)}; ${ne(r.elapsedMs)} earlier.` : ""} It is not a calendar day. Missing data are not filled.</p><p>Rise trigger shown: 400 cfs November\u2013February, 200 March\u2013April, 100 May\u2013October. Confirm these seasons with the health department.</p><p>Rise from the 24-hour low is ${a.low.available ? Z(a.low.changeCfs, !0) + " cfs" : "unavailable"}. It differs from comparing with the reading 24 hours earlier.</p><p>Gauge quality: ${$(i?.qualityLabel || "unknown")}. Provisional readings are not yet finalized and may be revised.</p>`)}`), document.getElementById("current").setAttribute("aria-busy", String(t)), Ue("number-strip", `<span>Flow (cfs) <strong>${K(i?.cfs) ? Z(i.cfs) : "\u2014"}</strong><small>${$(l)}</small></span><span>24h change <strong>${o ? c : "\u2014"}</strong></span><span>Low rise <strong>${a.low.available ? Z(a.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function La(e) {
  let t = e.peak ?? e.high, n = e.peak ? e.sincePeakMs : e.sinceHighMs, a = t ? `Observed high: <strong>${Z(t.cfs)} cfs</strong> \xB7 ${J(t.t)}<br>${$(ht(n))} before latest reading${e.peak ? `; now ${Z(e.drop)} cfs lower` : ""}.` : $(e.why || ""), r = e.peak && e.drop > dt(e.peak.cfs) ? `<p class="crest-fact">${e.trendSupported && K(e.fallMs) ? `<strong>No new rise for ${$(ht(e.fallMs))}</strong> <span class="clock-qualifier">\xB7 small fluctuations ignored</span>.` : "Renewed-rise clock unavailable: a complete hour of eligible readings is needed."}</p>` : "", i = e.peak && e.high?.cfs > e.peak.cfs ? `<p class="crest-fact">Earlier higher reading: ${Z(e.high.cfs)} cfs \xB7 ${J(e.high.t)} (${$(ht(e.sinceHighMs))} before latest reading).</p>` : "", o = e.hadGap ? `<p class="crest-fact">Continuous evidence starts ${J(e.evidenceStartT)} after a gap or unusable reading.</p>` : "";
  Ue("monitor", `<div class="crest-top"><h2 data-crest-state="${e.state}" data-crest-mode="observed-facts-only">${$(e.label)}</h2>${_n("crest", "About observed highs and the renewed-rise clock")}</div><p class="crest-fact">${a}</p>${r}${i}${o}<p class="crest-fact crest-guidance">Growers and sampling staff make the crest call.</p>${yn("crest", "Observed highs and the renewed-rise clock", `<p>${Aa}</p><p>The observed high is the highest eligible actual reading in the available 48 hours, using the latest time when equal highs repeat. Gaps may exist. ${Ht.mode === "B" ? "Direction labels compare the middle of five native readings spanning the past hour with the same middle value one hour earlier. A change larger than both 1 cfs and 0.62% of the larger comparison value is Rising or Falling; otherwise it is Little change. Every new direction must persist across five consecutive quarter-hour comparisons (60 elapsed minutes) before the label changes. Missing support clears the direction to the neutral observed-high heading. The calculation restarts from the available 48-hour history on every load; no browser memory or future readings are used." : "Direction labels are withheld. The observed high and the separate renewed-rise clock remain available as measured facts."} These describe the available readings, not a final crest decision.</p><p>The two clocks end at the newest gauge reading: the high's age is elapsed time since that actual reading; the renewed-rise clock starts at that high or its last material increasing trend reading. A missing quarter-hour breaks trend support; a gap over 30 minutes or unusable reading restarts the contiguous evidence window. Its first complete trend hour restarts the clock, so missing time is never counted. Reading age and quality can withhold all status. Older highs do not acquire an automatic confirmation or an expiry verdict.</p><p>A crest concerns actual river flow topping out, not the peak of the 24-hour rise. A closure can already be in place while the river rises. Around 12 hours of falling is a staff planning judgment, not a fixed closure or sampling rule. The clocks do not mean continuous falling or establish that a storm has ended.</p>`)}`);
}
function Dt(e, t) {
  for (let n of e || [])
    if (!(!n.length || t < n[0].t || t > n[n.length - 1].t))
      for (let a = 0; a < n.length; a++) {
        if (n[a].t === t) return n[a].cfs;
        if (a && n[a].t > t) {
          let r = n[a - 1], i = n[a];
          return r.cfs + (i.cfs - r.cfs) * (t - r.t) / (i.t - r.t);
        }
      }
  return null;
}
function Na(e, t, n) {
  for (let a of e || []) {
    if (!a.length || a[0].t > t || a[a.length - 1].t < n) continue;
    let r = Dt([a], t), i = Dt([a], n);
    if (!K(r) || !K(i)) continue;
    let o = Math.min(r, i);
    for (let s of a) s.t > t && s.t < n && (o = Math.min(o, s.cfs));
    return o;
  }
  return null;
}
function Ra(e) {
  let t = e.gauge?.segments || [], n = e.forecast?.shifted?.segments || [], a = e.gauge?.latest, r = t.find((o) => o[o.length - 1]?.t === a?.t), i = n.find((o) => o[0]?.t === a?.t);
  return !r || !i || r[r.length - 1].cfs !== i[0].cfs ? [] : [[...r, ...i.slice(1)]];
}
function Tn(e) {
  let t = e.forecast || {}, n = Math.max(e.nowMs, e.gauge?.latest?.t ?? e.nowMs), a = t.raw?.endT, r = e.gauge?.latest?.t;
  if (!t.available || !K(a) || e.timeUncertain) return { available: !1, through: a, peaks: [], maxRatio: null, complete: !1 };
  let i = t.raw.segments, o = Ra(e), s = K(r) ? r + 24 * W : n, c = /* @__PURE__ */ new Set([n, a, s]);
  for (let w = Y(n).year; w <= Y(a).year; w++) for (let p of [3, 5, 11]) {
    let y = Ge(w, p, 1);
    y >= n && y <= a && (c.add(y), c.add(y - 1));
  }
  for (let w of [...i, ...o]) for (let p of w)
    p.t >= n && p.t <= a && c.add(p.t), p.t + 24 * W >= n && p.t + 24 * W <= a && c.add(p.t + 24 * W);
  for (let w = n; w <= a; w += Ft) c.add(w);
  let u = -1 / 0, l = null, f = null, d = !0, g = [];
  for (let w of [...c].filter((p) => p >= n && p <= a).sort((p, y) => p - y)) {
    let p = w <= s ? o : i, y = Dt(p, w), N = Na(p, w - 24 * W, w);
    if (!K(y) || !K(N)) {
      d = !1;
      continue;
    }
    let k = ae(y, N), _ = k / we(w);
    g.push({ t: w, rise: k, ratio: _ }), _ > u && (u = _), (l === null || k > l) && (l = k, f = w);
  }
  let h = (t.crests || []).filter((w) => w.endT > n && g.some((p) => p.t >= Math.max(n, w.precedingLow?.t ?? n) && p.t <= w.endT && p.ratio >= 0.5)), m = i?.[i.length - 1], A = m?.length > 1 && m[m.length - 1].cfs > m[m.length - 2].cfs;
  return { available: g.length > 0, complete: d, through: a, maxRatio: K(u) ? u : null, maxRise: l, maxT: f, peaks: h, risingTail: A };
}
function Oa(e, t, n = Tn(e)) {
  let a = e.forecast, r = t.high, i = t.peak ? `<p><strong>Observed high: ${Z(t.peak.cfs)} cfs</strong> \xB7 ${J(t.peak.t)} (${$(ht(t.sincePeakMs))} before latest reading). Now ${Z(t.drop)} cfs lower; final crest not established.</p>` : r ? `<p><strong>Recent observed high: ${Z(r.cfs)} cfs</strong> \xB7 ${J(r.t)} (${$(ht(t.sinceHighMs))} before latest reading). ${$(t.label)}.</p>` : `<p>${$(t.label)}. ${$(t.why || "")}</p>`, o = K(a.issuedT) ? `Issued ${J(a.issuedT)} \xB7 ${$(e.timeUncertain ? "age unknown" : ne(a.issueAgeMs) + " old")}.` : "", s = K(n.through) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(n.through) : "the available forecast", c = n.available ? n.maxRatio < 0.5 ? `${n.complete ? "NOAA-based forecast shows no rise near the trigger" : "Where readings are available, the NOAA-based forecast shows no rise near the trigger"} through ${s}.` : n.peaks.length ? "" : "The comparison using measured flow and forecasts reaches at least half the seasonal rise trigger; no supported future peak time is identified." : "There are not enough readings to check the forecast rise.", u = n.peaks.map((l) => `<article class="peak-card"><h3>NOAA forecast peak \xB7 ${Z(l.cfs)} cfs</h3><p>Between ${J(l.bracketStartT)} and ${J(l.bracketEndT)} (highest issued point ${J(l.startT)}${l.endT !== l.startT ? " to " + J(l.endT) : ""}). ${$({ inside_08_17: "Daytime (8 AM\u20135 PM)", outside_08_17: "Overnight / outside 8 AM\u20135 PM", spans_both: "Spans daytime and overnight" }[l.clockRange] || "Daytime / overnight timing unavailable")}.</p><details><summary>Timing and surrounding forecast points</summary><p>${J(l.bracketStartT)} to ${J(l.bracketEndT)}. These times describe forecast spacing, not the actual crest-time uncertainty.</p></details></article>`).join("");
  Ue("peaks", `<h2>Observed high, then forecast</h2>${i}<h3>NOAA river forecast</h3><p class="meta">National Oceanic and Atmospheric Administration (NOAA), National Weather Service. ${o}</p>${c ? `<p>${$(c)}</p>` : ""}${u}${n.available ? `<p class="meta">Largest supported rise from the 24-hour low (measured + forecast comparison): ${Qe(n.maxRise, !0)} cfs \xB7 ${J(n.maxT)}. \u201CNear the trigger\u201D means at least half the seasonal rise trigger.</p>` : ""}${n.risingTail ? `<p class="meta">Forecast still rising at its last point (${J(n.through)}); no final crest time is established.</p>` : ""}${!n.complete && n.available ? '<p class="meta">Some forecast comparisons are unsupported; a missing comparison does not mean no rise.</p>' : ""}<details><summary>Which forecast peaks are shown?</summary><p>Display filter: a forecast peak is shown only when a supported rise from the rolling 24-hour low on its rising limb reaches at least 50% of the seasonal rise trigger (200 cfs November\u2013February, 100 March\u2013April, 50 May\u2013October). This is a display choice, not a closure rule. During the first 24 hours, the gauge-adjusted forecast is compared with the supported measured and adjusted low; if adjustment is unsupported that interval is unavailable. After 24 hours, both the flow and rolling low use the unchanged official forecast. The chart shows smaller forecast bumps too. No peak time is predicted by this page.</p></details>`);
}
function xn(e, t, n, a, r, i = {}) {
  Ea(t, i);
  let o = Ca(t, i), s = Tn(t);
  La(o, s.peaks.length > 0), pn(t, a), gn(t);
  let c = document.getElementById("rain");
  c.innerHTML = c.innerHTML.replaceAll("<strong>Unavailable</strong>", '<strong class="unavailable">Unavailable</strong>');
  let u = c.querySelector?.(".station-links"), l = c.querySelector?.(".rain-total-grid");
  u && l && l.insertAdjacentElement("afterend", u), Oa(t, o, s), mn(t), bn(e, t, n);
  let f = document.getElementById("forecast-details");
  f.innerHTML = f.innerHTML.replace("The adjusted forecast first reaches", "Within its first 72 hours, the adjusted forecast first reaches").replace("The adjusted forecast already meets", "Within its first 72 hours, the adjusted forecast already meets").replace("earlier measurements or the adjusted forecast", "earlier measurements or forecast values").replace("Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.", "After 72 hours, the moving rise reference uses only the unchanged official forecast. Adjusted forecasts and past cases still stop at 72 hours; a gap marks any change of basis.").replace("Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.", "The observed high is listed first. Forecast peaks are filtered by their rolling 24-hour rise; smaller bumps remain on the chart.");
  let d = document.getElementById("sources");
  d.innerHTML = d.innerHTML.replace("Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.", "Estimated or otherwise unsupported readings cannot confirm an observed crest."), Ue("snapshot-label", `Saved snapshot ${$(e.id)} \xB7 ${$(Q(e.createdAt))}`);
}

// site/js/watch-preview-reference.js
var Mn = 36e5, ue = 24 * Mn, Ia = 6 * Mn, se = Number.isFinite, jt = (e) => se(e) && Math.abs(e) <= 864e13;
function Pa(e) {
  if (e?.available === !1) return [];
  let t = [];
  for (let n of e?.segments || []) {
    if (!Array.isArray(n) || n.some((i, o) => o && i?.t <= n[o - 1]?.t)) continue;
    let a = [], r = () => {
      a.length && t.push(a), a = [];
    };
    for (let i of n) {
      if (!jt(i?.t) || !se(i?.cfs) || i.cfs < 0 || se(e?.endT) && i.t > e.endT) {
        r();
        continue;
      }
      a.length && i.t - a.at(-1).t > Ia && r(), a.push({ t: i.t, cfs: i.cfs });
    }
    r();
  }
  return t;
}
function He(e, t) {
  if (!e.length || t < e[0].t || t > e.at(-1).t) return null;
  for (let n = 0; n < e.length; n++) {
    let a = e[n];
    if (t === a.t) return a.cfs;
    if (t < a.t) {
      let r = e[n - 1], i = (t - r.t) / (a.t - r.t), o = (1 - i) * r.cfs + i * a.cfs;
      return se(o) ? o : null;
    }
  }
  return null;
}
function Ua(e, t) {
  let n = [];
  for (let a = Y(e).year; a <= Y(t).year; a++) for (let r of [3, 5, 11]) {
    let i = Ge(a, r, 1);
    i > e && i <= t && n.push(i);
  }
  return n.sort((a, r) => a - r);
}
function Ha(e, t) {
  let n = He(e, t - ue), a = He(e, t);
  if (n === null || a === null) return null;
  let r = Math.min(n, a);
  for (let i of e) i.t > t - ue && i.t < t && (r = Math.min(r, i.cfs));
  return r;
}
function Da(e, t, n) {
  let a = /* @__PURE__ */ new Set([t, n]);
  for (let i of e) for (let o of [i.t, i.t + ue]) o > t && o < n && a.add(o);
  let r = [...a].sort((i, o) => i - o);
  for (let i = 1; i < r.length; i++) {
    let o = r[i - 1], s = r[i], c = (o + s) / 2, u = e.filter((f) => f.t > c - ue && f.t < c).reduce((f, d) => Math.min(f, d.cfs), 1 / 0), l = [
      [He(e, o - ue), He(e, s - ue)],
      [He(e, o), He(e, s)],
      ...se(u) ? [[u, u]] : []
    ];
    for (let f = 0; f < l.length; f++) for (let d = f + 1; d < l.length; d++) {
      let g = l[f][0] - l[d][0], h = l[f][1] - l[d][1];
      if (!se(g) || !se(h) || g === h) continue;
      let m = Math.max(Math.abs(g), Math.abs(h)), A = g / m / (g / m - h / m);
      A > 0 && A < 1 && a.add(o + A * (s - o));
    }
  }
  return [...a].sort((i, o) => i - o);
}
function Fa(e, t, n, a) {
  let r = (u, l) => {
    let f = a(u);
    return se(f) && se(f + l) ? f + l : null;
  };
  if (e === t) {
    let u = r(e, we(e));
    return { segments: se(u) ? [[{ t: e, cfs: u }]] : [], steps: [] };
  }
  let i = Ua(e, t), o = [e, ...i, ...i.at(-1) === t ? [] : [t]], s = [], c = [];
  for (let u = 1; u < o.length; u++) {
    let l = o[u - 1], f = o[u], d = we(l), h = [l, ...n.filter((m) => m > l && m < f), f].map((m) => ({ t: m, cfs: r(m, d) }));
    if (h.every((m) => se(m.cfs)) && s.push(h), i.includes(f)) {
      let m = r(f, d), A = r(f, we(f));
      se(m) && se(A) && (c.push({ t: f, beforeCfs: m, afterCfs: A }), f === t && s.push([{ t: f, cfs: A }]));
    }
  }
  return { segments: s, steps: c };
}
function An(e, t, n = "endpoint") {
  let a = { available: !1, basis: "official_forecast", segments: [], steps: [], startT: null, endT: null };
  if (!jt(t) || !jt(e?.endT) || e.endT <= t || !["endpoint", "low"].includes(n)) return a;
  let r = Pa(e), i = [], o = [], s = t + 1, c = (l, f, d, g) => {
    if (l > f) return;
    let h = Fa(l, f, d, g);
    i.push(...h.segments), o.push(...h.steps);
  };
  if (n === "endpoint")
    for (let l of r) for (let f of r) {
      let d = Math.max(s, l[0].t, f[0].t + ue), g = Math.min(e.endT, l.at(-1).t, f.at(-1).t + ue);
      c(d, g, f.map((h) => h.t + ue), (h) => He(f, h - ue));
    }
  else
    for (let l of r) {
      let f = Math.max(s, l[0].t + ue), d = Math.min(e.endT, l.at(-1).t);
      f <= d && c(f, d, Da(l, f, d), (g) => Ha(l, g));
    }
  i.sort((l, f) => l[0].t - f[0].t);
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
var U = Number.isFinite, H = null, ja = (e, t, n) => U(e?.t) && U(e?.cfs) && e.t >= t && e.t <= n;
function xt(e, t, n) {
  for (let a of e || []) {
    let r = un(a, (i) => i.t === t);
    if (r) return r.cfs;
    for (let i = 1; i < a.length; i++) {
      let o = a[i], s = a[i - 1];
      if (s.t < t && o.t > t)
        return o.t - s.t > n ? null : s.cfs + (o.cfs - s.cfs) * (t - s.t) / (o.t - s.t);
    }
  }
  return null;
}
function Sn(e, t, n, a) {
  let r = e.filter((i) => ja(i, t, n));
  for (let i of [t, n])
    if (!r.some((o) => o.t === i)) {
      let o = xt([e], i, a);
      U(o) && r.push({ t: i, cfs: o });
    }
  return r.sort((i, o) => i.t - o.t);
}
function qa(e, t, n) {
  return e.map((a, r) => `${r ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function kn(e, t, n) {
  return (e?.segments || []).map((a) => {
    let r = Sn(a, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !a.length || i.t < a[0].t || i.t > a.at(-1).t) continue;
      let o = r.findIndex((c) => c.t >= i.t), s = o < 0 ? r.length : o;
      for (; r[s]?.t === i.t; ) r.splice(s, 1);
      r.splice(s, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return r;
  });
}
var Ba = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function qt(e) {
  let t = Object.fromEntries(Ba.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function Wa(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - qt(t);
  return t;
}
function Ga(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), r = qt(e), i = qt(t), o = [];
  for (let s of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let c = Math.min(s, 12) * 36e5, u = [];
    for (let f = Math.ceil(r / c) * c; f <= i + 36e5; f += s * 36e5) {
      let d = Wa(f);
      d >= e && d <= t && u.push(d);
    }
    if (u.length < 2) continue;
    o = u;
    let l = Math.min(...u.slice(1).map((f, d) => (f - u[d]) / (t - e) * n));
    if (u.length <= a && l >= 40) return u;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function Cn(e, t, n, { previewReferenceTail: a = !1, officialReferenceTail: r = null } = {}) {
  let i = Math.max(1, Math.floor(e.clientWidth)), o = globalThis.innerHeight, s = i < 500 ? 240 : U(o) && o < 500 ? Math.max(180, Math.min(280, o - 80)) : 280, c = { left: Math.min(49, i / 4), right: Math.min(14, i / 4), top: 26, bottom: 38 }, u = c.left, l = i - c.right, f = c.top, d = s - c.bottom, g = t.gauge?.latest?.t, h = Math.round(t.nowMs), m = document.getElementById("chart-cursor");
  if (t.timeUncertain && !U(g)) {
    let b = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${i} ${s}" width="${i}" height="${s}" role="img" aria-label="${b}"><text x="${i / 2}" y="${s / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${i / 2}" y="${s / 2 + 4}" text-anchor="middle">${i < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let C of document.querySelectorAll?.(".legend span") ?? []) C.hidden = !0;
    H = null, m.min = "0", m.max = "1", m.step = "1", m.value = "0", m.disabled = !0, m.style.marginLeft = `${u - 10}px`, m.style.width = `${l - u + 20}px`, m.setAttribute("aria-valuetext", b), document.getElementById("chart-readout").textContent = b;
    return;
  }
  let A = t.timeUncertain ? g : h, w = A - Number(n.past || 24) * 36e5, p = n.range === "full" ? Math.max(A + 36e5, t.forecast?.raw?.endT ?? A + 72 * 36e5) : A + (n.range === "day" ? 24 : 72) * 36e5, y = t.forecast || {}, N = t.gauge?.references?.[n.reference], k = y.references?.[n.reference], _ = { segments: [...N?.segments || [], ...k?.segments || []], steps: [...N?.steps || [], ...k?.steps || []] }, M = a && U(g) ? r : null, B = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: y.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: y.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: y.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: y.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: a ? "Rise-trigger flow" : "24-hour rise reference", segments: kn(_, w, p), gap: 1 / 0 }, ...M ? [{ key: "reference", name: "Official forecast-based rise-trigger flow", basis: "official-forecast", segments: kn(M, Math.max(w, g + 72 * 36e5 + 1), p), gap: 1 / 0 }] : []].map((b) => ({ ...b, visible: b.key === "reference" ? b.segments : b.segments.map((C) => Sn(C, w, p, b.gap)) })), q = B.flatMap((b) => b.visible.flat()).filter((b) => U(b.cfs)), G = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let b of document.querySelectorAll?.(".legend span") ?? []) {
    let C = G[b.querySelector("i")?.className];
    b.hidden = !!C && !B.some((Le) => Le.key === C && Le.visible.some((Nt) => Nt.length));
  }
  let Me = Math.max(10, ...q.map((b) => b.cfs)) * 1.08, Fe = Me / 4, vt = Math.pow(10, Math.floor(Math.log10(Fe))), Ae = Fe / vt, wt = (Ae <= 1 ? 1 : Ae <= 2 ? 2 : Ae <= 5 ? 5 : 10) * vt, je = wt * 4, P = (b) => u + (b - w) / (p - w) * (l - u), me = (b) => d - b / je * (d - f), it = Array.from({ length: 5 }, (b, C) => wt * C), ot = Ga(w, p, l - u), St = it.map((b) => `<line class="grid" x1="${u}" x2="${l}" y1="${me(b)}" y2="${me(b)}"/><text x="${u - 7}" y="${me(b) + 4}" text-anchor="end">${$(Qe(b))}</text>`).join("") + ot.map((b) => {
    let C = P(b), Le = C < 24 ? "start" : C > i - 24 ? "end" : "middle", Nt = `<tspan x="${C}">${$(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(b))}</tspan><tspan x="${C}" dy="14">${$(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(b))}</tspan>`;
    return `<text class="x-axis-label" x="${C}" y="${s - 24}" text-anchor="${Le}">${Nt}</text>`;
  }).join(""), lt = B.map((b) => b.visible.filter((C) => C.length).map((C) => C.length === 1 ? `<circle class="${b.key}${b.basis ? " reference-official" : ""}"${b.basis ? ` data-reference-basis="${b.basis}"` : ""} cx="${P(C[0].t)}" cy="${me(C[0].cfs)}" r="2" fill="var(--${b.key === "observed" ? "obs" : b.key})"/>` : `<path class="plot-line ${b.key}${b.basis ? " reference-official" : ""}"${b.basis ? ` data-reference-basis="${b.basis}"` : ""} d="${qa(C, P, me)}"/>`).join("")).join(""), ve = xt(_.segments, w, 1 / 0) ?? xt(_.segments, A, 1 / 0), de = U(ve) ? me(ve) : f + 14;
  de = de - f > 32 ? de - 10 : de + 24, de = Math.max(f + 12, Math.min(d - 6, de));
  let _t = B.find((b) => b.key === "reference")?.visible.flat() || [], ke = _t.reduce((b, C) => !b || C.t > b.t ? C : b, null), qe = a ? 112 : 84, Se = a ? "Rise-trigger flow" : "24h rise line", Ce = ke ? Math.max(u + 4, Math.min(l - qe - 4, P(ke.t) - qe)) : u + 4, x = de, T = Ce + qe, he = U(n.cursorT) && n.cursorT >= w && n.cursorT <= p ? P(n.cursorT) : null, Be = U(g) && g >= w && g <= p ? P(g) : null, We = ke && P(ke.t) - u >= qe, Xt = [he, Be].some((b) => U(b) && b >= Ce && b <= T), Wn = l - u < 200 || !We || Xt ? "" : `<rect class="reference-label-bg" x="${Ce}" y="${x - 12}" width="${qe}" height="16" rx="3"/><text class="reference-label" x="${Ce + 4}" y="${x}">${Se}</text>`, Zt = t.timeUncertain && l - u < 132, Gn = t.timeUncertain ? Zt ? "Last reading" : "Last saved river reading" : "Latest observed", Vn = t.timeUncertain ? Zt ? 80 : 132 : 90, zn = U(g) && g >= w && g <= p ? `<line x1="${P(g)}" x2="${P(g)}" y1="${f}" y2="${d}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(u, Math.min(l - Vn, P(g) + 5))}" y="${f - 9}">${Gn}</text>` : "", Xn = !t.timeUncertain && h >= w && h <= p ? `<line class="now" x1="${P(h)}" x2="${P(h)}" y1="${f}" y2="${d}"/><text x="${Math.min(l - 25, P(h) + 5)}" y="${f + 15}">Now</text>` : "", Ee = U(n.cursorT) ? Math.max(w, Math.min(p, n.cursorT)) : null, Zn = Ee !== null ? `<line class="cursor" x1="${P(Ee)}" x2="${P(Ee)}" y1="${f}" y2="${d}"/>` : "", le = U(g) ? g + 72 * 36e5 : null, Jn = U(y.raw?.endT) && y.raw.endT > le && (y.raw?.segments || []).some((b) => b.some((C) => U(C.cfs) && C.t > le)), Ct = n.range === "full" && U(le) && le > w && p - le > 6 * 36e5 && Jn, Et = Ct ? l - P(le) : 0, Yn = a ? "Beyond this limit the forecast and its 24-hour rise reference use official forecast values only, where supported. Adjusted forecasts and past cases stop at 72 hours. The reference changes basis in a separate path." : "Beyond this limit only supported official forecast points can be shown. Adjustments, past cases and moving references are limited to at most 72 hours.", Qn = Ct ? `<g class="forecast-horizon"><title>72-hour context limit: ${$(Q(le, !0))}. ${Yn}</title><rect x="${P(le)}" y="${f}" width="${Et}" height="${d - f}" fill="currentColor" opacity=".04"/><line x1="${P(le)}" x2="${P(le)}" y1="${f}" y2="${d}" stroke="currentColor" stroke-dasharray="3 4" opacity=".55"/>${Et >= 65 ? `<rect x="${l - 68}" y="${f + 6}" width="67" height="33" rx="3" fill="var(--surface)" opacity=".95"/><text x="${l - 4}" y="${f + 19}" text-anchor="end"><tspan x="${l - 4}">After 72h</tspan><tspan x="${l - 4}" dy="14">Official only</tspan></text>` : ""}</g>` : "", Kn = B.some((b) => b.segments.some((C) => C.some((Le) => U(Le.t) && U(Le.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${i} ${s}" width="${i}" height="${s}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. ${a ? "After the 72-hour limit, any reference shown uses only official forecast values and begins as a separate path. " : ""}Observations and forecast paths from ${$(Q(w, !0))} through ${$(Q(p, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${u}" y="${f}" width="${l - u}" height="${d - f}"/></clipPath></defs>${St}<g clip-path="url(#plot-clip)">${Qn}${lt}${Zn}</g>${Wn}${zn}${Xn}${q.length ? "" : `<text x="${(u + l) / 2}" y="${s / 2}" text-anchor="middle">${Kn}</text>`}</svg>${Ct && Et < 65 ? `<p class="meta forecast-horizon-caption">${a ? "After 72h: official forecast and its supported 24-hour reference." : "After 72h: official forecast only, where supported."}</p>` : ""}`, H = { lines: B, hasData: q.length > 0, start: w, end: p, left: u, right: l, width: i, host: e, contextLimit: le, previewReferenceTail: a }, m.min = String(w), m.max = String(p), m.step = "1", m.disabled = !H.hasData, m.style.marginLeft = `${u - 10}px`, m.style.width = `${l - u + 20}px`;
  let Lt = Ee ?? Math.max(w, Math.min(p, U(g) ? g : h));
  m.value = String(Math.round(Lt)), m.setAttribute("aria-valuetext", t.timeUncertain ? `${Ee === null ? "Last saved river reading" : "Saved chart selection"}: ${Q(Lt)}. Current time is unconfirmed.` : Q(Lt)), Ee !== null ? Va(Ee) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function Va(e) {
  if (!H) return;
  let t = H.lines.map((n) => {
    let a = xt(n.visible, e, n.gap);
    return U(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${$(Q(e))}</strong><br>${t.map($).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}${U(H.contextLimit) && e > H.contextLimit ? `<br><span class="meta">${H.previewReferenceTail ? "Beyond 72 hours: official forecast values only. The reference uses those forecast values when supported; adjusted forecasts and past cases stop at 72 hours." : "Beyond 72 hours: official forecast only, where supported. Other comparisons are limited to 72 hours."}</span>` : ""}`;
}
function En(e) {
  if (!H?.hasData) return null;
  let t = H.host.getBoundingClientRect(), n = t.width / H.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - H.left) / (H.right - H.left)));
  return Math.round(H.start + a * (H.end - H.start));
}
function Bt() {
  if (!H?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return U(e) ? Math.max(H.start, Math.min(H.end, e)) : null;
}
function Ln(e) {
  let t = Bt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? H.start : e === "End" ? H.end : U(n[e]) ? Math.max(H.start, Math.min(H.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var Nn = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var bt = (e, t, n) => Cn(e, t, n, { previewReferenceTail: !0, officialReferenceTail: An(t.forecast.raw, (t.gauge.latest?.t ?? NaN) + 72 * 36e5, n.reference) }), Xa = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", In = new URL("./", import.meta.url), Pn = "samish.public.preview.packet.v1", Un = "samish.public.preview.preferences.v1", Mt = 9466848e5, nt = 41024448e5, De = 5 * 6e4, Hn = 2 * 1024 * 1024, S = (e) => document.getElementById(e), at = Number.isFinite;
function st() {
  let e = S("number-strip"), t = S("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", st, { passive: !0 });
window.addEventListener("resize", st);
function zt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = S(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function Gt(e, t, n = !1) {
  let a = S(e), r = S(`${e}-toggle`);
  if (!(!a || !r) && (a.open = t, zt(), st(), n)) {
    r.focus({ preventScroll: !0 });
    let i = S("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, s = r.getBoundingClientRect();
    (s.top < o + 8 || s.bottom > innerHeight - 8) && r.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), st();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), Gt(t.dataset.helpTarget, !S(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), Gt(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || S(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), Gt(t.id, !1, !0));
});
zt();
var Dn = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, Fn = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, j = () => {
  throw new Error("invalid_public_packet");
};
function O(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && j(), e;
}
function oe(e, t = !1, n = !1, a = !1, r = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !at(e) || !n && e < 0 || a && !Number.isInteger(e) || e > r) && j();
}
function L(e, t = !1) {
  oe(e, t, !1, !0, nt), e !== null && e < Mt && j();
}
function tt(e) {
  typeof e != "boolean" && j();
}
function ie(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && j();
}
function fe(e, t, n) {
  (!Array.isArray(e) || e.length > t) && j(), e.forEach(n);
}
var Za = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], Ja = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], Ya = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function Vt(e, t = !1) {
  O(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), L(e.t, t), "cfs" in e && oe(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && tt(e[n]);
  "approval" in e && ie(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && ie(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && ie(e[n], Ya);
  "reason" in e && ie(e.reason, Za, !0);
}
function pt(e, t = !1) {
  e !== null && (O(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), L(e.t), oe(e.cfs, !0), t && L(e.eligibleT, !0));
}
function Qa(e, t) {
  O(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), L(t.lastAttemptAt, !0), L(t.lastSuccessAt, !0), ie(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (O(n, ["points", "exclusions", "coveredWindow"]), fe(n.points, 4096, (a) => Vt(a)), fe(n.exclusions, 4096, (a) => Vt(a, !0)), n.coveredWindow !== null)) {
      let a = O(n.coveredWindow, ["startT", "endT", "complete"]);
      L(a.startT), L(a.endT), (a.complete !== !0 || a.startT > a.endT) && j();
    }
    if (e === "noaa" && (O(n, ["issuedT", "points", "conflicts"]), L(n.issuedT), fe(n.points, 1024, (a) => {
      O(a, ["t", "cfs"]), L(a.t), oe(a.cfs);
    }), fe(n.conflicts, 1024, (a) => L(a))), e === "radar") {
      O(n, ["generatedT", "hours", "conflicts"]), L(n.generatedT);
      let a = (r) => {
        L(r), r % 36e5 && j();
      };
      fe(n.hours, 256, (r) => {
        O(r, ["endT", "mm"]), a(r.endT), oe(r.mm, !0);
      }), fe(n.conflicts, 256, a);
    }
    e === "grid" && (O(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), L(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && j(), fe(n.periods, 1024, (a) => {
      O(a, ["startT", "endT", "mm"]), L(a.startT), L(a.endT), oe(a.mm, !0), a.endT <= a.startT && j();
    })), e === "tides" && (O(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && j(), fe(n.points, 128, (a) => {
      O(a, ["t", "ft", "type"]), L(a.t), oe(a.ft, !1, !0), ie(a.type, ["H", "L"]);
    }));
  }
}
function Ka(e) {
  O(e, ["summary", "transitions"]);
  let t = O(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && j(), L(t.asOf), ie(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && Vt(t.actualCurrentObservation), L(t.supportObservationT, !0), t.event !== null) {
    let o = O(t.event, ["openedT", "high", "cycle"]);
    L(o.openedT), pt(o.high);
    let s = O(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    oe(s.ordinal, !1, !1, !0, 1e5), L(s.openedT), pt(s.high, !0), pt(s.low), tt(s.endingPending);
  }
  if (t.standing !== null) {
    let o = O(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    ie(o.kind, ["downturn", "correction"]), ie(o.state, ["possible_downturn", "rising_again"]), L(o.t), L(o.detectedAt), oe(o.cfs), tt(o.active), pt(o.supportingHigh), pt(o.low);
  }
  let n = (o) => fe(o, 16, (s) => ie(s, Ja)), a = O(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  ie(a.status, ["available", "warming_up", "partial", "unavailable"]), tt(a.newDownturnAvailable), tt(a.aboveHighCorrectionAvailable), n(a.reasons);
  let r = O(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(r.blockingReasons), L(r.nextEligibleAt, !0);
  let i = O(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  L(i.lastSuccessfulPollAt, !0), oe(i.monitoringGapMs, !0, !1, !1, nt), oe(i.observationAgeMs, !0, !1, !1, nt), fe(i.missingQuarterHours, 7, (o) => L(o)), tt(i.clockTrusted), fe(e.transitions, 32, (o) => {
    O(o, ["kind", "t", "cfs", "event", "detected_at"]), ie(o.kind, ["downturn", "event_end"]), L(o.t), L(o.detected_at), oe(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && j();
  });
}
async function jn(e) {
  O(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && j();
  let t = new TextEncoder().encode(e.payload);
  t.length > Hn && j(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && j();
  let a = JSON.parse(e.payload);
  O(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && j(), L(a.publishedAt);
  let r = O(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (r.schemaVersion !== 1 || typeof r.id != "string" || !/^[a-f0-9]{12}$/.test(r.id)) && j(), L(r.createdAt), a.publishedAt < r.createdAt && j();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return O(r.sources, i), i.forEach((o) => Qa(o, r.sources[o])), Ka(r.monitor), r.monitor.summary.asOf !== r.createdAt && j(), a;
}
var et = Dn(Un) || {}, I = { range: ["day", "three", "full"].includes(et.range) ? et.range : "three", past: et.past === 48 ? 48 : 24, reference: et.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(et.theme) ? et.theme : null, cursorT: null };
I.theme && (document.documentElement.dataset.theme = I.theme);
var te = null, mt = null, V = null, Wt = !1, z = "waiting", Te = null, gt = null, At = !0, xe = !1, be = Date.now(), kt = () => Fn(Un, { range: I.range, past: I.past, reference: I.reference, theme: I.theme });
function es() {
  let e = Date.now(), t = Te ? Math.max(0, performance.now() - Te.mono) : 0, n = Te ? Te.lower + t : null, a = Te ? Te.upper + t : null;
  be = Math.max(be, e, a ?? 0, te?.snapshot.createdAt ?? 0);
  let r = At || !Te || e < n - De || e > a + De || e + De < be || te && te.snapshot.createdAt > a + De;
  return { now: be, uncertain: r };
}
function qn() {
  return gt ? gt.now + Math.max(0, performance.now() - gt.mono) : 0;
}
function ts() {
  mt && Fn(Pn, { packet: mt, greatestNow: be, trustedNow: qn(), savedDeviceMs: Date.now(), ended: xe });
}
function Rn(e) {
  let t = S("connection");
  if (z === "waiting") {
    t.textContent = "Checking the public snapshot and current time\u2026", t.className = "connection";
    return;
  }
  if (!te) {
    t.textContent = xe ? "Preview ended. No current readings are provided." : z === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - te.snapshot.createdAt), a = z !== "checked";
  if (!xe && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${ne(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [xe ? "Preview ended. Earlier readings are retained for reference." : a ? z === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : z === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current crest status is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${Q(te.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${ne(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current crest status is withheld." : ""].join(" "), t.className = "connection attention";
}
function ge() {
  let e = es();
  if (!te) {
    Rn(e);
    let l = z === "waiting";
    S("current").textContent = l ? "Checking river readings\u2026" : "No verified river readings available.", S("current").setAttribute("aria-busy", String(l)), S("monitor").textContent = l ? "" : "Crest status unavailable until readings can be verified.";
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((l) => l.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((l) => [...S(l).querySelectorAll("details:not(.section-help)")].flatMap((f, d) => f.open ? [`${l}:${d}`] : [])), r = te.snapshot, i = e.uncertain ? r.createdAt : e.now;
  V = ln({ nowMs: i, sources: r.sources, ratioTable: Nn });
  let o = xe || e.uncertain || z !== "checked" || e.now - r.createdAt > 12 * 6e4;
  V.timeUncertain = e.uncertain, e.uncertain && (V.forecast.freshContext = !1, V.forecast.higherLater = { ...V.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let s = r.monitor.summary, c = !at(s.supportObservationT) || i - s.supportObservationT > 60 * 6e4;
  if (o) {
    let l = { code: xe ? "preview_ended" : e.uncertain ? "public_time_uncertain" : z !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" };
    V.gauge.direction = { ...V.gauge.direction, available: !1, reason: l }, V.gauge.twelveHourChange = { ...V.gauge.twelveHourChange, available: !1, reason: l };
  }
  let u = r;
  if (o || c || !s.support.clockTrusted) {
    let l = [...s.capability.reasons, ...c ? [at(s.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...s.support.clockTrusted ? [] : ["clock_uncertain"]];
    u = { ...r, monitor: { ...r.monitor, summary: { ...s, capability: { ...s.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: l }, preparation: { ...s.preparation, nextEligibleAt: null } } } };
  }
  xn(u, V, e.uncertain ? null : { lastCommitAt: r.createdAt, workerStale: e.now - r.createdAt > 12 * 6e4 }, I, i, { checking: z === "waiting", suppressed: o });
  for (let l of S("forecast-details").querySelectorAll("a")) l.getAttribute("href") === "/data/ratio_table.json" && (l.href = new URL("ratio_table.json", In).href, l.textContent = "View the frozen historical-case table");
  a.forEach((l) => {
    let [f, d] = l.split(":"), g = S(f).querySelectorAll("details:not(.section-help)")[Number(d)];
    g && (g.open = !0);
  }), zt(n), document.querySelectorAll("[data-range]").forEach((l) => l.setAttribute("aria-pressed", String(l.dataset.range === I.range))), S("past").value = String(I.past), S("reference").value = I.reference, bt(S("chart"), V, I), Rn(e), st(), ts(), t && S(t) && document.activeElement?.id !== t && S(t).focus({ preventScroll: !0 });
}
async function Bn(e, t = Hn * 2) {
  let n = new AbortController(), a = setTimeout(() => n.abort(), 18e3);
  try {
    let r = await fetch(e, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: n.signal });
    if (!r.ok) throw new Error("unavailable");
    let i = await r.text();
    return new TextEncoder().encode(i).length > t && j(), { response: r, value: JSON.parse(i) };
  } finally {
    clearTimeout(a);
  }
}
async function ns() {
  let e = new URL("version.json", In);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await Bn(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && j(), xe = n.state === "ended";
  let a = t.headers.get("Date"), r = t.headers.get("Age"), i = Date.parse(a || "");
  if (!at(i) || i < Mt || i > nt || r !== null && !/^\d+$/.test(r)) throw new Error("time_unavailable");
  let o = r === null ? 0 : Number(r);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let s = i + o * 1e3, c = Date.now();
  c >= i - De && c <= s + De && s - c <= De && (be = Math.max(s, c, qn(), te?.snapshot.createdAt ?? 0), gt = { now: be, mono: performance.now() }), Te = { lower: i, upper: s, mono: performance.now() }, At = !1;
}
function as(e, t) {
  if (te) {
    let n = te.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      z = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && j(), z = "checked";
      return;
    }
  }
  te = e, mt = t, z = "checked";
}
async function rt() {
  if (!Wt) {
    Wt = !0, S("refresh").disabled = !0, z === "waiting" && ge();
    try {
      let e = new URL(Xa);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([ns(), Bn(e)]);
      if (t[0].status === "rejected" && (At = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          as(await jn(n), n);
        } catch {
          z = "invalid";
        }
      else z = "offline";
      ge();
    } finally {
      Wt = !1, S("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  I.range = e.dataset.range, I.cursorT = null, kt(), ge();
}));
S("past").addEventListener("change", () => {
  I.past = Number(S("past").value), kt(), ge();
});
S("reference").addEventListener("change", () => {
  I.reference = S("reference").value, kt(), ge();
});
S("theme").addEventListener("click", () => {
  let e = I.theme ? I.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  I.theme = e ? "light" : "dark", document.documentElement.dataset.theme = I.theme, kt();
});
S("refresh").addEventListener("click", rt);
S("chart").addEventListener("pointerdown", (e) => {
  I.cursorT = En(e), V && bt(S("chart"), V, I);
});
S("chart-cursor").addEventListener("input", () => {
  I.cursorT = Bt(), V && bt(S("chart"), V, I);
});
S("chart-cursor").addEventListener("keydown", (e) => {
  let t = Ln(e.key);
  t !== null && (e.preventDefault(), I.cursorT = t, V && bt(S("chart"), V, I));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (z = "waiting", ge(), rt());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (z = "waiting", ge(), rt());
});
window.addEventListener("offline", () => {
  z = "offline", At = !0, ge();
});
window.addEventListener("online", rt);
var On = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== On && (On = t, V && bt(S("chart"), V, I), st());
}).observe(S("chart"));
async function ss() {
  let e = Dn(Pn);
  if (e?.packet)
    try {
      te = await jn(e.packet), mt = e.packet, at(e.greatestNow) && e.greatestNow >= Mt && e.greatestNow <= nt && (be = Math.max(be, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), at(e.trustedNow) && e.trustedNow >= Mt && e.trustedNow <= nt && (gt = { now: e.trustedNow, mono: performance.now() }), xe = e.ended === !0, z = "waiting", ge();
    } catch {
      te = null, mt = null;
    }
  await rt(), setInterval(() => {
    document.hidden || rt();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || ge();
  }, 3e4);
}
ss();
export {
  ln as buildWatchModel,
  jn as verifyPublicPacket
};
