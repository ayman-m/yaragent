"use client";

import { cn } from "@/lib/utils";
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
        "relative overflow-hidden border-b border-slate-800/90 px-4 py-5 md:px-8",
        "bg-[linear-gradient(130deg,rgba(8,22,46,.95)_0%,rgba(10,24,52,.92)_35%,rgba(14,27,58,.84)_60%,rgba(13,22,46,.86)_100%)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(circle_at_22%_-10%,rgba(59,130,246,.35),transparent_45%),radial-gradient(circle_at_80%_110%,rgba(56,189,248,.2),transparent_40%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-300/90">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
