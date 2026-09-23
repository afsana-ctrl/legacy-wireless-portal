"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Phone, Mail, LogOut, TrendingUp, TrendingDown, UploadCloud, Users, List, BarChart3, AlertTriangle, Building2, Layers, ChevronDown, ChevronUp, ClipboardList, Map as MapIcon } from "lucide-react";
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
  const [activationsHistory, setActivationsHistory] = useState([]);
  const [view, setView] = useState("list"); // list | charts | watchlist | dealer | subagent | team
  const [teamDoors, setTeamDoors] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamLatestDate, setTeamLatestDate] = useState(null);
  const [pendingPlanCount, setPendingPlanCount] = useState(0);

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
          setActivationsHistory([]);
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

      // Full Day 1..Day N history, summed across every door. Computed per
      // store first (ascending by date) so a month rollover — where
      // Current Acts resets to 0 — is treated as a fresh count for that
      // day instead of producing a huge fake negative "activation" value.
      const fullByStore = new Map();
      for (const row of snapRows || []) {
        const arr = fullByStore.get(row.store_id) || [];
        arr.push(row);
        fullByStore.set(row.store_id, arr);
      }
      const totalsByDate = new Map();
      for (const [, rows] of fullByStore) {
        const asc = rows.slice().sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        for (let i = 0; i < asc.length; i++) {
          const cur = asc[i];
          const prev = asc[i - 1];
          let value;
          if (cur.cur_acts == null) value = null;
          else if (!prev || prev.cur_acts == null) value = cur.cur_acts;
          else if (prev.snapshot_date.slice(0, 7) !== cur.snapshot_date.slice(0, 7)) value = cur.cur_acts; // new month — reset, not a real diff
          else value = cur.cur_acts - prev.cur_acts;
          if (value !== null) {
            totalsByDate.set(cur.snapshot_date, (totalsByDate.get(cur.snapshot_date) || 0) + value);
          }
        }
      }
      const history = Array.from(totalsByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value }));

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
      setActivationsHistory(history);
      setDataLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [selectedRepId]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("action_plans")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .eq("acknowledged", false)
      .then(({ count }) => setPendingPlanCount(count || 0));
  }, [isAdmin, view]);

  const selectedRep = reps.find((r) => r.id === selectedRepId) || profile?.reps || null;

  // Admin-only: load every rep's doors at once for the Team comparison view.
  useEffect(() => {
    if (!isAdmin || view !== "team") return;
    let active = true;
    setTeamLoading(true);

    async function load() {
      const { data: doorRows, error: doorErr } = await supabase.from("doors").select("*");
      if (doorErr) console.error(doorErr);
      const storeIds = (doorRows || []).map((d) => d.store_id);
      if (storeIds.length === 0) {
        if (active) {
          setTeamDoors([]);
          setTeamLatestDate(null);
          setTeamLoading(false);
        }
        return;
      }
      const { data: snapRows, error: snapErr } = await supabase
        .from("snapshots")
        .select("*")
        .in("store_id", storeIds)
        .order("snapshot_date", { ascending: false });
      if (snapErr) console.error(snapErr);

      const byStore = new Map();
      for (const row of snapRows || []) {
        if (!byStore.has(row.store_id)) byStore.set(row.store_id, row);
      }
      const allDates = (snapRows || []).map((r) => r.snapshot_date);
      const newest = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : null;

      const merged = (doorRows || []).map((d) => withDerived({ ...d, ...(byStore.get(d.store_id) || {}) }));
      if (!active) return;
      setTeamDoors(merged);
      setTeamLatestDate(newest);
      setTeamLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [isAdmin, view]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return doors.filter((d) => {
      if (!q) return true;
      return (
        (d.address || "").toLowerCase().includes(q) ||
        (d.city || "").toLowerCase().includes(q) ||
        (d.store_id || "").toLowerCase().includes(q) ||
        (d.market || "").toLowerCase().includes(q) ||
        String(d.door_tsp || "").toLowerCase().includes(q) ||
        (d.sub_agent_name || "").toLowerCase().includes(q) ||
        (d.sub_agent_id || "").toLowerCase().includes(q)
      );
    });
  }, [doors, query]);

  const behindCount = doors.filter((d) => d.pacingPct !== null && d.pacingPct < 80).length;
  const onPaceCount = doors.filter((d) => d.pacingPct !== null && d.pacingPct >= 100).length;
  const totalActs = doors.reduce((s, d) => s + (d.cur_acts || 0), 0);
  const totalQuota = doors.reduce((s, d) => s + (d.cur_quota || 0), 0);
  const avgMr4 = avg(doors.map((d) => d.cur_4mr_pct));
  const avgMr5 = avg(doors.map((d) => d.cur_5mr_pct));
  const avgMr7 = avg(doors.map((d) => d.cur_7mr_pct));

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
      {view === "team" ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="display" style={{ fontSize: 13, color: "var(--teal)", marginBottom: 6 }}>
              Legacy Wireless — Field Portal
            </div>
            <h1 className="display" style={{ fontSize: 32, margin: 0 }}>
              Team overview
            </h1>
            <p style={{ color: "var(--ink-60)", fontSize: 13.5, marginTop: 6 }}>Every rep, compared side by side. Click one to see their full dashboard.</p>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <NavLink icon={<UploadCloud size={14} />} label="Import data" onClick={() => router.push("/admin/import")} />
            <NavLink icon={<Users size={14} />} label="Assign reps" onClick={() => router.push("/admin/assign")} />
            <NavLink icon={<ClipboardList size={14} />} label="Action Plans" badge={pendingPlanCount} onClick={() => router.push("/admin/action-plans")} />
            <NavLink icon={<LogOut size={14} />} label="Sign out" onClick={() => signOut(router)} />
          </div>
        </div>
      ) : (
        <>
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
                  <NavLink icon={<ClipboardList size={14} />} label="Action Plans" badge={pendingPlanCount} onClick={() => router.push("/admin/action-plans")} />
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
            <StatTile label="Avg 4MR%" value={fmtPct(avgMr4)} />
            <StatTile label="Avg 5MR%" value={fmtPct(avgMr5)} />
            <StatTile label="Avg 7MR%" value={fmtPct(avgMr7)} />
          </div>
          <p style={{ color: "var(--ink-40)", fontSize: 12, margin: "0 2px 20px" }}>
            {latestDate ? `Last updated ${fmtDate(latestDate)}` : "No data imported yet"}
          </p>
        </>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {isAdmin && (
          <button
            className="btn-reset"
            onClick={() => setView("team")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: view === "team" ? "var(--ink)" : "var(--surface)", color: view === "team" ? "var(--paper)" : "var(--ink-60)",
              border: `1px solid ${view === "team" ? "var(--ink)" : "var(--line)"}`,
            }}
          >
            <Users size={14} /> Team
          </button>
        )}
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
        <button
          className="btn-reset"
          onClick={() => setView("dealer")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: view === "dealer" ? "var(--ink)" : "var(--surface)", color: view === "dealer" ? "var(--paper)" : "var(--ink-60)",
            border: `1px solid ${view === "dealer" ? "var(--ink)" : "var(--line)"}`,
          }}
        >
          <Building2 size={14} /> Dealer
        </button>
        <button
          className="btn-reset"
          onClick={() => setView("subagent")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: view === "subagent" ? "var(--ink)" : "var(--surface)", color: view === "subagent" ? "var(--paper)" : "var(--ink-60)",
            border: `1px solid ${view === "subagent" ? "var(--ink)" : "var(--line)"}`,
          }}
        >
          <Layers size={14} /> Sub-Agents
        </button>
        <button
          className="btn-reset"
          onClick={() => setView("state")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: view === "state" ? "var(--ink)" : "var(--surface)", color: view === "state" ? "var(--paper)" : "var(--ink-60)",
            border: `1px solid ${view === "state" ? "var(--ink)" : "var(--line)"}`,
          }}
        >
          <MapIcon size={14} /> State
        </button>
      </div>

      {view !== "team" && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--ink-40)" }} />
          <input
            className="field-input"
            style={{ paddingLeft: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by address, city, market, store ID, Door TSP, or Sub-Agent"
          />
        </div>
      )}

      {view === "list" && (
        <>
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
          <ChartLabel>Current Acts, Day 1 through Day N (non-cumulative, all doors combined)</ChartLabel>
          <ActivationsHistoryChart history={activationsHistory} />
        </>
      )}

      {view === "watchlist" && !dataLoading && (
        <WatchlistView doors={filtered} latestDate={latestDate} onOpen={(id) => router.push(`/dashboard/${id}`)} />
      )}

      {view === "team" && (
        <TeamView
          doors={teamDoors}
          reps={reps}
          loading={teamLoading}
          latestDate={teamLatestDate}
          onSelectRep={(repId) => {
            setSelectedRepId(repId);
            setView("list");
          }}
        />
      )}

      {view === "dealer" && !dataLoading && <DealerView doors={filtered} />}

      {view === "subagent" && !dataLoading && (
        <SubAgentView doors={filtered} latestDate={latestDate} onOpen={(id) => router.push(`/dashboard/${id}`)} />
      )}

      {view === "state" && !dataLoading && <StateView doors={filtered} />}
    </div>
  );
}

function TeamView({ doors, reps, loading, latestDate, onSelectRep }) {
  if (loading) {
    return <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>Loading team data…</div>;
  }

  const repById = new Map(reps.map((r) => [r.id, r]));
  const groups = new Map();
  doors.forEach((d) => {
    const key = d.rep_id || "unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  });

  const rows = Array.from(groups.entries())
    .map(([repId, list]) => ({
      repId,
      name: repId === "unassigned" ? "Unassigned" : repById.get(repId)?.name || "Unknown rep",
      count: list.length,
      avgPacing: avg(list.map((d) => d.pacingPct)),
      totalActs: list.reduce((s, d) => s + (d.cur_acts || 0), 0),
      totalQuota: list.reduce((s, d) => s + (d.cur_quota || 0), 0),
      needsAttention: list.filter((d) => d.pacingPct !== null && d.pacingPct < 80).length,
      avgMr4: avg(list.map((d) => d.cur_4mr_pct)),
      avgMr5: avg(list.map((d) => d.cur_5mr_pct)),
      avgMr7: avg(list.map((d) => d.cur_7mr_pct)),
      avgTwp: avg(list.map((d) => d.twpProtectPct)),
      avgZulu: avg(list.map((d) => d.cur_zulu_pct)),
    }))
    .filter((r) => r.repId !== "unassigned")
    .sort((a, b) => (b.avgPacing ?? -1) - (a.avgPacing ?? -1));

  if (rows.length === 0) {
    return <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>No rep data to compare yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto", marginBottom: 28 }}>
      <p style={{ color: "var(--ink-60)", fontSize: 13, margin: "0 2px 16px" }}>
        {rows.length} rep{rows.length === 1 ? "" : "s"} · based on the {latestDate ? fmtDate(latestDate) : "latest"} upload.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
        <thead>
          <tr style={{ color: "var(--ink-60)", textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Rep</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Doors</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Pacing%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Acts / Quota</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Needs attn.</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 4MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 5MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 7MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg TWP+%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Zulu%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.repId} onClick={() => onSelectRep(r.repId)} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
              <td style={{ padding: "10px", fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: "10px" }}>{r.count}</td>
              <td style={{ padding: "10px", fontWeight: 600, color: paceStatus(r.avgPacing).color }}>{fmtPct(r.avgPacing)}</td>
              <td style={{ padding: "10px" }}>
                {fmtNum(r.totalActs)} / {fmtNum(r.totalQuota)}
              </td>
              <td style={{ padding: "10px", fontWeight: 600, color: r.needsAttention > 0 ? "var(--rust)" : "var(--ink)" }}>{r.needsAttention}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr4)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr5)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr7)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgTwp)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgZulu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StateView({ doors }) {
  const groups = new Map();
  doors.forEach((d) => {
    const name = d.state || "No state listed";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(d);
  });

  const rows = Array.from(groups.entries())
    .map(([state, list]) => ({
      state,
      count: list.length,
      avgPacing: avg(list.map((d) => d.pacingPct)),
      totalActs: list.reduce((s, d) => s + (d.cur_acts || 0), 0),
      totalQuota: list.reduce((s, d) => s + (d.cur_quota || 0), 0),
      avgFamily: avg(list.map((d) => d.curFamilyPct)),
      avgPort: avg(list.map((d) => d.curPortPct)),
      avg50: avg(list.map((d) => d.cur50Pct)),
      avgEdge: avg(list.map((d) => d.cur_edge_pct)),
      avgAutopay: avg(list.map((d) => d.cur_autopay_pct)),
      avgMr4: avg(list.map((d) => d.cur_4mr_pct)),
      avgMr5: avg(list.map((d) => d.cur_5mr_pct)),
      avgMr7: avg(list.map((d) => d.cur_7mr_pct)),
      avgTwp: avg(list.map((d) => d.twpProtectPct)),
      avgZulu: avg(list.map((d) => d.cur_zulu_pct)),
    }))
    .sort((a, b) => (b.avgPacing ?? -1) - (a.avgPacing ?? -1));

  if (rows.length === 0) {
    return <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>No state data to summarize yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto", marginBottom: 28 }}>
      <p style={{ color: "var(--ink-60)", fontSize: 13, margin: "0 2px 16px" }}>Averages across all locations in each state.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 980 }}>
        <thead>
          <tr style={{ color: "var(--ink-60)", textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>State</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Doors</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Pacing%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Acts / Quota</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Family%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Port%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg $50+%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Edge%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg AutoPay%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 4MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 5MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 7MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg TWP+%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Zulu%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.state} style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "10px", fontWeight: 600 }}>{r.state}</td>
              <td style={{ padding: "10px" }}>{r.count}</td>
              <td style={{ padding: "10px", fontWeight: 600, color: paceStatus(r.avgPacing).color }}>{fmtPct(r.avgPacing)}</td>
              <td style={{ padding: "10px" }}>
                {fmtNum(r.totalActs)} / {fmtNum(r.totalQuota)}
              </td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgFamily)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgPort)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avg50)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgEdge)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgAutopay)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr4)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr5)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr7)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgTwp)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgZulu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function dealerAddress(d) {
  return d.sub_agent_name ? `${d.sub_agent_name} — ${d.address}` : d.address || "";
}

function avg(nums) {
  const vals = nums.filter((n) => n !== null && n !== undefined && !Number.isNaN(n));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
      {flagged.length === 0 ? (
        <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>Nothing flagged right now.</div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ color: "var(--ink-60)", textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Dealer / Address</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Pacing Acts</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>4MR%</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>5MR%</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>7MR%</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Zulu%</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>TWP+%</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map(({ door, reasons }) => {
                const reasonKeys = new Set(reasons.map((r) => r.key));
                const cell = (key, value) => (
                  <td style={{ padding: "10px", fontWeight: reasonKeys.has(key) ? 700 : 400, color: reasonKeys.has(key) ? "var(--rust)" : "var(--ink)" }}>
                    {value}
                  </td>
                );
                return (
                  <tr key={door.store_id} onClick={() => onOpen(door.store_id)} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 600 }}>{dealerAddress(door)}</div>
                      <div style={{ color: "var(--ink-60)", fontSize: 12 }}>
                        {door.city}, {door.state} · {door.store_id}
                      </div>
                    </td>
                    {cell("pacing", fmtNum(door.cur_pace))}
                    {cell("mr4", fmtPct(door.cur_4mr_pct))}
                    {cell("mr5", fmtPct(door.cur_5mr_pct))}
                    {cell("mr7", fmtPct(door.cur_7mr_pct))}
                    {cell("zulu", fmtPct(door.cur_zulu_pct))}
                    {cell("twp", fmtPct(door.twpProtectPct))}
                    <td style={{ padding: "10px", fontWeight: 600, color: "var(--rust)", whiteSpace: "nowrap" }}>{reasons.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DealerView({ doors }) {
  const groups = new Map();
  doors.forEach((d) => {
    const name = d.sub_agent_name || "No dealer listed";
    if (!groups.has(name)) groups.set(name, { id: d.sub_agent_id || null, list: [] });
    groups.get(name).list.push(d);
  });

  const rows = Array.from(groups.entries())
    .map(([dealer, { id, list }]) => ({
      dealer,
      id,
      count: list.length,
      avgPacing: avg(list.map((d) => d.pacingPct)),
      totalActs: list.reduce((s, d) => s + (d.cur_acts || 0), 0),
      totalQuota: list.reduce((s, d) => s + (d.cur_quota || 0), 0),
      avgFamily: avg(list.map((d) => d.curFamilyPct)),
      avgPort: avg(list.map((d) => d.curPortPct)),
      avg50: avg(list.map((d) => d.cur50Pct)),
      avgMr4: avg(list.map((d) => d.cur_4mr_pct)),
      avgMr5: avg(list.map((d) => d.cur_5mr_pct)),
      avgMr7: avg(list.map((d) => d.cur_7mr_pct)),
      avgTwp: avg(list.map((d) => d.twpProtectPct)),
      avgZulu: avg(list.map((d) => d.cur_zulu_pct)),
    }))
    .sort((a, b) => (b.avgPacing ?? -1) - (a.avgPacing ?? -1));

  if (rows.length === 0) {
    return <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>No dealer data to summarize yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto", marginBottom: 28 }}>
      <p style={{ color: "var(--ink-60)", fontSize: 13, margin: "0 2px 16px" }}>
        Averages across all locations under each dealer (Sub-Agent Name).
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
        <thead>
          <tr style={{ color: "var(--ink-60)", textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Dealer</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Sub-Agent ID</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Doors</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Pacing%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Acts / Quota</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Family%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Port%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg $50+%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 4MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 5MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg 7MR%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg TWP+%</th>
            <th style={{ padding: "8px 10px", fontWeight: 600 }}>Avg Zulu%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dealer} style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "10px", fontWeight: 600 }}>{r.dealer}</td>
              <td style={{ padding: "10px", color: "var(--ink-60)" }}>{r.id || "—"}</td>
              <td style={{ padding: "10px" }}>{r.count}</td>
              <td style={{ padding: "10px", fontWeight: 600, color: paceStatus(r.avgPacing).color }}>{fmtPct(r.avgPacing)}</td>
              <td style={{ padding: "10px" }}>
                {fmtNum(r.totalActs)} / {fmtNum(r.totalQuota)}
              </td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgFamily)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgPort)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avg50)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr4)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr5)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgMr7)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgTwp)}</td>
              <td style={{ padding: "10px" }}>{fmtPct(r.avgZulu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    .map((d) => ({ name: truncateName(dealerAddress(d)), storeId: d.store_id, pacing: d.pacingPct ?? 0, color: paceStatus(d.pacingPct).color }));

  if (data.length === 0) return <EmptyChart />;
  const height = Math.max(160, data.length * 26 + 40);

  return (
    <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 8px", marginBottom: 8 }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload?.[0] && onOpen(e.activePayload[0].payload.storeId)}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: "#1b2521" }} axisLine={false} tickLine={false} />
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
    .map((d) => ({ name: truncateName(dealerAddress(d)), storeId: d.store_id, acts: d.cur_acts || 0, quota: d.cur_quota || 0 }));

  if (data.length === 0) return <EmptyChart />;
  const height = Math.max(160, data.length * 30 + 40);

  return (
    <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 8px", marginBottom: 28 }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload?.[0] && onOpen(e.activePayload[0].payload.storeId)}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: "#1b2521" }} axisLine={false} tickLine={false} />
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

function SubAgentView({ doors, latestDate, onOpen }) {
  const [expanded, setExpanded] = useState(new Set());

  const groups = new Map();
  doors.forEach((d) => {
    const name = d.sub_agent_name || "No sub-agent listed";
    if (!groups.has(name)) groups.set(name, { id: d.sub_agent_id || null, list: [] });
    groups.get(name).list.push(d);
  });

  const rows = Array.from(groups.entries())
    .map(([name, { id, list }]) => ({
      name,
      id,
      list,
      count: list.length,
      avgPacing: avg(list.map((d) => d.pacingPct)),
      totalActs: list.reduce((s, d) => s + (d.cur_acts || 0), 0),
      totalQuota: list.reduce((s, d) => s + (d.cur_quota || 0), 0),
      avgFamily: avg(list.map((d) => d.curFamilyPct)),
      avgPort: avg(list.map((d) => d.curPortPct)),
      avg50: avg(list.map((d) => d.cur50Pct)),
      avgMr4: avg(list.map((d) => d.cur_4mr_pct)),
      avgMr5: avg(list.map((d) => d.cur_5mr_pct)),
      avgMr7: avg(list.map((d) => d.cur_7mr_pct)),
      avgTwp: avg(list.map((d) => d.twpProtectPct)),
      avgZulu: avg(list.map((d) => d.cur_zulu_pct)),
    }))
    .sort((a, b) => (b.avgPacing ?? -1) - (a.avgPacing ?? -1));

  function toggle(name) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (rows.length === 0) {
    return <div style={{ padding: "32px 4px", color: "var(--ink-60)" }}>No sub-agent data yet.</div>;
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ color: "var(--ink-60)", fontSize: 13, margin: "0 2px 16px" }}>
        {rows.length} sub-agent{rows.length === 1 ? "" : "s"} · averages based on the {latestDate ? fmtDate(latestDate) : "latest"} upload. Click one to see its stores.
      </p>
      {rows.map((r) => {
        const isOpen = expanded.has(r.name);
        return (
          <div key={r.name} style={{ marginBottom: 8, border: "1px solid var(--line)", borderRadius: 3, overflow: "hidden" }}>
            <button
              className="btn-reset"
              onClick={() => toggle(r.name)}
              style={{ width: "100%", textAlign: "left", padding: "14px 16px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                  {r.id ? ` (${r.id})` : ""}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-60)", marginTop: 2 }}>
                  {r.count} store{r.count === 1 ? "" : "s"} · {fmtNum(r.totalActs)} / {fmtNum(r.totalQuota)} acts
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div className="display" style={{ fontSize: 20, color: paceStatus(r.avgPacing).color }}>
                    {fmtPct(r.avgPacing)}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-40)" }}>avg pacing</div>
                </div>
                {isOpen ? <ChevronUp size={16} color="var(--ink-60)" /> : <ChevronDown size={16} color="var(--ink-60)" />}
              </div>
            </button>

            {isOpen && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 1, background: "var(--line)", borderTop: "1px solid var(--line)" }}>
                  <MiniStat label="Avg Family%" value={fmtPct(r.avgFamily)} />
                  <MiniStat label="Avg Port%" value={fmtPct(r.avgPort)} />
                  <MiniStat label="Avg $50+%" value={fmtPct(r.avg50)} />
                  <MiniStat label="Avg 4MR%" value={fmtPct(r.avgMr4)} />
                  <MiniStat label="Avg 5MR%" value={fmtPct(r.avgMr5)} />
                  <MiniStat label="Avg 7MR%" value={fmtPct(r.avgMr7)} />
                  <MiniStat label="Avg TWP+%" value={fmtPct(r.avgTwp)} />
                  <MiniStat label="Avg Zulu%" value={fmtPct(r.avgZulu)} />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                    <thead>
                      <tr style={{ color: "var(--ink-60)", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>Store</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>Pacing%</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>Acts / Quota</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>Family%</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>Port%</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>4MR%</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>5MR%</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>7MR%</th>
                        <th style={{ padding: "8px 12px", fontWeight: 600 }}>TWP+%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.list
                        .slice()
                        .sort((a, b) => (a.pacingPct ?? 999) - (b.pacingPct ?? 999))
                        .map((d) => (
                          <tr key={d.store_id} onClick={() => onOpen(d.store_id)} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <div style={{ fontWeight: 600 }}>{d.address}</div>
                              <div style={{ color: "var(--ink-60)", fontSize: 11.5 }}>
                                {d.city}, {d.state} · {d.store_id}
                              </div>
                            </td>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: paceStatus(d.pacingPct).color }}>{fmtPct(d.pacingPct)}</td>
                            <td style={{ padding: "8px 12px" }}>
                              {fmtNum(d.cur_acts)} / {fmtNum(d.cur_quota)}
                            </td>
                            <td style={{ padding: "8px 12px" }}>{fmtPct(d.curFamilyPct)}</td>
                            <td style={{ padding: "8px 12px" }}>{fmtPct(d.curPortPct)}</td>
                            <td style={{ padding: "8px 12px" }}>{fmtPct(d.cur_4mr_pct)}</td>
                            <td style={{ padding: "8px 12px" }}>{fmtPct(d.cur_5mr_pct)}</td>
                            <td style={{ padding: "8px 12px" }}>{fmtPct(d.cur_7mr_pct)}</td>
                            <td style={{ padding: "8px 12px" }}>{fmtPct(d.twpProtectPct)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "var(--surface)", padding: "8px 12px" }}>
      <div style={{ fontSize: 10.5, color: "var(--ink-60)" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ActivationsHistoryChart({ history }) {
  const data = history.map((p) => ({
    date: p.date,
    label: fmtDate(p.date),
    value: p.value,
  }));

  if (data.length === 0) {
    return (
      <div style={{ padding: "32px 4px", color: "var(--ink-60)", background: "var(--surface)", borderRadius: 3, marginBottom: 24 }}>
        No history yet — this fills in as more days are imported.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface)", borderRadius: 3, padding: "16px 8px 8px", marginBottom: 28 }}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5b655f" }} axisLine={{ stroke: "#d9d6c9" }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#5b655f" }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
          <Tooltip
            formatter={(v) => [v, "Activations"]}
            contentStyle={{ background: "#1b2521", border: "none", borderRadius: 4, fontSize: 13 }}
            labelStyle={{ color: "#ecead2" }}
            itemStyle={{ color: "#ecead2" }}
          />
          <Bar dataKey="value" name="Activations" fill="var(--teal)" radius={[3, 3, 0, 0]} />
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

function NavLink({ icon, label, onClick, badge }) {
  return (
    <button className="btn-reset" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-60)", fontSize: 13, whiteSpace: "nowrap" }}>
      {icon} {label}
      {!!badge && (
        <span style={{ background: "var(--rust)", color: "white", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>
          {badge}
        </span>
      )}
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
        <div style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dealerAddress(door)}</div>
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
