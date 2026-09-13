// Maps the exact column headers on the "Data" tab of the daily workbook
// to the snake_case column names used in the Supabase tables.
// If your sheet's headers ever change, update this map — nothing else
// needs to change.

export const HEADER_TO_FIELD = {
  "Store ID": "store_id",
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
};

export const DOOR_FIELDS = [
  "store_id", "address", "city", "state", "zip", "market", "district", "region",
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
];

export const SNAPSHOT_FIELDS = ["status", "last_rpm_visit", "last_ma_visit", "low_device", ...SNAPSHOT_NUMERIC_FIELDS];

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
  const doors = [];
  const snapshotRows = [];
  const repNames = new Set();

  for (const raw of rows) {
    const rec = {};
    for (const [header, field] of Object.entries(HEADER_TO_FIELD)) {
      if (raw[header] !== undefined) rec[field] = raw[header];
    }
    if (!rec.store_id) continue;

    rec.contact_name = `${cleanValue(rec._cfirst) || ""} ${cleanValue(rec._clast) || ""}`.trim() || null;
    rec.open_date = toDateString(rec.open_date);
    rec.last_rpm_visit = toDateString(rec.last_rpm_visit);
    rec.last_ma_visit = toDateString(rec.last_ma_visit);
    rec.low_device = cleanValue(rec.low_device) ? true : false;
    SNAPSHOT_NUMERIC_FIELDS.forEach((f) => (rec[f] = toNumber(rec[f])));

    const door = {};
    DOOR_FIELDS.forEach((f) => (door[f] = cleanValue(rec[f]) ?? null));
    doors.push(door);

    const snap = { store_id: rec.store_id };
    SNAPSHOT_FIELDS.forEach((f) => (snap[f] = rec[f] ?? null));
    snapshotRows.push(snap);

    if (rec.ma_field_rep && !String(rec.ma_field_rep).toUpperCase().includes("UNASSIGNED")) {
      repNames.add(String(rec.ma_field_rep).trim());
    }
  }

  return { doors, snapshotRows, repNames: Array.from(repNames) };
}
