"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useProfile } from "../../../lib/useProfile";

function fmtWhen(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ActionPlansPage() {
  const router = useRouter();
  const { loading, profile } = useProfile();
  const [plans, setPlans] = useState([]);
  const [doorsById, setDoorsById] = useState(new Map());
  const [repsById, setRepsById] = useState(new Map());
  const [dataLoading, setDataLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setDataLoading(true);
    const [{ data: planRows }, { data: doorRows }, { data: repRows }] = await Promise.all([
      supabase.from("action_plans").select("*").order("created_at", { ascending: false }),
      supabase.from("doors").select("store_id, address, city, state, rep_id"),
      supabase.from("reps").select("id, name"),
    ]);
    setPlans(planRows || []);
    setDoorsById(new Map((doorRows || []).map((d) => [d.store_id, d])));
    setRepsById(new Map((repRows || []).map((r) => [r.id, r])));
    setDataLoading(false);
  }

  useEffect(() => {
    if (profile?.role === "admin") load();
  }, [profile]);

  async function acknowledge(id) {
    setBusyId(id);
    await supabase.from("action_plans").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("id", id);
    await load();
    setBusyId(null);
  }

  if (loading || (profile?.role === "admin" && dataLoading)) {
    return <div style={{ padding: 40, color: "var(--ink-60)" }}>Loading…</div>;
  }
  if (profile?.role !== "admin") {
    return <div style={{ padding: 40, color: "var(--ink-60)" }}>Admin access required.</div>;
  }

  const needsReview = plans.filter((p) => p.status === "submitted" && !p.acknowledged);
  const awaitingSubmission = plans.filter((p) => p.status === "requested");
  const reviewed = plans.filter((p) => p.status === "submitted" && p.acknowledged);

  function repName(repId) {
    return repId ? repsById.get(repId)?.name || "Unknown rep" : "Unassigned";
  }
  function doorLabel(storeId) {
    const d = doorsById.get(storeId);
    if (!d) return storeId;
    return `${d.address} — ${d.city}, ${d.state}`;
  }

  return (
    <div className="container">
      <button className="btn-reset" onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 13.5, marginBottom: 18 }}>
        <ChevronLeft size={16} /> Back
      </button>
      <div className="display" style={{ fontSize: 13, color: "var(--teal)", marginBottom: 6 }}>
        Legacy Wireless — Field Portal
      </div>
      <h1 className="display" style={{ fontSize: 30, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <ClipboardList size={26} /> Action Plans
      </h1>
      <p style={{ color: "var(--ink-60)", fontSize: 14.5, marginBottom: 28 }}>
        Anything a rep has submitted shows up here to review, plus anything you're still waiting on.
      </p>

      <SectionTitle>Needs your review ({needsReview.length})</SectionTitle>
      {needsReview.length === 0 ? (
        <EmptyRow>Nothing waiting on you right now.</EmptyRow>
      ) : (
        needsReview.map((p) => (
          <PlanRow key={p.id} plan={p} doorLabel={doorLabel(p.store_id)} repName={repName(p.rep_id)} onOpenDoor={() => router.push(`/dashboard/${p.store_id}`)}>
            <button
              className="btn-reset"
              disabled={busyId === p.id}
              onClick={() => acknowledge(p.id)}
              style={{ padding: "6px 14px", borderRadius: 3, background: "var(--ink)", color: "var(--paper)", fontSize: 13, fontWeight: 600, opacity: busyId === p.id ? 0.5 : 1 }}
            >
              {busyId === p.id ? "Saving…" : "Mark as reviewed"}
            </button>
          </PlanRow>
        ))
      )}

      <SectionTitle>Waiting on a rep to submit ({awaitingSubmission.length})</SectionTitle>
      {awaitingSubmission.length === 0 ? (
        <EmptyRow>No open requests.</EmptyRow>
      ) : (
        awaitingSubmission.map((p) => (
          <PlanRow key={p.id} plan={p} doorLabel={doorLabel(p.store_id)} repName={repName(p.rep_id)} onOpenDoor={() => router.push(`/dashboard/${p.store_id}`)} />
        ))
      )}

      {reviewed.length > 0 && (
        <>
          <SectionTitle>Reviewed ({reviewed.length})</SectionTitle>
          {reviewed.map((p) => (
            <PlanRow key={p.id} plan={p} doorLabel={doorLabel(p.store_id)} repName={repName(p.rep_id)} onOpenDoor={() => router.push(`/dashboard/${p.store_id}`)} dim />
          ))}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-60)", margin: "24px 2px 10px" }}>{children}</div>;
}
function EmptyRow({ children }) {
  return <div style={{ padding: "16px 4px", color: "var(--ink-60)", fontSize: 13.5 }}>{children}</div>;
}

function PlanRow({ plan, doorLabel, repName, onOpenDoor, children, dim }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 3, padding: "12px 14px", marginBottom: 8, opacity: dim ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <button className="btn-reset" onClick={onOpenDoor} style={{ fontWeight: 600, fontSize: 14.5, color: "var(--teal)", textAlign: "left" }}>
            {doorLabel}
          </button>
          <div style={{ fontSize: 12.5, color: "var(--ink-60)", marginTop: 2 }}>
            {repName} · {plan.status === "submitted" ? `Submitted ${fmtWhen(plan.submitted_at)}` : `Requested ${fmtWhen(plan.created_at)}`}
            {plan.acknowledged && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--teal)", marginLeft: 8 }}>
                <CheckCircle2 size={12} /> Reviewed {fmtWhen(plan.acknowledged_at)}
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
      {plan.plan_text && <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 8 }}>{plan.plan_text}</div>}
    </div>
  );
}
