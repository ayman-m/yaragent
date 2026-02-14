"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface LinesGradientShaderProps {
  className?: string;
  speed?: number;
  bandCount?: number;
  bandSpacing?: number;
  bandThickness?: number;
  waveAmplitude?: number;
  colors?: [number, number, number][];
  bandOpacity?: number;
  highlightOpacity?: number;
}

export const LinesGradientShader: React.FC<LinesGradientShaderProps> = ({
  className,
  speed = 1,
  bandCount = 12,
  bandSpacing = 40,
  bandThickness = 100,
  waveAmplitude = 0.2,
  colors,
  bandOpacity = 0.14,
  highlightOpacity = 0.12,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stopped = false;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${Math.floor(width)}px`;
      canvas.style.height = `${Math.floor(height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const handleVisibilityChange = () => {
      if (!document.hidden) startTimeRef.current = 0;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interpolateColor = (
      color1: [number, number, number],
      color2: [number, number, number],
      t: number,
      alpha: number
    ): string => {
      const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
      const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
      const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const colorStops: [number, number, number][] = colors || [
      [139, 92, 246],
      [168, 85, 247],
      [217, 70, 239],
      [236, 72, 153],
      [244, 63, 94],
      [249, 115, 22],
      [251, 191, 36],
      [254, 240, 138],
    ];

    const getColorAtPosition = (t: number, alpha: number): string => {
      const clampedT = Math.max(0, Math.min(1, t));
      const scaledT = clampedT * (colorStops.length - 1);
      const index = Math.floor(scaledT);
      const fraction = scaledT - index;
      const color1 = colorStops[Math.min(index, colorStops.length - 1)];
      const color2 = colorStops[Math.min(index + 1, colorStops.length - 1)];
      return interpolateColor(color1, color2, fraction, alpha);
    };

    const draw = (timestamp: number) => {
      if (stopped) return;
      if (startTimeRef.current === 0) startTimeRef.current = timestamp;

      const elapsed = (timestamp - startTimeRef.current) * 0.001 * speed;
      const { width, height } = container.getBoundingClientRect();

      ctx.clearRect(0, 0, width, height);
      const baseAmplitude = height * waveAmplitude;

      for (let i = bandCount - 1; i >= 0; i--) {
        const progress = i / Math.max(1, bandCount - 1);
        const colorStart = getColorAtPosition(progress - 0.02, bandOpacity);
        const colorEnd = getColorAtPosition(progress + 0.08, bandOpacity);

        const gradient = ctx.createLinearGradient(width * 0.3, 0, width, height);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);

        ctx.fillStyle = gradient;
        ctx.beginPath();

        const phase1 = elapsed * 0.12 + i * 0.15;
        const phase2 = elapsed * 0.08 + i * 0.1;
        const phase3 = elapsed * 0.05 + i * 0.08;
        const bandOffset = (i - bandCount / 2) * bandSpacing;

        ctx.moveTo(-100, height + 200);

        const steps = 80;
        const bottomPoints: { x: number; y: number }[] = [];
        const topPoints: { x: number; y: number }[] = [];

        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const x = -100 + (width + 400) * t;
          const baseY = height * 1.4 - t * height * 1.2 + bandOffset;
          const wave1 = Math.sin(t * 2.5 + phase1) * baseAmplitude;
          const wave2 = Math.sin(t * 1.5 + phase2) * baseAmplitude * 0.4;
          const wave3 = Math.sin(t * 4 + phase3) * baseAmplitude * 0.15;
          const waveOffset = wave1 + wave2 + wave3;
          const thickness = bandThickness + 4 * Math.sin(t * 2 + phase1 * 0.3);

          bottomPoints.push({ x, y: baseY + waveOffset + thickness / 2 });
          topPoints.push({ x, y: baseY + waveOffset - thickness / 2 });
        }

        for (const point of bottomPoints) ctx.lineTo(point.x, point.y);
        ctx.lineTo(width + 200, -100);
        for (let j = topPoints.length - 1; j >= 0; j--) ctx.lineTo(topPoints[j].x, topPoints[j].y);
        ctx.lineTo(-100, height + 200);
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = highlightOpacity;
      for (let i = 0; i < bandCount; i++) {
        const phase1 = elapsed * 0.12 + i * 0.15;
        const phase2 = elapsed * 0.08 + i * 0.1;
        const phase3 = elapsed * 0.05 + i * 0.08;
        const bandOffset = (i - bandCount / 2) * bandSpacing;

        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let j = 0; j <= 60; j++) {
          const t = j / 60;
          const x = -100 + (width + 400) * t;
          const baseY = height * 1.4 - t * height * 1.2 + bandOffset;
          const wave1 = Math.sin(t * 2.5 + phase1) * baseAmplitude;
          const wave2 = Math.sin(t * 1.5 + phase2) * baseAmplitude * 0.4;
          const wave3 = Math.sin(t * 4 + phase3) * baseAmplitude * 0.15;
          const y = baseY + wave1 + wave2 + wave3;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      ro.disconnect();
    };
  }, [speed, bandCount, bandSpacing, bandThickness, waveAmplitude, colors, bandOpacity, highlightOpacity]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: "block" }} />
    </div>
  );
};

