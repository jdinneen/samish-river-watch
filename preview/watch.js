// site/js/season.js
var Gn = "America/Los_Angeles";
var wt = null;
function Vn() {
  return wt === null && (wt = new Intl.DateTimeFormat("en-US", {
    timeZone: Gn,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  })), wt;
}
function Y(e) {
  if (!Number.isFinite(e)) throw new RangeError("laParts needs a finite time");
  let t = {};
  for (let n of Vn().formatToParts(new Date(e)))
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
function Ut(e) {
  let t = Y(e);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(e / 1e3) * 1e3;
}
function Le(e, t, n, a = 0, s = 0) {
  let i = Date.UTC(e, t - 1, n, a, s), o = i - Ut(i);
  return i - Ut(o);
}
function pe(e) {
  let t = Y(e).month;
  return t >= 11 || t <= 2 ? 400 : t <= 4 ? 200 : 100;
}

// site/js/lines.js
var zn = 3600 * 1e3, Xn = Object.freeze([1, 2, 3, 4, 10, 11, 12]);
function Jn(e, t) {
  for (let n = 0; n < e.length; n++) {
    let a = e[n], s = n === e.length - 1;
    if (t >= a.lead_lo_h && (t < a.lead_hi_h || s && t === a.lead_hi_h)) return a;
  }
  return null;
}
function Yn(e, t) {
  return (e && Array.isArray(e.wet_months) ? e.wet_months : Xn).includes(Y(t).month);
}
var Ae = (e) => typeof e == "number" && Number.isFinite(e);
function Zn(e) {
  if (e.apply_to !== void 0 && e.apply_to !== "flow") throw new Error('past-miss table apply_to must be "flow"');
  if (!Ae(e.rise_floor_cfs) || !Ae(e.storm_flow_cfs)) throw new Error("past-miss table needs rise_floor_cfs and storm_flow_cfs");
  for (let t of e.bins) {
    if (!Ae(t.lead_lo_h) || !Ae(t.lead_hi_h) || !Ae(t.add_cfs)) throw new Error("past-miss table bin needs lead_lo_h, lead_hi_h and add_cfs");
    for (let n of ["rise", "flat"]) {
      let a = t[n];
      if (!a || !Ae(a.low_factor) || !Ae(a.high_factor)) throw new Error(`past-miss table bin ${t.lead_lo_h}-${t.lead_hi_h} h needs ${n} factors`);
    }
  }
}
function It(e, t, n, a = t.t) {
  let s = [], i = [], o = Yn(n, a);
  if (!o || !n || !Array.isArray(n.bins) || !n.bins.length) return { high: s, low: i, wetSeason: o };
  Zn(n);
  let r = n.bins, u = r[r.length - 1].lead_hi_h;
  for (let c of e) {
    let l = (c.t - t.t) / zn;
    if (l <= 0 || l > u) continue;
    let f = Jn(r, l);
    if (!f) continue;
    let d, m;
    if (c.cfs >= n.storm_flow_cfs) {
      let h = c.cfs - t.cfs >= n.rise_floor_cfs ? f.rise : f.flat;
      d = c.cfs * h.high_factor, m = c.cfs * h.low_factor;
    } else
      d = c.cfs + f.add_cfs, m = c.cfs - f.add_cfs;
    s.push({ t: c.t, cfs: Math.max(d, c.cfs) }), i.push({ t: c.t, cfs: Math.max(0, Math.min(m, c.cfs)) });
  }
  return { high: s, low: i, wetSeason: o };
}

// site/js/watch-model.js
var ke = 6e4, P = 60 * ke, L = 24 * P, fe = 30 * ke, Re = 6 * P, Se = 15 * ke, Qn = [2, 4, 6, 8, 12, 18, 24], j = (e) => typeof e == "number" && Number.isFinite(e), E = (e) => j(e) && Math.abs(e) <= 864e13, _ = (e, t = {}) => ({ code: e, details: t }), Pe = (e, t) => E(t) ? Math.max(0, e - t) : null, Kn = (e, t) => Object.prototype.hasOwnProperty.call(e, t), ct = (e) => ({ t: e.t, cfs: e.cfs }), z = (e) => e && e.usable !== !1 && j(e.cfs) && e.cfs >= 0;
function Ue(e, t) {
  let n = (r) => {
    let [u, c = "0"] = String(r).toLowerCase().split("e"), l = u.includes(".") ? u.length - u.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(u.replace(".", "")), exponent: Number(c) - l };
  }, a = n(e), s = n(t), i = Math.min(a.exponent, s.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - s.coefficient * 10n ** BigInt(s.exponent - i)}e${i}`;
}
function Pt(e) {
  let t = j(e.cfs) && e.cfs >= 0, n = e.usable !== !1 && t, a = e.qualifierPresent === !1 || e.qualifierAvailable === !1 ? !1 : Kn(e, "qualifier"), s = {
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
function Dt(e = []) {
  let t = /* @__PURE__ */ new Map();
  for (let n of Array.isArray(e) ? e : []) {
    if (!n || !E(n.t)) continue;
    let a = Pt(n), s = t.get(n.t);
    s ? JSON.stringify(s) !== JSON.stringify(a) && t.set(n.t, Pt({
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
function Ce(e, t) {
  let n = 0, a = e.length;
  for (; n < a; ) {
    let s = n + a >>> 1;
    e[s].t < t ? n = s + 1 : a = s;
  }
  return n;
}
function Ft(e, t) {
  let n = Ce(e, t);
  return { before: n > 0 ? e[n - 1] : null, after: e[n] ?? null };
}
function Ie(e, t, n = Se) {
  let { before: a, after: s } = Ft(e, t), i = s?.t === t ? s : a && (!s || t - a.t <= s.t - t) ? a : s;
  return i && Math.abs(i.t - t) <= n ? i : null;
}
function ge(e) {
  if (!E(e)) throw new RangeError("seasonalReference requires a valid UTC timestamp");
  return pe(e);
}
function Ht(e, t) {
  let n = E(t) ? e[Ce(e, t)] : null, a = E(t) ? t - L : null, s = E(a) ? Ft(e, a) : { before: null, after: null };
  return {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: n?.t === t ? n : null,
    comparison: null,
    targetT: a,
    elapsedMs: null,
    approximate: !1,
    changeCfs: null,
    referenceCfs: E(t) ? ge(t) : null,
    distanceCfs: null,
    reached: null,
    ...s
  };
}
function Bt(e, t) {
  let n = Ue(e.current.cfs, t.cfs), a = j(n) ? Ue(e.referenceCfs, n) : null;
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
function _t(e, t) {
  let n = Ht(e, t);
  if (!z(n.current))
    return { ...n, reason: _(n.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let a = Ie(e, n.targetT);
  return a ? z(a) ? Bt(n, a) : { ...n, comparison: a, reason: _("comparison_unusable") } : { ...n, reason: _("comparison_missing", { toleranceMs: Se }) };
}
function yt(e, t) {
  let n = Ht(e, t), a = {
    ...n,
    minimum: null,
    windowStartT: n.targetT,
    windowEndT: E(t) ? t : null,
    startSupport: null,
    maxGapMs: null
  };
  if (!z(a.current)) return { ...a, reason: _(a.current ? "current_observation_unusable" : "current_observation_unavailable") };
  let s = Ie(e, a.targetT);
  if (!s) return { ...a, reason: _("window_start_missing", { toleranceMs: Se }) };
  if (!z(s)) return { ...a, startSupport: s, reason: _("window_start_unusable") };
  let i = e.slice(Ce(e, a.targetT), Ce(e, t) + 1), o = i.find((l) => !z(l));
  if (o) return { ...a, startSupport: s, reason: _("window_unusable_observation", { t: o.t }) };
  let r = s.t < a.targetT ? [s, ...i] : i, u = 0;
  for (let l = 1; l < r.length; l++) u = Math.max(u, r[l].t - r[l - 1].t);
  if (u > fe) return {
    ...a,
    startSupport: s,
    maxGapMs: u,
    reason: _("observation_gap", { maxGapMs: u, allowedMs: fe })
  };
  let c = i.reduce((l, f) => !l || f.cfs < l.cfs ? f : l, null);
  return c ? {
    ...Bt(a, c),
    minimum: c,
    startSupport: s,
    maxGapMs: u,
    // The selected minimum is not an approximation to the 24-hour endpoint.
    approximate: !1
  } : { ...a, startSupport: s, maxGapMs: u, reason: _("window_empty") };
}
function lt(e, t, n = !1) {
  let a = [], s = [], i = [], o = [];
  for (let r of e) {
    if (!z(r) || n && r.cfs <= 0) {
      s.length && a.push(s), s = [], o.push({ t: r.t, reason: n && r.cfs <= 0 ? "non_positive_flow" : r.reason?.code ?? "unusable_observation" });
      continue;
    }
    let u = s[s.length - 1];
    u && r.t - u.t > t && (i.push({ startT: u.t, endT: r.t, reason: "unsupported_gap" }), a.push(s), s = []), s.push(ct(r));
  }
  return s.length && a.push(s), { segments: a, gaps: i, exclusions: o };
}
function le(e = "path_unavailable") {
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
function me(e, t = {}) {
  let n = e.filter((s) => s.length).map((s) => s.map(ct)), a = n.flat();
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
function Wt(e, t = Re, n = !1) {
  let a = lt(e, t, n);
  return me(a.segments, { gaps: a.gaps, exclusions: a.exclusions });
}
function Me(e, t) {
  if (!e.length || t < e[0].t || t > e[e.length - 1].t) return null;
  let n = Ce(e, t), a = e[n];
  if (a.t === t) return a.cfs;
  let s = e[n - 1], i = (t - s.t) / (a.t - s.t), o = (1 - i) * s.cfs + i * a.cfs;
  return j(o) ? o : null;
}
function Ze(e, t) {
  for (let n of e.segments) {
    let a = Me(n, t);
    if (a !== null) return a;
  }
  return null;
}
function $t(e, t, n) {
  let a = [];
  for (let s of e.segments) {
    let i = Math.max(t, s[0].t), o = Math.min(n, s[s.length - 1].t);
    if (i > o) continue;
    let r = [
      { t: i, cfs: Me(s, i) },
      ...s.filter((u) => u.t > i && u.t < o),
      ...o > i ? [{ t: o, cfs: Me(s, o) }] : []
    ];
    a.push(r);
  }
  return me(a, { gaps: e.gaps, exclusions: e.exclusions });
}
function Ye(e, t, n, a) {
  let s = Pe(n, t);
  return {
    available: !!e?.data,
    dataT: E(t) ? t : null,
    ageMs: s,
    stale: s === null || s > a,
    lastAttemptAt: E(e?.lastAttemptAt) ? e.lastAttemptAt : null,
    lastSuccessAt: E(e?.lastSuccessAt) ? e.lastSuccessAt : null,
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
function ea(e, t, n, a) {
  let s = t ? t.t - 12 * P : null, i = {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: t,
    comparison: null,
    targetT: s,
    elapsedMs: null,
    changeCfs: null,
    approximate: !1,
    asOf: !!(t && n - t.t > 30 * ke)
  };
  if (!z(t)) return { ...i, reason: _(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let o = Ie(e, s);
  if (!o) return { ...i, reason: _("comparison_missing", { toleranceMs: Se }) };
  let r = {
    ...i,
    comparison: o,
    elapsedMs: t.t - o.t,
    approximate: o.t !== s
  };
  if (!z(o)) return { ...r, reason: _("comparison_unusable") };
  if (n - t.t > 2 * P) return { ...r, reason: _("gauge_stale") };
  if (a?.error) return { ...r, reason: _("source_fetch_failed") };
  let u = e.slice(Ce(e, o.t), Ce(e, t.t) + 1), c = u.find((d) => !z(d));
  if (c) return { ...r, reason: _("unusable_observation", { t: c.t }) };
  let l = 0;
  for (let d = 1; d < u.length; d++) l = Math.max(l, u[d].t - u[d - 1].t);
  if (l > fe) return { ...r, reason: _("observation_gap", { maxGapMs: l, allowedMs: fe }) };
  let f = Ue(t.cfs, o.cfs);
  return j(f) ? { ...r, available: !0, reason: null, changeCfs: f } : { ...r, reason: _("non_finite_arithmetic") };
}
function ta(e, t, n, a) {
  let s = {
    available: !1,
    reason: _("current_observation_unavailable"),
    current: t,
    comparison: null,
    elapsedMs: null,
    changeCfs: null,
    toleranceCfs: null,
    label: "unavailable",
    asOf: !!(t && n - t.t > 30 * ke)
  };
  if (!z(t)) return { ...s, reason: _(t ? "current_observation_unusable" : "current_observation_unavailable") };
  let i = Ie(e, t.t - P);
  if (!z(i)) return { ...s, comparison: i, reason: _("direction_comparison_unavailable") };
  let o = Ue(t.cfs, i.cfs), r = Math.max(1, 0.01 * Math.max(t.cfs, i.cfs)), u = { ...s, comparison: i, elapsedMs: t.t - i.t, changeCfs: o, toleranceCfs: r };
  if (!j(o)) return { ...u, changeCfs: null, reason: _("non_finite_arithmetic") };
  if (n - t.t > 2 * P) return { ...u, reason: _("gauge_stale") };
  if (a?.error) return { ...u, reason: _("source_fetch_failed") };
  let c = e.filter((l) => l.t >= i.t && l.t <= t.t);
  return c.some((l) => !z(l)) || c.some((l, f) => f && l.t - c[f - 1].t > fe) ? { ...u, reason: _("direction_observation_gap") } : {
    ...u,
    available: !0,
    reason: null,
    label: Math.abs(o) <= r ? "roughly_level" : o > 0 ? "rising" : "falling"
  };
}
function jt(e, t, n) {
  let a = E(t) ? t - 7 * L : null, s = {
    windowStartT: a,
    windowEndT: E(t) ? t : null,
    coverageStartT: null,
    coverageEndT: null,
    coverageComplete: !1,
    evaluatedCount: 0,
    unavailableCount: 0,
    last: null
  };
  if (!E(t)) return s;
  for (let o of e) {
    if (o.t < a || o.t > t) continue;
    let r = n(e, o.t);
    r.available ? (s.evaluatedCount++, s.coverageStartT ?? (s.coverageStartT = o.t), s.coverageEndT = o.t, r.reached && (s.last = r)) : s.unavailableCount++;
  }
  let i = e.filter((o) => o.t >= a && o.t <= t);
  return s.coverageComplete = s.coverageStartT !== null && s.coverageStartT <= a + Se && s.coverageEndT >= t - fe && s.unavailableCount === 0 && !i.some((o, r) => r && o.t - i[r - 1].t > fe), s;
}
function qt(e, t, n) {
  if (!E(t)) return { ...le("observations_unavailable"), steps: [] };
  let a = [], s = [], i = [], o = [], r = null;
  for (let u of e) {
    if (u.t < t - 2 * L) continue;
    let c = n(e, u.t), l = c.comparison?.cfs;
    if (!c.available || !j(l + c.referenceCfs)) {
      o.length && a.push(o), o = [], r = null;
      continue;
    }
    if (r && u.t - r.t > fe && (i.push({ startT: r.t, endT: u.t, reason: "unsupported_gap" }), o.length && a.push(o), o = [], r = null), r) for (let d of Tt(r.t, u.t)) {
      let m = (d - r.t) / (u.t - r.t), h = (1 - m) * r.base + m * l, g = h + ge(d - 1), x = h + ge(d);
      o.push({ t: d, cfs: g }), a.push(o), o = [{ t: d, cfs: x }], s.push({ t: d, beforeCfs: g, afterCfs: x });
    }
    let f = { t: u.t, cfs: l + c.referenceCfs };
    o.at(-1)?.t !== u.t && o.push(f), r = { t: u.t, base: l };
  }
  return o.length && a.push(o), { ...me(a, { gaps: i }), steps: s };
}
function ot(e, t = "forecast_unavailable") {
  let n = () => le(t), a = () => ({ endpoint: Oe(t), low: Oe(t) });
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
function Oe(e = "path_unavailable", t = !1) {
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
function Tt(e, t) {
  if (!E(e) || !E(t) || e >= t) return [];
  let n = Y(e), a = Y(t), s = [];
  for (let i = n.year; i <= a.year; i++)
    for (let o of [3, 5, 11]) {
      let r = Le(i, o, 1);
      r > e && r <= t && s.push(r);
    }
  return s.sort((i, o) => i - o);
}
function na(e, t, n) {
  let a = $t(e, n.t - 2 * L, n.t), s = $t(t, n.t, t.endT ?? n.t), i = a.segments.map((o) => [...o]);
  for (let o of s.segments) {
    let r = o.filter((l) => l.t > n.t);
    if (!r.length) continue;
    let u = i[i.length - 1];
    o[0].t === n.t && u?.[u.length - 1].t === n.t ? u.push(...r) : i.push(r);
  }
  return me(i);
}
function Gt(e, t) {
  let n = t - L, a = Ze(e, t);
  if (a === null) return null;
  let s = Ze(e, n);
  if (s === null) return null;
  let i = e.segments.find((r) => r[0].t <= n && r[r.length - 1].t >= t), o = null;
  if (i) {
    o = s;
    for (let r of i) r.t > n && r.t <= t && (o = Math.min(o, r.cfs));
    o = Math.min(o, a);
  }
  return { current: a, endpoint: s, low: o };
}
function aa(e, t, n, a, s, i) {
  let o = Ze(t, s);
  if (o === null) return null;
  let r = s - L;
  if (r > a.t) {
    let h = Gt(e, s);
    return h && h[i] !== null ? { current: o, base: h[i] } : null;
  }
  if (i === "endpoint") {
    let h = Ie(n, r);
    return z(h) ? { current: o, base: h.cfs, comparisonT: h.t } : null;
  }
  let u = Ie(n, r);
  if (!z(u)) return null;
  let c = n.filter((h) => h.t >= r && h.t <= a.t), l = u.t < r ? [u, ...c] : c;
  if (!c.length || c.some((h) => !z(h)) || l.some((h, g) => g && h.t - l[g - 1].t > fe)) return null;
  let f = t.segments.find((h) => h[0].t <= a.t && h[h.length - 1].t >= s);
  if (!f) return null;
  let d = o, m = null;
  for (let h of c) h.cfs <= d && (d = h.cfs, m = h.t);
  for (let h of f) h.t > a.t && h.t <= s && h.cfs < d && (d = h.cfs, m = null);
  return { current: o, base: d, minimumObservedT: m };
}
function sa(e, t, n, a, s) {
  let i = [], o = (r) => {
    r > n && r <= a && i.push(r);
  };
  if (s === "endpoint") {
    for (let r = 1; r < e.length; r++)
      o(Math.floor((e[r - 1].t + e[r].t) / 2) + L + 1);
    for (let r of e)
      o(r.t - Se + L), o(r.t + Se + L + 1);
  } else for (let r of e) o(r.t + L + 1);
  return i.filter((r) => r - L <= t.t);
}
function ra(e, t, n, a, s = []) {
  let i = /* @__PURE__ */ new Set([t, n]);
  for (let r of e.points)
    for (let u of [r.t, r.t + L]) u >= t && u <= n && i.add(u);
  for (let r of Tt(t, n))
    i.add(r), r - 1 >= t && i.add(r - 1);
  for (let r of s)
    i.add(r), r - 1 >= t && i.add(r - 1);
  let o = [...i].sort((r, u) => r - u);
  for (let r = 1; r < o.length; r++) {
    let u = o[r - 1], c = o[r], l = (u + c) / 2, f = Gt(e, l);
    if (!f || a === "low" && f.low === null) {
      i.add(l);
      continue;
    }
    if (a !== "low") continue;
    let d = e.segments.find((g) => g[0].t <= l - L && g[g.length - 1].t >= l);
    if (!d) continue;
    let m = 1 / 0;
    for (let g of d) g.t > l - L && g.t < l && (m = Math.min(m, g.cfs));
    let h = [
      [Me(d, u - L), Me(d, c - L)],
      [Me(d, u), Me(d, c)],
      ...j(m) ? [[m, m]] : []
    ].filter((g) => g.every(j));
    for (let g = 0; g < h.length; g++) for (let x = g + 1; x < h.length; x++) {
      let b = h[g][0] - h[x][0], p = h[g][1] - h[x][1];
      if (!j(b) || !j(p) || b === p) continue;
      let y = b / (b - p);
      y > 0 && y < 1 && i.add(u + y * (c - u));
    }
  }
  return [...i].sort((r, u) => r - u);
}
function ia(e, t, n, a, s, i) {
  if (!t.available) return { reference: { ...le(t.reason), steps: [] }, crossing: Oe(t.reason, s) };
  let o = na(e, t, n), r = t.endT, u = n.t, c = sa(i, n, u, r, a), l = ra(o, u, r, a, c), f = /* @__PURE__ */ new Set([...Tt(u, r), ...c]), d = [], m = [], h = [], g = Oe("comparison_coverage_missing", s), x = 0, b = !1, p = null, y = (M) => {
    if (Ze(t, M) === null) return null;
    let $ = aa(o, t, i, n, M, a), k = $?.base;
    if (!$ || k === null || !j(k)) return null;
    let F = ge(M), H = k + F, G = Ue($.current, k);
    return j(H) && j(G) ? {
      t: M,
      current: $.current,
      base: k,
      line: H,
      delta: G,
      threshold: F,
      comparisonT: $.comparisonT ?? null,
      minimumObservedT: $.minimumObservedT ?? null
    } : null;
  };
  for (let M of l) {
    let $ = y(M);
    if (!$) {
      g.t === null && (b = !0), h.length && d.push(h), h = [], p = null;
      continue;
    }
    if (x++, f.has(M)) {
      let k = y(M - 1), F = ge(M - 1) !== $.threshold, H = k && k.base !== $.base && (a === "endpoint" ? k.comparisonT !== $.comparisonT : k.minimumObservedT !== null && k.minimumObservedT + L + 1 === M);
      if (k && h.length && (F || H)) {
        let G = H ? k.line : $.base + ge(M - 1);
        h.push({ t: M, cfs: G }), d.push(h), h = [], G !== $.line && m.push({ t: M, beforeCfs: G, afterCfs: $.line });
      }
    }
    if (h.push({ t: M, cfs: $.line }), g.t === null && $.delta >= $.threshold && !b) {
      let k = $;
      if (p && p.delta < p.threshold && !f.has(M) && ge(p.t) === $.threshold) {
        let F = p.t, H = M;
        for (; H - F > 1; ) {
          let G = Math.floor((H + F) / 2), _e = y(G);
          !_e || _e.delta < _e.threshold ? F = G : H = G;
        }
        k = y(H) ?? $;
      }
      g = {
        available: !0,
        reason: null,
        t: k.t,
        currentCfs: k.current,
        comparisonCfs: k.base,
        changeCfs: k.delta,
        referenceCfs: k.threshold,
        alreadyReached: k.t === n.t,
        largeAdjustment: s
      };
    }
    p = $;
  }
  h.length && d.push(h), g.t === null && x && !b ? g = { ...Oe(null, s), available: !0, reason: null } : g.t === null && b && (g = Oe("comparison_coverage_missing", s));
  let D = d.map((M) => {
    let $ = [];
    for (let k of M)
      $.length >= 2 && $.at(-2).cfs === $.at(-1).cfs && $.at(-1).cfs === k.cfs && $.pop(), $.push(k);
    return $;
  });
  return { reference: { ...me(D), steps: m }, crossing: g };
}
function oa(e, t) {
  let n = [e, t];
  for (let s = e + ke; s < t; s += ke) n.push(s);
  let a = n.map((s) => {
    let i = Y(s);
    return i.hour >= 8 && (i.hour < 17 || i.hour === 17 && i.minute === 0 && i.second === 0);
  });
  return a.every(Boolean) ? "inside_08_17" : a.every((s) => !s) ? "outside_08_17" : "spans_both";
}
function la(e, t) {
  let n = [];
  for (let a of e.segments) {
    let s = 0;
    for (; s < a.length; ) {
      let i = s;
      for (; i + 1 < a.length && a[i + 1].cfs === a[s].cfs; ) i++;
      let o = a[s - 1], r = a[i + 1];
      if (o && r && o.cfs < a[s].cfs && r.cfs < a[i].cfs && a[i].t > t) {
        let u = s - 1;
        for (; u > 0 && a[u - 1].cfs <= a[u].cfs; ) u--;
        let c = ct(a[u]);
        n.push({
          startT: a[s].t,
          endT: a[i].t,
          cfs: a[s].cfs,
          precedingLow: c,
          riseCfs: a[s].cfs - c.cfs,
          bracketStartT: o.t,
          bracketEndT: r.t,
          clockRange: oa(o.t, r.t)
        });
      }
      s = i + 1;
    }
  }
  return n.sort((a, s) => a.startT - s.startT);
}
function ca(e, t, n, a, s, i, o) {
  let r = ot(e), u = t?.data;
  if (!u) return r;
  let c = u.issuedT;
  r.issuedT = E(c) ? c : null, r.issueAgeMs = Pe(e, c), r.older = r.issueAgeMs !== null && r.issueAgeMs > 12 * P, r.cases.tableVersion = o?.version ?? null, r.cases.trainingCutoff = o?.training_cutoff_utc ?? null;
  let l = (p) => ({
    ...ot(e, p),
    issuedT: r.issuedT,
    issueAgeMs: r.issueAgeMs,
    older: r.older,
    cases: { ...r.cases, reason: _(p) }
  });
  if (!E(c)) return l("forecast_issue_missing");
  if (c > e) return l("forecast_issue_future");
  if (e - c > 48 * P) return l("forecast_issue_too_old");
  let f = Dt(u.points).filter((p) => p.t <= e + 10 * L), d = Wt(f, Re);
  if (!d.segments.some((p) => p[0].t <= e + Re && p[p.length - 1].t >= e + L))
    return l("forecast_next_day_coverage_missing");
  if (r.available = d.available, r.reason = d.reason, r.raw = d, r.crests = la(d, i?.t ?? e), r.nextCrest = r.crests[0] ?? null, r.laterHigherCrests = r.nextCrest ? r.crests.slice(1).filter((p) => p.cfs > r.nextCrest.cfs) : [], !z(i)) {
    let y = ot(e, i ? "current_observation_unusable" : "current_observation_unavailable");
    return {
      ...r,
      shifted: y.shifted,
      high: y.high,
      low: y.low,
      references: y.references,
      crossings: y.crossings,
      higherLater: y.higherLater,
      cases: { ...r.cases, reason: y.cases.reason }
    };
  }
  let m = Ze(d, i.t);
  if (m === null) {
    let p = ot(e, "forecast_alignment_unsupported");
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
  let h = Ue(i.cfs, m);
  if (!j(h)) return l("non_finite_arithmetic");
  r.offsetCfs = h, r.largeAdjustment = Math.abs(h) > Math.max(10, 0.1 * i.cfs);
  let g = [], x = [];
  for (let p of d.segments) {
    let y = p.map((M) => ({ t: M.t, cfs: M.cfs + h })), D = lt(y, Re, !0);
    g.push(...D.segments), x.push(...D.exclusions);
  }
  r.shifted = $t(me(g, { gaps: d.gaps, exclusions: x }), i.t, i.t + 72 * P), r.shifted.points.some((p) => p.t > i.t) || (r.shifted = { ...le("non_positive_shifted_flow"), exclusions: x, gaps: d.gaps }), r.freshContext = !r.older && !t.error && !n?.error && e - i.t <= 2 * P, r.higherLater = {
    available: !1,
    reason: _("forecast_context_not_current"),
    aboveCurrent: null,
    peakCfs: null,
    peakT: null,
    largeAdjustment: r.largeAdjustment
  };
  let b = r.shifted.points.filter((p) => p.t > i.t);
  if (r.freshContext && b.length) {
    let p = b.reduce((y, D) => D.cfs > y.cfs ? D : y);
    r.higherLater = {
      available: !0,
      reason: null,
      aboveCurrent: p.cfs > i.cfs,
      peakCfs: p.cfs,
      peakT: p.t,
      largeAdjustment: r.largeAdjustment
    };
  }
  if (r.cases.wetSeason = [1, 2, 3, 4, 10, 11, 12].includes(Y(e).month), !r.cases.wetSeason)
    r.cases.reason = _("historical_cases_off_season"), r.high = le(r.cases.reason), r.low = le(r.cases.reason);
  else if (!o || o.version !== 3 || o.apply_to !== "flow" || !Array.isArray(o.bins) || !o.bins.length)
    r.cases.reason = _("historical_table_unavailable"), r.high = le(r.cases.reason), r.low = le(r.cases.reason);
  else
    try {
      let p = [], y = [], D = [], M = [];
      for (let $ of r.shifted.segments) {
        let k = It($, i, o, e), F = $[0]?.t === i.t && i.cfs > 0 ? [ct(i)] : [], H = lt([...F, ...k.high], Re, !0), G = lt([...F, ...k.low], Re, !0);
        p.push(...H.segments), y.push(...G.segments), D.push(...H.exclusions), M.push(...G.exclusions);
      }
      r.high = me(p, { gaps: r.shifted.gaps, exclusions: D }), r.low = me(y, { gaps: r.shifted.gaps, exclusions: M });
      for (let $ of ["high", "low"]) r[$].points.some((k) => k.t > i.t) || (r[$] = { ...le("historical_case_values_unsupported"), exclusions: r[$].exclusions, gaps: r[$].gaps });
      r.cases.available = r.high.available || r.low.available, r.cases.reason = r.cases.available ? null : _("historical_case_values_unsupported");
    } catch {
      r.cases.reason = _("historical_table_invalid"), r.high = le(r.cases.reason), r.low = le(r.cases.reason);
    }
  for (let p of ["shifted", "high", "low"])
    for (let y of ["endpoint", "low"]) {
      let D = ia(s, r[p], i, y, r.largeAdjustment, a);
      r.crossings[p][y] = D.crossing, p === "shifted" && (r.references[y] = D.reference);
    }
  return r;
}
function ua(e, t) {
  let n = t?.data, a = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
  for (let l of n?.conflicts ?? []) E(l) && l <= e && l % P === 0 && s.add(l);
  for (let l of n?.hours ?? [])
    if (!(!E(l.endT) || l.endT > e || l.endT % P !== 0)) {
      if (!j(l.mm) || l.mm < 0) {
        s.add(l.endT);
        continue;
      }
      a.has(l.endT) && a.get(l.endT) !== l.mm ? s.add(l.endT) : a.set(l.endT, l.mm);
    }
  let i = [...a.keys(), ...s], o = i.length ? Math.max(...i) : null, r = Pe(e, o), u = Qn.map((l) => {
    let f = {
      hours: l,
      available: !1,
      reason: _("radar_unavailable"),
      startT: o === null ? null : o - l * P,
      endT: o,
      ageMs: r,
      mm: null,
      inches: null
    };
    if (o === null) return f;
    let d = 0;
    for (let m = 0; m < l; m++) {
      let h = o - m * P;
      if (s.has(h)) return { ...f, reason: _("radar_conflicting_hour", { endT: h }) };
      if (!a.has(h)) return { ...f, reason: _("radar_missing_hour", { endT: h }) };
      d += a.get(h);
    }
    return j(d) ? { ...f, available: !0, reason: null, mm: d, inches: d / 25.4 } : { ...f, reason: _("non_finite_arithmetic") };
  }), c = u.some((l) => l.available);
  return {
    available: c,
    reason: c ? null : _("radar_windows_unavailable"),
    endT: o,
    generatedT: E(n?.generatedT) ? n.generatedT : null,
    ageMs: r,
    historical: r !== null && r > 2 * P,
    stale: r === null || r > 3 * P,
    windows: u
  };
}
function fa(e, t) {
  let n = t?.data, a = Pe(e, n?.updatedT), s = {
    available: !1,
    reason: _("grid_forecast_unavailable"),
    startT: e,
    endT: e + L,
    updatedT: E(n?.updatedT) ? n.updatedT : null,
    issueAgeMs: a,
    stale: a === null || a > 12 * P,
    mm: null,
    inches: null,
    prorated: !1,
    gridId: n?.gridId ?? null,
    gridX: n?.gridX ?? null,
    gridY: n?.gridY ?? null
  };
  if (!n) return s;
  if (!E(n.updatedT) || n.updatedT > e) return { ...s, reason: _("grid_issue_invalid") };
  let i = (n.periods ?? []).filter((c) => E(c.startT) && E(c.endT) && c.endT > e && c.startT < e + L).sort((c, l) => c.startT - l.startT || c.endT - l.endT), o = e, r = 0, u = !1;
  for (let c of i) {
    if (c.startT >= c.endT || !j(c.mm) || c.mm < 0) return { ...s, reason: _("grid_interval_invalid") };
    let l = Math.max(e, c.startT), f = Math.min(e + L, c.endT);
    if (l < o) return { ...s, reason: _("grid_interval_overlap", { t: l }) };
    if (l > o) return { ...s, reason: _("grid_interval_gap", { startT: o, endT: l }) };
    let d = (f - l) / (c.endT - c.startT);
    r += c.mm * d, u || (u = d !== 1), o = f;
  }
  return o < e + L ? { ...s, reason: _("grid_interval_gap", { startT: o, endT: e + L }) } : j(r) ? { ...s, available: !0, reason: null, mm: r, inches: r / 25.4, prorated: u } : { ...s, reason: _("non_finite_arithmetic") };
}
function da(e, t) {
  let n = t?.data, a = Pe(e, t?.lastSuccessAt), s = {
    available: !1,
    reason: _("tides_unavailable"),
    stationId: "9449211",
    datum: "MLLW",
    fetchAgeMs: a,
    stale: a === null || a > 36 * P,
    startT: e,
    endT: e + 2 * L,
    events: []
  };
  if (!n) return s;
  if (String(n.stationId) !== "9449211" || n.datum !== "MLLW") return { ...s, reason: _("tide_identity_or_datum_invalid") };
  let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  for (let u of n.points ?? []) {
    if (!E(u.t) || u.t < e || u.t > e + 2 * L || !j(u.ft) || !["H", "L"].includes(u.type)) continue;
    let c = i.get(u.t);
    c && (c.ft !== u.ft || c.type !== u.type) && o.add(u.t), i.set(u.t, { t: u.t, ft: u.ft, type: u.type });
  }
  let r = [...i.values()].filter((u) => !o.has(u.t)).sort((u, c) => u.t - c.t);
  return { ...s, available: r.length > 0, reason: r.length ? null : _("tide_events_unavailable"), events: r };
}
function Vt({ nowMs: e, sources: t = {}, ratioTable: n = null } = {}) {
  if (!E(e)) throw new RangeError("buildWatchModel requires a valid nowMs");
  let a = t.gauge?.data, s = Dt(a?.points).filter((g) => g.t <= e), i = s[s.length - 1] ?? null, o = [...s].reverse().find((g) => z(g)) ?? null, r = Wt(s, fe), u = i?.t ?? null, c = Ye(t.gauge, u, e, 2 * P), l = {
    latest: i,
    lastNumericObservation: o,
    points: s,
    segments: r.segments,
    exclusions: a?.exclusions ?? [],
    coveredWindow: a?.coveredWindow ?? null,
    ageMs: Pe(e, u),
    stale: c.stale,
    referenceCfs: E(u) ? ge(u) : null,
    endpoint: _t(s, u),
    low: yt(s, u),
    references: { endpoint: qt(s, u, _t), low: qt(s, u, yt) },
    direction: ta(s, i, e, t.gauge),
    twelveHourChange: ea(s, i, e, t.gauge),
    history: { endpoint: jt(s, u, _t), low: jt(s, u, yt) }
  }, f = ca(e, t.noaa, t.gauge, s, r, i, n), d = ua(e, t.radar), m = fa(e, t.grid), h = da(e, t.tides);
  return {
    schemaVersion: 1,
    nowMs: e,
    actualCurrentObservation: i,
    sources: {
      gauge: c,
      noaa: Ye(t.noaa, f.issuedT, e, 12 * P),
      radar: Ye(t.radar, d.endT, e, 3 * P),
      grid: Ye(t.grid, m.updatedT, e, 12 * P),
      tides: Ye(t.tides, t.tides?.lastSuccessAt, e, 36 * P)
    },
    gauge: l,
    forecast: f,
    rain: { radar: d, grid: m },
    tides: h
  };
}

// site/js/watch-render.js
function Xt(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n], n)) return e[n];
}
var T = (e) => String(e ?? "").replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]), ae = (e) => typeof e == "number" && Number.isFinite(e);
function Jt(e, t = !1) {
  if (!ae(e)) return "Unavailable";
  let n = Math.abs(e), a = n !== 0 && (n >= 1e7 || n < 1e-5) ? e.toExponential(5) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, maximumSignificantDigits: 12 }).format(e);
  return t && e > 0 ? `+${a}` : a;
}
function qe(e, t = !1) {
  if (!ae(e)) return "Unavailable";
  let n = e !== 0 && Math.abs(e) < 0.1 ? Number(e.toPrecision(2)).toString() : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(e);
  return t && e > 0 ? `+${n}` : n;
}
function J(e, t = !1) {
  if (!ae(e)) return "Unavailable";
  let n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(e));
  return t && e > 0 ? `+${n}` : n;
}
function X(e, t = !1) {
  return ae(e) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", ...t ? {} : { weekday: "short" }, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(e) : "time unavailable";
}
function K(e) {
  if (!ae(e) || e < 0) return "unknown age";
  if (e < 6e4) return "less than 1 minute";
  let t = Math.floor(e / 6e4), n = Math.floor(t / 60), a = Math.floor(n / 24);
  return a ? `${a}d ${n % 24}h ${t % 60}m` : n ? `${n}h ${t % 60}m` : `${t} minute${t === 1 ? "" : "s"}`;
}
function zt(e) {
  return ae(e) ? e > 0 && e < 0.01 ? "less than 0.01" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(e) : "Unavailable";
}
var Yt = { missing_comparison: "No supported comparison reading near the required time.", missing_current: "The latest reading is not usable.", insufficient_history: "There is not enough supported history.", missing_history: "There is not enough supported history.", incomplete_window: "Missing readings leave this window incomplete.", gap: "A gap in the readings prevents this calculation.", stale: "The retained data are old.", forecast_stale: "This forecast is too old to use.", missing_source: "This source is unavailable.", off_season: "Historical cases are available only for October\u2013April.", nonpositive_shift: "The adjustment would create a non-positive flow, so that part is withheld.", unsupported_units: "The source units are unsupported.", ineligible_quality: "The newest reading does not support automatic turn checks.", clock_uncertain: "The monitor could not confirm its clock.", missing_quarter_hours: "Required quarter-hour readings are missing.", rate_limited: "The warning rate limit has been reached." };
function De(e) {
  if (!e) return "Insufficient supported data.";
  if (Array.isArray(e)) return e.map(De).join(" ");
  let t = typeof e == "string" ? e : e.code;
  return Yt[t] || (typeof e == "object" && typeof e.message == "string" ? e.message : "Insufficient supported data.");
}
Object.assign(Yt, {
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
function je(e, t) {
  let n = document.getElementById(e);
  n && (n.innerHTML = t);
}
var ha = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}"><span aria-hidden="true">\u24D8</span></button>`, Zt = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, be = (e) => `<time datetime="${ae(e) ? new Date(e).toISOString() : ""}">${T(X(e, !0))}</time>`;
var pa = ["forecast_issue_future", "forecast_issue_too_old", "forecast_next_day_coverage_missing", "historical_cases_off_season"];
function ga(e, t) {
  let n = typeof t == "string" ? t : t?.code;
  if (e.timeUncertain && n === "forecast_context_not_current") return De("public_time_uncertain");
  let a = De(t);
  return e.timeUncertain && pa.includes(n) ? `At the snapshot save time: ${a}` : a;
}
function Qt(e, t) {
  let n = e.forecast || {}, a = (h) => ga(e, h);
  je("forecast-age", n.issuedT ? `Issued ${be(n.issuedT)} \xB7 ${T(e.timeUncertain ? "age unknown" : K(n.issueAgeMs) + " old")}${n.older && !e.timeUncertain ? " \xB7 older forecast" : ""}.${n.available === !1 ? ` ${T(a(n.reason))}` : ""}` : `Forecast unavailable. ${T(a(n.reason))}`);
  let s = [];
  e.sources?.noaa?.error && s.push("Latest forecast retrieval failed; retained values keep their issue time."), n.largeAdjustment && s.push({ text: `Gauge adjustment makes the forecast ${n.offsetCfs < 0 ? "lower" : "higher"} by ${qe(Math.abs(n.offsetCfs))} cfs.`, neutral: n.offsetCfs < 0 });
  let i = n.available && n.shifted?.reason?.code === "forecast_alignment_unsupported";
  i ? s.push({ text: a(n.shifted.reason), neutral: !0 }) : n.available && n.shifted?.available === !1 && s.push(`Adjusted forecast unavailable. ${a(n.shifted.reason)}`), n.available && n.cases?.available === !1 && !(i && n.cases?.reason?.code === "forecast_alignment_unsupported") && s.push(`Historical cases unavailable. ${a(n.cases.reason)}`), je("forecast-problems", s.map((h) => `<p${typeof h == "object" && h.neutral ? ' class="neutral"' : ""}>${T(typeof h == "object" ? h.text : h)}</p>`).join(""));
  let o = document.getElementById("forecast-problems");
  (i && s.length === 1 ? document.getElementById("chart-readout") : document.getElementById("forecast-age"))?.insertAdjacentElement?.("afterend", o);
  let u = n.crossings?.shifted?.[t.reference], c = u?.available ? ae(u.t) ? `The adjusted forecast ${u.alreadyReached ? "already meets" : "first reaches"} the reference at ${X(u.t, !0)}.` : "No supported adjusted-forecast crossing is calculated." : `Crossing unavailable. ${a(u?.reason)}`, l = ae(n.offsetCfs) ? `Adjustment to the gauge reading: ${qe(n.offsetCfs, !0)} cfs.` : "A supported adjustment to the gauge reading is unavailable.", f = Date.parse(n.cases?.trainingCutoff ?? ""), d = ae(n.cases?.tableVersion) ? `<p>Frozen historical-case table version ${Jt(n.cases.tableVersion)}${ae(f) ? `; training cutoff ${be(f)}` : ""}.</p><div class="station-links"><a href="/data/ratio_table.json" target="_blank" rel="noopener noreferrer">View the frozen table and its source history</a></div>` : "";
  je("forecast-details", Zt("forecast", "Forecast and chart", `<p>The key above the graph names the lines currently drawn. Lines can overlap when their values match. Missing lines or gaps mean the data do not support drawing them.</p><ul class="line-guide-list"><li><i class="obs" aria-hidden="true"></i><div><strong>Measured river flow</strong><p>What the river gauge actually recorded.</p></div></li><li><i class="raw" aria-hidden="true"></i><div><strong>Official river forecast</strong><p>The National Weather Service prediction, unchanged.</p></div></li><li><i class="shifted" aria-hidden="true"></i><div><strong>Adjusted forecast</strong><p>The official forecast moved up or down to match the latest gauge reading at that reading's time. This is a comparison, not a new official forecast.</p></div></li><li><i class="case" aria-hidden="true"></i><div><strong>Past high / low cases</strong><p>Higher and lower examples based on earlier forecast misses. These are not probabilities or guaranteed bounds.</p></div></li><li><i class="reference" aria-hidden="true"></i><div><strong>24-hour rise reference</strong><p>The flow needed to reach the selected rolling 24-hour increase. This line moves with earlier measurements or the adjusted forecast; it is not a fixed flow limit or a closure decision.</p></div></li></ul><p>National Weather Service river forecast for SMRW1${ae(n.raw?.endT) ? `; available through ${be(n.raw.endT)}` : ""}.</p><p>${T(l)} ${n.available === !1 ? `The issued forecast is unavailable. ${T(a(n.reason))}` : "The original forecast remains visible."}</p><p>The reference adds a seasonal rise to the selected earlier flow; it is not a fixed flow limit. ${T(c)}</p><p>Between readings, values follow straight-line estimates. Observation gaps over 30 minutes and forecast gaps over six hours stay blank. Nothing extends beyond supported points. Estimates are rounded; headline comparisons use actual readings.</p><p>Past high and low ranges reflect earlier forecast misses. They are not probabilities or proven forecasts. Cases extend up to 72 hours from the latest reading in October\u2013April. A low case stops when its historical subtraction reaches zero; this does not predict a dry river. Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.</p>${d}<p>Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.</p><p>Nearby forecast times show the spacing of model readings. They do not bound when the river will actually crest.</p>`));
}
function Kt(e) {
  let t = e.rain?.radar || {}, n = e.rain?.grid || {}, a = t.endT ? `All totals end ${X(t.endT, !0)} \xB7 ${e.timeUncertain ? "age unknown" : K(t.ageMs) + " ago"}${e.timeUncertain ? "" : t.stale ? " \xB7 STALE" : t.historical ? " \xB7 historical" : ""}.` : "Hour-ending rainfall time unavailable.", s = t.windows || [2, 4, 6, 8, 12, 18, 24].map((r) => ({ hours: r, available: !1 })), i = [...new Set(s.filter((r) => !r.available).map((r) => De(r.reason || t.reason)))], o = Zt("rain", "How rainfall is estimated", "<p>Totals use complete hourly radar estimates averaged over the drainage area. Missing or conflicting hours make that total unavailable; partial hours are excluded. Radar cannot confirm whether rain has stopped upriver.</p><p>The rainfall forecast is for one grid cell near the watershed, not measured watershed rainfall. Partial forecast intervals are prorated.</p><p>Mount Vernon and Sakuma links open official Washington State University station pages; those readings are not imported here.</p>");
  je("rain", `<div class="section-heading"><h2>Rain</h2>${ha("rain", "About rainfall")}</div><p class="meta">Radar estimate over the drainage area; not a rain gauge.</p><p class="meta" id="rain-end">${T(a)}</p><div class="station-links"><a href="https://weather.wsu.edu/widget/current?unit_id=100090" target="_blank" rel="noopener noreferrer">Mount Vernon station \u2197</a><a href="https://weather.wsu.edu/widget/current?unit_id=330159" target="_blank" rel="noopener noreferrer">Sakuma station \u2197</a></div>${o}<div class="rain-total-grid">${s.map((r) => `<div class="rain-total" aria-label="${r.hours}-hour total ending ${T(X(r.endT ?? t.endT, !0))}, ${T(e.timeUncertain ? "age unknown" : K(r.ageMs ?? t.ageMs) + " old")}"><span>${r.hours} hours</span><strong>${r.available ? zt(r.inches) + " in" : "Unavailable"}</strong></div>`).join("")}</div>${i.length ? `<p class="meta">${i.map(T).join(" ")}</p>` : ""}<div class="rain-secondary"><h3>Forecast rain \xB7 one nearby grid point</h3><p>${e.timeUncertain ? "Unavailable while current time is uncertain." : n.available ? `<strong>${zt(n.inches)} inches</strong> over the next 24 hours.` : `Unavailable. ${T(De(n.reason))}`}</p>${n.updatedT ? `<p class="meta">Updated ${be(n.updatedT)} \xB7 ${T(e.timeUncertain ? "age unknown" : K(n.issueAgeMs) + " old")}${n.stale && !e.timeUncertain ? " \xB7 STALE" : ""}.</p>` : ""}<p class="meta">National Weather Service forecast; not measured watershed rainfall.</p></div>`);
}
function en(e) {
  let t = e.tides || {};
  je("tides", `<div class="disclosure-body"><p>Predicted high and low tides for Bellingham, station 9449211. Feet relative to Mean Lower Low Water (MLLW).</p><p class="meta">${e.timeUncertain ? "Saved predicted events; the current 48-hour window cannot be confirmed. Retrieval age unknown" : "Next 48 hours. Retrieved " + T(K(t.fetchAgeMs)) + " ago" + (t.stale ? " \xB7 STALE" : "")}. Predictions do not establish boat clearance or access to sampling stations.</p>${t.available ? `<table class="tide-table"><thead><tr><th>Pacific time</th><th>Tide</th><th>Feet MLLW</th></tr></thead><tbody>${(t.events || []).map((n) => `<tr><td>${be(n.t)}</td><td>${n.type === "H" ? "High" : "Low"}</td><td>${Jt(n.ft)}</td></tr>`).join("")}</tbody></table>` : `<p>${T(De(t.reason))}</p>`}</div>`);
}
function tn(e, t, n) {
  je("sources", Object.entries({ gauge: "U.S. Geological Survey (USGS) \xB7 gauge 12201500", noaa: "NOAA issued river forecast \xB7 SMRW1", radar: "Multi-Radar/Multi-Sensor (MRMS) radar rainfall estimate", grid: "National Weather Service \xB7 forecast grid cell", tides: "NOAA Bellingham tide predictions" }).map(([s, i]) => {
    let o = t.sources?.[s] || {}, r = n?.sources?.[s] || {};
    return `<div class="source-row"><strong>${T(i)}</strong>${s === "tides" ? "<p>Prediction event times are listed in the tide panel; they are not observation times.</p>" : `<p>Data time: ${be(o.dataT)} \xB7 ${T(t.timeUncertain ? "age unknown" : K(o.ageMs) + " old")}${o.stale && !t.timeUncertain ? " \xB7 STALE" : ""}.</p>`}<p>Last successful retrieval: ${be(r.lastSuccessAt ?? o.lastSuccessAt)}.${r.error || o.error ? " Latest retrieval failed; any retained values keep their original data time." : ""}</p></div>`;
  }).join("") + `<p>Snapshot saved ${be(e.createdAt)}. This save time is not the observation time. Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.</p>`);
}

// site/js/watch-preview.js
var Z = 36e5, nn = 15 * 6e4, te = Number.isFinite;
function Qe(e, t) {
  let n = (r) => {
    let [u, c = "0"] = String(r).toLowerCase().split("e"), l = u.includes(".") ? u.length - u.indexOf(".") - 1 : 0;
    return { coefficient: BigInt(u.replace(".", "")), exponent: Number(c) - l };
  }, a = n(e), s = n(t), i = Math.min(a.exponent, s.exponent);
  return +`${a.coefficient * 10n ** BigInt(a.exponent - i) - s.coefficient * 10n ** BigInt(s.exponent - i)}e${i}`;
}
var V = (e) => `<time datetime="${new Date(e).toISOString()}">${T(X(e, !0))}</time>`, Ke = (e, t) => {
  document.getElementById(e).innerHTML = t;
}, an = (e, t) => `<button id="${e}-help-toggle" class="help-toggle" type="button" data-help-target="${e}-help" aria-controls="${e}-help" aria-expanded="false" aria-label="${t}">\u24D8</button>`, sn = (e, t, n) => `<details id="${e}-help" class="section-help"><summary hidden>${t}</summary><div class="help-content" role="region" aria-labelledby="${e}-help-heading"><h3 id="${e}-help-heading">${t}</h3>${n}<button id="${e}-help-close" type="button" data-help-close="${e}-help">Close help</button></div></details>`, ma = "This page confirms an observed crest so far after at least 6 elapsed hours below a measured high, at least a 5% and 2 cfs drop, and uninterrupted eligible readings no more than 30 minutes apart. Each rebound from its most recent trough exceeding the larger of 2 cfs or 1% of that high resets the falling clock to the last increasing reading in that upswing. Flat readings and smaller flickers are allowed; the clock does not mean continuous falling. Rising requires a recent upward contribution, including a cumulative six-hour change when the hourly change is small. The river may rise again; this is a description of readings, not a forecast or a sampling rule.";
function ba(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  let a = e.gauge || {}, s = a.latest, i = (S) => ({ state: t ? "checking" : "unavailable", label: t ? "Checking river readings\u2026" : "Crest status unavailable", why: S, peak: null, high: null, fallMs: null });
  if (t) return i("Verification is in progress.");
  if (n || e.timeUncertain) return i("A current snapshot and current time must be verified first.");
  if (!s || !te(s.cfs) || s.usable !== !0 || s.eligible !== !0) return i("The newest gauge reading is missing or its quality does not support a crest check.");
  if (a.ageMs > Z || e.sources?.gauge?.error) return i("The newest eligible reading must be no more than one hour old, with a successful latest retrieval.");
  let o = a.points.filter((S) => S.t >= s.t - 48 * Z && S.t <= s.t), r = [], u = null;
  for (let S of o) S.eligible === !0 && S.usable === !0 && te(S.cfs) && (!u || S.cfs >= u.cfs) && (u = S);
  for (let S = o.length - 1; S >= 0; S--) {
    let v = o[S];
    if (v.eligible !== !0 || v.usable !== !0 || !te(v.cfs) || r.length && r[0].t - v.t > 2 * nn) break;
    r.unshift(v);
  }
  if (r.length < 5 || s.t - r[0].t < Z) return i("At least an hour of uninterrupted eligible observations is needed.");
  let c = r[0], l = c, f = c, d = c.t, m = null, h = !1, g = !1, x = c, b = null;
  for (let S = 1; S < r.length; S++) {
    let v = r[S], ie = Math.max(2, c.cfs * 0.01), st = Math.max(2, c.cfs * 0.05);
    if (v.cfs >= c.cfs) {
      v.cfs - l.cfs > ie && c.cfs - l.cfs > ie && (g = !0), h || (h = Qe(v.cfs, f.cfs) > Math.max(2, v.cfs * 0.01)), c = v, l = v, d = v.t, x = v, b = null;
      continue;
    }
    v.cfs < l.cfs && (l = v);
    let pt = v.cfs - l.cfs;
    b ? v.cfs > b.cfs ? (d = v.t, b = v) : b.cfs - v.cfs > ie && (b = null, x = v) : (v.cfs < x.cfs && (x = v), v.cfs - x.cfs > ie && (d = v.t, b = v, g = !0)), c.cfs - l.cfs >= st && pt >= st && (m = c, f = l, c = v, l = v, h = !0, d = v.t, x = v, b = null);
  }
  let p = Math.max(2, c.cfs * 0.01), y = c.cfs - s.cfs, D = s.t - Math.max(c.t, d), M = s.t - c.t, $ = r[0].t, k = $ > o[0].t, F = r.reduce((S, v) => Math.abs(v.t - (s.t - Z)) < Math.abs(S.t - (s.t - Z)) ? v : S, r[0]), H = r.reduce((S, v) => Math.abs(v.t - (s.t - 2 * Z)) < Math.abs(S.t - (s.t - 2 * Z)) ? v : S, r[0]), G = Qe(s.cfs, H.cfs) > 0, _e = r.filter((S) => S.t >= s.t - 6 * Z).reduce((S, v) => Math.min(S, v.cfs), s.cfs), ze = Qe(s.cfs, F.cfs) > p || y <= p && s.t - c.t < Z && Qe(s.cfs, _e) > p && G, ye = { high: u, earlierPeak: m, peak: c, fallMs: D, sincePeakMs: M, drop: y, bracketed: h, evidenceStartT: $, hadGap: k }, Xe = !!b && s.cfs >= b.cfs && s.cfs - x.cfs > p && G;
  if (s.cfs - l.cfs > p && (ze || Xe)) return { ...ye, state: "rising_again", label: "Rising again \u2014 crest not confirmed", peak: null };
  if (y <= p) {
    let S = ze;
    return { ...ye, state: S ? m || g ? "rising_again" : "rising" : "level", label: S ? m || g ? "Rising again \u2014 crest not confirmed" : "Rising \u2014 crest not confirmed" : "Little change \u2014 crest not confirmed", peak: null, fallMs: 0 };
  }
  if (!h) return { ...ye, state: "falling_unbracketed", label: "Falling \u2014 crest not established" };
  let Je = D >= 6 * Z && y >= Math.max(2, c.cfs * 0.05);
  return { ...ye, state: Je ? "confirmed" : "possible", label: Je ? "Observed crest so far" : "Possible crest \u2014 not confirmed" };
}
function va(e, { checking: t = !1, suppressed: n = !1 } = {}) {
  let a = e.gauge, s = a.endpoint, i = a.latest, o = s.available, r = o && s.elapsedMs === 24 * Z, u = o ? J(s.changeCfs, !0) : "Unavailable", c = o ? s.changeCfs < 0 ? "No net 24-hour rise" : s.distanceCfs === 0 ? `At the ${J(s.referenceCfs)} cfs rise trigger` : `${Math.abs(s.distanceCfs) < 0.5 ? "Less than 1" : J(Math.abs(s.distanceCfs))} cfs ${s.distanceCfs > 0 ? "below" : "above"} the ${J(s.referenceCfs)} cfs rise trigger` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", l = e.timeUncertain ? "age unknown" : `${K(a.ageMs)} old${a.stale ? " \xB7 STALE" : ""}`, f = te(i?.cfs) ? `${J(i.cfs)} cfs` : "unavailable", d = n || a.stale || e.timeUncertain, m = o ? `${u} cfs ${d ? "over the 24 hours to this reading" : r ? "in the last 24 hours" : "over about 24 hours"}` : t ? "Checking the 24-hour rise\u2026" : "24-hour rise unavailable", h = o && s.changeCfs < 0 ? " (a fall; no net rise)" : "", g = a.history?.endpoint?.last, x = o && s.distanceCfs > 0 && g ? `<p class="meta rise-history-note">Rise reference last met ${V(g.current?.t ?? g.windowEndT)}. Closure status is decided by health authorities.</p>` : "";
  Ke("current", `<div class="flow-row"><div class="section-heading flow-heading"><h2>24-hour rise</h2>${an("flow", "About flow readings")}</div><div class="rise-headline"><strong class="distance-headline">${T(m + h)}</strong><b class="rise-support">${T(c)}</b></div>${x}<div class="preview-flow"><strong class="actual-flow flow-number">Actual flow: ${T(f)} \xB7 ${T(l)}</strong>${i ? V(i.t) : ""}</div></div><p class="authority">Rise trigger calculation unconfirmed. Health authorities decide closures and reopening.</p>${sn("flow", "How flow comparisons work", `<p>Flow is water passing the gauge, in cubic feet per second (cfs). A rise of 400 cfs means an increase of 400, not a river flow of 400.</p><p>The 24-hour rise compares the newest actual reading with the actual reading nearest 24 elapsed hours earlier, within 15 minutes. ${o ? `Comparison: ${J(s.comparison.cfs)} cfs at ${V(s.comparison.t)}; ${K(s.elapsedMs)} earlier.` : ""} It is not a calendar day. Missing data are not filled.</p><p>Rise trigger shown: 400 cfs November\u2013February, 200 March\u2013April, 100 May\u2013October. Confirm these seasons with the health department.</p><p>Rise from the 24-hour low is ${a.low.available ? J(a.low.changeCfs, !0) + " cfs" : "unavailable"}. It differs from comparing with the reading 24 hours earlier.</p><p>Gauge quality: ${T(i?.qualityLabel || "unknown")}. Provisional readings are not yet finalized and may be revised.</p>`)}`), document.getElementById("current").setAttribute("aria-busy", String(t)), Ke("number-strip", `<span>Flow (cfs) <strong>${te(i?.cfs) ? J(i.cfs) : "\u2014"}</strong><small>${T(l)}</small></span><span>24h change <strong>${o ? u : "\u2014"}</strong></span><span>Low rise <strong>${a.low.available ? J(a.low.changeCfs, !0) : "\u2014"}</strong></span>`);
}
function wa(e, t = !1) {
  let n = e.peak ? `${e.state === "confirmed" ? "Measured crest" : e.state === "falling_unbracketed" ? "High in the available evidence" : "Candidate high"}: ${J(e.peak.cfs)} cfs \xB7 ${V(e.peak.t)}. <strong>No sustained rise for ${T(K(e.fallMs))}</strong>; now ${J(e.drop)} cfs below this high.${e.bracketed ? "" : " The earlier rise was not established; this high is not a confirmed crest."}` : e.high ? `Recent observed high: ${J(e.high.cfs)} cfs \xB7 ${V(e.high.t)} (highest available reading in the past 48 hours; gaps may exist).` : T(e.why || ""), a = e.high?.cfs > e.peak?.cfs ? ` Earlier higher reading: ${J(e.high.cfs)} cfs \xB7 ${V(e.high.t)}.` : "", s = e.hadGap ? `<p class="crest-fact">Continuous evidence starts ${V(e.evidenceStartT)} after a gap or unusable reading.</p>` : "", i = e.peak && e.state !== "falling_unbracketed" ? `<p class="crest-fact">${e.state === "confirmed" ? "6-hour / 5% check met so far; the river may rise again." : "May rise again. Confirmation needs 6 hours without a sustained rise and a drop of at least 5% and 2 cfs."}</p>` : "";
  Ke("monitor", `<div class="crest-top"><h2 data-crest-state="${e.state}">${T(e.label)}</h2>${an("crest", "About the crest check")}</div><p class="crest-fact">${n}${a}</p>${s}${i}${e.state === "confirmed" && t ? '<p class="crest-fact">The official forecast also shows a later peak; see below.</p>' : ""}${sn("crest", "How the crest check works", `<p>${ma}</p><p>Small daily fluctuations can meet this descriptive check; it does not establish that a storm has ended. This is the actual river flow topping out, not the peak of the 24-hour rise. A closure can already be in place while the river rises. Around 12 hours of falling is a staff planning judgment, not a fixed closure or sampling rule.</p><p>Reading age and quality can withhold this status. A gap or unusable reading restarts the evidence window; it cannot be counted as hours falling. This check uses observations only, and cannot prove that the final storm peak has passed.</p>`)}`);
}
function xt(e, t) {
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
function _a(e, t, n) {
  for (let a of e || []) {
    if (!a.length || a[0].t > t || a[a.length - 1].t < n) continue;
    let s = xt([a], t), i = xt([a], n);
    if (!te(s) || !te(i)) continue;
    let o = Math.min(s, i);
    for (let r of a) r.t > t && r.t < n && (o = Math.min(o, r.cfs));
    return o;
  }
  return null;
}
function ya(e) {
  let t = e.gauge?.segments || [], n = e.forecast?.shifted?.segments || [], a = e.gauge?.latest, s = t.find((o) => o[o.length - 1]?.t === a?.t), i = n.find((o) => o[0]?.t === a?.t);
  return !s || !i || s[s.length - 1].cfs !== i[0].cfs ? [] : [[...s, ...i.slice(1)]];
}
function rn(e) {
  let t = e.forecast || {}, n = Math.max(e.nowMs, e.gauge?.latest?.t ?? e.nowMs), a = t.raw?.endT, s = e.gauge?.latest?.t;
  if (!t.available || !te(a) || e.timeUncertain) return { available: !1, through: a, peaks: [], maxRatio: null, complete: !1 };
  let i = t.raw.segments, o = ya(e), r = te(s) ? s + 24 * Z : n, u = /* @__PURE__ */ new Set([n, a, r]);
  for (let b = Y(n).year; b <= Y(a).year; b++) for (let p of [3, 5, 11]) {
    let y = Le(b, p, 1);
    y >= n && y <= a && (u.add(y), u.add(y - 1));
  }
  for (let b of [...i, ...o]) for (let p of b)
    p.t >= n && p.t <= a && u.add(p.t), p.t + 24 * Z >= n && p.t + 24 * Z <= a && u.add(p.t + 24 * Z);
  for (let b = n; b <= a; b += nn) u.add(b);
  let c = -1 / 0, l = null, f = null, d = !0, m = [];
  for (let b of [...u].filter((p) => p >= n && p <= a).sort((p, y) => p - y)) {
    let p = b <= r ? o : i, y = xt(p, b), D = _a(p, b - 24 * Z, b);
    if (!te(y) || !te(D)) {
      d = !1;
      continue;
    }
    let M = Qe(y, D), $ = M / pe(b);
    m.push({ t: b, rise: M, ratio: $ }), $ > c && (c = $), (l === null || M > l) && (l = M, f = b);
  }
  let h = (t.crests || []).filter((b) => b.endT > n && m.some((p) => p.t >= Math.max(n, b.precedingLow?.t ?? n) && p.t <= b.endT && p.ratio >= 0.5)), g = i?.[i.length - 1], x = g?.length > 1 && g[g.length - 1].cfs > g[g.length - 2].cfs;
  return { available: m.length > 0, complete: d, through: a, maxRatio: te(c) ? c : null, maxRise: l, maxT: f, peaks: h, risingTail: x };
}
function $a(e, t, n = rn(e)) {
  let a = e.forecast, s = t.high, i = t.peak ? `<p><strong>${t.state === "confirmed" ? "Observed crest so far" : t.state === "falling_unbracketed" ? "High in available evidence" : "Possible crest"}: ${J(t.peak.cfs)} cfs</strong> \xB7 ${V(t.peak.t)}. No sustained rise for ${T(K(t.fallMs))}; ${t.state === "confirmed" ? "the river may rise again." : "crest not established."}</p>` : s ? `<p><strong>Recent observed high: ${J(s.cfs)} cfs</strong> \xB7 ${V(s.t)}. ${T(t.label)}.</p>` : `<p>${T(t.label)}. ${T(t.why || "")}</p>`, o = te(a.issuedT) ? `Issued ${V(a.issuedT)} \xB7 ${T(e.timeUncertain ? "age unknown" : K(a.issueAgeMs) + " old")}.` : "", r = n.available ? n.maxRatio < 0.5 ? `${n.complete ? "No supported" : "In the supported portions, no"} measured-and-forecast rise from the 24-hour low reaches half the seasonal rise trigger through ${X(n.through, !0)}.` : n.peaks.length ? "" : "The comparison using measured flow and forecasts reaches at least half the seasonal rise trigger; no supported future peak time is identified." : "The forecast rise cannot be fully checked with the supported readings.", u = n.peaks.map((c) => `<article class="peak-card"><h3>NOAA forecast peak \xB7 ${J(c.cfs)} cfs</h3><p>Between ${V(c.bracketStartT)} and ${V(c.bracketEndT)} (highest issued point ${V(c.startT)}${c.endT !== c.startT ? " to " + V(c.endT) : ""}). ${T({ inside_08_17: "Daytime (8 AM\u20135 PM)", outside_08_17: "Overnight / outside 8 AM\u20135 PM", spans_both: "Spans daytime and overnight" }[c.clockRange] || "Daytime / overnight timing unavailable")}.</p><details><summary>Timing and surrounding forecast points</summary><p>${V(c.bracketStartT)} to ${V(c.bracketEndT)}. These times describe forecast spacing, not the actual crest-time uncertainty.</p></details></article>`).join("");
  Ke("peaks", `<h2>Observed high, then forecast</h2>${i}<h3>NOAA river forecast</h3><p class="meta">National Oceanic and Atmospheric Administration (NOAA), National Weather Service. ${o}</p>${r ? `<p>${T(r)}</p>` : ""}${u}${n.available ? `<p class="meta">Largest supported rise from the 24-hour low (measured + forecast comparison): ${qe(n.maxRise, !0)} cfs \xB7 ${V(n.maxT)}. Display filter: 50% of the seasonal rise trigger.</p>` : ""}${n.risingTail ? `<p class="meta">Forecast still rising at its last point (${V(n.through)}); no final crest time is established.</p>` : ""}${!n.complete && n.available ? '<p class="meta">Some forecast comparisons are unsupported; a missing comparison does not mean no rise.</p>' : ""}<details><summary>Which forecast peaks are shown?</summary><p>Display filter: a forecast peak is shown only when a supported rise from the rolling 24-hour low on its rising limb reaches at least 50% of the seasonal rise trigger (200 cfs November\u2013February, 100 March\u2013April, 50 May\u2013October). This is a display choice, not a closure rule. During the first 24 hours, the gauge-adjusted forecast is compared with the supported measured and adjusted low; if adjustment is unsupported that interval is unavailable. After 24 hours, both the flow and rolling low use the unchanged official forecast. The chart shows smaller forecast bumps too. No peak time is predicted by this page.</p></details>`);
}
function on(e, t, n, a, s, i = {}) {
  va(t, i);
  let o = ba(t, i), r = rn(t);
  wa(o, r.peaks.length > 0), Qt(t, a), Kt(t);
  let u = document.getElementById("rain");
  u.innerHTML = u.innerHTML.replaceAll("<strong>Unavailable</strong>", '<strong class="unavailable">Unavailable</strong>');
  let c = u.querySelector?.(".station-links"), l = u.querySelector?.(".rain-total-grid");
  c && l && l.insertAdjacentElement("afterend", c), $a(t, o, r), en(t), tn(e, t, n);
  let f = document.getElementById("forecast-details");
  f.innerHTML = f.innerHTML.replace("The adjusted forecast first reaches", "Within its first 72 hours, the adjusted forecast first reaches").replace("The adjusted forecast already meets", "Within its first 72 hours, the adjusted forecast already meets").replace("earlier measurements or the adjusted forecast", "earlier measurements or forecast values").replace("Only the official forecast can extend beyond 72 hours; these comparisons are limited to 72 hours.", "After 72 hours, the moving rise reference uses only the unchanged official forecast. Adjusted forecasts and past cases still stop at 72 hours; a gap marks any change of basis.").replace("Peak cards show high points in the forecast, including any later peak higher than the first. A dip may precede another rise.", "The observed high is listed first. Forecast peaks are filtered by their rolling 24-hour rise; smaller bumps remain on the chart.");
  let d = document.getElementById("sources");
  d.innerHTML = d.innerHTML.replace("Provisional readings may be revised; estimated or otherwise unsupported readings cannot support automatic turn notices.", "Estimated or otherwise unsupported readings cannot confirm an observed crest."), Ke("snapshot-label", `Saved snapshot ${T(e.id)} \xB7 ${T(X(e.createdAt))}`);
}

// site/js/watch-preview-reference.js
var ln = 36e5, ce = 24 * ln, Ta = 6 * ln, ne = Number.isFinite, At = (e) => ne(e) && Math.abs(e) <= 864e13;
function xa(e) {
  if (e?.available === !1) return [];
  let t = [];
  for (let n of e?.segments || []) {
    if (!Array.isArray(n) || n.some((i, o) => o && i?.t <= n[o - 1]?.t)) continue;
    let a = [], s = () => {
      a.length && t.push(a), a = [];
    };
    for (let i of n) {
      if (!At(i?.t) || !ne(i?.cfs) || i.cfs < 0 || ne(e?.endT) && i.t > e.endT) {
        s();
        continue;
      }
      a.length && i.t - a.at(-1).t > Ta && s(), a.push({ t: i.t, cfs: i.cfs });
    }
    s();
  }
  return t;
}
function Ee(e, t) {
  if (!e.length || t < e[0].t || t > e.at(-1).t) return null;
  for (let n = 0; n < e.length; n++) {
    let a = e[n];
    if (t === a.t) return a.cfs;
    if (t < a.t) {
      let s = e[n - 1], i = (t - s.t) / (a.t - s.t), o = (1 - i) * s.cfs + i * a.cfs;
      return ne(o) ? o : null;
    }
  }
  return null;
}
function Aa(e, t) {
  let n = [];
  for (let a = Y(e).year; a <= Y(t).year; a++) for (let s of [3, 5, 11]) {
    let i = Le(a, s, 1);
    i > e && i <= t && n.push(i);
  }
  return n.sort((a, s) => a - s);
}
function Ma(e, t) {
  let n = Ee(e, t - ce), a = Ee(e, t);
  if (n === null || a === null) return null;
  let s = Math.min(n, a);
  for (let i of e) i.t > t - ce && i.t < t && (s = Math.min(s, i.cfs));
  return s;
}
function ka(e, t, n) {
  let a = /* @__PURE__ */ new Set([t, n]);
  for (let i of e) for (let o of [i.t, i.t + ce]) o > t && o < n && a.add(o);
  let s = [...a].sort((i, o) => i - o);
  for (let i = 1; i < s.length; i++) {
    let o = s[i - 1], r = s[i], u = (o + r) / 2, c = e.filter((f) => f.t > u - ce && f.t < u).reduce((f, d) => Math.min(f, d.cfs), 1 / 0), l = [
      [Ee(e, o - ce), Ee(e, r - ce)],
      [Ee(e, o), Ee(e, r)],
      ...ne(c) ? [[c, c]] : []
    ];
    for (let f = 0; f < l.length; f++) for (let d = f + 1; d < l.length; d++) {
      let m = l[f][0] - l[d][0], h = l[f][1] - l[d][1];
      if (!ne(m) || !ne(h) || m === h) continue;
      let g = Math.max(Math.abs(m), Math.abs(h)), x = m / g / (m / g - h / g);
      x > 0 && x < 1 && a.add(o + x * (r - o));
    }
  }
  return [...a].sort((i, o) => i - o);
}
function Sa(e, t, n, a) {
  let s = (c, l) => {
    let f = a(c);
    return ne(f) && ne(f + l) ? f + l : null;
  };
  if (e === t) {
    let c = s(e, pe(e));
    return { segments: ne(c) ? [[{ t: e, cfs: c }]] : [], steps: [] };
  }
  let i = Aa(e, t), o = [e, ...i, ...i.at(-1) === t ? [] : [t]], r = [], u = [];
  for (let c = 1; c < o.length; c++) {
    let l = o[c - 1], f = o[c], d = pe(l), h = [l, ...n.filter((g) => g > l && g < f), f].map((g) => ({ t: g, cfs: s(g, d) }));
    if (h.every((g) => ne(g.cfs)) && r.push(h), i.includes(f)) {
      let g = s(f, d), x = s(f, pe(f));
      ne(g) && ne(x) && (u.push({ t: f, beforeCfs: g, afterCfs: x }), f === t && r.push([{ t: f, cfs: x }]));
    }
  }
  return { segments: r, steps: u };
}
function cn(e, t, n = "endpoint") {
  let a = { available: !1, basis: "official_forecast", segments: [], steps: [], startT: null, endT: null };
  if (!At(t) || !At(e?.endT) || e.endT <= t || !["endpoint", "low"].includes(n)) return a;
  let s = xa(e), i = [], o = [], r = t + 1, u = (l, f, d, m) => {
    if (l > f) return;
    let h = Sa(l, f, d, m);
    i.push(...h.segments), o.push(...h.steps);
  };
  if (n === "endpoint")
    for (let l of s) for (let f of s) {
      let d = Math.max(r, l[0].t, f[0].t + ce), m = Math.min(e.endT, l.at(-1).t, f.at(-1).t + ce);
      u(d, m, f.map((h) => h.t + ce), (h) => Ee(f, h - ce));
    }
  else
    for (let l of s) {
      let f = Math.max(r, l[0].t + ce), d = Math.min(e.endT, l.at(-1).t);
      f <= d && u(f, d, ka(l, f, d), (m) => Ma(l, m));
    }
  i.sort((l, f) => l[0].t - f[0].t);
  let c = i.flat();
  return c.length ? {
    available: !0,
    basis: "official_forecast",
    segments: i,
    steps: o,
    startT: Math.min(...c.map((l) => l.t)),
    endT: Math.max(...c.map((l) => l.t))
  } : a;
}

// site/js/watch-chart.js
var U = Number.isFinite, I = null, Ca = (e, t, n) => U(e?.t) && U(e?.cfs) && e.t >= t && e.t <= n;
function ut(e, t, n) {
  for (let a of e || []) {
    let s = Xt(a, (i) => i.t === t);
    if (s) return s.cfs;
    for (let i = 1; i < a.length; i++) {
      let o = a[i], r = a[i - 1];
      if (r.t < t && o.t > t)
        return o.t - r.t > n ? null : r.cfs + (o.cfs - r.cfs) * (t - r.t) / (o.t - r.t);
    }
  }
  return null;
}
function fn(e, t, n, a) {
  let s = e.filter((i) => Ca(i, t, n));
  for (let i of [t, n])
    if (!s.some((o) => o.t === i)) {
      let o = ut([e], i, a);
      U(o) && s.push({ t: i, cfs: o });
    }
  return s.sort((i, o) => i.t - o.t);
}
function Ea(e, t, n) {
  return e.map((a, s) => `${s ? "L" : "M"}${t(a.t).toFixed(2)},${n(a.cfs).toFixed(2)}`).join(" ");
}
function un(e, t, n) {
  return (e?.segments || []).map((a) => {
    let s = fn(a, t, n, 1 / 0);
    for (let i of e.steps || []) {
      if (i.t < t || i.t > n || !a.length || i.t < a[0].t || i.t > a.at(-1).t) continue;
      let o = s.findIndex((u) => u.t >= i.t), r = o < 0 ? s.length : o;
      for (; s[r]?.t === i.t; ) s.splice(r, 1);
      s.splice(r, 0, { t: i.t, cfs: i.beforeCfs }, { t: i.t, cfs: i.afterCfs });
    }
    return s;
  });
}
var Na = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function Mt(e) {
  let t = Object.fromEntries(Na.formatToParts(e).filter((n) => n.type !== "literal").map((n) => [n.type, Number(n.value)]));
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}
function La(e) {
  let t = e;
  for (let n = 0; n < 3; n++) t += e - Mt(t);
  return t;
}
function Ra(e, t, n) {
  let a = Math.max(2, Math.floor(n / 70) + 1), s = Mt(e), i = Mt(t), o = [];
  for (let r of [6, 12, 24, 48, 72, 96, 120, 144, 168, 192, 240, 336, 504, 672]) {
    let u = Math.min(r, 12) * 36e5, c = [];
    for (let f = Math.ceil(s / u) * u; f <= i + 36e5; f += r * 36e5) {
      let d = La(f);
      d >= e && d <= t && c.push(d);
    }
    if (c.length < 2) continue;
    o = c;
    let l = Math.min(...c.slice(1).map((f, d) => (f - c[d]) / (t - e) * n));
    if (c.length <= a && l >= 40) return c;
  }
  return o.length > 2 ? [o[0], o.at(-1)] : o;
}
function dn(e, t, n, { previewReferenceTail: a = !1, officialReferenceTail: s = null } = {}) {
  let i = Math.max(1, Math.floor(e.clientWidth)), o = globalThis.innerHeight, r = i < 500 ? 240 : U(o) && o < 500 ? Math.max(180, Math.min(280, o - 80)) : 280, u = { left: Math.min(49, i / 4), right: Math.min(14, i / 4), top: 26, bottom: 38 }, c = u.left, l = i - u.right, f = u.top, d = r - u.bottom, m = t.gauge?.latest?.t, h = Math.round(t.nowMs), g = document.getElementById("chart-cursor");
  if (t.timeUncertain && !U(m)) {
    let w = "Chart unavailable. No saved river-reading time is available; current time is unconfirmed.";
    e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="${w}"><text x="${i / 2}" y="${r / 2 - 12}" text-anchor="middle">Chart unavailable</text><text x="${i / 2}" y="${r / 2 + 4}" text-anchor="middle">${i < 220 ? "No saved time" : "No saved river-reading time"}</text></svg>`;
    for (let C of document.querySelectorAll?.(".legend span") ?? []) C.hidden = !0;
    I = null, g.min = "0", g.max = "1", g.step = "1", g.value = "0", g.disabled = !0, g.style.marginLeft = `${c - 10}px`, g.style.width = `${l - c + 20}px`, g.setAttribute("aria-valuetext", w), document.getElementById("chart-readout").textContent = w;
    return;
  }
  let x = t.timeUncertain ? m : h, b = x - Number(n.past || 24) * 36e5, p = n.range === "full" ? Math.max(x + 36e5, t.forecast?.raw?.endT ?? x + 72 * 36e5) : x + (n.range === "day" ? 24 : 72) * 36e5, y = t.forecast || {}, D = t.gauge?.references?.[n.reference], M = y.references?.[n.reference], $ = { segments: [...D?.segments || [], ...M?.segments || []], steps: [...D?.steps || [], ...M?.steps || []] }, k = a && U(m) ? s : null, F = [{ key: "observed", name: "Measured river flow", segments: t.gauge?.segments || [], gap: 30 * 6e4 }, { key: "raw", name: "Official river forecast", segments: y.raw?.segments || [], gap: 6 * 36e5 }, { key: "shifted", name: "Adjusted forecast", segments: y.shifted?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past high case", segments: y.high?.segments || [], gap: 6 * 36e5 }, { key: "case", name: "Past low case", segments: y.low?.segments || [], gap: 6 * 36e5 }, { key: "reference", name: "24-hour rise reference", segments: un($, b, p), gap: 1 / 0 }, ...k ? [{ key: "reference", name: "Official forecast-based 24-hour rise reference", basis: "official-forecast", segments: un(k, Math.max(b, m + 72 * 36e5 + 1), p), gap: 1 / 0 }] : []].map((w) => ({ ...w, visible: w.key === "reference" ? w.segments : w.segments.map((C) => fn(C, b, p, w.gap)) })), H = F.flatMap((w) => w.visible.flat()).filter((w) => U(w.cfs)), G = { obs: "observed", raw: "raw", shifted: "shifted", case: "case", reference: "reference" };
  for (let w of document.querySelectorAll?.(".legend span") ?? []) {
    let C = G[w.querySelector("i")?.className];
    w.hidden = !!C && !F.some((xe) => xe.key === C && xe.visible.some((vt) => vt.length));
  }
  let _e = Math.max(10, ...H.map((w) => w.cfs)) * 1.08, ze = _e / 4, ye = Math.pow(10, Math.floor(Math.log10(ze))), Xe = ze / ye, Je = (Xe <= 1 ? 1 : Xe <= 2 ? 2 : Xe <= 5 ? 5 : 10) * ye, S = Je * 4, v = (w) => c + (w - b) / (p - b) * (l - c), ie = (w) => d - w / S * (d - f), st = Array.from({ length: 5 }, (w, C) => Je * C), pt = Ra(b, p, l - c), kn = st.map((w) => `<line class="grid" x1="${c}" x2="${l}" y1="${ie(w)}" y2="${ie(w)}"/><text x="${c - 7}" y="${ie(w) + 4}" text-anchor="end">${T(qe(w))}</text>`).join("") + pt.map((w) => {
    let C = v(w), xe = C < 24 ? "start" : C > i - 24 ? "end" : "middle", vt = `<tspan x="${C}">${T(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).format(w))}</tspan><tspan x="${C}" dy="14">${T(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric" }).format(w))}</tspan>`;
    return `<text class="x-axis-label" x="${C}" y="${r - 24}" text-anchor="${xe}">${vt}</text>`;
  }).join(""), Sn = F.map((w) => w.visible.filter((C) => C.length).map((C) => C.length === 1 ? `<circle class="${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} cx="${v(C[0].t)}" cy="${ie(C[0].cfs)}" r="2" fill="var(--${w.key === "observed" ? "obs" : w.key})"/>` : `<path class="plot-line ${w.key}${w.basis ? " reference-official" : ""}"${w.basis ? ` data-reference-basis="${w.basis}"` : ""} d="${Ea(C, v, ie)}"/>`).join("")).join(""), Lt = ut($.segments, b, 1 / 0) ?? ut($.segments, x, 1 / 0), $e = U(Lt) ? ie(Lt) : f + 14;
  $e = $e - f > 32 ? $e - 10 : $e + 24, $e = Math.max(f + 12, Math.min(d - 6, $e));
  let Cn = F.find((w) => w.key === "reference")?.visible.flat() || [], rt = Cn.reduce((w, C) => !w || C.t > w.t ? C : w, null), it = rt ? Math.max(c + 4, Math.min(l - 88, v(rt.t) - 84)) : c + 4, Rt = $e, En = it + 84, Nn = U(n.cursorT) && n.cursorT >= b && n.cursorT <= p ? v(n.cursorT) : null, Ln = U(m) && m >= b && m <= p ? v(m) : null, Rn = rt && v(rt.t) - c >= 84, On = [Nn, Ln].some((w) => U(w) && w >= it && w <= En), Un = l - c < 200 || !Rn || On ? "" : `<rect class="reference-label-bg" x="${it}" y="${Rt - 12}" width="84" height="16" rx="3"/><text class="reference-label" x="${it + 4}" y="${Rt}">24h rise line</text>`, Ot = t.timeUncertain && l - c < 132, In = t.timeUncertain ? Ot ? "Last reading" : "Last saved river reading" : "Latest observed", Pn = t.timeUncertain ? Ot ? 80 : 132 : 90, jn = U(m) && m >= b && m <= p ? `<line x1="${v(m)}" x2="${v(m)}" y1="${f}" y2="${d}" stroke="var(--obs)" opacity=".5"/><text x="${Math.max(c, Math.min(l - Pn, v(m) + 5))}" y="${f - 9}">${In}</text>` : "", qn = !t.timeUncertain && h >= b && h <= p ? `<line class="now" x1="${v(h)}" x2="${v(h)}" y1="${f}" y2="${d}"/><text x="${Math.min(l - 25, v(h) + 5)}" y="${f + 15}">Now</text>` : "", Te = U(n.cursorT) ? Math.max(b, Math.min(p, n.cursorT)) : null, Dn = Te !== null ? `<line class="cursor" x1="${v(Te)}" x2="${v(Te)}" y1="${f}" y2="${d}"/>` : "", oe = U(m) ? m + 72 * 36e5 : null, Fn = U(y.raw?.endT) && y.raw.endT > oe && (y.raw?.segments || []).some((w) => w.some((C) => U(C.cfs) && C.t > oe)), gt = n.range === "full" && U(oe) && oe > b && p - oe > 6 * 36e5 && Fn, mt = gt ? l - v(oe) : 0, Hn = a ? "Beyond this limit the forecast and its 24-hour rise reference use official forecast values only, where supported. Adjusted forecasts and past cases stop at 72 hours. The reference changes basis in a separate path." : "Beyond this limit only supported official forecast points can be shown. Adjustments, past cases and moving references are limited to at most 72 hours.", Bn = gt ? `<g class="forecast-horizon"><title>72-hour context limit: ${T(X(oe, !0))}. ${Hn}</title><rect x="${v(oe)}" y="${f}" width="${mt}" height="${d - f}" fill="currentColor" opacity=".04"/><line x1="${v(oe)}" x2="${v(oe)}" y1="${f}" y2="${d}" stroke="currentColor" stroke-dasharray="3 4" opacity=".55"/>${mt >= 65 ? `<rect x="${l - 68}" y="${f + 6}" width="67" height="33" rx="3" fill="var(--surface)" opacity=".95"/><text x="${l - 4}" y="${f + 19}" text-anchor="end"><tspan x="${l - 4}">After 72h</tspan><tspan x="${l - 4}" dy="14">Official only</tspan></text>` : ""}</g>` : "", Wn = F.some((w) => w.segments.some((C) => C.some((xe) => U(xe.t) && U(xe.cfs)))) ? "No supported points fall within the selected chart range." : "No supported source readings are available to draw.";
  e.innerHTML = `<svg viewBox="0 0 ${i} ${r}" width="${i}" height="${r}" role="img" aria-label="River flow in cubic feet per second. ${t.timeUncertain ? "Chart based on the last saved river reading; current time is unconfirmed. " : ""}The comparison line marks the level needed for the rolling 24-hour rise to meet its reference. ${a ? "After the 72-hour limit, any reference shown uses only official forecast values and begins as a separate path. " : ""}Observations and forecast paths from ${T(X(b, !0))} through ${T(X(p, !0))}. Gaps are not connected."><defs><clipPath id="plot-clip"><rect x="${c}" y="${f}" width="${l - c}" height="${d - f}"/></clipPath></defs>${kn}<g clip-path="url(#plot-clip)">${Bn}${Sn}${Dn}</g>${Un}${jn}${qn}${H.length ? "" : `<text x="${(c + l) / 2}" y="${r / 2}" text-anchor="middle">${Wn}</text>`}</svg>${gt && mt < 65 ? `<p class="meta forecast-horizon-caption">${a ? "After 72h: official forecast and its supported 24-hour reference." : "After 72h: official forecast only, where supported."}</p>` : ""}`, I = { lines: F, hasData: H.length > 0, start: b, end: p, left: c, right: l, width: i, host: e, contextLimit: oe, previewReferenceTail: a }, g.min = String(b), g.max = String(p), g.step = "1", g.disabled = !I.hasData, g.style.marginLeft = `${c - 10}px`, g.style.width = `${l - c + 20}px`;
  let bt = Te ?? Math.max(b, Math.min(p, U(m) ? m : h));
  g.value = String(Math.round(bt)), g.setAttribute("aria-valuetext", t.timeUncertain ? `${Te === null ? "Last saved river reading" : "Saved chart selection"}: ${X(bt)}. Current time is unconfirmed.` : X(bt)), Te !== null ? Oa(Te) : document.getElementById("chart-readout").textContent = "Tap the graph or drag the slider to inspect a time.";
}
function Oa(e) {
  if (!I) return;
  let t = I.lines.map((n) => {
    let a = ut(n.visible, e, n.gap);
    return U(a) ? `${n.name}: ${Math.round(a).toLocaleString("en-US")} cfs` : null;
  }).filter(Boolean);
  document.getElementById("chart-readout").innerHTML = `<strong>${T(X(e))}</strong><br>${t.map(T).join(" \xB7 ") || "No supported value at this time."}${t.length ? '<br><span class="meta">Between readings: estimated. Gaps stay blank.</span>' : ""}${U(I.contextLimit) && e > I.contextLimit ? `<br><span class="meta">${I.previewReferenceTail ? "Beyond 72 hours: official forecast values only. The reference uses those forecast values when supported; adjusted forecasts and past cases stop at 72 hours." : "Beyond 72 hours: official forecast only, where supported. Other comparisons are limited to 72 hours."}</span>` : ""}`;
}
function hn(e) {
  if (!I?.hasData) return null;
  let t = I.host.getBoundingClientRect(), n = t.width / I.width, a = Math.max(0, Math.min(1, ((e.clientX - t.left) / n - I.left) / (I.right - I.left)));
  return Math.round(I.start + a * (I.end - I.start));
}
function kt() {
  if (!I?.hasData) return null;
  let e = Number(document.getElementById("chart-cursor").value);
  return U(e) ? Math.max(I.start, Math.min(I.end, e)) : null;
}
function pn(e) {
  let t = kt();
  if (t === null) return null;
  let n = { ArrowLeft: -15 * 6e4, ArrowDown: -15 * 6e4, ArrowRight: 15 * 6e4, ArrowUp: 15 * 6e4, PageDown: -6 * 36e5, PageUp: 6 * 36e5 };
  return e === "Home" ? I.start : e === "End" ? I.end : U(n[e]) ? Math.max(I.start, Math.min(I.end, t + n[e])) : null;
}

// fixed-public-table:ratio
var gn = { name: "Historical river forecast cases", version: 3, apply_to: "flow", rise_floor_cfs: 50, storm_flow_cfs: 150, wet_months: [1, 2, 3, 4, 10, 11, 12], training_cutoff_utc: "2026-10-06 00:00:00+00:00", bins: [{ lead_lo_h: 0, lead_hi_h: 12, add_cfs: 11.7, rise: { low_factor: 0.697, high_factor: 1.193 }, flat: { low_factor: 0.93, high_factor: 1.06 } }, { lead_lo_h: 12, lead_hi_h: 24, add_cfs: 29.6, rise: { low_factor: 0.608, high_factor: 1.223 }, flat: { low_factor: 0.881, high_factor: 1.146 } }, { lead_lo_h: 24, lead_hi_h: 36, add_cfs: 47.7, rise: { low_factor: 0.547, high_factor: 1.223 }, flat: { low_factor: 0.862, high_factor: 1.229 } }, { lead_lo_h: 36, lead_hi_h: 48, add_cfs: 63, rise: { low_factor: 0.524, high_factor: 1.228 }, flat: { low_factor: 0.834, high_factor: 1.299 } }, { lead_lo_h: 48, lead_hi_h: 60, add_cfs: 84.5, rise: { low_factor: 0.505, high_factor: 1.297 }, flat: { low_factor: 0.807, high_factor: 1.306 } }, { lead_lo_h: 60, lead_hi_h: 72, add_cfs: 107.7, rise: { low_factor: 0.491, high_factor: 1.346 }, flat: { low_factor: 0.791, high_factor: 1.341 } }], description: "Descriptive examples of past forecast misses; not probabilities or independently validated forecasts." };

// site/watch-public.js
var at = (e, t, n) => dn(e, t, n, { previewReferenceTail: !0, officialReferenceTail: cn(t.forecast.raw, (t.gauge.latest?.t ?? NaN) + 72 * 36e5, n.reference) }), Ia = "https://raw.githubusercontent.com/jdinneen/samish-river-watch/preview-data/current.json", vn = new URL("./", import.meta.url), wn = "samish.public.preview.packet.v1", _n = "samish.public.preview.preferences.v1", ft = 9466848e5, Be = 41024448e5, Ne = 5 * 6e4, yn = 2 * 1024 * 1024, A = (e) => document.getElementById(e), We = Number.isFinite;
function Ge() {
  let e = A("number-strip"), t = A("current").querySelector(".flow-number");
  e.dataset.visible = String(!!t && t.getBoundingClientRect().top <= 0), document.documentElement.style.setProperty("--reading-strip-height", `${e.offsetHeight}px`);
}
window.addEventListener("scroll", Ge, { passive: !0 });
window.addEventListener("resize", Ge);
function Nt(e) {
  document.querySelectorAll("button[data-help-target]").forEach((t) => {
    let n = A(t.dataset.helpTarget);
    if (t.disabled = !n, !n) return;
    e && (n.open = e.has(n.id)), t.setAttribute("aria-expanded", String(n.open));
    let a = n.querySelector("button[data-help-close]");
    a && !a.id && (a.id = `${n.id}-close`);
  });
}
function Ct(e, t, n = !1) {
  let a = A(e), s = A(`${e}-toggle`);
  if (!(!a || !s) && (a.open = t, Nt(), Ge(), n)) {
    s.focus({ preventScroll: !0 });
    let i = A("number-strip"), o = i.dataset.visible === "true" ? i.getBoundingClientRect().bottom : 0, r = s.getBoundingClientRect();
    (r.top < o + 8 || r.bottom > innerHeight - 8) && s.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }), Ge();
  }
}
document.addEventListener("click", (e) => {
  let t = e.target.closest("button[data-help-target]"), n = e.target.closest("button[data-help-close]");
  t ? (e.preventDefault(), Ct(t.dataset.helpTarget, !A(t.dataset.helpTarget)?.open)) : n && (e.preventDefault(), Ct(n.dataset.helpClose, !1, !0));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  let t = e.target.closest("details.section-help") || A(e.target.closest("button[data-help-target]")?.dataset.helpTarget);
  t?.open && (e.preventDefault(), Ct(t.id, !1, !0));
});
Nt();
var $n = (e) => {
  try {
    return JSON.parse(localStorage.getItem(e));
  } catch {
    return null;
  }
}, Tn = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, q = () => {
  throw new Error("invalid_public_packet");
};
function R(e, t, n = []) {
  return (!e || typeof e != "object" || Array.isArray(e) || t.some((a) => !Object.prototype.hasOwnProperty.call(e, a)) || Object.keys(e).some((a) => ![...t, ...n].includes(a))) && q(), e;
}
function re(e, t = !1, n = !1, a = !1, s = Number.MAX_SAFE_INTEGER) {
  e === null && t || (typeof e != "number" || !We(e) || !n && e < 0 || a && !Number.isInteger(e) || e > s) && q();
}
function N(e, t = !1) {
  re(e, t, !1, !0, Be), e !== null && e < ft && q();
}
function He(e) {
  typeof e != "boolean" && q();
}
function se(e, t, n = !1) {
  e === null && n || (typeof e != "string" || !t.includes(e)) && q();
}
function ue(e, t, n) {
  (!Array.isArray(e) || e.length > t) && q(), e.forEach(n);
}
var Pa = ["negative_value", "ice", "malformed_value", "estimated", "quality_flags_unavailable", "approval_unavailable", "unsupported_quality", "conflicting_duplicate", "wrong_station", "wrong_parameter", "unsupported_unit", "invalid_timestamp", "future_timestamp", "unusable_observation", "ineligible_quality"], ja = ["latest_ineligible", "no_data", "observation_older_than_60min", "missing_quarter_hours", "clock_uncertain", "rate_suppression", "rate_limit"], qa = ["conflicting duplicate readings", "Conflicting readings at this time", "Quality metadata supplied", "Quality flags unavailable", "quality unknown", "approved", "provisional", "Approved", "Provisional", "estimated", "ineligible", ...["approved", "provisional", "approval unavailable"].flatMap((e) => ["no qualifier supplied", "estimated", "flags unavailable"].map((t) => `${e}; ${t}`))];
function Et(e, t = !1) {
  R(e, t ? ["t"] : ["t", "cfs"], ["cfs", "eligible", "usable", "qualifierPresent", "approval", "qualifier", "qualityLabel", "quality", "reason", ...t ? ["currentCandidate"] : []]), N(e.t, t), "cfs" in e && re(e.cfs, !0);
  for (let n of ["eligible", "usable", "qualifierPresent", "currentCandidate"]) n in e && He(e[n]);
  "approval" in e && se(e.approval, ["Approved", "Provisional", "approved", "provisional"], !0), "qualifier" in e && se(e.qualifier, ["", "e", "E", "estimated", "Estimated"], !0);
  for (let n of ["quality", "qualityLabel"]) n in e && se(e[n], qa);
  "reason" in e && se(e.reason, Pa, !0);
}
function et(e, t = !1) {
  e !== null && (R(e, ["t", "cfs", ...t ? ["eligibleT"] : []]), N(e.t), re(e.cfs, !0), t && N(e.eligibleT, !0));
}
function Da(e, t) {
  R(t, ["data", "lastAttemptAt", "lastSuccessAt", "error"]), N(t.lastAttemptAt, !0), N(t.lastSuccessAt, !0), se(t.error, ["source_fetch_failed"], !0);
  let n = t.data;
  if (n !== null) {
    if (e === "gauge" && (R(n, ["points", "exclusions", "coveredWindow"]), ue(n.points, 4096, (a) => Et(a)), ue(n.exclusions, 4096, (a) => Et(a, !0)), n.coveredWindow !== null)) {
      let a = R(n.coveredWindow, ["startT", "endT", "complete"]);
      N(a.startT), N(a.endT), (a.complete !== !0 || a.startT > a.endT) && q();
    }
    if (e === "noaa" && (R(n, ["issuedT", "points", "conflicts"]), N(n.issuedT), ue(n.points, 1024, (a) => {
      R(a, ["t", "cfs"]), N(a.t), re(a.cfs);
    }), ue(n.conflicts, 1024, (a) => N(a))), e === "radar") {
      R(n, ["generatedT", "hours", "conflicts"]), N(n.generatedT);
      let a = (s) => {
        N(s), s % 36e5 && q();
      };
      ue(n.hours, 256, (s) => {
        R(s, ["endT", "mm"]), a(s.endT), re(s.mm, !0);
      }), ue(n.conflicts, 256, a);
    }
    e === "grid" && (R(n, ["updatedT", "periods", "gridId", "gridX", "gridY"]), N(n.updatedT), (n.gridId !== "SEW" || n.gridX !== 136 || n.gridY !== 112) && q(), ue(n.periods, 1024, (a) => {
      R(a, ["startT", "endT", "mm"]), N(a.startT), N(a.endT), re(a.mm, !0), a.endT <= a.startT && q();
    })), e === "tides" && (R(n, ["points", "stationId", "datum"]), (n.stationId !== "9449211" || n.datum !== "MLLW") && q(), ue(n.points, 128, (a) => {
      R(a, ["t", "ft", "type"]), N(a.t), re(a.ft, !1, !0), se(a.type, ["H", "L"]);
    }));
  }
}
function Fa(e) {
  R(e, ["summary", "transitions"]);
  let t = R(e.summary, ["schemaVersion", "asOf", "phase", "event", "standing", "actualCurrentObservation", "supportObservationT", "capability", "preparation", "support", "experimental", "deliveryDisabled"]);
  if ((t.schemaVersion !== 1 || t.experimental !== !0 || t.deliveryDisabled !== !0) && q(), N(t.asOf), se(t.phase, ["unarmed", "tracking", "possible_downturn", "ended"]), t.actualCurrentObservation !== null && Et(t.actualCurrentObservation), N(t.supportObservationT, !0), t.event !== null) {
    let o = R(t.event, ["openedT", "high", "cycle"]);
    N(o.openedT), et(o.high);
    let r = R(o.cycle, ["ordinal", "openedT", "high", "low", "endingPending"]);
    re(r.ordinal, !1, !1, !0, 1e5), N(r.openedT), et(r.high, !0), et(r.low), He(r.endingPending);
  }
  if (t.standing !== null) {
    let o = R(t.standing, ["kind", "state", "t", "detectedAt", "cfs", "active", "supportingHigh", "low"]);
    se(o.kind, ["downturn", "correction"]), se(o.state, ["possible_downturn", "rising_again"]), N(o.t), N(o.detectedAt), re(o.cfs), He(o.active), et(o.supportingHigh), et(o.low);
  }
  let n = (o) => ue(o, 16, (r) => se(r, ja)), a = R(t.capability, ["status", "newDownturnAvailable", "aboveHighCorrectionAvailable", "reasons"]);
  se(a.status, ["available", "warming_up", "partial", "unavailable"]), He(a.newDownturnAvailable), He(a.aboveHighCorrectionAvailable), n(a.reasons);
  let s = R(t.preparation, ["blockingReasons", "nextEligibleAt"]);
  n(s.blockingReasons), N(s.nextEligibleAt, !0);
  let i = R(t.support, ["lastSuccessfulPollAt", "monitoringGapMs", "missingQuarterHours", "observationAgeMs", "clockTrusted"]);
  N(i.lastSuccessfulPollAt, !0), re(i.monitoringGapMs, !0, !1, !1, Be), re(i.observationAgeMs, !0, !1, !1, Be), ue(i.missingQuarterHours, 7, (o) => N(o)), He(i.clockTrusted), ue(e.transitions, 32, (o) => {
    R(o, ["kind", "t", "cfs", "event", "detected_at"]), se(o.kind, ["downturn", "event_end"]), N(o.t), N(o.detected_at), re(o.cfs), (typeof o.event != "string" || !/^E[1-9][0-9]{0,8}$/.test(o.event)) && q();
  });
}
async function xn(e) {
  R(e, ["schemaVersion", "payload", "sha256"]), (e.schemaVersion !== 1 || typeof e.payload != "string" || typeof e.sha256 != "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) && q();
  let t = new TextEncoder().encode(e.payload);
  t.length > yn && q(), [...new Uint8Array(await crypto.subtle.digest("SHA-256", t))].map((o) => o.toString(16).padStart(2, "0")).join("") !== e.sha256 && q();
  let a = JSON.parse(e.payload);
  R(a, ["schemaVersion", "publishedAt", "snapshot"]), a.schemaVersion !== 1 && q(), N(a.publishedAt);
  let s = R(a.snapshot, ["schemaVersion", "id", "createdAt", "sources", "monitor"]);
  (s.schemaVersion !== 1 || typeof s.id != "string" || !/^[a-f0-9]{12}$/.test(s.id)) && q(), N(s.createdAt), a.publishedAt < s.createdAt && q();
  let i = ["gauge", "noaa", "radar", "grid", "tides"];
  return R(s.sources, i), i.forEach((o) => Da(o, s.sources[o])), Fa(s.monitor), s.monitor.summary.asOf !== s.createdAt && q(), a;
}
var Fe = $n(_n) || {}, O = { range: ["day", "three", "full"].includes(Fe.range) ? Fe.range : "three", past: Fe.past === 48 ? 48 : 24, reference: Fe.reference === "low" ? "low" : "endpoint", theme: ["light", "dark"].includes(Fe.theme) ? Fe.theme : null, cursorT: null };
O.theme && (document.documentElement.dataset.theme = O.theme);
var ee = null, nt = null, B = null, St = !1, W = "waiting", ve = null, tt = null, dt = !0, we = !1, he = Date.now(), ht = () => Tn(_n, { range: O.range, past: O.past, reference: O.reference, theme: O.theme });
function Ha() {
  let e = Date.now(), t = ve ? Math.max(0, performance.now() - ve.mono) : 0, n = ve ? ve.lower + t : null, a = ve ? ve.upper + t : null;
  he = Math.max(he, e, a ?? 0, ee?.snapshot.createdAt ?? 0);
  let s = dt || !ve || e < n - Ne || e > a + Ne || e + Ne < he || ee && ee.snapshot.createdAt > a + Ne;
  return { now: he, uncertain: s };
}
function An() {
  return tt ? tt.now + Math.max(0, performance.now() - tt.mono) : 0;
}
function Ba() {
  nt && Tn(wn, { packet: nt, greatestNow: he, trustedNow: An(), savedDeviceMs: Date.now(), ended: we });
}
function mn(e) {
  let t = A("connection");
  if (W === "waiting") {
    t.textContent = "Checking the public snapshot and current time\u2026", t.className = "connection";
    return;
  }
  if (!ee) {
    t.textContent = we ? "Preview ended. No current readings are provided." : W === "waiting" ? "Checking the public snapshot and current time\u2026" : "Public readings unavailable. A valid snapshot could not be downloaded and verified.", t.className = "connection attention";
    return;
  }
  let n = Math.max(0, e.now - ee.snapshot.createdAt), a = W !== "checked";
  if (!we && !a && !e.uncertain && n <= 12 * 6e4) {
    t.textContent = `Snapshot age ${K(n)} \xB7 verified.`, t.className = "connection";
    return;
  }
  t.textContent = [we ? "Preview ended. Earlier readings are retained for reference." : a ? W === "older" ? "Not refreshed \u2014 an older snapshot was received; the newest verified snapshot is retained." : W === "invalid" ? "Not refreshed \u2014 snapshot verification failed; showing last-known readings." : "Not refreshed \u2014 showing last-known readings." : e.uncertain ? "Snapshot content verified." : n > 12 * 6e4 ? "Saved snapshot is old; current crest status is unavailable." : "Verified snapshot.", e.uncertain ? `Snapshot age unknown; saved ${X(ee.snapshot.createdAt)}. Observation ages are also unknown.` : `Snapshot age ${K(n)}; observation ages below.`, e.uncertain ? "Time uncertain \u2014 device and current-time receipt are unavailable or disagree by more than five minutes. Current crest status is withheld." : ""].join(" "), t.className = "connection attention";
}
function de() {
  let e = Ha();
  if (!ee) {
    mn(e);
    let l = W === "waiting";
    A("current").textContent = l ? "Checking river readings\u2026" : "No verified river readings available.", A("current").setAttribute("aria-busy", String(l)), A("monitor").textContent = l ? "" : "Crest status unavailable until readings can be verified.";
    return;
  }
  let t = document.activeElement?.id, n = new Set([...document.querySelectorAll("details.section-help[open]")].map((l) => l.id)), a = ["monitor", "forecast-details", "peaks"].flatMap((l) => [...A(l).querySelectorAll("details:not(.section-help)")].flatMap((f, d) => f.open ? [`${l}:${d}`] : [])), s = ee.snapshot, i = e.uncertain ? s.createdAt : e.now;
  B = Vt({ nowMs: i, sources: s.sources, ratioTable: gn });
  let o = we || e.uncertain || W !== "checked" || e.now - s.createdAt > 12 * 6e4;
  B.timeUncertain = e.uncertain, e.uncertain && (B.forecast.freshContext = !1, B.forecast.higherLater = { ...B.forecast.higherLater, available: !1, reason: { code: "public_time_uncertain" }, aboveCurrent: null, peakCfs: null, peakT: null });
  let r = s.monitor.summary, u = !We(r.supportObservationT) || i - r.supportObservationT > 60 * 6e4;
  if (o) {
    let l = { code: we ? "preview_ended" : e.uncertain ? "public_time_uncertain" : W !== "checked" ? "public_snapshot_unavailable" : "published_snapshot_old" };
    B.gauge.direction = { ...B.gauge.direction, available: !1, reason: l }, B.gauge.twelveHourChange = { ...B.gauge.twelveHourChange, available: !1, reason: l };
  }
  let c = s;
  if (o || u || !r.support.clockTrusted) {
    let l = [...r.capability.reasons, ...u ? [We(r.supportObservationT) ? "observation_older_than_60min" : "no_data"] : [], ...e.uncertain ? ["public_time_uncertain"] : [], ...r.support.clockTrusted ? [] : ["clock_uncertain"]];
    c = { ...s, monitor: { ...s.monitor, summary: { ...r, capability: { ...r.capability, status: "unavailable", newDownturnAvailable: !1, aboveHighCorrectionAvailable: !1, reasons: l }, preparation: { ...r.preparation, nextEligibleAt: null } } } };
  }
  on(c, B, e.uncertain ? null : { lastCommitAt: s.createdAt, workerStale: e.now - s.createdAt > 12 * 6e4 }, O, i, { checking: W === "waiting", suppressed: o });
  for (let l of A("forecast-details").querySelectorAll("a")) l.getAttribute("href") === "/data/ratio_table.json" && (l.href = new URL("ratio_table.json", vn).href, l.textContent = "View the frozen historical-case table");
  a.forEach((l) => {
    let [f, d] = l.split(":"), m = A(f).querySelectorAll("details:not(.section-help)")[Number(d)];
    m && (m.open = !0);
  }), Nt(n), document.querySelectorAll("[data-range]").forEach((l) => l.setAttribute("aria-pressed", String(l.dataset.range === O.range))), A("past").value = String(O.past), A("reference").value = O.reference, at(A("chart"), B, O), mn(e), Ge(), Ba(), t && A(t) && document.activeElement?.id !== t && A(t).focus({ preventScroll: !0 });
}
async function Mn(e, t = yn * 2) {
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
async function Wa() {
  let e = new URL("version.json", vn);
  e.searchParams.set("check", String(Date.now()));
  let { response: t, value: n } = await Mn(e, 65536);
  (n?.schemaVersion !== 1 || !["active", "ended"].includes(n.state)) && q(), we = n.state === "ended";
  let a = t.headers.get("Date"), s = t.headers.get("Age"), i = Date.parse(a || "");
  if (!We(i) || i < ft || i > Be || s !== null && !/^\d+$/.test(s)) throw new Error("time_unavailable");
  let o = s === null ? 0 : Number(s);
  if (!Number.isSafeInteger(o) || o > 7 * 86400) throw new Error("time_unavailable");
  let r = i + o * 1e3, u = Date.now();
  u >= i - Ne && u <= r + Ne && r - u <= Ne && (he = Math.max(r, u, An(), ee?.snapshot.createdAt ?? 0), tt = { now: he, mono: performance.now() }), ve = { lower: i, upper: r, mono: performance.now() }, dt = !1;
}
function Ga(e, t) {
  if (ee) {
    let n = ee.snapshot, a = e.snapshot;
    if (a.createdAt < n.createdAt || a.createdAt === n.createdAt && a.id < n.id) {
      W = "older";
      return;
    }
    if (a.id === n.id) {
      (a.createdAt !== n.createdAt || JSON.stringify(a) !== JSON.stringify(n)) && q(), W = "checked";
      return;
    }
  }
  ee = e, nt = t, W = "checked";
}
async function Ve() {
  if (!St) {
    St = !0, A("refresh").disabled = !0, W === "waiting" && de();
    try {
      let e = new URL(Ia);
      e.searchParams.set("check", String(Date.now()));
      let t = await Promise.allSettled([Wa(), Mn(e)]);
      if (t[0].status === "rejected" && (dt = !0), t[1].status === "fulfilled")
        try {
          let n = t[1].value.value;
          Ga(await xn(n), n);
        } catch {
          W = "invalid";
        }
      else W = "offline";
      de();
    } finally {
      St = !1, A("refresh").disabled = !1;
    }
  }
}
document.querySelectorAll("[data-range]").forEach((e) => e.addEventListener("click", () => {
  O.range = e.dataset.range, O.cursorT = null, ht(), de();
}));
A("past").addEventListener("change", () => {
  O.past = Number(A("past").value), ht(), de();
});
A("reference").addEventListener("change", () => {
  O.reference = A("reference").value, ht(), de();
});
A("theme").addEventListener("click", () => {
  let e = O.theme ? O.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  O.theme = e ? "light" : "dark", document.documentElement.dataset.theme = O.theme, ht();
});
A("refresh").addEventListener("click", Ve);
A("chart").addEventListener("pointerdown", (e) => {
  O.cursorT = hn(e), B && at(A("chart"), B, O);
});
A("chart-cursor").addEventListener("input", () => {
  O.cursorT = kt(), B && at(A("chart"), B, O);
});
A("chart-cursor").addEventListener("keydown", (e) => {
  let t = pn(e.key);
  t !== null && (e.preventDefault(), O.cursorT = t, B && at(A("chart"), B, O));
});
document.addEventListener("visibilitychange", () => {
  document.hidden || (W = "waiting", de(), Ve());
});
window.addEventListener("pageshow", (e) => {
  e.persisted && (W = "waiting", de(), Ve());
});
window.addEventListener("offline", () => {
  W = "offline", dt = !0, de();
});
window.addEventListener("online", Ve);
var bn = 0;
new ResizeObserver((e) => {
  let t = Math.round(e[0].contentRect.width);
  t !== bn && (bn = t, B && at(A("chart"), B, O), Ge());
}).observe(A("chart"));
async function Va() {
  let e = $n(wn);
  if (e?.packet)
    try {
      ee = await xn(e.packet), nt = e.packet, We(e.greatestNow) && e.greatestNow >= ft && e.greatestNow <= Be && (he = Math.max(he, e.greatestNow + Math.max(0, Date.now() - Number(e.savedDeviceMs || Date.now())))), We(e.trustedNow) && e.trustedNow >= ft && e.trustedNow <= Be && (tt = { now: e.trustedNow, mono: performance.now() }), we = e.ended === !0, W = "waiting", de();
    } catch {
      ee = null, nt = null;
    }
  await Ve(), setInterval(() => {
    document.hidden || Ve();
  }, 5 * 6e4), setInterval(() => {
    document.hidden || de();
  }, 3e4);
}
Va();
export {
  Vt as buildWatchModel,
  xn as verifyPublicPacket
};
