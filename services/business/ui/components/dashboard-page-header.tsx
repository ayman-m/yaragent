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
        "relative overflow-hidden border-b border-slate-200 px-4 py-5 md:px-8",
        "bg-white",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-100 [background:radial-gradient(circle_at_20%_-10%,rgba(59,130,246,.08),transparent_35%),radial-gradient(circle_at_80%_120%,rgba(15,23,42,.03),transparent_35%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
