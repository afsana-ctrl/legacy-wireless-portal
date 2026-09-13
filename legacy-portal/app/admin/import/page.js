"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, UploadCloud, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useProfile } from "../../../lib/useProfile";

export default function ImportPage() {
  const router = useRouter();
  const { loading, profile } = useProfile();
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const [confirmText, setConfirmText] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  if (loading) return <div style={{ padding: 40, color: "var(--ink-60)" }}>Loading…</div>;
  if (profile?.role !== "admin") {
    return <div style={{ padding: 40, color: "var(--ink-60)" }}>Admin access required.</div>;
  }

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("date", date);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: json.error || "Import failed" });
      } else {
        const skippedNote = json.doorsSkipped > 0 ? ` ${json.doorsSkipped} door(s)' directory info was left alone because you already have newer data for them.` : "";
        setResult({ ok: true, message: `Saved ${json.doors} doors and ${json.snapshots} snapshot rows for ${json.date} (${json.reps} reps found).${skippedNote}` });
      }
    } catch (e) {
      setResult({ ok: false, message: "Network error while uploading." });
    }
    setBusy(false);
  }

  async function handleReset() {
    setResetBusy(true);
    setResetResult(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setResetResult({ ok: false, message: json.error || "Reset failed" });
      } else {
        setResetResult({ ok: true, message: "All doors and snapshots deleted. Reps and rep assignments were left untouched — just re-import to rebuild fresh." });
        setConfirmText("");
      }
    } catch (e) {
      setResetResult({ ok: false, message: "Network error while resetting." });
    }
    setResetBusy(false);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 60px" }}>
      <button className="btn-reset" onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 13.5, marginBottom: 18 }}>
        <ChevronLeft size={16} /> Back
      </button>
      <div className="display" style={{ fontSize: 13, color: "var(--teal)", marginBottom: 6 }}>
        Legacy Wireless — Field Portal
      </div>
      <h1 className="display" style={{ fontSize: 30, margin: "0 0 6px" }}>
        Import today's data
      </h1>
      <p style={{ color: "var(--ink-60)", fontSize: 14.5, lineHeight: 1.6, maxWidth: 520 }}>
        Upload the daily workbook you get (the same file, as .xlsx or a CSV export of its "Data" tab).
        This refreshes store info, quota pacing, inventory, and plan-quality numbers, and saves it as a
        dated snapshot so day-over-day and week-over-week views keep building.
      </p>

      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginTop: 20, marginBottom: 4 }}>
        Snapshot date
      </label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" style={{ width: "auto", marginBottom: 16 }} />

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          border: "1px dashed var(--line)",
          borderRadius: 4,
          padding: "32px 16px",
          cursor: "pointer",
          background: "var(--surface)",
        }}
      >
        <UploadCloud size={22} color="var(--ink-60)" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{file ? file.name : "Choose a file or drag it here"}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-40)" }}>.xlsx or .csv</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
      </label>

      <button className="btn-primary" disabled={busy || !file} onClick={handleUpload} style={{ marginTop: 16 }}>
        <UploadCloud size={15} /> {busy ? "Uploading…" : "Import"}
      </button>

      {result && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 3,
            background: result.ok ? "var(--teal-soft)" : "var(--rust-soft)",
            color: result.ok ? "var(--teal)" : "var(--rust)",
            fontSize: 13.5,
          }}
        >
          {result.ok ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{result.message}</span>
        </div>
      )}

      <div style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--rust)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          <Trash2 size={14} /> Danger zone
        </div>
        <p style={{ color: "var(--ink-60)", fontSize: 13.5, lineHeight: 1.6, maxWidth: 520, marginBottom: 12 }}>
          Permanently deletes every door and snapshot you've imported — useful for clearing out
          messy test data and starting fresh. Reps, login accounts, and rep assignments are left
          completely alone. Your next import fully rebuilds the door directory and matches it back
          to your existing reps automatically.
        </p>
        <label style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          Type <b>DELETE</b> to confirm:
        </label>
        <input
          className="field-input"
          style={{ width: 160, marginBottom: 12, display: "block" }}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
        />
        <button
          className="btn-reset"
          disabled={resetBusy || confirmText !== "DELETE"}
          onClick={handleReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 3,
            background: "var(--rust)",
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            opacity: resetBusy || confirmText !== "DELETE" ? 0.5 : 1,
          }}
        >
          <Trash2 size={15} /> {resetBusy ? "Deleting…" : "Delete all imported data"}
        </button>

        {resetResult && (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 3,
              background: resetResult.ok ? "var(--teal-soft)" : "var(--rust-soft)",
              color: resetResult.ok ? "var(--teal)" : "var(--rust)",
              fontSize: 13.5,
            }}
          >
            {resetResult.ok ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>{resetResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
