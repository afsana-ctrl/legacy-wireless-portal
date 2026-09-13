"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Phone, Mail, LogOut, TrendingUp, TrendingDown, UploadCloud, Users } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useProfile, signOut } from "../../lib/useProfile";
import { fmtNum, fmtDate, delta, paceStatus, statusPill, withDerived } from "../../lib/format";

export default function DashboardPage() {
  const router = useRouter();
  const { loading: authLoading, profile } = useProfile();

  const [reps, setReps] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [doors, setDoors] = useState([]);
  const [latestDate, setLatestDate] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [query, setQuery] = useState("");

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
    </div>
  );
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
