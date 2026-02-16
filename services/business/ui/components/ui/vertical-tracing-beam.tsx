"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export function VerticalTracingBeam({
  className,
  duration = 3.6,
}: {
  className?: string;
  duration?: number;
}) {
  return (
    <div className={cn("relative h-full w-[14px]", className)} aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300/80" />
      <motion.div
        className="absolute left-1/2 top-0 h-28 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-cyan-400/0 via-cyan-500 to-violet-500/0 shadow-[0_0_18px_rgba(26,115,232,0.45)]"
        animate={{ y: ["0%", "84%", "0%"] }}
        transition={{
          duration,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-cyan-400/60 bg-cyan-300/70 shadow-[0_0_15px_rgba(34,211,238,0.6)]"
        animate={{ y: ["0%", "84%", "0%"], scale: [1, 1.15, 1] }}
        transition={{
          duration,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

