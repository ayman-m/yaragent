"use client";

import { AgentProfile, useAgents } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function AgentDetailPage() {
  const params = useParams();
  const { getAgentProfile, refreshAgents } = useAgents();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const safeSbom = Array.isArray(profile?.sbom) ? profile.sbom : [];
  const safeCves = Array.isArray(profile?.cves) ? profile.cves : [];
  const title = String(profile?.assetProfile?.asset_name || agentId || "Agent");

  const tabs = useMemo(
    () => [
      {
        title: "Overview",
        value: "overview",
        content: (
          <TabCanvas title="Overview">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Agent ID" value={profile?.agentId || "n/a"} mono />
              <Info label="Tenant" value={profile?.tenantId || "default"} />
              <Info label="Provider" value={String(profile?.assetProfile?.provider || "unknown")} />
              <Info label="Cloud Region" value={String(profile?.assetProfile?.cloud_region || "unknown")} />
              <Info label="Account ID" value={String(profile?.assetProfile?.account_id || "unknown")} />
              <Info label="Asset Category" value={String(profile?.assetProfile?.asset_category || "unknown")} />
              <Info label="OS" value={String((profile?.assetProfile?.os as Record<string, unknown> | undefined)?.name || "unknown")} />
              <Info label="Runtime" value={String(profile?.assetProfile?.runtime_kind || "unknown")} />
              <Info label="Findings" value={String(profile?.findingsCount || 0)} />
              <Info label="First Seen" value={formatTs(profile?.connectedAt || null)} />
              <Info label="Last Seen" value={formatTs(profile?.lastSeen || null)} />
              <Info label="Last Heartbeat" value={formatTs(profile?.lastHeartbeat || null)} />
            </div>
          </TabCanvas>
        ),
      },
      {
        title: "SBOM",
        value: "sbom",
        content: (
          <TabCanvas title="SBOM">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-400/30 text-left text-slate-300">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Version</th>
                  <th className="px-2 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {safeSbom.length > 0 ? (
                  safeSbom.map((pkg, idx) => (
                    <tr key={`${String(pkg.name || "pkg")}-${idx}`} className="border-b border-slate-500/20">
                      <td className="px-2 py-2 text-slate-100">{String(pkg.name || "unknown")}</td>
                      <td className="px-2 py-2 text-slate-200">{String(pkg.version || "unknown")}</td>
                      <td className="px-2 py-2 text-slate-300">{String(pkg.type || "unknown")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-8 text-center text-slate-300">
                      No SBOM data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TabCanvas>
        ),
      },
      {
        title: "Vulnerabilities",
        value: "cves",
        content: (
          <TabCanvas title="Vulnerabilities">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-400/30 text-left text-slate-300">
                  <th className="px-2 py-2">CVE</th>
                  <th className="px-2 py-2">Severity</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeCves.length > 0 ? (
                  safeCves.map((cve, idx) => (
                    <tr key={`${String(cve.id || "cve")}-${idx}`} className="border-b border-slate-500/20">
                      <td className="px-2 py-2 text-slate-100">{String(cve.id || "unknown")}</td>
                      <td className="px-2 py-2 text-slate-200">{String(cve.severity || "unknown")}</td>
                      <td className="px-2 py-2 text-slate-300">{String(cve.status || "unknown")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-8 text-center text-slate-300">
                      No CVE data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TabCanvas>
        ),
      },
      {
        title: "Network",
        value: "network",
        content: (
          <TabCanvas title="Network">
            <pre className="max-h-[22rem] overflow-auto rounded-xl bg-slate-950/70 p-4 text-xs text-slate-200">
              {JSON.stringify((profile?.assetProfile?.network as Record<string, unknown> | undefined) || {}, null, 2)}
            </pre>
          </TabCanvas>
        ),
      },
      {
        title: "Agent Information",
        value: "agent-info",
        content: (
          <TabCanvas title="Agent Information">
            <pre className="max-h-[22rem] overflow-auto rounded-xl bg-slate-950/70 p-4 text-xs text-slate-200">
              {JSON.stringify(profile || {}, null, 2)}
            </pre>
          </TabCanvas>
        ),
      },
    ],
    [profile, safeSbom, safeCves]
  );

  return (
    <>
      <DashboardPageHeader title={title} subtitle="Agent profile and inventory details" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-4">
          <Link href="/agents" className="text-sm text-blue-700 hover:underline">
            ← Back to agents table
          </Link>
        </div>

        {loading ? (
          <Card>
            <p className="text-slate-500">Loading agent profile...</p>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <p className="text-red-700">{error}</p>
          </Card>
        ) : null}

        {!loading && !error && profile ? (
          <div className="relative my-8 flex w-full flex-col items-start justify-start [perspective:1000px]">
            <Tabs
              tabs={tabs}
              containerClassName="gap-2 pb-2"
              tabClassName="border border-slate-300 bg-white text-slate-700"
              activeTabClassName="bg-slate-900"
              contentClassName="h-[26rem] md:h-[34rem]"
            />
          </div>
        ) : null}
      </main>
    </>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{children}</section>;
}

function TabCanvas({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white md:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(circle_at_70%_0%,rgba(59,130,246,.45),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,.25),transparent_38%)]" />
      <p className="relative mb-4 text-xl font-bold md:text-3xl">{title}</p>
      <div className="relative h-[calc(100%-3rem)] overflow-auto">{children}</div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-600/40 bg-slate-900/50 p-3">
      <dt className="text-xs uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm text-slate-100 ${mono ? "font-mono break-all" : ""}`}>{value}</dd>
    </div>
  );
}

function formatTs(value: string | null) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
