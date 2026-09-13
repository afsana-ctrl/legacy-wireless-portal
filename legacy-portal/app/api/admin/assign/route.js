import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/apiAuth";

export const runtime = "nodejs";

export async function POST(request) {
  const admin = getSupabaseAdmin();
  const auth = await requireAdmin(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await request.json();
  const { userId, repId, role } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const update = {};
  if (repId !== undefined) update.rep_id = repId || null;
  if (role !== undefined) update.role = role;

  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
