"use client";

import { useAgents } from "@/components/agent-context";
import { AgentsStatusDoughnut } from "@/components/charts/agents-status-doughnut";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { WobbleCard } from "@/components/ui/wobble-card";
import { useMemo } from "react";

export default function OverviewPage() {
  const { agents, error } = useAgents();

  const connectedCount = useMemo(() => agents.filter((a) => a.status === "connected").length, [agents]);
  const staleCount = useMemo(() => agents.filter((a) => a.status === "stale").length, [agents]);
  const disconnectedCount = useMemo(() => agents.filter((a) => a.status === "disconnected").length, [agents]);

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
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            Control plane error: {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <WobbleCard containerClassName="lg:col-span-2 min-h-[360px]">
            <h2 className="text-lg font-semibold text-white">Agent Status Breakdown</h2>
            <p className="mt-1 text-sm text-slate-300">Phase 1 baseline widget powered by Chart.js</p>
            <div className="mt-4">
              <AgentsStatusDoughnut connected={connectedCount} stale={staleCount} disconnected={disconnectedCount} />
            </div>
          </WobbleCard>

          <WobbleCard containerClassName="min-h-[360px] bg-[#111827]">
            <h2 className="text-lg font-semibold text-white">Phase 1 Notes</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Chart.js + react-chartjs-2 integrated.</li>
              <li>Reusable WobbleCard wrapper added.</li>
              <li>Next phases will add full widget grid.</li>
            </ul>
          </WobbleCard>
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "zinc"
      ? "border-slate-200 bg-white text-slate-700"
      : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`rounded-xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
