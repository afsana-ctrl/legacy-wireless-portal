import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapRowsToRecords } from "../../../lib/sheetMapping";
import { requireAdmin } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds — give the workbook parse more headroom

export async function POST(request) {
  const admin = getSupabaseAdmin();

  const auth = await requireAdmin(request, admin);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const snapshotDate = formData.get("date");
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!snapshotDate) return NextResponse.json({ error: "No snapshot date provided" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Try to parse only the "Data" tab up front — reading all 14 tabs of a
    // multi-megabyte workbook is what was pushing this past the function's
    // time limit. XLSX's `sheets` option skips parsing anything else.
    let workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheets: ["Data"], bookSheets: false });
    let sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === "data");

    if (!sheetName) {
      // Fall back to a full parse if there's no tab literally named "Data"
      // (e.g. a CSV export of the DLAR tab, which shows up as "Sheet1").
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      sheetName = workbook.SheetNames[0];
    }

    const sheet = workbook.Sheets[sheetName];

    // The "Data" tab has its header on row 1. The "DLAR" tab has a few
    // title/filter rows above the real header row. Rather than assume
    // either layout, scan the first 10 rows for whichever one starts with
    // "Store ID" and treat that as the header row.
    const asArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const headerRowIndex = asArrays.findIndex((row) => String(row?.[0] ?? "").trim() === "Store ID");
    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: "Couldn't find a 'Store ID' column in the first 10 rows of this file. Make sure you're uploading the Data or DLAR tab." },
        { status: 400 }
      );
    }
    const headerRow = asArrays[headerRowIndex];
    const rows = asArrays.slice(headerRowIndex + 1).map((row) => {
      const obj = {};
      headerRow.forEach((h, i) => {
        if (h) obj[h] = row[i] === undefined ? null : row[i];
      });
      return obj;
    });

    const { doors, snapshotRows, repNames } = mapRowsToRecords(rows);

    if (doors.length === 0) {
      return NextResponse.json(
        { error: "No matching rows found. Make sure the file has a 'Store ID' column and the header row is included." },
        { status: 400 }
      );
    }

    // 1. Upsert reps, then build a name -> id lookup
    if (repNames.length > 0) {
      const { error: repsErr } = await admin.from("reps").upsert(
        repNames.map((name) => ({ name })),
        { onConflict: "name", ignoreDuplicates: true }
      );
      if (repsErr) throw repsErr;
    }
    const { data: repRows, error: repsFetchErr } = await admin.from("reps").select("id, name");
    if (repsFetchErr) throw repsFetchErr;
    const repIdByName = new Map((repRows || []).map((r) => [r.name, r.id]));

    // 2. Attach rep_id to each door, then filter out any door whose
    // directory info we've already got from a *newer* snapshot date —
    // this is what makes it safe to import files out of chronological
    // order (e.g. backfilling an older month after today's data).
    const doorsWithRep = doors.map((d) => ({
      ...d,
      rep_id: d.ma_field_rep ? repIdByName.get(d.ma_field_rep) || null : null,
      source_date: snapshotDate,
    }));

    const storeIds = doorsWithRep.map((d) => d.store_id);
    const { data: existingDoors, error: existingErr } = await admin
      .from("doors")
      .select("store_id, source_date")
      .in("store_id", storeIds);
    if (existingErr) throw existingErr;
    const existingDateByStore = new Map((existingDoors || []).map((d) => [d.store_id, d.source_date]));

    const doorsToUpsert = doorsWithRep.filter((d) => {
      const existingDate = existingDateByStore.get(d.store_id);
      return !existingDate || snapshotDate >= existingDate;
    });
    const skippedDoorCount = doorsWithRep.length - doorsToUpsert.length;

    if (doorsToUpsert.length > 0) {
      const { error: doorsErr } = await admin.from("doors").upsert(doorsToUpsert, { onConflict: "store_id" });
      if (doorsErr) throw doorsErr;
    }

    // 3. Upsert this day's snapshot rows
    const snapshotsWithDate = snapshotRows.map((s) => ({ ...s, snapshot_date: snapshotDate }));
    const { error: snapErr } = await admin.from("snapshots").upsert(snapshotsWithDate, { onConflict: "store_id,snapshot_date" });
    if (snapErr) throw snapErr;

    return NextResponse.json({
      ok: true,
      doors: doorsWithRep.length,
      doorsUpdated: doorsToUpsert.length,
      doorsSkipped: skippedDoorCount,
      snapshots: snapshotsWithDate.length,
      reps: repNames.length,
      date: snapshotDate,
    });
  } catch (err) {
    console.error("import error", err);
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 });
  }
}
