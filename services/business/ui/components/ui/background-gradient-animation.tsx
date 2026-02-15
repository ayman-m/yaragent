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
      <div className="absolute inset-0 bg-[linear-gradient(35deg,rgba(73,163,241,0.06),rgba(236,64,122,0.03))]" />
      <div className="pointer-events-none absolute inset-0 blur-2xl">
        <div className="animate-first absolute left-[20%] top-[20%] h-[45%] w-[45%] rounded-full bg-[radial-gradient(circle,rgba(73,163,241,0.09)_0%,rgba(73,163,241,0)_70%)]" />
        <div className="animate-second absolute left-[55%] top-[30%] h-[40%] w-[40%] rounded-full bg-[radial-gradient(circle,rgba(236,64,122,0.08)_0%,rgba(236,64,122,0)_70%)]" />
        <div className="animate-third absolute left-[35%] top-[55%] h-[40%] w-[40%] rounded-full bg-[radial-gradient(circle,rgba(102,187,106,0.07)_0%,rgba(102,187,106,0)_70%)]" />
        <div className="animate-fourth absolute left-[60%] top-[65%] h-[35%] w-[35%] rounded-full bg-[radial-gradient(circle,rgba(255,167,38,0.06)_0%,rgba(255,167,38,0)_70%)]" />
        <div className="animate-fifth absolute left-[10%] top-[70%] h-[30%] w-[30%] rounded-full bg-[radial-gradient(circle,rgba(116,123,138,0.06)_0%,rgba(116,123,138,0)_70%)]" />
      </div>
      {interactive ? <div className="pointer-events-none absolute inset-0 bg-transparent" /> : null}
    </div>
  );
}
