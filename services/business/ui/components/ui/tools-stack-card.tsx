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
  { key: "graphql", node: <GraphqlLogo className="h-5 w-5 opacity-95" /> },
  { key: "gemini", node: <GeminiLogo className="h-5 w-5 opacity-95" /> },
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

  return (
    <Card className="mx-0 max-w-none border-slate-600/30 bg-slate-900/65">
      <CardSkeletonContainer className="h-[11rem] md:h-[13rem]">
        <Skeleton />
      </CardSkeletonContainer>
      <CardTitle>Built with modern infrastructure</CardTitle>
      <CardDescription>
        Next.js UI with Grafana telemetry, GraphQL APIs, Gemini-assisted flows, and MCP-compatible integrations.
      </CardDescription>
    </Card>
  );
}

const Skeleton = () => {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden p-8">
      <div className="relative z-20 flex shrink-0 items-center justify-center gap-2">
        {logoItems.map((item, index) => (
          <Container
            key={item.key}
            className={cn(
              `tool-pill-${index}`,
              index % 2 === 0 ? "h-8 w-8" : "h-12 w-12",
              index === 1 && "h-16 w-16 ring-1 ring-white/20",
              index === 2 && "h-14 w-14 ring-1 ring-fuchsia-200/20"
            )}
          >
            {item.node}
          </Container>
        ))}
      </div>

      <motion.div
        className="absolute top-8 left-1/2 z-40 h-40 w-px bg-gradient-to-b from-transparent via-cyan-400/80 to-transparent"
        animate={{ x: [-130, 130, -130] }}
        transition={{ duration: 4.2, ease: "easeInOut", repeat: Infinity }}
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

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "group w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(15,23,42,0.72)] p-6 shadow-[2px_4px_24px_0px_rgba(2,6,23,0.35)_inset]",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("py-2 text-lg font-semibold text-white", className)}>{children}</h3>;
}

function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("max-w-xl text-sm font-normal text-slate-300", className)}>{children}</p>;
}

function CardSkeletonContainer({
  className,
  children,
  showGradient = true,
}: {
  className?: string;
  children: React.ReactNode;
  showGradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "z-40 rounded-xl",
        className,
        showGradient &&
          "bg-slate-700/35 [mask-image:radial-gradient(50%_50%_at_50%_50%,white_0%,transparent_100%)]"
      )}
    >
      {children}
    </div>
  );
}

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
