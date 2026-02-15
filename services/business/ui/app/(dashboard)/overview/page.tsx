"use client";

import { useAgents } from "@/components/agent-context";
import { AgentsStatusDoughnut } from "@/components/charts/agents-status-doughnut";
import {
  ComplianceChart,
  FindingsSeverityMixChart,
  HeartbeatRecencyChart,
  OpenResolvedDetectionsChart,
  OsDistributionChart,
  PackageInventorySizeChart,
  RiskDistributionChart,
  RuntimeSplitChart,
  TopVulnerablePackagesChart,
} from "@/components/charts/overview-core-charts";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { GlareCard } from "@/components/ui/glare-card";
import { useEffect, useMemo, useState } from "react";

export default function OverviewPage() {
  const { agents, error, getAgentProfile } = useAgents();
  const [profilesByAgent, setProfilesByAgent] = useState<Record<string, { sbom: Array<Record<string, unknown>>; cves: Array<Record<string, unknown>> }>>({});

  const connectedCount = useMemo(() => agents.filter((a) => a.status === "connected").length, [agents]);
  const staleCount = useMemo(() => agents.filter((a) => a.status === "stale").length, [agents]);
  const disconnectedCount = useMemo(() => agents.filter((a) => a.status === "disconnected").length, [agents]);
  const containerCount = useMemo(
    () =>
      agents.filter((a) => String(a.runtimeKind || (a.assetProfile?.["runtime_kind"] as string) || "").toLowerCase() === "container")
        .length,
    [agents]
  );
  const hostCount = Math.max(0, agents.length - containerCount);

  const osDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      const os = (agent.assetProfile?.os || {}) as Record<string, unknown>;
      const label = String(os.name || "Unknown").trim() || "Unknown";
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(([k]) => k),
      values: sorted.map(([, v]) => v),
    };
  }, [agents]);

  const heartbeatRecency = useMemo(() => {
    const now = Date.now();
    const buckets = [
      { label: "<1m", min: 0, max: 60_000, count: 0 },
      { label: "1-5m", min: 60_000, max: 300_000, count: 0 },
      { label: "5-15m", min: 300_000, max: 900_000, count: 0 },
      { label: "15-60m", min: 900_000, max: 3_600_000, count: 0 },
      { label: ">60m", min: 3_600_000, max: Number.POSITIVE_INFINITY, count: 0 },
    ];
    for (const agent of agents) {
      const ts = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).getTime() : NaN;
      const delta = Number.isFinite(ts) ? Math.max(0, now - ts) : Number.POSITIVE_INFINITY;
      const bucket = buckets.find((b) => delta >= b.min && delta < b.max);
      if (bucket) bucket.count += 1;
    }
    return {
      labels: buckets.map((b) => b.label),
      values: buckets.map((b) => b.count),
    };
  }, [agents]);

  const riskDistribution = useMemo(() => {
    const labels = ["0-10", "11-25", "26-50", "51-75", "76+"];
    const values = [0, 0, 0, 0, 0];
    for (const agent of agents) {
      const posture = (agent.assetProfile?.posture || {}) as Record<string, unknown>;
      const score = Number(posture.risk_score ?? 0);
      if (score <= 10) values[0] += 1;
      else if (score <= 25) values[1] += 1;
      else if (score <= 50) values[2] += 1;
      else if (score <= 75) values[3] += 1;
      else values[4] += 1;
    }
    return { labels, values };
  }, [agents]);

  const compliance = useMemo(() => {
    let compliant = 0;
    let review = 0;
    let unknown = 0;
    for (const agent of agents) {
      const posture = (agent.assetProfile?.posture || {}) as Record<string, unknown>;
      const raw = String(posture.compliance_status || "").trim().toLowerCase();
      if (raw === "compliant") compliant += 1;
      else if (raw === "needs review" || raw === "non-compliant") review += 1;
      else unknown += 1;
    }
    return { compliant, review, unknown };
  }, [agents]);

  useEffect(() => {
    let cancelled = false;
    if (agents.length === 0) {
      setProfilesByAgent({});
      return;
    }

    const load = async () => {
      const results = await Promise.allSettled(
        agents.map(async (agent) => {
          const profile = await getAgentProfile(agent.id);
          return {
            id: agent.id,
            sbom: profile.sbom,
            cves: profile.cves,
          };
        })
      );
      if (cancelled) return;
      const next: Record<string, { sbom: Array<Record<string, unknown>>; cves: Array<Record<string, unknown>> }> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          next[r.value.id] = { sbom: r.value.sbom, cves: r.value.cves };
        }
      }
      setProfilesByAgent(next);
    };

    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [agents, getAgentProfile]);

  const detectionMetrics = useMemo(() => {
    const allCves = Object.values(profilesByAgent).flatMap((p) => p.cves);
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let resolved = 0;
    let open = 0;
    const pkgCounts = new Map<string, number>();

    for (const cve of allCves) {
      const severity = String(cve.severity || "").toLowerCase();
      if (severity === "critical") critical += 1;
      else if (severity === "high") high += 1;
      else if (severity === "medium") medium += 1;
      else if (severity === "low") low += 1;

      const status = String(cve.status || "").toLowerCase();
      if (status === "resolved" || status === "closed" || status === "fixed") resolved += 1;
      else open += 1;

      const pkg = String(cve.package || cve.component || cve.name || "").trim();
      if (pkg) pkgCounts.set(pkg, (pkgCounts.get(pkg) || 0) + 1);
    }

    const topPackages = [...pkgCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      critical,
      high,
      medium,
      low,
      open,
      resolved,
      topPackageLabels: topPackages.map(([k]) => k),
      topPackageValues: topPackages.map(([, v]) => v),
    };
  }, [profilesByAgent]);

  const packageInventory = useMemo(() => {
    const rows = agents.map((agent) => {
      const sbomCount = profilesByAgent[agent.id]?.sbom?.length || 0;
      const assetName = String(agent.assetProfile?.asset_name || agent.id).trim();
      return { label: assetName, value: sbomCount };
    });
    const top = rows.sort((a, b) => b.value - a.value).slice(0, 10);
    return {
      labels: top.map((r) => r.label),
      values: top.map((r) => r.value),
    };
  }, [agents, profilesByAgent]);

  return (
    <>
      <DashboardPageHeader
        title="Overview"
        subtitle="Fleet status and control-plane posture"
        flipSubtitle
        flipWords={["Fleet", "Status", "Posture", "Health"]}
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Agents" value={agents.length} tone="slate" />
          <MetricCard label="Connected" value={connectedCount} tone="green" />
          <MetricCard label="Stale" value={staleCount} tone="amber" />
          <MetricCard label="Disconnected" value={disconnectedCount} tone="zinc" />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Control plane error: {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <GlareCard containerClassName="lg:col-span-2 min-h-[360px]">
            <h2 className="text-lg font-semibold text-slate-900">Agent Status Breakdown</h2>
            <p className="mt-1 text-sm text-slate-600">Connected, stale, and disconnected fleet split</p>
            <div className="mt-4">
              <AgentsStatusDoughnut connected={connectedCount} stale={staleCount} disconnected={disconnectedCount} />
            </div>
          </GlareCard>

          <GlareCard containerClassName="min-h-[360px]">
            <h2 className="text-lg font-semibold text-slate-900">Runtime Split</h2>
            <p className="mt-1 text-sm text-slate-600">Container vs host deployment footprint</p>
            <div className="mt-4">
              <RuntimeSplitChart containerCount={containerCount} hostCount={hostCount} />
            </div>
          </GlareCard>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <GlareCard containerClassName="min-h-[380px]">
            <h2 className="text-lg font-semibold text-slate-900">OS Distribution</h2>
            <p className="mt-1 text-sm text-slate-600">Top operating systems across active agents</p>
            <div className="mt-3">
              <OsDistributionChart labels={osDistribution.labels} values={osDistribution.values} />
            </div>
          </GlareCard>

          <GlareCard containerClassName="min-h-[380px]">
            <h2 className="text-lg font-semibold text-slate-900">Heartbeat Recency</h2>
            <p className="mt-1 text-sm text-slate-600">Agent freshness by last heartbeat age</p>
            <div className="mt-3">
              <HeartbeatRecencyChart labels={heartbeatRecency.labels} values={heartbeatRecency.values} />
            </div>
          </GlareCard>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <GlareCard containerClassName="min-h-[360px]">
            <h2 className="text-lg font-semibold text-slate-900">Risk Score Distribution</h2>
            <p className="mt-1 text-sm text-slate-600">Fleet posture grouped by risk bands</p>
            <div className="mt-3">
              <RiskDistributionChart labels={riskDistribution.labels} values={riskDistribution.values} />
            </div>
          </GlareCard>

          <GlareCard containerClassName="min-h-[360px]">
            <h2 className="text-lg font-semibold text-slate-900">Compliance Posture</h2>
            <p className="mt-1 text-sm text-slate-600">Compliant vs needs review overview</p>
            <div className="mt-3">
              <ComplianceChart
                compliant={compliance.compliant}
                review={compliance.review}
                unknown={compliance.unknown}
              />
            </div>
          </GlareCard>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <GlareCard containerClassName="min-h-[360px]">
            <h2 className="text-lg font-semibold text-slate-900">Findings Severity Mix</h2>
            <p className="mt-1 text-sm text-slate-600">Critical, high, medium, and low CVE volume</p>
            <div className="mt-3">
              <FindingsSeverityMixChart
                critical={detectionMetrics.critical}
                high={detectionMetrics.high}
                medium={detectionMetrics.medium}
                low={detectionMetrics.low}
              />
            </div>
          </GlareCard>

          <GlareCard containerClassName="min-h-[360px]">
            <h2 className="text-lg font-semibold text-slate-900">Open vs Resolved Detections</h2>
            <p className="mt-1 text-sm text-slate-600">Current detection lifecycle split</p>
            <div className="mt-3">
              <OpenResolvedDetectionsChart open={detectionMetrics.open} resolved={detectionMetrics.resolved} />
            </div>
          </GlareCard>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <GlareCard containerClassName="min-h-[400px]">
            <h2 className="text-lg font-semibold text-slate-900">Vulnerable Packages Top 10</h2>
            <p className="mt-1 text-sm text-slate-600">Packages with highest CVE count</p>
            <div className="mt-3">
              <TopVulnerablePackagesChart
                labels={detectionMetrics.topPackageLabels}
                values={detectionMetrics.topPackageValues}
              />
            </div>
          </GlareCard>

          <GlareCard containerClassName="min-h-[400px]">
            <h2 className="text-lg font-semibold text-slate-900">Package Inventory Size</h2>
            <p className="mt-1 text-sm text-slate-600">Installed package volume per agent</p>
            <div className="mt-3">
              <PackageInventorySizeChart labels={packageInventory.labels} values={packageInventory.values} />
            </div>
          </GlareCard>
        </section>
      </main>
    </>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "zinc" | "slate";
}) {
  const toneClass =
    tone === "green"
      ? "border-[color:var(--gradient-success-start)]/40 bg-white text-[color:var(--gradient-success-end)]"
      : tone === "amber"
      ? "border-[color:var(--gradient-warning-start)]/40 bg-white text-[color:var(--gradient-warning-end)]"
      : tone === "zinc"
      ? "border-[color:var(--neutral-300)] bg-white text-[color:var(--neutral-700)]"
      : "border-[color:var(--gradient-info-start)]/30 bg-white text-[color:var(--color-dark)]";

  return (
    <div className={`rounded-xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-widest text-[color:var(--neutral-600)]">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
