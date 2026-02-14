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
  const asset = (profile?.assetProfile || {}) as Record<string, unknown>;
  const os = ((asset.os as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;
  const hardware = ((asset.hardware as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;
  const network = ((asset.network as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;
  const identity = ((asset.identity as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;
  const posture = ((asset.posture as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;

  const tabs = useMemo(
    () => [
      {
        title: "Information",
        value: "information",
        content: (
          <TabCanvas title="Information">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Agent ID" value={asDisplay(profile?.agentId)} mono />
              <Info label="Hostname" value={asDisplay(asset.asset_name)} />
              <Info label="Tenant" value={asDisplay(profile?.tenantId)} />
              <Info label="Provider" value={asDisplay(asset.provider)} />
              <Info label="Cloud Region" value={asDisplay(asset.cloud_region)} />
              <Info label="Account ID" value={asDisplay(asset.account_id)} />
              <Info label="Asset Category" value={asDisplay(asset.asset_category)} />
              <Info label="Runtime" value={asDisplay(asset.runtime_kind)} />
              <Info label="OS Name" value={asDisplay(os.name)} />
              <Info label="OS Version" value={asDisplay(os.version)} />
              <Info label="Kernel" value={asDisplay(os.kernel)} />
              <Info label="Architecture" value={asDisplay(os.architecture)} />
              <Info label="CPU Cores" value={asDisplay(hardware.cpu_cores)} />
              <Info label="Memory (MB)" value={asDisplay(hardware.memory_mb)} />
              <Info label="Primary IP" value={asDisplay(network.primary_ip)} />
              <Info label="MAC Address" value={asDisplay(network.mac_address)} />
              <Info label="Domain" value={asDisplay(identity.domain)} />
              <Info label="Logged User" value={asDisplay(identity.username)} />
              <Info label="First Seen" value={formatTs(profile?.connectedAt || null)} />
              <Info label="Last Seen" value={formatTs(profile?.lastSeen || null)} />
              <Info label="Last Heartbeat" value={formatTs(profile?.lastHeartbeat || null)} />
            </div>
          </TabCanvas>
        ),
      },
      {
        title: "Software",
        value: "software",
        content: (
          <TabCanvas title="Software">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <Info label="SBOM Packages" value={asDisplay(safeSbom.length)} />
              <Info label="Package Managers" value={asDisplay(uniqueCount(safeSbom, "type"))} />
              <Info label="Top Ecosystem" value={asDisplay(topByField(safeSbom, "type"))} />
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-400/30 text-left text-slate-300">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Version</th>
                  <th className="px-2 py-2">Ecosystem</th>
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
        title: "Posture",
        value: "posture",
        content: (
          <TabCanvas title="Posture">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Findings" value={asDisplay(profile?.findingsCount)} />
              <Info label="CVEs" value={asDisplay(safeCves.length)} />
              <Info label="Compliance" value={asDisplay(posture.compliance_status)} />
              <Info label="Patch Level" value={asDisplay(posture.patch_level)} />
              <Info label="Hardening Profile" value={asDisplay(posture.hardening_profile)} />
              <Info label="Risk Score" value={asDisplay(posture.risk_score)} />
              <Info label="Identity Risk" value={asDisplay(posture.identity_risk)} />
              <Info label="Network Exposure" value={asDisplay(posture.network_exposure)} />
              <Info label="Last Scan" value={formatTs(asMaybeString(posture.last_scan_at))} />
            </div>
          </TabCanvas>
        ),
      },
      {
        title: "Detections",
        value: "detections",
        content: (
          <TabCanvas title="Detections">
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <Info label="Total CVEs" value={asDisplay(safeCves.length)} />
              <Info label="Critical" value={asDisplay(countBySeverity(safeCves, "critical"))} />
              <Info label="High" value={asDisplay(countBySeverity(safeCves, "high"))} />
              <Info label="Resolved" value={asDisplay(countByStatus(safeCves, "resolved"))} />
            </div>
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
    ],
    [profile, safeSbom, safeCves, asset, os, hardware, network, identity, posture]
  );

  return (
    <>
      <DashboardPageHeader
        title={title}
        subtitle="Agent profile and inventory details"
        flipSubtitle
        flipWords={["Information", "Software", "Posture", "Detections"]}
      />

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
              tabClassName="border border-slate-300 bg-white"
              activeTabClassName="bg-[#14213d] border-[#14213d]"
              activeTabTextClassName="text-white"
              inactiveTabTextClassName="text-black"
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
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function asDisplay(value: unknown): string {
  if (value === null || value === undefined) return "Unknown";
  const str = String(value).trim();
  return str.length > 0 ? str : "Unknown";
}

function asMaybeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const str = value.trim();
  return str.length > 0 ? str : null;
}

function uniqueCount(rows: Array<Record<string, unknown>>, key: string): string {
  if (!rows.length) return "Unknown";
  const values = new Set(rows.map((r) => asDisplay(r[key])).filter((v) => v !== "Unknown"));
  return values.size > 0 ? String(values.size) : "Unknown";
}

function topByField(rows: Array<Record<string, unknown>>, key: string): string {
  if (!rows.length) return "Unknown";
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = asDisplay(row[key]);
    if (value === "Unknown") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  if (counts.size === 0) return "Unknown";
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function countBySeverity(rows: Array<Record<string, unknown>>, severity: string): string {
  if (!rows.length) return "Unknown";
  const count = rows.filter((row) => String(row.severity || "").toLowerCase() === severity).length;
  return String(count);
}

function countByStatus(rows: Array<Record<string, unknown>>, status: string): string {
  if (!rows.length) return "Unknown";
  const count = rows.filter((row) => String(row.status || "").toLowerCase() === status).length;
  return String(count);
}
