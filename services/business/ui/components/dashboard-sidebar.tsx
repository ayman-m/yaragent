"use client";

import { cn } from "@/lib/utils";
import {
  IconActivityHeartbeat,
  IconBellRinging,
  IconBuildingStore,
  IconChartBar,
  IconClipboardData,
  IconDatabase,
  IconEyeSearch,
  IconGridDots,
  IconHelpCircle,
  IconLayoutDashboard,
  IconLayoutSidebarRightCollapse,
  IconLogout2,
  IconNotification,
  IconSettings,
  IconSatellite,
  IconShieldHalf,
  IconStar,
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
  { label: "Favorites", href: "/overview", icon: IconStar },
  { label: "Dashboards & Reports", href: "/overview", icon: IconLayoutDashboard },
  { label: "Cases & Issues", href: "/alerts", icon: IconBellRinging },
  { label: "Investigation & Response", href: "/agents", icon: IconEyeSearch },
  { label: "Threat Management", href: "/agents", icon: IconShieldHalf },
  { label: "Posture Management", href: "/overview", icon: IconClipboardData },
  { label: "Inventory", href: "/agents", icon: IconDatabase },
  { label: "Modules", href: "/telemetry", icon: IconGridDots },
];

const secondaryLinks: SidebarLinkItem[] = [
  { label: "Settings", href: "/overview", icon: IconSettings },
  { label: "Tenant Navigator", href: "/overview", icon: IconBuildingStore },
  { label: "Notifications", href: "/overview", icon: IconNotification },
  { label: "Help", href: "/overview", icon: IconHelpCircle },
];

const toolsLinks: SidebarLinkItem[] = [
  { label: "Telemetry", href: "/telemetry", icon: IconActivityHeartbeat },
  { label: "Analytics", href: "/overview", icon: IconChartBar },
  { label: "Settings", href: "#", icon: IconSettings },
];

const footerLinks: SidebarLinkItem[] = [{ label: "Sign Out", href: "#", icon: IconLogout2 }];

export function DashboardSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(true);

  const activeHref = useMemo(() => {
    const found = primaryLinks.find((x) => pathname.startsWith(x.href));
    return found?.href || "/overview";
  }, [pathname]);

  const links = primaryLinks;
  const sessionLinks = footerLinks.map((link) => ({ ...link, onClick: onLogout }));

  return (
    <>
      <aside className="hidden h-full w-[14rem] shrink-0 border-r border-neutral-800 bg-neutral-950 px-3 py-6 md:flex md:flex-col">
        <SidebarBody
          open
          activeHref={activeHref}
          links={links}
          secondaryLinks={secondaryLinks}
          toolsLinks={toolsLinks}
          sessionLinks={sessionLinks}
          onNavigate={() => undefined}
        />
      </aside>

      <button
        className="fixed bottom-4 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-black/70 text-neutral-300 backdrop-blur-sm md:hidden"
        onClick={() => setOpenMobile((prev) => !prev)}
      >
        <IconLayoutSidebarRightCollapse className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {openMobile && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[120] flex h-full w-[14rem] flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-6 md:hidden"
          >
            <SidebarBody
              open
              activeHref={activeHref}
              links={links}
              secondaryLinks={secondaryLinks}
              toolsLinks={toolsLinks}
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
  secondaryLinks,
  toolsLinks,
  sessionLinks,
  onNavigate,
}: {
  open: boolean;
  activeHref: string;
  links: SidebarLinkItem[];
  secondaryLinks: SidebarLinkItem[];
  toolsLinks: SidebarLinkItem[];
  sessionLinks: SidebarLinkItem[];
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-6 overflow-y-auto">
        <Link href="/overview" onClick={onNavigate} className="block">
          <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-all", open ? "justify-start" : "justify-center")}>
            <div className="relative h-7 w-7 rounded-full border border-emerald-400/40 bg-emerald-500/20">
              <div className="absolute left-2 top-1 h-5 w-2 rounded-r-full bg-emerald-300/90" />
            </div>
            <motion.div
              animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-semibold tracking-[0.14em] text-neutral-100">YARAGENT</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Command Center</p>
            </motion.div>
          </div>
        </Link>

        <nav className="space-y-1">
          {links.map((link) => (
            <SidebarLink key={link.href} link={link} open={open} active={activeHref === link.href} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="pt-5">
          <p className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Command Tools</p>
          <nav className="mt-2 space-y-1">
            {toolsLinks.map((link) => (
              <SidebarLink key={link.label} link={link} open={open} active={false} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>

        <div className="pt-5">
          <p className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">System</p>
          <nav className="mt-2 space-y-1">
            {secondaryLinks.map((link) => (
              <SidebarLink key={link.label} link={link} open={open} active={false} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      </div>

      <div className="space-y-2 border-t border-neutral-800/70 pt-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-2">
          <p className="text-xs font-medium text-neutral-300">Authenticated Operator</p>
          <p className="text-[11px] text-neutral-500">admin</p>
        </div>
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
        active
          ? "border border-neutral-700 bg-neutral-700/50 text-white shadow-lg shadow-black/30"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
      )}
    >
      {active && <motion.div layoutId="manuarora-sidebar-active" className="absolute inset-0 rounded-xl" />}
      <Icon className={cn("relative z-10 h-4 w-4", active ? "text-white" : "text-neutral-400")} />
      <motion.span
        animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
        className="relative z-10 overflow-hidden whitespace-nowrap text-sm font-medium"
      >
        {link.label}
      </motion.span>
    </Link>
  );
}
