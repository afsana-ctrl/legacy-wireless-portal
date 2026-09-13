export async function requireAdmin(request, admin) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, message: "Missing auth token" };

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, status: 401, message: "Invalid session" };

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileErr || profile?.role !== "admin") {
    return { ok: false, status: 403, message: "Admin access required" };
  }
  return { ok: true, userId: userData.user.id };
}
