"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LinesGradientShader } from "@/components/ui/lines-gradient-shader";
import { useAgents } from "@/components/agent-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, logout, checkSetupStatus, refreshAgents } = useAgents();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    checkSetupStatus()
      .then((status) => {
        if (!alive) return;
        if (!status.initialized) {
          router.replace("/");
          return;
        }
        if (!token) {
          router.replace("/");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        router.replace("/");
      });
    return () => {
      alive = false;
    };
  }, [checkSetupStatus, token, router]);

  useEffect(() => {
    if (!token) return;
    const shouldPollAgents = pathname !== "/telemetry" && pathname !== "/alerts";
    if (!shouldPollAgents) return;
    refreshAgents();
    const interval = setInterval(refreshAgents, 5000);
    return () => clearInterval(interval);
  }, [token, refreshAgents, pathname]);

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  if (!ready) {
    return <div className="flex h-screen items-center justify-center bg-white text-slate-600">Loading dashboard...</div>;
  }

  return (
    <div className="h-screen bg-white text-slate-900">
      <div className="flex h-screen">
        <DashboardSidebar onLogout={handleLogout} />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <LinesGradientShader
            className="pointer-events-none absolute inset-0"
            bandCount={12}
            bandSpacing={42}
            bandThickness={96}
            waveAmplitude={0.2}
            speed={1}
            bandOpacity={0.1}
            highlightOpacity={0.08}
          />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
