export function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

export function fmtPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function fmtDate(s) {
  if (!s) return "—";
  // Appending T00:00:00 forces this to parse as local midnight instead of
  // UTC midnight — without it, US timezones would display one day earlier
  // than the actual date (e.g. "2026-09-13" rendering as Sep 12).
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDayShort(s) {
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function pct(n, d) {
  if (n === null || n === undefined || d === null || d === undefined || d === 0) return null;
  return (n / d) * 100;
}

export function delta(cur, prev) {
  if (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function paceStatus(v) {
  if (v === null || v === undefined) return { label: "No data", color: "var(--ink-40)", bg: "var(--line)" };
  if (v >= 100) return { label: "On pace", color: "var(--teal)", bg: "var(--teal-soft)" };
  if (v >= 80) return { label: "Tracking behind", color: "var(--gold)", bg: "var(--gold-soft)" };
  return { label: "Needs attention", color: "var(--rust)", bg: "var(--rust-soft)" };
}

export function statusPill(status) {
  const map = {
    Open: { color: "var(--teal)", bg: "var(--teal-soft)" },
    Suspended: { color: "var(--rust)", bg: "var(--rust-soft)" },
    "Soft Open": { color: "var(--gold)", bg: "var(--gold-soft)" },
    Closed: { color: "var(--ink-40)", bg: "var(--line)" },
  };
  return map[status] || { color: "var(--ink-40)", bg: "var(--line)" };
}

/** Attach derived KPI percentages to a door + its latest snapshot fields merged together. */
export function withDerived(row) {
  const orElse = (direct, n, d) => (direct !== null && direct !== undefined ? direct : pct(n, d));
  return {
    ...row,
    pacingPct: orElse(row.cur_pacing_pct, row.cur_pace, row.cur_quota),
    curFamilyPct: orElse(row.cur_family_pct, row.cur_fam, row.cur_acts),
    curPortPct: orElse(row.cur_port_pct, row.cur_port, row.cur_acts),
    cur50Pct: orElse(row.cur_50_pct, row.cur_50, row.cur_acts),
    prevFamilyPct: orElse(row.prev_family_pct, row.prev_fam, row.prev_acts),
    prevPortPct: orElse(row.prev_port_pct, row.prev_port, row.prev_acts),
    prev50Pct: orElse(row.prev_50_pct, row.prev_50, row.prev_acts),
    cur2mrPct: orElse(row.cur_2mr_pct, row.cur_2m_pay, row.cur_2m_acts),
    cur3mrPct: orElse(row.cur_3mr_pct, row.cur_3m_pay, row.cur_3m_acts),
    prev2mrPct: orElse(row.prev_2mr_pct, row.prev_2m_pay, row.prev_2m_acts),
    prev3mrPct: orElse(row.prev_3mr_pct, row.prev_3m_pay, row.prev_3m_acts),
    fwaClosePct: orElse(row.cur_fwa_close_pct, row.cur_fwa, row.cur_fwa_eligible),
    twpProtectPct: pct(row.cur_twp, row.cur_twp_acts),
    promoPct: pct(row.promo_on_hand, row.device_on_hand),
    // Full replenishment cohort curve, ranges 2–7 months
    mrCohorts: [2, 3, 4, 5, 6, 7].map((n) => ({
      months: n,
      curPct: row[`cur_${n}mr_pct`] ?? null,
      curActs: row[`cur_${n}mr_acts`] ?? null,
      prevPct: row[`prev_${n}mr_pct`] ?? null,
      prevActs: row[`prev_${n}mr_acts`] ?? null,
    })),
  };
}
