import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapRowsToRecords } from "../../../lib/sheetMapping";
import { requireAdmin } from "../../../lib/apiAuth";

export const runtime = "nodejs";

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
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === "data") || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

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

    // 2. Attach rep_id to each door and upsert
    const doorsWithRep = doors.map((d) => ({
      ...d,
      rep_id: d.ma_field_rep ? repIdByName.get(d.ma_field_rep) || null : null,
    }));
    const { error: doorsErr } = await admin.from("doors").upsert(doorsWithRep, { onConflict: "store_id" });
    if (doorsErr) throw doorsErr;

    // 3. Upsert this day's snapshot rows
    const snapshotsWithDate = snapshotRows.map((s) => ({ ...s, snapshot_date: snapshotDate }));
    const { error: snapErr } = await admin.from("snapshots").upsert(snapshotsWithDate, { onConflict: "store_id,snapshot_date" });
    if (snapErr) throw snapErr;

    return NextResponse.json({
      ok: true,
      doors: doorsWithRep.length,
      snapshots: snapshotsWithDate.length,
      reps: repNames.length,
      date: snapshotDate,
    });
  } catch (err) {
    console.error("import error", err);
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 });
  }
}
