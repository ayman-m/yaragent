"use client";

export default function AlertsPage() {
  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 md:px-8">
        <h1 className="text-2xl font-bold md:text-3xl">Alerts</h1>
        <p className="mt-1 text-sm text-slate-400">Surface error spikes and finding anomalies from telemetry</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Alerting Plan</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>Configure Grafana alert rules against Loki LogQL queries.</li>
            <li>Add notification channels (email, webhook, PagerDuty).</li>
            <li>Track latency regressions and high-severity finding spikes.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
