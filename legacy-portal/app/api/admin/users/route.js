import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/apiAuth";

export const runtime = "nodejs";

export async function GET(request) {
  const admin = getSupabaseAdmin();
  const auth = await requireAdmin(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { data: userList, error: userErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  const { data: profiles, error: profileErr } = await admin.from("profiles").select("id, role, rep_id");
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  const profileById = new Map((profiles || []).map((p) => [p.id, p]));
  const merged = (userList?.users || []).map((u) => {
    const p = profileById.get(u.id) || {};
    return { id: u.id, email: u.email, role: p.role || "rep", rep_id: p.rep_id || null };
  });

  return NextResponse.json({ users: merged });
}
