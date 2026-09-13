"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useProfile } from "../../../lib/useProfile";

export default function AssignRepsPage() {
  const router = useRouter();
  const { loading, profile } = useProfile();
  const [users, setUsers] = useState([]);
  const [reps, setReps] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    if (profile?.role !== "admin") return;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setUsers(json.users || []);
      const { data: repRows } = await supabase.from("reps").select("id, name").order("name");
      setReps(repRows || []);
    })();
  }, [profile]);

  async function updateUser(userId, patch) {
    setSavingId(userId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch("/api/admin/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, ...patch }),
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    setSavingId(null);
    setSavedId(userId);
    setTimeout(() => setSavedId(null), 1500);
  }

  if (loading) return <div style={{ padding: 40, color: "var(--ink-60)" }}>Loading…</div>;
  if (profile?.role !== "admin") return <div style={{ padding: 40, color: "var(--ink-60)" }}>Admin access required.</div>;

  return (
    <div className="container">
      <button className="btn-reset" onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 13.5, marginBottom: 18 }}>
        <ChevronLeft size={16} /> Back
      </button>
      <div className="display" style={{ fontSize: 13, color: "var(--teal)", marginBottom: 6 }}>
        Legacy Wireless — Field Portal
      </div>
      <h1 className="display" style={{ fontSize: 30, margin: "0 0 6px" }}>
        Assign reps
      </h1>
      <p style={{ color: "var(--ink-60)", fontSize: 14.5, lineHeight: 1.6, maxWidth: 560, marginBottom: 24 }}>
        Invite people from your Supabase dashboard's Authentication tab first — they'll show up
        here automatically. Then link each account to the rep (and role) they should see data as.
      </p>

      <div style={{ borderTop: "1px solid var(--line)" }}>
        {users.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 4px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180, fontSize: 14.5, fontWeight: 600 }}>{u.email}</div>
            <select
              className="field-input"
              style={{ width: "auto" }}
              value={u.role}
              onChange={(e) => updateUser(u.id, { role: e.target.value })}
            >
              <option value="rep">Rep</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="field-input"
              style={{ width: "auto" }}
              value={u.rep_id || ""}
              onChange={(e) => updateUser(u.id, { repId: e.target.value || null })}
            >
              <option value="">No rep assigned</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {savingId === u.id && <span style={{ fontSize: 12.5, color: "var(--ink-40)" }}>Saving…</span>}
            {savedId === u.id && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--teal)" }}>
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
          </div>
        ))}
        {users.length === 0 && <div style={{ padding: "24px 4px", color: "var(--ink-60)" }}>No users invited yet.</div>}
      </div>
    </div>
  );
}
