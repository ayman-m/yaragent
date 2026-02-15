"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

export const WobbleCard = ({
  children,
  containerClassName,
  className,
  showGradient = true,
}: {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
  showGradient?: boolean;
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY } = event;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (clientX - (rect.left + rect.width / 2)) / 20;
    const y = (clientY - (rect.top + rect.height / 2)) / 20;
    setMousePosition({ x, y });
  };

  return (
    <motion.section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setMousePosition({ x: 0, y: 0 });
      }}
      style={{
        transform: isHovering
          ? `translate3d(${mousePosition.x}px, ${mousePosition.y}px, 0) scale3d(1, 1, 1)`
          : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
        transition: "transform 0.1s ease-out",
      }}
      className={cn("relative mx-auto w-full overflow-hidden rounded-2xl bg-transparent", containerClassName)}
    >
      <div
        className="relative h-full overflow-hidden border border-slate-200 bg-white [background-image:radial-gradient(88%_100%_at_top,rgba(59,130,246,0.08),rgba(255,255,255,0))]"
        style={{
          boxShadow:
            "0 10px 30px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04), 0 0 0 1px rgba(148,163,184,0.10)",
        }}
      >
        {showGradient ? <BackgroundGradientAnimation className="opacity-70" /> : null}
        <motion.div
          style={{
            transform: isHovering
              ? `translate3d(${-mousePosition.x}px, ${-mousePosition.y}px, 0) scale3d(1.02, 1.02, 1)`
              : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
            transition: "transform 0.1s ease-out",
          }}
          className={cn("relative z-10 h-full px-4 py-5 sm:px-6", className)}
        >
          <Noise />
          {children}
        </motion.div>
      </div>
    </motion.section>
  );
};

const Noise = () => {
  return (
    <div
      className="absolute inset-0 h-full w-full scale-[1.2] opacity-[0.035] [mask-image:radial-gradient(#fff,transparent,75%)]"
      style={{
        backgroundImage: "radial-gradient(rgba(15,23,42,0.35) 0.6px, transparent 0.6px)",
        backgroundSize: "4px 4px",
      }}
    />
  );
};
