// Maps the exact column headers on the "Data" tab of the daily workbook
// to the snake_case column names used in the Supabase tables.
// If your sheet's headers ever change, update this map — nothing else
// needs to change.

export const HEADER_TO_FIELD = {
  "Store ID": "store_id",
  "Door TSP": "door_tsp",
  Address: "address",
  City: "city",
  State: "state",
  "Zip Code": "zip",
  Market: "market",
  "District Description": "district",
  Region: "region",
  "Sub-Agent Name": "sub_agent_name",
  Tenure: "tenure",
  "Building Type": "building_type",
  "Open Date": "open_date",
  "MA Field Rep": "ma_field_rep",
  "MA Field Phone#": "ma_field_phone",
  "MA Field Email": "ma_field_email",
  "Contact First Name": "_cfirst",
  "Contact Last Name": "_clast",
  "Contact Phone Number": "contact_phone",
  RPM: "rpm",
  SM: "sm",
  Status: "status",
  "Last RPM Visit": "last_rpm_visit",
  "Last MA Visit": "last_ma_visit",
  CurActs: "cur_acts",
  CurQuota: "cur_quota",
  CurPace: "cur_pace",
  PrevActs: "prev_acts",
  CurFam: "cur_fam",
  CurPort: "cur_port",
  Cur50: "cur_50",
  Cur65: "cur_65",
  PrevFam: "prev_fam",
  PrevPort: "prev_port",
  Prev50: "prev_50",
  Prev65: "prev_65",
  DeviceOnHand: "device_on_hand",
  PromoOnHand: "promo_on_hand",
  LowDevice: "low_device",
  SpiffOnHand: "spiff_on_hand",
  SpiffSales: "spiff_sales",
  Cur2mActs: "cur_2m_acts",
  Cur2mPay: "cur_2m_pay",
  Cur3mActs: "cur_3m_acts",
  Cur3mPay: "cur_3m_pay",
  Prev2mActs: "prev_2m_acts",
  Prev2mPay: "prev_2m_pay",
  Prev3mActs: "prev_3m_acts",
  Prev3mPay: "prev_3m_pay",
  CurFwa: "cur_fwa",
  CurFwaEligible: "cur_fwa_eligible",
  CurFwaLooks: "cur_fwa_looks",
  PrevFwa: "prev_fwa",
  PrevFwaEligible: "prev_fwa_eligible",
  CurTwp: "cur_twp",
  CurTwpActs: "cur_twp_acts",
  PrevTwp: "prev_twp",
  PrevTwpActs: "prev_twp_acts",
  CurTabs: "cur_tabs",
  PrevTabs: "prev_tabs",
  PrevZuApAct: "prev_zu_ap_act",
  PrevZulu: "prev_zulu",
  PrevAp: "prev_ap",
  Violations: "violations",
  CurEdgeApply: "cur_edge_apply",
  Upgrades: "upgrades",
  CurTops: "cur_tops",

  // --- DLAR tab header names (the richer, human-readable report view) ---
  // Same underlying fields, different column labels — both are recognized
  // so either the "Data" tab or the "DLAR" tab can be uploaded.
  "Prior Acts": "prev_acts",
  "Current Acts": "cur_acts",
  "Pacing Acts": "cur_pace",
  "Current Quota": "cur_quota",
  "Pacing % to Quota": "cur_pacing_pct",
  "Current Upgrades": "upgrades",
  "Current TopUps": "cur_tops",
  "Current Edge Apply": "cur_edge_apply",
  "Devices OnHand": "device_on_hand",
  "<15 Devices OnHand": "low_device",
  "Promo Device OnHand#": "promo_on_hand",
  "Current TWP Acts": "cur_twp_acts",
  "Current TWP Adds": "cur_twp",
  "Prior TWP Acts": "prev_twp_acts",
  "Prior TWP Adds": "prev_twp",
  "Current Family%": "cur_family_pct",
  "Prior Family%": "prev_family_pct",
  "Current Port-in%": "cur_port_pct",
  "Prior Port-in%": "prev_port_pct",
  "Current $50+ Plan%": "cur_50_pct",
  "Prior $50+ Plan%": "prev_50_pct",
  "Current $65+ Plan%": "cur_65_pct",
  "Prior $65+ Plan%": "prev_65_pct",
  "Current FWA Close %": "cur_fwa_close_pct",
  "Prior FWA Close %": "prev_fwa_close_pct",
  "Prior Zulu%": "prev_zulu_pct",
  "Current Zulu%": "cur_zulu_pct",

  // Full 2MR–7MR replenishment cohort breakdown (acts, payments, %)
  "Prior 2MR Acts": "prev_2mr_acts", "Prior 2MR Payments": "prev_2mr_pay", "Prior 2MR%": "prev_2mr_pct",
  "Current 2MR Acts": "cur_2mr_acts", "Current 2MR Payments": "cur_2mr_pay", "Current 2MR%": "cur_2mr_pct",
  "Prior 3MR Acts": "prev_3mr_acts", "Prior 3MR Payments": "prev_3mr_pay", "Prior 3MR%": "prev_3mr_pct",
  "Current 3MR Acts": "cur_3mr_acts", "Current 3MR Payments": "cur_3mr_pay", "Current 3MR%": "cur_3mr_pct",
  "Prior 4MR Acts": "prev_4mr_acts", "Prior 4MR Payments": "prev_4mr_pay", "Prior 4MR%": "prev_4mr_pct",
  "Current 4MR Acts": "cur_4mr_acts", "Current 4MR Payments": "cur_4mr_pay", "Current 4MR%": "cur_4mr_pct",
  "Prior 5MR Acts": "prev_5mr_acts", "Prior 5MR Payments": "prev_5mr_pay", "Prior 5MR%": "prev_5mr_pct",
  "Current 5MR Acts": "cur_5mr_acts", "Current 5MR Payments": "cur_5mr_pay", "Current 5MR%": "cur_5mr_pct",
  "Prior 6MR Acts": "prev_6mr_acts", "Prior 6MR Payments": "prev_6mr_pay", "Prior 6MR%": "prev_6mr_pct",
  "Current 6MR Acts": "cur_6mr_acts", "Current 6MR Payments": "cur_6mr_pay", "Current 6MR%": "cur_6mr_pct",
  "Prior 7MR Acts": "prev_7mr_acts", "Prior 7MR Payments": "prev_7mr_pay", "Prior 7MR%": "prev_7mr_pct",
  "Current 7MR Acts": "cur_7mr_acts", "Current 7MR Payments": "cur_7mr_pay", "Current 7MR%": "cur_7mr_pct",
};

export const DOOR_FIELDS = [
  "store_id", "door_tsp", "address", "city", "state", "zip", "market", "district", "region",
  "sub_agent_name", "tenure", "building_type", "open_date",
  "ma_field_rep", "ma_field_phone", "ma_field_email",
  "contact_name", "contact_phone", "rpm", "sm",
];

export const SNAPSHOT_NUMERIC_FIELDS = [
  "cur_acts", "cur_quota", "cur_pace", "prev_acts",
  "cur_fam", "cur_port", "cur_50", "cur_65", "prev_fam", "prev_port", "prev_50", "prev_65",
  "device_on_hand", "promo_on_hand", "spiff_on_hand", "spiff_sales",
  "cur_2m_acts", "cur_2m_pay", "cur_3m_acts", "cur_3m_pay",
  "prev_2m_acts", "prev_2m_pay", "prev_3m_acts", "prev_3m_pay",
  "cur_fwa", "cur_fwa_eligible", "cur_fwa_looks", "prev_fwa", "prev_fwa_eligible",
  "cur_twp", "cur_twp_acts", "prev_twp", "prev_twp_acts",
  "cur_tabs", "prev_tabs", "prev_zu_ap_act", "prev_zulu", "prev_ap", "violations",
  "cur_edge_apply", "upgrades", "cur_tops",
  "cur_pacing_pct", "cur_family_pct", "prev_family_pct", "cur_port_pct", "prev_port_pct",
  "cur_50_pct", "prev_50_pct", "cur_65_pct", "prev_65_pct", "cur_fwa_close_pct", "prev_fwa_close_pct",
  "cur_zulu_pct", "prev_zulu_pct",
  "prev_2mr_acts", "prev_2mr_pay", "prev_2mr_pct", "cur_2mr_acts", "cur_2mr_pay", "cur_2mr_pct",
  "prev_3mr_acts", "prev_3mr_pay", "prev_3mr_pct", "cur_3mr_acts", "cur_3mr_pay", "cur_3mr_pct",
  "prev_4mr_acts", "prev_4mr_pay", "prev_4mr_pct", "cur_4mr_acts", "cur_4mr_pay", "cur_4mr_pct",
  "prev_5mr_acts", "prev_5mr_pay", "prev_5mr_pct", "cur_5mr_acts", "cur_5mr_pay", "cur_5mr_pct",
  "prev_6mr_acts", "prev_6mr_pay", "prev_6mr_pct", "cur_6mr_acts", "cur_6mr_pay", "cur_6mr_pct",
  "prev_7mr_acts", "prev_7mr_pay", "prev_7mr_pct", "cur_7mr_acts", "cur_7mr_pay", "cur_7mr_pct",
];

export const SNAPSHOT_FIELDS = ["status", "last_rpm_visit", "last_ma_visit", "low_device", ...SNAPSHOT_NUMERIC_FIELDS];

// Rather than rely only on exact-string header matches for the 2–7 month
// replenishment columns, also pattern-match on the shape "Current/Prior
// <N>MR <Acts|Payments|%>" — this catches the same data even if a header
// has different spacing/casing than expected (e.g. "Current 5MR %" with
// an extra space). Bounded to 2–7 since that's what the database has
// columns for.
const MR_PATTERN = /^(Prior|Current)\s+(\d)\s*MR\s*(Acts|Payments|%)\s*$/i;
const MR_SUFFIX = { acts: "acts", payments: "pay", "%": "pct" };

function applyMrPatternFields(raw, rec) {
  for (const key of Object.keys(raw)) {
    const m = key.match(MR_PATTERN);
    if (!m) continue;
    const n = Number(m[2]);
    if (n < 2 || n > 7) continue;
    const prefix = m[1].toLowerCase() === "current" ? "cur" : "prev";
    const suffix = MR_SUFFIX[m[3].toLowerCase()];
    if (!suffix) continue;
    const field = `${prefix}_${n}mr_${suffix}`;
    if (raw[key] !== undefined && raw[key] !== null) rec[field] = raw[key];
  }
}

function cleanValue(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || t === "--") return null;
    return t;
  }
  return v;
}

function toNumber(v) {
  const c = cleanValue(v);
  if (c === null) return null;
  const n = typeof c === "number" ? c : parseFloat(String(c).replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/**
 * Percentage fields need extra care: a CSV export bakes Excel's percent
 * formatting into visible text ("58.80%"), which already represents the
 * intended value once the "%" is stripped. But a raw .xlsx upload hands us
 * the underlying fraction instead (0.588 — the way Excel actually stores a
 * percent-formatted cell), with no "%" in sight to signal that. We use the
 * value's type as the signal for which case we're in, rather than just its
 * size — that way a genuinely tiny value like a real "0.50%" (parsed from
 * text) is never mistaken for a fraction and inflated to 50%.
 */
function toPercent(v) {
  const c = cleanValue(v);
  if (c === null) return null;
  if (typeof c === "number") {
    // No "%" was ever visible — this is Excel's raw stored fraction.
    return Math.abs(c) <= 1 ? c * 100 : c;
  }
  const n = parseFloat(String(c).replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function toDateString(v) {
  const c = cleanValue(v);
  if (c === null) return null;
  // Excel serial dates come through the xlsx lib as JS Date objects when
  // {cellDates: true} is set, so this mainly just formats those.
  const d = v instanceof Date ? v : new Date(c);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Takes an array of row objects (as produced by XLSX.utils.sheet_to_json
 * with header row detection) and returns { doors, snapshotRows, repNames }.
 */
export function mapRowsToRecords(rows) {
  const doorsByStore = new Map();
  const snapshotsByStore = new Map();
  const repNames = new Set();

  for (const raw of rows) {
    const rec = {};
    for (const [header, field] of Object.entries(HEADER_TO_FIELD)) {
      if (raw[header] !== undefined) rec[field] = raw[header];
    }
    applyMrPatternFields(raw, rec);
    if (!rec.store_id) continue;

    rec.contact_name = `${cleanValue(rec._cfirst) || ""} ${cleanValue(rec._clast) || ""}`.trim() || null;
    rec.open_date = toDateString(rec.open_date);
    rec.last_rpm_visit = toDateString(rec.last_rpm_visit);
    rec.last_ma_visit = toDateString(rec.last_ma_visit);
    rec.low_device = cleanValue(rec.low_device) ? true : false;
    SNAPSHOT_NUMERIC_FIELDS.forEach((f) => (rec[f] = f.endsWith("_pct") ? toPercent(rec[f]) : toNumber(rec[f])));

    const door = {};
    DOOR_FIELDS.forEach((f) => (door[f] = cleanValue(rec[f]) ?? null));
    // If a Store ID appears more than once in the sheet, the last occurrence
    // wins — this also protects the database upsert, which otherwise
    // errors on "ON CONFLICT DO UPDATE command cannot affect row a second
    // time" when the same key shows up twice in one batch.
    doorsByStore.set(door.store_id, door);

    const snap = { store_id: rec.store_id };
    SNAPSHOT_FIELDS.forEach((f) => (snap[f] = rec[f] ?? null));
    snapshotsByStore.set(rec.store_id, snap);

    if (rec.ma_field_rep && !String(rec.ma_field_rep).toUpperCase().includes("UNASSIGNED")) {
      repNames.add(String(rec.ma_field_rep).trim());
    }
  }

  return {
    doors: Array.from(doorsByStore.values()),
    snapshotRows: Array.from(snapshotsByStore.values()),
    repNames: Array.from(repNames),
  };
}
