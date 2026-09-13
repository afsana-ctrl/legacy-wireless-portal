import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/apiAuth";

export const runtime = "nodejs";

// Deletes every row from snapshots and doors — the data that comes from
// daily file uploads. Reps, accounts, roles, and rep assignments are left
// completely untouched. The next import fully rebuilds doors from scratch
// and matches them back to the existing reps by name, so nothing about
// who's assigned to what needs to be redone.
export async function POST(request) {
  const admin = getSupabaseAdmin();
  const auth = await requireAdmin(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    // Order matters: snapshots references doors.
    const { error: snapErr } = await admin.from("snapshots").delete().not("id", "is", null);
    if (snapErr) throw snapErr;

    const { error: doorsErr } = await admin.from("doors").delete().not("store_id", "is", null);
    if (doorsErr) throw doorsErr;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset error", err);
    return NextResponse.json({ error: err.message || "Reset failed" }, { status: 500 });
  }
}
