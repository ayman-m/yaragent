"use client";

import { cn } from "@/lib/utils";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import type { ReactNode } from "react";

export function DashboardPageHeader({
  title,
  subtitle,
  flipSubtitle = false,
  flipDuration = 2200,
  action,
  className,
}: {
  title: string;
  subtitle: string;
  flipSubtitle?: boolean;
  flipDuration?: number;
  action?: ReactNode;
  className?: string;
}) {
  const subtitleWords = subtitle
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

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
          {flipSubtitle ? (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
              <LayoutTextFlip
                words={subtitleWords}
                duration={flipDuration}
                wordClassName="rounded-md border border-slate-300 bg-[#14213d] px-2.5 py-1 text-white shadow-none"
              />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </>
          )}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
