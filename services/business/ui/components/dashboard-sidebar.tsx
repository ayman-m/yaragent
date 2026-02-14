"use client";

import { cn } from "@/lib/utils";
import {
  IconActivityHeartbeat,
  IconBellRinging,
  IconLayoutDashboard,
  IconLogout2,
  IconMenu2,
  IconSatellite,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type SidebarLinkItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
};

const primaryLinks: SidebarLinkItem[] = [
  { label: "Overview", href: "/overview", icon: IconLayoutDashboard },
  { label: "Agents", href: "/agents", icon: IconSatellite },
  { label: "Telemetry", href: "/telemetry", icon: IconActivityHeartbeat },
  { label: "Alerts", href: "/alerts", icon: IconBellRinging },
];

const footerLinks: SidebarLinkItem[] = [{ label: "Sign Out", href: "#", icon: IconLogout2 }];

export function DashboardSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const [openDesktop, setOpenDesktop] = useState(false);

  const activeHref = useMemo(() => {
    const found = primaryLinks.find((x) => pathname.startsWith(x.href));
    return found?.href || "/overview";
  }, [pathname]);

  const links = primaryLinks;
  const sessionLinks = footerLinks.map((link) => ({ ...link, onClick: onLogout }));

  return (
    <>
      <motion.aside
        className="hidden h-full shrink-0 border-r border-slate-800/80 bg-[linear-gradient(180deg,#030d25_0%,#061635_52%,#050f27_100%)] px-3 py-4 md:flex md:flex-col"
        animate={{ width: openDesktop ? 256 : 84 }}
        onMouseEnter={() => setOpenDesktop(true)}
        onMouseLeave={() => setOpenDesktop(false)}
      >
        <SidebarBody
          open={openDesktop}
          activeHref={activeHref}
          links={links}
          sessionLinks={sessionLinks}
          onNavigate={() => undefined}
        />
      </motion.aside>

      <div className="flex h-12 w-full items-center justify-between border-b border-slate-800 bg-slate-950 px-4 md:hidden">
        <p className="text-sm font-semibold text-slate-100">YARAgent</p>
        <IconMenu2 className="text-slate-200" onClick={() => setOpenMobile(true)} />
      </div>

      <AnimatePresence>
        {openMobile && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[120] flex h-full w-full flex-col bg-[linear-gradient(180deg,#030d25_0%,#061635_52%,#050f27_100%)] p-4 md:hidden"
          >
            <div className="absolute right-6 top-6 z-50 text-slate-200">
              <IconX onClick={() => setOpenMobile(false)} />
            </div>
            <SidebarBody
              open
              activeHref={activeHref}
              links={links}
              sessionLinks={sessionLinks}
              onNavigate={() => setOpenMobile(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarBody({
  open,
  activeHref,
  links,
  sessionLinks,
  onNavigate,
}: {
  open: boolean;
  activeHref: string;
  links: SidebarLinkItem[];
  sessionLinks: SidebarLinkItem[];
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-6">
        <Link href="/overview" onClick={onNavigate} className="block">
          <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-all", open ? "justify-start" : "justify-center")}>
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-300" />
            <motion.div
              animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-semibold tracking-wide text-slate-100">YARAgent</p>
              <p className="text-xs text-slate-400">Control Plane</p>
            </motion.div>
          </div>
        </Link>

        <nav className="space-y-1">
          {links.map((link) => (
            <SidebarLink key={link.href} link={link} open={open} active={activeHref === link.href} onNavigate={onNavigate} />
          ))}
        </nav>
      </div>

      <div className="space-y-2 border-t border-slate-800/70 pt-4">
        {sessionLinks.map((link) => (
          <SidebarLink key={link.label} link={link} open={open} active={false} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function SidebarLink({
  link,
  open,
  active,
  onNavigate,
}: {
  link: SidebarLinkItem;
  open: boolean;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={(e) => {
        if (link.onClick) {
          e.preventDefault();
          link.onClick();
        }
        onNavigate();
      }}
      className={cn(
        "group relative flex items-center rounded-xl px-2 py-2 transition-all duration-200",
        open ? "justify-start gap-3" : "justify-center",
        active ? "bg-slate-700/70 text-white" : "text-slate-300 hover:bg-slate-800/70 hover:text-slate-100"
      )}
    >
      {active && <motion.div layoutId="esparka-sidebar-active" className="absolute inset-0 rounded-xl border border-slate-500/40" />}
      <Icon className={cn("relative z-10 h-5 w-5", active ? "text-cyan-300" : "text-slate-300")} />
      <motion.span
        animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
        className="relative z-10 overflow-hidden whitespace-nowrap text-sm font-medium"
      >
        {link.label}
      </motion.span>
    </Link>
  );
}
