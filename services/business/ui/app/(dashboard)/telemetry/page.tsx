"use client";

export default function TelemetryPage() {
  const grafanaDashboardUrl =
    process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL || "/grafana/d/yaragent-telemetry-overview?orgId=1&kiosk";

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 md:px-8">
        <h1 className="text-2xl font-bold md:text-3xl">Telemetry</h1>
        <p className="mt-1 text-sm text-slate-400">Embedded Grafana dashboard for operational visibility</p>
      </header>

      <main className="flex min-h-0 flex-1">
        <iframe title="YARAgent Grafana Dashboard" src={grafanaDashboardUrl} className="h-full w-full border-0" loading="lazy" />
      </main>
    </>
  );
}
