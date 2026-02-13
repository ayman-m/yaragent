"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
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
  }, [checkSetupStatus, token, router, pathname]);

  useEffect(() => {
    if (!token) return;
    refreshAgents();
    const interval = setInterval(refreshAgents, 5000);
    return () => clearInterval(interval);
  }, [token, refreshAgents]);

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  if (!ready) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">Loading dashboard...</div>;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      <div className="flex h-screen">
        <DashboardSidebar onLogout={handleLogout} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
