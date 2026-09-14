"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Phone, Mail, LogOut, TrendingUp, TrendingDown, UploadCloud, Users, List, BarChart3, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { supabase } from "../../lib/supabaseClient";
import { useProfile, signOut } from "../../lib/useProfile";
import { fmtNum, fmtPct, fmtDate, delta, paceStatus, statusPill, withDerived } from "../../lib/format";

const WATCHLIST_RULES = [
  { key: "pacing", label: "Pacing Acts", test: (d) => d.cur_pace != null && d.cur_pace < 30, describe: (d) => `Pacing Acts ${fmtNum(d.cur_pace)} (< 30)` },
  { key: "mr4", label: "4MR", test: (d) => d.cur_4mr_pct != null && d.cur_4mr_pct < 65, describe: (d) => `4MR ${fmtPct(d.cur_4mr_pct)} (< 65%)` },
  { key: "mr5", label: "5MR", test: (d) => d.cur_5mr_pct != null && d.cur_5mr_pct < 65, describe: (d) => `5MR ${fmtPct(d.cur_5mr_pct)} (< 65%)` },
  { key: "mr7", label: "7MR", test: (d) => d.cur_7mr_pct != null && d.cur_7mr_pct < 65, describe: (d) => `7MR ${fmtPct(d.cur_7mr_pct)} (< 65%)` },
  { key: "zulu", label: "Zulu", test: (d) => d.cur_zulu_pct != null && d.cur_zulu_pct > 4, describe: (d) => `Zulu ${fmtPct(d.cur_zulu_pct)} (> 4%)` },
  { key: "twp", label: "TWP+", test: (d) => d.twpProtectPct != null && d.twpProtectPct < 65, describe: (d) => `TWP+ ${fmtPct(d.twpProtectPct)} (< 65%)` },
];

export default function DashboardPage() {
  const router = useRouter();
  const { loading: authLoading, profile } = useProfile();

  const [reps, setReps] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [doors, setDoors] = useState([]);
  const [latestDate, setLatestDate] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // list | charts

  const isAdmin = profile?.role === "admin";

  // Once profile is known, decide which rep's doors to show and (if admin) load the rep list.
  useEffect(() => {
    if (!profile) return;
    if (isAdmin) {
      supabase
        .from("reps")
        .select("id, name, phone, email")
        .order("name")
        .then(({ data }) => {
          setReps(data || []);
          if (data && data.length > 0) setSelectedRepId((prev) => prev || data[0].id);
        });
    } else {
      setSelectedRepId(profile.rep_id || null);
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    if (!selectedRepId) {
      setDoors([]);
      setDataLoading(false);
      return;
    }
    let active = true;
    setDataLoading(true);

    async function load() {
      const { data: doorRows, error: doorErr } = await supabase
        .from("doors")
        .select("*")
        .eq("rep_id", selectedRepId);
      if (doorErr) console.error(doorErr);
      const storeIds = (doorRows || []).map((d) => d.store_id);
      if (storeIds.length === 0) {
        if (active) {
          setDoors([]);
          setLatestDate(null);
          setDataLoading(false);
        }
        return;
      }

      const { data: snapRows, error: snapErr } = await supabase
        .from("snapshots")
        .select("*")
        .in("store_id", storeIds)
        .order("snapshot_date", { ascending: false });
      if (snapErr) console.error(snapErr);

      // group snapshots by store, keep the 2 most recent per store for a day-over-day delta
      const byStore = new Map();
      for (const row of snapRows || []) {
        const arr = byStore.get(row.store_id) || [];
        if (arr.length < 2) arr.push(row);
        byStore.set(row.store_id, arr);
      }

      const allDates = (snapRows || []).map((r) => r.snapshot_date);
      const newest = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : null;

      const merged = (doorRows || []).map((d) => {
        const snaps = byStore.get(d.store_id) || [];
        const latest = snaps[0] || {};
        const prior = snaps[1] || {};
        return withDerived({ ...d, ...latest, _priorSnapshotActs: prior.cur_acts ?? null });
      });

      if (!active) return;
      setDoors(merged);
      setLatestDate(newest);
      setDataLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [selectedRepId]);

  const selectedRep = reps.find((r) => r.id === selectedRepId) || profile?.reps || null;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return doors.filter((d) => {
      if (!q) return true;
      return (
        (d.address || "").toLowerCase().includes(q) ||
        (d.city || "").toLowerCase().includes(q) ||
        (d.store_id || "").toLowerCase().includes(q) ||
        (d.market || "").toLowerCase().includes(q)
      );
    });
  }, [doors, query]);

  const behindCount = doors.filter((d) => d.pacingPct !== null && d.pacingPct < 80).length;
  const onPaceCount = doors.filter((d) => d.pacingPct !== null && d.pacingPct >= 100).length;
  const totalActs = doors.reduce((s, d) => s + (d.cur_acts || 0), 0);
  const totalQuota = doors.reduce((s, d) => s + (d.cur_quota || 0), 0);

  if (authLoading || !profile) {
    return <Centered>Loading your account…</Centered>;
  }

  if (!isAdmin && !profile.rep_id) {
    return (
      <Centered>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          Your account isn't linked to a rep yet. Ask your admin to assign
          you to a rep on the Assign Reps page.
        </div>
      </Centered>
    );
  }

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="display" style={{ fontSize: 13, color: "var(--teal)", marginBottom: 6 }}>
            Legacy Wireless — Field Portal
          </div>
          {isAdmin ? (
            <select
              value={selectedRepId || ""}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="display"
              style={{ fontSize: 28, border: "none", background: "transparent", padding: 0, appearance: "none" }}
            >
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="display" style={{ fontSize: 32, margin: 0 }}>
              {selectedRep?.name || "Your locations"}
            </h1>
          )}
          <div style={{ display: "flex", gap: 14, marginTop: 8, color: "var(--ink-60)", fontSize: 13.5, flexWrap: "wrap" }}>
            {selectedRep?.phone && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Phone size={13} /> {selectedRep.phone}
              </span>
            )}
            {selectedRep?.email && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Mail size={13} /> {selectedRep.email}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {isAdmin && (
            <>
              <NavLink icon={<UploadCloud size={14} />} label="Import data" onClick={() => router.push("/admin/import")} />
              <NavLink icon={<Users size={14} />} label="Assign reps" onClick={() => router.push("/admin/assign")} />
            </>
          )}
          <NavLink icon={<LogOut size={14} />} label="Sign out" onClick={() => signOut(router)} />
        </div>
      </div>

      <div className="grid-tiles" style={{ marginBottom: 8 }}>
        <StatTile label="Locations" value={doors.length} />
        <StatTile label="Activations MTD" value={fmtNum(totalActs)} />
        <StatTile label="Combined quota" value={fmtNum(totalQuota)} />
        <StatTile label="On pace" value={onPaceCount} tone="var(--teal)" />
        <StatTile label="Needs attention" value={behindCount} tone={behindCount > 0 ? "var(--rust)" : undefined} />
      </div>
      <p style={{ color: "var(--ink-40)", fontSize: 12, margin: "0 2px 20px" }}>
        {latestDate ? `Last updated ${fmtDate(latestDate)}` : "No data imported yet"}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button
          className="btn-reset"
          onClick={() => setView("list")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: view === "list" ? "var(--ink)" : "var(--surface)", color: view === "list" ? "var(--paper)" : "var(--ink-60)",
            border: `1px solid ${view === "list" ? "var(--ink)" : "var(--line)"}`,
          }}
        >
          <List size={14} /> List
        </button>
        <button
          className="btn-reset"
          onClick={() => setView("charts")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: view === "charts" ? "var(--ink)" : "var(--surface)", color: view === "charts" ? "var(--paper)" : "var(--ink-60)",
            border: `1px solid ${view === "charts" ? "var(--ink)" : "var(--line)"}`,
          }}
        >
          <BarChart3 size={14} /> Charts
        </button>
        <button
          className="btn-reset"
          onClick={() => setView("watchlist")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: view === "watchlist" ? "var(--ink)" : "var(--surface)", color: view === "watchlist" ? "var(--paper)" : "var(--ink-60)",
            border: `1px solid ${view === "watchlist" ? "var(--ink)" : "var(--line)"}`,
          }}
        >
          <AlertTriangle size={14} /> Watchlist
        </button>
      </div>

      {view === "list" && (
        <>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--ink-40)" }} />
            <input
              className="field-input"
              style={{ paddingLeft: 36 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by address, city, market, or store ID"
            />
          </div>

          <div style={{ marginTop: 8 }}>
            {dataLoading && <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>Loading locations…</div>}
            {!dataLoading && filtered.length === 0 && (
              <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>
                {doors.length === 0 ? "No locations assigned yet." : `No locations match "${query}".`}
              </div>
            )}
            {!dataLoading &&
              filtered
                .slice()
                .sort((a, b) => (a.pacingPct ?? 999) - (b.pacingPct ?? 999))
                .map((d) => <DoorRow key={d.store_id} door={d} onOpen={() => router.push(`/dashboard/${d.store_id}`)} />)}
          </div>
        </>
      )}

      {view === "charts" && !dataLoading && (
        <>
          <ChartLabel>Pacing % to quota — all locations</ChartLabel>
          <PacingChart doors={filtered} onOpen={(id) => router.push(`/dashboard/${id}`)} />
          <ChartLabel>Current Acts vs. Quota — all locations</ChartLabel>
          <ActsVsQuotaChart doors={filtered} onOpen={(id) => router.push(`/dashboard/${id}`)} />
        </>
      )}

      {view === "watchlist" && !dataLoading && (
        <WatchlistView doors={filtered} latestDate={latestDate} onOpen={(id) => router.push(`/dashboard/${id}`)} />
      )}
    </div>
  );
}

function WatchlistView({ doors, latestDate, onOpen }) {
  const flagged = doors
    .map((d) => ({ door: d, reasons: WATCHLIST_RULES.filter((r) => r.test(d)) }))
    .filter((x) => x.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length);

  return (
    <div>
      <p style={{ color: "var(--ink-60)", fontSize: 13, margin: "0 2px 16px" }}>
        {flagged.length} of {doors.length} location{doors.length === 1 ? "" : "s"} flagged, based on the {latestDate ? fmtDate(latestDate) : "latest"} upload.
      </p>
      {flagged.length === 0 && <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>Nothing flagged right now.</div>}
      {flagged.map(({ door, reasons }) => (
        <WatchlistRow key={door.store_id} door={door} reasons={reasons} onOpen={() => onOpen(door.store_id)} />
      ))}
    </div>
  );
}

function WatchlistRow({ door, reasons, onOpen }) {
  const sp = statusPill(door.status);
  return (
    <button
      className="btn-reset"
      onClick={onOpen}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 12px", borderBottom: "1px solid var(--line)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{door.address}</div>
          <div style={{ fontSize: 13, color: "var(--ink-60)", marginTop: 2, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span>{door.city}, {door.state}</span>
            <span>·</span>
            <span>{door.store_id}</span>
            <span className="pill" style={{ background: sp.bg, color: sp.color }}>{door.status}</span>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--rust)", flexShrink: 0, whiteSpace: "nowrap" }}>
          {reasons.length} flag{reasons.length > 1 ? "s" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {reasons.map((r) => (
          <span key={r.key} className="pill" style={{ background: "var(--rust-soft)", color: "var(--rust)" }}>
            {r.describe(door)}
          </span>
        ))}
      </div>
    </button>
  );
}

function ChartLabel({ children }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-60)", margin: "20px 2px 8px" }}>{children}</div>;
}

function truncateName(s, n = 30) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function PacingChart({ doors, onOpen }) {
  const data = doors
    .slice()
    .sort((a, b) => (a.pacingPct ?? 999) - (b.pacingPct ?? 999))
    .map((d) => ({ name: truncateName(d.address), storeId: d.store_id, pacing: d.pacingPct ?? 0, color: paceStatus(d.pacingPct).color }));

  if (data.length === 0) return <EmptyChart />;
  const height = Math.max(160, data.length * 26 + 40);

  return (
    <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 8px", marginBottom: 8 }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload?.[0] && onOpen(e.activePayload[0].payload.storeId)}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "#1b2521" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--line)", opacity: 0.4 }}
            formatter={(v) => [`${Number(v).toFixed(1)}%`, "Pacing"]}
            contentStyle={{ background: "#1b2521", border: "none", borderRadius: 4, fontSize: 13 }}
            labelStyle={{ color: "#ecead2" }}
            itemStyle={{ color: "#ecead2" }}
          />
          <Bar dataKey="pacing" radius={[0, 3, 3, 0]} cursor="pointer">
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActsVsQuotaChart({ doors, onOpen }) {
  const data = doors
    .slice()
    .sort((a, b) => (b.cur_acts || 0) - (a.cur_acts || 0))
    .map((d) => ({ name: truncateName(d.address), storeId: d.store_id, acts: d.cur_acts || 0, quota: d.cur_quota || 0 }));

  if (data.length === 0) return <EmptyChart />;
  const height = Math.max(160, data.length * 30 + 40);

  return (
    <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 8px", marginBottom: 28 }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload?.[0] && onOpen(e.activePayload[0].payload.storeId)}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "#1b2521" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--line)", opacity: 0.4 }}
            contentStyle={{ background: "#1b2521", border: "none", borderRadius: 4, fontSize: 13 }}
            labelStyle={{ color: "#ecead2" }}
            itemStyle={{ color: "#ecead2" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="quota" name="Quota" fill="var(--line)" radius={[0, 3, 3, 0]} cursor="pointer" />
          <Bar dataKey="acts" name="Current Acts" fill="var(--teal)" radius={[0, 3, 3, 0]} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return <div style={{ padding: "32px 4px", color: "var(--ink-60)", background: "var(--surface)", borderRadius: 3, marginBottom: 24 }}>No locations to chart yet.</div>;
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-60)", fontSize: 14, padding: 20 }}>
      {children}
    </div>
  );
}

function NavLink({ icon, label, onClick }) {
  return (
    <button className="btn-reset" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 13, whiteSpace: "nowrap" }}>
      {icon} {label}
    </button>
  );
}

function StatTile({ label, value, tone }) {
  return (
    <div className="tile">
      <div style={{ fontSize: 11.5, color: "var(--ink-60)" }}>{label}</div>
      <div className="display" style={{ fontSize: 26, marginTop: 4, color: tone || "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function DoorRow({ door, onOpen }) {
  const paceSt = paceStatus(door.pacingPct);
  const sp = statusPill(door.status);
  const actDelta = delta(door.cur_acts, door._priorSnapshotActs);
  return (
    <button
      className="btn-reset"
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", textAlign: "left", padding: "14px 12px", borderBottom: "1px solid var(--line)" }}
    >
      <div style={{ width: 6, alignSelf: "stretch", background: paceSt.color, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{door.address}</div>
        <div style={{ fontSize: 13, color: "var(--ink-60)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span>
            {door.city}, {door.state}
          </span>
          <span>·</span>
          <span>{door.store_id}</span>
          <span className="pill" style={{ background: sp.bg, color: sp.color }}>
            {door.status}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, color: "var(--ink-60)" }}>
          {fmtNum(door.cur_acts)} / {fmtNum(door.cur_quota)} quota
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: paceSt.color }}>{paceSt.label}</div>
      </div>
      <div style={{ textAlign: "right", width: 64, flexShrink: 0 }}>
        {actDelta !== null ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, fontSize: 13, color: actDelta >= 0 ? "var(--teal)" : "var(--rust)" }}>
            {actDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(actDelta).toFixed(0)}%
          </div>
        ) : (
          <span style={{ color: "var(--ink-40)", fontSize: 13 }}>—</span>
        )}
        <div style={{ fontSize: 10.5, color: "var(--ink-40)" }}>vs prior day</div>
      </div>
    </button>
  );
}
