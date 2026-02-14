"use client";

import { useAgents } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useMemo } from "react";

export default function OverviewPage() {
  const { agents, error } = useAgents();

  const connectedCount = useMemo(() => agents.filter((a) => a.status === "connected").length, [agents]);
  const staleCount = useMemo(() => agents.filter((a) => a.status === "stale").length, [agents]);
  const disconnectedCount = useMemo(() => agents.filter((a) => a.status === "disconnected").length, [agents]);

  return (
    <>
      <DashboardPageHeader title="XSIAM Command Center" subtitle="Agentic telemetry and case orchestration overview" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <section className="relative overflow-hidden rounded-2xl border border-[#1a3554]/70 bg-[radial-gradient(circle_at_50%_20%,rgba(21,137,196,.20),transparent_35%),linear-gradient(180deg,rgba(4,15,35,.96)_0%,rgba(4,12,27,.99)_100%)] p-4 md:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(67,128,168,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(67,128,168,.08)_1px,transparent_1px);background-size:20px_20px]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr_1fr]">
            <FlowColumn title="Ingestion" items={["Endpoints", "NGFW", "Prisma Cloud", "Snort", "O365"]} />
            <CenterPulse />
            <FlowColumn title="Case Pipeline" items={["Automated", "Manual", "Open Cases", "Resolved"]} right />
          </div>

          <div className="relative mt-6 grid gap-3 border-t border-[#1a3554]/60 pt-4 md:grid-cols-4">
            <MetricStrip label="Events Ingestion" value={agents.length * 42} suffix="/24H" />
            <MetricStrip label="Connected Agents" value={connectedCount} />
            <MetricStrip label="Stale Agents" value={staleCount} />
            <MetricStrip label="Disconnected" value={disconnectedCount} />
          </div>
        </section>

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

function FlowColumn({
  title,
  items,
  right = false,
}: {
  title: string;
  items: string[];
  right?: boolean;
}) {
  return (
    <div className="relative">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-300/70">{title}</p>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item} className={cn("flex items-center gap-3", right ? "justify-end" : "justify-start")}>
            {!right ? <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,.8)]" /> : null}
            <span className="text-sm text-slate-200">{item}</span>
            {right ? <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.8)]" /> : null}
            <motion.div
              className="h-[2px] w-16 rounded-full bg-gradient-to-r from-cyan-400/80 to-slate-400/30"
              animate={{ opacity: [0.3, 1, 0.3], scaleX: [0.8, 1.1, 0.8] }}
              transition={{ duration: 2.5 + idx * 0.2, repeat: Infinity }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CenterPulse() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative flex h-72 w-72 items-center justify-center rounded-full border border-cyan-400/30">
        <motion.div
          className="absolute inset-0 rounded-full border border-cyan-300/20"
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="h-32 w-32 rounded-full border border-cyan-300/50"
          animate={{ rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.35),rgba(2,6,23,.9))]" />
      </div>
    </div>
  );
}

function MetricStrip({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1a3554]/70 bg-slate-950/40 px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-semibold text-slate-100">
        {value}
        {suffix ? <span className="ml-1 text-sm text-slate-400">{suffix}</span> : null}
      </p>
    </div>
  );
}
