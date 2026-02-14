"use client";

import { cn } from "@/lib/utils";

export function NextjsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M7.2 7.4h2.2l5.2 7.6V7.4h2v9.2h-2.1L9.2 9v7.6h-2V7.4z" fill="#0b1220" />
    </svg>
  );
}

export function GrafanaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)} aria-hidden>
      <defs>
        <linearGradient id="g-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#g-grad)" />
      <circle cx="12" cy="12.2" r="4.3" fill="#111827" />
      <circle cx="15.8" cy="8.1" r="1.4" fill="#111827" />
    </svg>
  );
}

export function LokiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#22d3ee" />
      <path d="M8 7.5h2.2v8h5.8v2H8v-10z" fill="#06283d" />
    </svg>
  );
}

export function KeycloakLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)} aria-hidden>
      <path d="M12 2l7 3v5.2c0 5.1-3 8.6-7 11.8-4-3.2-7-6.7-7-11.8V5l7-3z" fill="#60a5fa" />
      <path d="M9.2 8.6h2.1v2.1h2.6v-2.1H16v6.8h-2.1v-2.4h-2.6v2.4H9.2V8.6z" fill="#0b1220" />
    </svg>
  );
}

export function DockerLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)} aria-hidden>
      <rect x="4" y="8" width="3" height="3" rx="0.8" fill="#60a5fa" />
      <rect x="7.6" y="8" width="3" height="3" rx="0.8" fill="#60a5fa" />
      <rect x="11.2" y="8" width="3" height="3" rx="0.8" fill="#60a5fa" />
      <rect x="14.8" y="8" width="3" height="3" rx="0.8" fill="#60a5fa" />
      <rect x="7.6" y="11.6" width="3" height="3" rx="0.8" fill="#60a5fa" />
      <rect x="11.2" y="11.6" width="3" height="3" rx="0.8" fill="#60a5fa" />
      <path d="M4.3 16h13.8c-.7 2.6-3.2 4-5.8 4H8.7c-1.8 0-3.6-1.2-4.4-4z" fill="#38bdf8" />
    </svg>
  );
}
