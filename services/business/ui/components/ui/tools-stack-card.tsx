"use client";

import { cn } from "@/lib/utils";
import { animate, motion } from "motion/react";
import { useEffect, useMemo } from "react";

const tools = ["Next.js", "FastAPI", "PostgreSQL", "Grafana", "Loki", "Alloy", "Keycloak", "OAuth2 Proxy", "Docker"];

export function ToolsStackCard() {
  const sequence = useMemo(
    () =>
      tools.map((_, index) => [
        `.tool-pill-${index}`,
        { y: [0, -3, 0], scale: [1, 1.04, 1] },
        { duration: 0.55, delay: 0 },
      ]) as Parameters<typeof animate>[0],
    []
  );

  useEffect(() => {
    animate(sequence, {
      repeat: Infinity,
      repeatDelay: 1.2,
    });
  }, [sequence]);

  return (
    <div className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.45)] backdrop-blur">
      <h3 className="text-base font-semibold text-slate-100">Built With</h3>
      <p className="mt-1 text-xs text-slate-400">Core technologies powering this control plane and telemetry stack.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tools.map((tool, index) => (
          <motion.span
            key={tool}
            className={cn(
              `tool-pill-${index}`,
              "inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/75 px-3 py-1 text-xs font-medium text-slate-200"
            )}
          >
            {tool}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
