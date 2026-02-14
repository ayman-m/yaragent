"use client";

import { AgentProfile, useAgents } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TabKey = "overview" | "sbom" | "cves";

export default function AgentDetailPage() {
  const params = useParams();
  const { getAgentProfile, refreshAgents } = useAgents();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");

  const agentId = useMemo(() => {
    const raw = params?.agentId;
    if (Array.isArray(raw)) return decodeURIComponent(String(raw[0] || ""));
    return decodeURIComponent(String(raw || ""));
  }, [params?.agentId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refreshAgents().catch(() => undefined);
    getAgentProfile(agentId)
      .then((data) => {
        if (!alive) return;
        setProfile(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [agentId, getAgentProfile, refreshAgents]);

  const title = String(profile?.assetProfile?.asset_name || agentId || "Agent");
  const safeSbom = Array.isArray(profile?.sbom) ? profile.sbom : [];
  const safeCves = Array.isArray(profile?.cves) ? profile.cves : [];

  return (
    <>
      <DashboardPageHeader title={title} subtitle="Agent profile and inventory details" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-4">
          <Link href="/agents" className="text-sm text-blue-700 hover:underline">
            ← Back to agents table
          </Link>
        </div>

        {loading ? <Card><p className="text-slate-500">Loading agent profile...</p></Card> : null}
        {error ? <Card><p className="text-red-700">{error}</p></Card> : null}

        {!loading && !error && profile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TabButton tab="overview" active={tab === "overview"} onClick={() => setTab("overview")} />
              <TabButton tab="sbom" active={tab === "sbom"} onClick={() => setTab("sbom")} />
              <TabButton tab="cves" active={tab === "cves"} onClick={() => setTab("cves")} />
            </div>

            {tab === "overview" ? (
              <Card>
                <h2 className="mb-4 text-lg font-semibold">Overview</h2>
                <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Agent ID" value={profile.agentId} mono />
                  <Info label="Tenant" value={profile.tenantId} />
                  <Info label="Provider" value={String(profile.assetProfile?.provider || "unknown")} />
                  <Info label="Cloud Region" value={String(profile.assetProfile?.cloud_region || "unknown")} />
                  <Info label="Account ID" value={String(profile.assetProfile?.account_id || "unknown")} />
                  <Info label="Asset Category" value={String(profile.assetProfile?.asset_category || "unknown")} />
                  <Info label="OS" value={String((profile.assetProfile?.os as Record<string, unknown> | undefined)?.name || "unknown")} />
                  <Info label="Runtime" value={String(profile.assetProfile?.runtime_kind || "unknown")} />
                  <Info label="Findings" value={String(profile.findingsCount)} />
                  <Info label="First Seen" value={formatTs(profile.connectedAt)} />
                  <Info label="Last Seen" value={formatTs(profile.lastSeen)} />
                  <Info label="Last Heartbeat" value={formatTs(profile.lastHeartbeat)} />
                </dl>
              </Card>
            ) : null}

            {tab === "sbom" ? (
              <Card>
                <h2 className="mb-4 text-lg font-semibold">SBOM</h2>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Version</th>
                      <th className="px-2 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeSbom.length > 0 ? (
                      safeSbom.map((pkg, idx) => (
                        <tr key={`${String(pkg.name || "pkg")}-${idx}`} className="border-b border-slate-100">
                          <td className="px-2 py-2">{String(pkg.name || "unknown")}</td>
                          <td className="px-2 py-2">{String(pkg.version || "unknown")}</td>
                          <td className="px-2 py-2">{String(pkg.type || "unknown")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-2 py-8 text-center text-slate-500">
                          No SBOM data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            ) : null}

            {tab === "cves" ? (
              <Card>
                <h2 className="mb-4 text-lg font-semibold">CVEs</h2>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-2 py-2">CVE</th>
                      <th className="px-2 py-2">Severity</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeCves.length > 0 ? (
                      safeCves.map((cve, idx) => (
                        <tr key={`${String(cve.id || "cve")}-${idx}`} className="border-b border-slate-100">
                          <td className="px-2 py-2">{String(cve.id || "unknown")}</td>
                          <td className="px-2 py-2">{String(cve.severity || "unknown")}</td>
                          <td className="px-2 py-2">{String(cve.status || "unknown")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-2 py-8 text-center text-slate-500">
                          No CVE data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            ) : null}
          </div>
        ) : null}
      </main>
    </>
  );
}

function TabButton({ tab, active, onClick }: { tab: TabKey; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {tab.toUpperCase()}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{children}</section>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm text-slate-800 ${mono ? "font-mono break-all" : ""}`}>{value}</dd>
    </div>
  );
}

function formatTs(value: string | null) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
