"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { clsx } from "clsx";

type NavLink = {
  label: string;
  href: string;
  subtitle: string;
  icon: string;
};

const primaryLinks: NavLink[] = [
  { label: "Overview", href: "/overview", subtitle: "Fleet posture", icon: "OV" },
  { label: "Agents", href: "/agents", subtitle: "Connectivity and control", icon: "AG" },
  { label: "Telemetry", href: "/telemetry", subtitle: "Logs and observability", icon: "TM" },
  { label: "Alerts", href: "/alerts", subtitle: "Findings and failures", icon: "AL" },
];

export function DashboardSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeHref = useMemo(() => {
    const found = primaryLinks.find((x) => pathname.startsWith(x.href));
    return found?.href || "/overview";
  }, [pathname]);

  return (
    <>
      <aside className="hidden h-full w-[264px] flex-shrink-0 border-r border-slate-800 bg-slate-900/95 px-3 py-4 md:flex md:flex-col">
        <SidebarBody activeHref={activeHref} onLogout={onLogout} closeMobile={() => setMobileOpen(false)} />
      </aside>

      <div className="flex h-12 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 md:hidden">
        <p className="text-sm font-semibold text-slate-100">YARAgent</p>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
          onClick={() => setMobileOpen(true)}
        >
          Menu
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="fixed inset-0 z-[120] flex h-full w-full flex-col bg-slate-950 p-4 md:hidden"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">YARAgent</p>
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>
            <SidebarBody activeHref={activeHref} onLogout={onLogout} closeMobile={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarBody({
  activeHref,
  onLogout,
  closeMobile,
}: {
  activeHref: string;
  onLogout: () => void;
  closeMobile: () => void;
}) {
  return (
    <>
      <div className="mb-5 rounded-xl border border-slate-800/90 bg-slate-900 px-4 py-5 shadow-[0_0_0_1px_rgba(15,23,42,0.35)]">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">YARAgent</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">Control Center</h2>
        <p className="mt-1 text-xs text-slate-400">Control plane + telemetry operations</p>
      </div>

      <nav className="space-y-2">
        {primaryLinks.map((link) => (
          <SidebarLink key={link.href} link={link} active={activeHref === link.href} onNavigate={closeMobile} />
        ))}
      </nav>

      <div className="my-4 h-px bg-slate-800/90" />

      <div className="mt-auto rounded-xl border border-slate-800/90 bg-slate-900 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.35)]">
        <p className="text-xs uppercase tracking-widest text-slate-500">Session</p>
        <p className="mt-2 text-sm text-slate-300">Authenticated operator</p>
        <button
          onClick={() => {
            closeMobile();
            onLogout();
          }}
          className="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Sign Out
        </button>
      </div>
    </>
  );
}

function SidebarLink({
  link,
  active,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={link.href}
      className="group relative block rounded-xl border border-slate-800/90 px-3 py-2.5 transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNavigate}
    >
      {(hovered || active) && (
        <motion.div
          layoutId="sidebar-hover"
          className={clsx(
            "absolute inset-0 rounded-xl",
            active ? "bg-slate-800/95" : "bg-slate-800/60"
          )}
        />
      )}

      <div className="relative z-10 flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-200">
          {link.icon}
        </div>
        <div>
          <p
            className={clsx(
              "text-sm font-medium transition-transform duration-150 group-hover:translate-x-0.5",
              active ? "text-slate-100" : "text-slate-300"
            )}
          >
            {link.label}
          </p>
          <p className="mt-1 text-xs text-slate-400">{link.subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
