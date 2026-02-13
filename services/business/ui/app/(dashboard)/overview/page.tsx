"use client";

import { useAgents } from "@/components/agent-context";
import { useMemo } from "react";

export default function OverviewPage() {
  const { agents, error } = useAgents();

  const connectedCount = useMemo(() => agents.filter((a) => a.status === "connected").length, [agents]);
  const staleCount = useMemo(() => agents.filter((a) => a.status === "stale").length, [agents]);
  const disconnectedCount = useMemo(() => agents.filter((a) => a.status === "disconnected").length, [agents]);

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 md:px-8">
        <h1 className="text-2xl font-bold md:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">Fleet status and control-plane posture</p>
      </header>

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

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Operational Notes</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
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
      ? "border-green-900/70 bg-green-950/40 text-green-200"
      : tone === "amber"
      ? "border-amber-900/70 bg-amber-950/40 text-amber-200"
      : tone === "zinc"
      ? "border-slate-800 bg-slate-900 text-slate-300"
      : "border-blue-900/70 bg-blue-950/40 text-blue-200";

  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
