"use client";

import { useAgents } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortField = "hostname" | "status" | "tenant" | "lastSeen" | "findings";

export default function AgentsPage() {
  const { agents, refreshAgents, loading, error } = useAgents();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "stale" | "disconnected" | "error">("all");
  const [sortField, setSortField] = useState<SortField>("lastSeen");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filteredAgents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = agents.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!needle) return true;
      const hostname = String(a.assetProfile?.asset_name || "").toLowerCase();
      const provider = String(a.assetProfile?.provider || "").toLowerCase();
      const osName = String((a.assetProfile?.os as Record<string, unknown> | undefined)?.name || "").toLowerCase();
      return (
        a.id.toLowerCase().includes(needle) ||
        hostname.includes(needle) ||
        provider.includes(needle) ||
        osName.includes(needle) ||
        (a.tenantId || "").toLowerCase().includes(needle)
      );
    });
    const sorted = [...base].sort((x, y) => {
      const xHost = String(x.assetProfile?.asset_name || x.id).toLowerCase();
      const yHost = String(y.assetProfile?.asset_name || y.id).toLowerCase();
      const xTenant = String(x.tenantId || "");
      const yTenant = String(y.tenantId || "");
      const xLast = x.lastSeen ? Date.parse(x.lastSeen) : 0;
      const yLast = y.lastSeen ? Date.parse(y.lastSeen) : 0;
      const xFind = Number(x.findingsCount || 0);
      const yFind = Number(y.findingsCount || 0);

      let cmp = 0;
      if (sortField === "hostname") cmp = xHost.localeCompare(yHost);
      if (sortField === "status") cmp = x.status.localeCompare(y.status);
      if (sortField === "tenant") cmp = xTenant.localeCompare(yTenant);
      if (sortField === "lastSeen") cmp = xLast - yLast;
      if (sortField === "findings") cmp = xFind - yFind;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [agents, search, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(field === "hostname" || field === "tenant" ? "asc" : "desc");
  };

  return (
    <>
      <DashboardPageHeader
        title="Agents"
        subtitle="Connectivity, heartbeat, and policy push controls"
        flipSubtitle
        action={
          <button
            onClick={refreshAgents}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <section className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_auto]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostname, provider, OS, tenant, or ID..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="connected">Connected</option>
            <option value="stale">Stale</option>
            <option value="disconnected">Disconnected</option>
            <option value="error">Error</option>
          </select>
          <div className="self-center text-sm text-slate-500">{filteredAgents.length} agents</div>
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            Control plane error: {error}
          </div>
        )}

        {agents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">{loading ? "Loading agents..." : "No agents registered yet"}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <HeaderCell label="Hostname" active={sortField === "hostname"} dir={sortDir} onClick={() => toggleSort("hostname")} />
                    <HeaderCell label="Status" active={sortField === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
                    <HeaderCell label="Tenant" active={sortField === "tenant"} dir={sortDir} onClick={() => toggleSort("tenant")} />
                    <th className="px-4 py-3 text-left font-semibold">Provider</th>
                    <th className="px-4 py-3 text-left font-semibold">OS</th>
                    <HeaderCell label="Findings" active={sortField === "findings"} dir={sortDir} onClick={() => toggleSort("findings")} />
                    <HeaderCell label="Last Seen" active={sortField === "lastSeen"} dir={sortDir} onClick={() => toggleSort("lastSeen")} />
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent) => {
                    const hostname = String(agent.assetProfile?.asset_name || agent.id);
                    const provider = String(agent.assetProfile?.provider || "unknown");
                    const osName = String((agent.assetProfile?.os as Record<string, unknown> | undefined)?.name || "unknown");
                    return (
                      <tr key={agent.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link href={`/agents/${encodeURIComponent(agent.id)}`} className="font-medium text-blue-700 hover:underline">
                            {hostname}
                          </Link>
                          <p className="mt-0.5 max-w-[24ch] truncate text-xs text-slate-500">{agent.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={agent.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">{agent.tenantId || "default"}</td>
                        <td className="px-4 py-3 text-slate-700">{provider}</td>
                        <td className="px-4 py-3 text-slate-700">{osName}</td>
                        <td className="px-4 py-3 text-slate-700">{agent.findingsCount || 0}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTs(agent.lastSeen)}</td>
                      </tr>
                    );
                  })}
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        No matching agents.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function HeaderCell({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 text-left font-semibold">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900">
        {label}
        {active ? <span className="text-xs">{dir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );
}

function StatusChip({ status }: { status: "connected" | "stale" | "disconnected" | "error" }) {
  const cls =
    status === "connected"
      ? "bg-green-100 text-green-700"
      : status === "stale"
      ? "bg-amber-100 text-amber-700"
      : status === "error"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{status}</span>;
}

function formatTs(value: string | null) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
