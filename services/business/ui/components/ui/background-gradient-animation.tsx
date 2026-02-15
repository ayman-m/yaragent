"use client";

import { cn } from "@/lib/utils";

export function BackgroundGradientAnimation({
  className,
  interactive = false,
}: {
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[linear-gradient(35deg,rgba(59,130,246,0.03),rgba(14,165,233,0.01))]" />
      <div className="pointer-events-none absolute inset-0 blur-2xl">
        <div className="animate-first absolute left-[20%] top-[20%] h-[45%] w-[45%] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,rgba(59,130,246,0)_70%)]" />
        <div className="animate-second absolute left-[55%] top-[30%] h-[40%] w-[40%] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.06)_0%,rgba(236,72,153,0)_70%)]" />
        <div className="animate-third absolute left-[35%] top-[55%] h-[40%] w-[40%] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.06)_0%,rgba(14,165,233,0)_70%)]" />
        <div className="animate-fourth absolute left-[60%] top-[65%] h-[35%] w-[35%] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.05)_0%,rgba(139,92,246,0)_70%)]" />
        <div className="animate-fifth absolute left-[10%] top-[70%] h-[30%] w-[30%] rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.05)_0%,rgba(234,179,8,0)_70%)]" />
      </div>
      {interactive ? <div className="pointer-events-none absolute inset-0 bg-transparent" /> : null}
    </div>
  );
}
