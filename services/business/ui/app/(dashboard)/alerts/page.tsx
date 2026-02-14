"use client";

import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function AlertsPage() {
  return (
    <>
      <DashboardPageHeader title="Alerts" subtitle="Surface error spikes and finding anomalies from telemetry" flipSubtitle />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Alerting Plan</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Configure Grafana alert rules against Loki LogQL queries.</li>
            <li>Add notification channels (email, webhook, PagerDuty).</li>
            <li>Track latency regressions and high-severity finding spikes.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
