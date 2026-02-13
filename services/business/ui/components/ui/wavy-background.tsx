"use client";

import { clsx } from "clsx";
import React, { useEffect, useRef } from "react";

type WavyBackgroundProps = {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
};

export function WavyBackground({ children, className, containerClassName }: WavyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let time = 0;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawWave = (offset: number, amp: number, speed: number, color: string, thickness: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.beginPath();
      ctx.lineWidth = thickness;
      ctx.strokeStyle = color;

      for (let x = 0; x <= width; x += 6) {
        const y =
          height * 0.5 +
          Math.sin(x * 0.012 + time * speed + offset) * amp +
          Math.cos(x * 0.006 + time * speed * 0.6 + offset) * (amp * 0.4);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    };

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(0.45, "#0f172a");
      bg.addColorStop(1, "#111827");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      drawWave(0, 28, 1.1, "rgba(59,130,246,0.35)", 2.4);
      drawWave(1.8, 34, 0.85, "rgba(16,185,129,0.22)", 2.8);
      drawWave(3.1, 22, 1.35, "rgba(56,189,248,0.22)", 2.1);

      time += 0.016;
      raf = window.requestAnimationFrame(render);
    };

    resize();
    render();

    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={clsx("relative overflow-hidden", containerClassName)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className={clsx("relative z-10", className)}>{children}</div>
    </div>
  );
}
