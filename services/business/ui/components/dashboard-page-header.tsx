"use client";

import { cn } from "@/lib/utils";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import type { ReactNode } from "react";

export function DashboardPageHeader({
  title,
  subtitle,
  flipSubtitle = false,
  flipDuration = 2200,
  flipWords,
  action,
  className,
}: {
  title: string;
  subtitle: string;
  flipSubtitle?: boolean;
  flipDuration?: number;
  flipWords?: string[];
  action?: ReactNode;
  className?: string;
}) {
  const subtitleWords = (flipWords && flipWords.length > 0
    ? flipWords
    : subtitle
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)).map((w) => (w.length > 0 ? `${w.charAt(0).toUpperCase()}${w.slice(1)}` : w));

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
          {!flipSubtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {flipSubtitle ? (
            <LayoutTextFlip
              words={subtitleWords}
              duration={flipDuration}
              wordClassName="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[#14213d] shadow-sm"
            />
          ) : null}
          {action ? <div>{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
