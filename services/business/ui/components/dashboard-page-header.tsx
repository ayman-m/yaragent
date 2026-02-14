"use client";

import { cn } from "@/lib/utils";
import { IconChevronRight, IconClockHour4, IconDotsVertical } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function DashboardPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative overflow-hidden border-b border-[#1a3554]/70 px-4 py-4 md:px-8",
        "bg-[linear-gradient(120deg,rgba(4,11,24,.96)_0%,rgba(6,16,34,.96)_48%,rgba(5,12,24,.96)_100%)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_-20%,rgba(15,185,220,.13),transparent_36%),radial-gradient(circle_at_90%_120%,rgba(13,111,203,.11),transparent_40%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Dashboards & Reports</span>
            <IconChevronRight className="h-3 w-3" />
            <span>Dashboard</span>
          </div>
          <h1 className="mt-2 text-2xl font-medium tracking-tight text-slate-100 md:text-[2rem]">{title}</h1>
          <p className="mt-1 text-sm text-slate-300/90">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
            <IconClockHour4 className="h-4 w-4 text-cyan-300/80" />
            Last 24H
          </button>
          <button className="rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-300">
            <IconDotsVertical className="h-4 w-4" />
          </button>
          {action ? <div>{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
