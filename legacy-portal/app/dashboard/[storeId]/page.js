"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, MapPin, TrendingUp, Calendar, Package, Radio, Store, MessageSquare } from "lucide-react";
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
  const { loading: authLoading, profile, user } = useProfile();

  const [door, setDoor] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("cur_acts");
  const [granularity, setGranularity] = useState("day"); // day | week | month

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState(null);

  async function loadNotes() {
    setNotesLoading(true);
    const { data, error } = await supabase
      .from("door_notes")
      .select("id, note, author_email, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setNotes(data || []);
    setNotesLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, profile]);

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setNoteBusy(true);
    setNoteError(null);
    const { error } = await supabase.from("door_notes").insert({
      store_id: storeId,
      author_id: user.id,
      author_email: user.email,
      note: noteText.trim(),
    });
    if (error) {
      setNoteError(error.message);
    } else {
      setNoteText("");
      await loadNotes();
    }
    setNoteBusy(false);
  }

  function fmtNoteTime(s) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

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

  const dailyPoints = useMemo(() => {
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

  // Week/month views sum the same daily deltas into weekly/monthly totals,
  // rather than diffing raw cumulative values directly — since Current
  // Acts (and similar fields) reset at the start of each month, a raw
  // diff across a month boundary wouldn't mean anything.
  function bucketSum(points, keyFn) {
    const map = new Map();
    for (const p of points) {
      const key = keyFn(p.date);
      if (!map.has(key)) map.set(key, { key, sum: 0, hasValue: false });
      if (p.value !== null && p.value !== undefined) {
        const b = map.get(key);
        b.sum += p.value;
        b.hasValue = true;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }
  function isoWeekStart(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
  }

  const dailyLabeled = useMemo(
    () => dailyPoints.map((p) => ({ date: p.date, value: p.value, label: fmtDayShort(p.date), tooltipLabel: fmtDate(p.date) })),
    [dailyPoints]
  );
  const weeklyLabeled = useMemo(
    () =>
      bucketSum(dailyPoints, isoWeekStart).map((b) => ({
        date: b.key,
        value: b.hasValue ? b.sum : null,
        label: fmtDate(b.key),
        tooltipLabel: `Week of ${fmtDate(b.key)}`,
      })),
    [dailyPoints]
  );
  const monthlyLabeled = useMemo(
    () =>
      bucketSum(dailyPoints, (d) => d.slice(0, 7)).map((b) => {
        const d = new Date(b.key + "-01T00:00:00");
        return {
          date: b.key,
          value: b.hasValue ? b.sum : null,
          label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          tooltipLabel: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        };
      }),
    [dailyPoints]
  );

  const chartData = granularity === "week" ? weeklyLabeled : granularity === "month" ? monthlyLabeled : dailyLabeled;
  const hasEnoughHistory = chartData.filter((p) => p.value !== null).length >= 1 && chartData.length >= 2;

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
            {merged.door_tsp && <span style={{ color: "var(--ink-40)", fontSize: 13 }}>· TSP {merged.door_tsp}</span>}
          </div>
          <h1 className="display" style={{ fontSize: 30, margin: 0 }}>
            {merged.address}
          </h1>
          <div style={{ color: "var(--ink-60)", fontSize: 14.5, marginTop: 4, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <MapPin size={14} /> {merged.city}, {merged.state} {merged.zip} · {merged.market} market · {merged.sub_agent_name}
            {merged.sub_agent_id ? ` (${merged.sub_agent_id})` : ""}
          </div>
        </div>
        <div style={{ background: paceSt.bg, color: paceSt.color, padding: "10px 18px", borderRadius: 3, textAlign: "center" }}>
          <div className="display" style={{ fontSize: 24 }}>
            {fmtPct(merged.pacingPct)}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>{paceSt.label}</div>
        </div>
      </div>

      <SectionLabel icon={<MessageSquare size={14} />}>Visit notes</SectionLabel>
      <div style={{ background: "var(--surface)", borderRadius: 3, padding: "14px 16px", marginBottom: 8 }}>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="What happened on this visit? Inventory issues, conversations with staff, anything worth remembering next time…"
          rows={3}
          style={{ width: "100%", padding: "10px", fontSize: 14, fontFamily: "inherit", border: "1px solid var(--line)", borderRadius: 3, background: "white", color: "var(--ink)", resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-40)" }}>{user?.email}</span>
          <button
            className="btn-reset"
            disabled={noteBusy || !noteText.trim()}
            onClick={handleAddNote}
            style={{ padding: "7px 16px", borderRadius: 3, background: "var(--ink)", color: "var(--paper)", fontWeight: 600, fontSize: 13.5, opacity: noteBusy || !noteText.trim() ? 0.5 : 1 }}
          >
            {noteBusy ? "Saving…" : "Add note"}
          </button>
        </div>
        {noteError && <div style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{noteError}</div>}
      </div>
      <div style={{ marginBottom: 28 }}>
        {notesLoading && <div style={{ padding: "12px 4px", color: "var(--ink-60)", fontSize: 13.5 }}>Loading notes…</div>}
        {!notesLoading && notes.length === 0 && (
          <div style={{ padding: "12px 4px", color: "var(--ink-60)", fontSize: 13.5 }}>No visit notes yet — be the first to log one.</div>
        )}
        {!notesLoading &&
          notes.map((n) => (
            <div key={n.id} style={{ padding: "12px 4px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.note}</div>
              <div style={{ fontSize: 12, color: "var(--ink-40)", marginTop: 4 }}>
                {n.author_email} · {fmtNoteTime(n.created_at)}
              </div>
            </div>
          ))}
      </div>

      <SectionLabel icon={<TrendingUp size={14} />}>Activations — current vs. prior month</SectionLabel>
      <div className="grid-tiles" style={{ marginBottom: 8 }}>
        <Kpi label="Current acts (MTD)" value={fmtNum(merged.cur_acts)} sub={`Prior mo. ${fmtNum(merged.prev_acts)}`} />
        <Kpi label="Pacing to EOM" value={fmtNum(merged.cur_pace)} sub={`Quota ${fmtNum(merged.cur_quota)}`} />
        <Kpi label="Family / multi-line" value={fmtPct(merged.curFamilyPct)} sub={`Prior mo. ${fmtPct(merged.prevFamilyPct)}`} />
        <Kpi label="Port-in %" value={fmtPct(merged.curPortPct)} sub={`Prior mo. ${fmtPct(merged.prevPortPct)}`} />
        <Kpi label="$50+ plan %" value={fmtPct(merged.cur50Pct)} sub={`Prior mo. ${fmtPct(merged.prev50Pct)}`} />
      </div>

      <SectionLabel icon={<Calendar size={14} />}>
        {granularity === "week" ? "Week over week" : granularity === "month" ? "Month over month" : "Day over day"}
      </SectionLabel>
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
          className="field-input"
          style={{ width: "auto", padding: "6px 10px", fontSize: 13, fontWeight: 600 }}
        >
          <option value="day">Day over day</option>
          <option value="week">Week over week</option>
          <option value="month">Month over month</option>
        </select>
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 4px", marginBottom: 28 }}>
        {hasEnoughHistory ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#5b655f" }} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
              <Tooltip
                contentStyle={{ background: "#1b2521", border: "none", borderRadius: 4, fontSize: 13 }}
                labelStyle={{ color: "#ecead2" }}
                itemStyle={{ color: "#ecead2" }}
                formatter={(v) => [v ?? "—", METRICS.find((m) => m.key === metric)?.label]}
                labelFormatter={(_, payload) => (payload && payload[0] ? payload[0].payload.tooltipLabel : "")}
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

      <SectionLabel icon={<Radio size={14} />}>Replenishment cohorts (2–7 month)</SectionLabel>
      <div style={{ background: "var(--surface)", borderRadius: 3, padding: "4px 16px 8px", marginBottom: 8 }}>
        {merged.mrCohorts.every((c) => c.curPct === null) ? (
          <div style={{ padding: "20px 4px", color: "var(--ink-60)", fontSize: 13.5 }}>
            No replenishment cohort data in this snapshot yet — upload a DLAR-tab export to fill this in.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ color: "var(--ink-60)", textAlign: "left" }}>
                <th style={{ fontWeight: 600, padding: "8px 4px" }}>Cohort</th>
                <th style={{ fontWeight: 600, padding: "8px 4px" }}>Current</th>
                <th style={{ fontWeight: 600, padding: "8px 4px" }}>Prior mo.</th>
              </tr>
            </thead>
            <tbody>
              {merged.mrCohorts.map((c) => (
                <tr key={c.months} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 4px", fontWeight: 600 }}>{c.months}MR</td>
                  <td style={{ padding: "8px 4px" }} className="display">
                    {fmtPct(c.curPct)} <span style={{ fontFamily: "IBM Plex Sans", fontWeight: 400, color: "var(--ink-40)", fontSize: 12 }}>({fmtNum(c.curActs)} acts)</span>
                  </td>
                  <td style={{ padding: "8px 4px", color: "var(--ink-60)" }}>{fmtPct(c.prevPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SectionLabel icon={<Radio size={14} />}>Protection, FWA &amp; AutoPay</SectionLabel>
      <div className="grid-tiles" style={{ marginBottom: 28 }}>
        <Kpi label="Protect attach" value={fmtPct(merged.twpProtectPct)} sub={`${fmtNum(merged.cur_twp)} of ${fmtNum(merged.cur_twp_acts)} acts`} />
        <Kpi label="FWA close rate" value={fmtPct(merged.fwaClosePct)} sub={`${fmtNum(merged.cur_fwa)} activated MTD`} />
        <Kpi label="Zulu enrollment" value={fmtPct(merged.cur_zulu_pct)} sub={`Prior mo. ${fmtPct(merged.prev_zulu_pct)}`} />
      </div>

      <SectionLabel icon={<Store size={14} />}>Location &amp; contacts</SectionLabel>
      <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 18px", fontSize: 14, lineHeight: 1.9 }}>
        <ContactLine label="Door TSP" value={merged.door_tsp} />
        <ContactLine label="Sub-Agent ID" value={merged.sub_agent_id} />
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
