"use client";

import { useAgents } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { useMemo } from "react";

export default function OverviewPage() {
  const { agents, error } = useAgents();

  const connectedCount = useMemo(() => agents.filter((a) => a.status === "connected").length, [agents]);
  const staleCount = useMemo(() => agents.filter((a) => a.status === "stale").length, [agents]);
  const disconnectedCount = useMemo(() => agents.filter((a) => a.status === "disconnected").length, [agents]);

  return (
    <>
      <DashboardPageHeader title="Overview" subtitle="Fleet status and control-plane posture" />

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

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold">Operational Notes</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-400">
            <li>Connected agents accept policy push and compile validation.</li>
            <li>Stale agents exceeded heartbeat threshold and require network/runtime checks.</li>
            <li>Disconnected agents are retained for historical visibility.</li>
          </ul>
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
      ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-300"
      : tone === "amber"
      ? "border-amber-900/60 bg-amber-950/20 text-amber-300"
      : tone === "zinc"
      ? "border-neutral-800 bg-neutral-950 text-neutral-300"
      : "border-neutral-800 bg-neutral-950 text-neutral-200";

  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
