"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

function SvgIcon({
  src,
  alt,
  className,
  size = 20,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

export function NextjsLogo({ className }: { className?: string }) {
  return <SvgIcon src="/icons/nextjs.svg" alt="Next.js" size={20} className={className} />;
}

export function GrafanaLogo({ className }: { className?: string }) {
  return <SvgIcon src="/icons/grafana.svg" alt="Grafana" size={22} className={className} />;
}

export function GeminiLogo({ className }: { className?: string }) {
  return <SvgIcon src="/icons/gemini.svg" alt="Gemini" size={20} className={className} />;
}

export function GraphqlLogo({ className }: { className?: string }) {
  return <SvgIcon src="/icons/graphql.svg" alt="GraphQL" size={20} className={className} />;
}

export function MpcLogo({ className }: { className?: string }) {
  return <SvgIcon src="/icons/mcp.svg" alt="Model Context Protocol" size={22} className={className} />;
}

