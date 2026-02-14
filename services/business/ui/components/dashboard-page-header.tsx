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
        "relative overflow-hidden border-b border-neutral-800/90 px-4 py-5 md:px-8",
        "bg-[linear-gradient(120deg,rgba(7,7,7,.98)_0%,rgba(12,12,12,.96)_48%,rgba(18,18,18,.96)_100%)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_-10%,rgba(255,255,255,.08),transparent_40%),radial-gradient(circle_at_80%_120%,rgba(255,255,255,.05),transparent_35%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100 md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-neutral-300/90">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
