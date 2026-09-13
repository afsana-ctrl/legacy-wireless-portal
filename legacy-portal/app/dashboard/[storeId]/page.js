"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, MapPin, TrendingUp, Calendar, Package, Radio, Store } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useProfile } from "../../../lib/useProfile";
import { fmtNum, fmtPct, fmtDate, fmtDayShort, paceStatus, statusPill, withDerived } from "../../../lib/format";

const METRICS = [
  { key: "cur_acts", label: "Activations" },
  { key: "cur_edge_apply", label: "Edge Applications" },
  { key: "upgrades", label: "Upgrades" },
  { key: "cur_tops", label: "TopUps" },
];

export default function DoorDetailPage() {
  const { storeId } = useParams();
  const router = useRouter();
  const { loading: authLoading, profile } = useProfile();

  const [door, setDoor] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("cur_acts");

  useEffect(() => {
    if (!profile) return;
    let active = true;
    async function load() {
      const { data: doorRow, error: doorErr } = await supabase.from("doors").select("*").eq("store_id", storeId).single();
      const { data: snapRows, error: snapErr } = await supabase
        .from("snapshots")
        .select("*")
        .eq("store_id", storeId)
        .order("snapshot_date", { ascending: true });
      if (doorErr) console.error(doorErr);
      if (snapErr) console.error(snapErr);
      if (!active) return;
      setDoor(doorRow || null);
      setSnapshots(snapRows || []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [storeId, profile]);

  const latest = snapshots[snapshots.length - 1] || {};
  const merged = door ? withDerived({ ...door, ...latest }) : null;

  const chartData = useMemo(() => {
    // day-over-day = the change in a cumulative MTD field between consecutive snapshots
    const points = [];
    for (let i = 1; i < snapshots.length; i++) {
      const cur = snapshots[i][metric];
      const prev = snapshots[i - 1][metric];
      const value = cur != null && prev != null ? cur - prev : null;
      points.push({ date: snapshots[i].snapshot_date, value });
    }
    return points;
  }, [snapshots, metric]);

  const hasEnoughHistory = chartData.filter((p) => p.value !== null).length >= 1 && snapshots.length >= 2;

  if (authLoading || loading) {
    return <div style={{ padding: 40, color: "var(--ink-60)" }}>Loading…</div>;
  }
  if (!merged) {
    return <div style={{ padding: 40, color: "var(--ink-60)" }}>Location not found, or you don't have access to it.</div>;
  }

  const paceSt = paceStatus(merged.pacingPct);
  const sp = statusPill(merged.status);

  return (
    <div className="container">
      <button className="btn-reset" onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 13.5, marginBottom: 18 }}>
        <ChevronLeft size={16} /> Back to locations
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="pill" style={{ background: sp.bg, color: sp.color }}>
              {merged.status}
            </span>
            <span style={{ color: "var(--ink-60)", fontSize: 13 }}>{merged.store_id}</span>
          </div>
          <h1 className="display" style={{ fontSize: 30, margin: 0 }}>
            {merged.address}
          </h1>
          <div style={{ color: "var(--ink-60)", fontSize: 14.5, marginTop: 4, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <MapPin size={14} /> {merged.city}, {merged.state} {merged.zip} · {merged.market} market · {merged.sub_agent_name}
          </div>
        </div>
        <div style={{ background: paceSt.bg, color: paceSt.color, padding: "10px 18px", borderRadius: 3, textAlign: "center" }}>
          <div className="display" style={{ fontSize: 24 }}>
            {fmtPct(merged.pacingPct)}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>{paceSt.label}</div>
        </div>
      </div>

      <SectionLabel icon={<TrendingUp size={14} />}>Activations — current vs. prior month</SectionLabel>
      <div className="grid-tiles" style={{ marginBottom: 8 }}>
        <Kpi label="Current acts (MTD)" value={fmtNum(merged.cur_acts)} sub={`Prior mo. ${fmtNum(merged.prev_acts)}`} />
        <Kpi label="Pacing to EOM" value={fmtNum(merged.cur_pace)} sub={`Quota ${fmtNum(merged.cur_quota)}`} />
        <Kpi label="Family / multi-line" value={fmtPct(merged.curFamilyPct)} sub={`Prior mo. ${fmtPct(merged.prevFamilyPct)}`} />
        <Kpi label="Port-in %" value={fmtPct(merged.curPortPct)} sub={`Prior mo. ${fmtPct(merged.prevPortPct)}`} />
        <Kpi label="$50+ plan %" value={fmtPct(merged.cur50Pct)} sub={`Prior mo. ${fmtPct(merged.prev50Pct)}`} />
      </div>

      <SectionLabel icon={<Calendar size={14} />}>Day over day</SectionLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            className="btn-reset"
            onClick={() => setMetric(m.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: metric === m.key ? "var(--ink)" : "var(--surface)",
              color: metric === m.key ? "var(--paper)" : "var(--ink-60)",
              border: `1px solid ${metric === m.key ? "var(--ink)" : "var(--line)"}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 4px", marginBottom: 28 }}>
        {hasEnoughHistory ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData.map((p) => ({ ...p, day: fmtDayShort(p.date), niceDate: fmtDate(p.date) }))} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#5b655f" }} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
              <Tooltip
                contentStyle={{ background: "#1b2521", border: "none", borderRadius: 4, fontSize: 13 }}
                labelStyle={{ color: "#ecead2" }}
                itemStyle={{ color: "#ecead2" }}
                formatter={(v) => [v ?? "—", METRICS.find((m) => m.key === metric)?.label]}
                labelFormatter={(_, payload) => (payload && payload[0] ? payload[0].payload.niceDate : "")}
              />
              <Line type="monotone" dataKey="value" stroke="#2f6f5e" strokeWidth={2.5} dot={{ r: 3.5, fill: "#2f6f5e" }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ padding: "36px 12px", textAlign: "center", color: "var(--ink-60)", fontSize: 13.5 }}>
            Not enough history yet — this builds in as more days get imported.
          </div>
        )}
      </div>

      <SectionLabel icon={<Package size={14} />}>Inventory</SectionLabel>
      <div className="grid-tiles" style={{ marginBottom: 28 }}>
        <Kpi label="Devices on hand" value={fmtNum(merged.device_on_hand)} sub={merged.low_device ? "Below target" : "Above target"} tone={merged.low_device ? "var(--rust)" : undefined} />
        <Kpi label="Promo devices" value={fmtNum(merged.promo_on_hand)} sub={`${fmtPct(merged.promoPct)} of stock`} />
        <Kpi label="Moto on hand" value={fmtNum(merged.spiff_on_hand)} sub={`${fmtNum(merged.spiff_sales)} sold MTD`} />
        <Kpi label="Tablets sold MTD" value={fmtNum(merged.cur_tabs)} sub={`Prior mo. ${fmtNum(merged.prev_tabs)}`} />
      </div>

      <SectionLabel icon={<Radio size={14} />}>Replenishment &amp; protection</SectionLabel>
      <div className="grid-tiles" style={{ marginBottom: 28 }}>
        <Kpi label="2-month replenish" value={fmtPct(merged.cur2mrPct)} sub={`Prior mo. ${fmtPct(merged.prev2mrPct)}`} />
        <Kpi label="3-month replenish" value={fmtPct(merged.cur3mrPct)} sub={`Prior mo. ${fmtPct(merged.prev3mrPct)}`} />
        <Kpi label="Protect attach" value={fmtPct(merged.twpProtectPct)} sub={`${fmtNum(merged.cur_twp)} of ${fmtNum(merged.cur_twp_acts)} acts`} />
        <Kpi label="FWA close rate" value={fmtPct(merged.fwaClosePct)} sub={`${fmtNum(merged.cur_fwa)} activated MTD`} />
      </div>

      <SectionLabel icon={<Store size={14} />}>Location &amp; contacts</SectionLabel>
      <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 18px", fontSize: 14, lineHeight: 1.9 }}>
        <ContactLine label="Store contact" value={merged.contact_name} extra={merged.contact_phone} />
        <ContactLine label="MA field rep" value={merged.ma_field_rep} extra={merged.ma_field_phone} />
        <ContactLine label="Verizon RPM" value={merged.rpm} />
        <ContactLine label="Verizon SM" value={merged.sm} />
        <ContactLine label="Last RPM visit" value={fmtDate(merged.last_rpm_visit)} />
        <ContactLine label="Last MA visit" value={fmtDate(merged.last_ma_visit)} />
        <ContactLine label="Open since" value={fmtDate(merged.open_date)} />
      </div>
    </div>
  );
}

function SectionLabel({ children, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 12.5, fontWeight: 600, margin: "22px 2px 8px" }}>
      {icon} {children}
    </div>
  );
}
function Kpi({ label, value, sub, tone }) {
  return (
    <div className="tile">
      <div style={{ fontSize: 11.5, color: "var(--ink-60)" }}>{label}</div>
      <div className="display" style={{ fontSize: 22, marginTop: 3, color: tone || "var(--ink)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--ink-40)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function ContactLine({ label, value, extra }) {
  if (!value || (typeof value === "string" && value.trim() === "")) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
      <span style={{ color: "var(--ink-60)" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>
        {value}
        {extra ? ` · ${extra}` : ""}
      </span>
    </div>
  );
}
