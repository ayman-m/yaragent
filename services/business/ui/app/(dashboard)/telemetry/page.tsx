"use client";

import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function TelemetryPage() {
  const grafanaDashboardUrl =
    process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL || "/grafana/d/yaragent-telemetry-overview?orgId=1&kiosk";

  return (
    <>
      <DashboardPageHeader title="Telemetry" subtitle="Embedded Grafana dashboard for operational visibility" flipSubtitle />

      <main className="flex min-h-0 flex-1">
        <iframe title="YARAgent Grafana Dashboard" src={grafanaDashboardUrl} className="h-full w-full border-0" loading="lazy" />
      </main>
    </>
  );
}
