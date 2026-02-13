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

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-3 flex items-center justify-end">
          <a
            href={grafanaDashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Open in New Tab
          </a>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          <iframe title="YARAgent Grafana Dashboard" src={grafanaDashboardUrl} className="h-[920px] w-full" loading="lazy" />
        </div>
      </main>
    </>
  );
}
