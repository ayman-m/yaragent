"use client";

import {
  GeminiLogo,
  GrafanaLogo,
  GraphqlLogo,
  MpcLogo,
  NextjsLogo,
} from "@/components/icons/tool-logos";
import { cn } from "@/lib/utils";
import { animate, motion } from "motion/react";
import { useEffect, useMemo } from "react";

const logoItems = [
  { key: "nextjs", node: <NextjsLogo className="h-5 w-5 opacity-95" /> },
  { key: "grafana", node: <GrafanaLogo className="h-6 w-6 opacity-95" /> },
  { key: "gemini", node: <GeminiLogo className="h-8 w-8 opacity-95" /> },
  { key: "graphql", node: <GraphqlLogo className="h-5 w-5 opacity-95" /> },
  { key: "mcp", node: <MpcLogo className="h-6 w-6 opacity-95" /> },
];

export function ToolsStackCard() {
  const sequence = useMemo(
    () =>
      logoItems.map((_, index) => [
        `.tool-pill-${index}`,
        { scale: [1, 1.1, 1], transform: ["translateY(0px)", "translateY(-4px)", "translateY(0px)"] },
        { duration: 0.8 },
      ]) as Parameters<typeof animate>[0],
    []
  );

  useEffect(() => {
    animate(sequence, {
      repeat: Infinity,
      repeatDelay: 1,
    });
  }, [sequence]);

  return <Skeleton />;
}

const Skeleton = () => {
  return (
    <div className="relative flex h-[11rem] w-full items-center justify-center overflow-hidden md:h-[12rem]">
      <div className="relative z-20 flex shrink-0 items-center justify-center gap-2">
        {logoItems.map((item, index) => (
          <Container
            key={item.key}
            className={cn(
              `tool-pill-${index}`,
              index === 0 && "h-9 w-9",
              index === 1 && "h-12 w-12",
              index === 2 && "h-16 w-16 ring-1 ring-fuchsia-200/25",
              index === 3 && "h-12 w-12",
              index === 4 && "h-9 w-9"
            )}
          >
            {item.node}
          </Container>
        ))}
      </div>

      <motion.div
        className="absolute top-8 left-1/2 z-40 h-40 w-px bg-gradient-to-b from-transparent via-cyan-400/80 to-transparent"
        animate={{ x: [-150, -40, 80, 150], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 6.2, ease: "linear", repeat: Infinity, repeatDelay: 0.4 }}
      >
        <div className="absolute -left-10 top-1/2 h-32 w-12 -translate-y-1/2">
          <Sparkles />
        </div>
      </motion.div>
    </div>
  );
};

const Sparkles = () => {
  const randomMove = () => Math.random() * 2 - 1;
  const randomOpacity = () => Math.random();
  const random = () => Math.random();
  return (
    <div className="absolute inset-0">
      {[...Array(12)].map((_, i) => (
        <motion.span
          key={`star-${i}`}
          animate={{
            top: `calc(${random() * 100}% + ${randomMove()}px)`,
            left: `calc(${random() * 100}% + ${randomMove()}px)`,
            opacity: randomOpacity(),
            scale: [1, 1.2, 0],
          }}
          transition={{
            duration: random() * 2 + 4,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            top: `${random() * 100}%`,
            left: `${random() * 100}%`,
            width: "2px",
            height: "2px",
            borderRadius: "50%",
            zIndex: 1,
          }}
          className="inline-block bg-white"
        />
      ))}
    </div>
  );
};

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(248,248,248,0.03)] shadow-[0px_0px_8px_0px_rgba(248,248,248,0.28)_inset,0px_32px_24px_-16px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {children}
    </div>
  );
}
