"use client";

import { cn } from "@/lib/utils";
import { GlareCard } from "@/components/ui/glare-card";
import {
  IconActivityHeartbeat,
  IconBellRinging,
  IconBrandGithub,
  IconBook2,
  IconLayoutDashboard,
  IconLayoutSidebarRightCollapse,
  IconLogout2,
  IconSatellite,
  IconSettings,
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

const secondaryLinks: SidebarLinkItem[] = [
  { label: "Docs", href: "#", icon: IconBook2 },
  { label: "Settings", href: "#", icon: IconSettings },
  { label: "GitHub", href: "#", icon: IconBrandGithub },
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
  sessionLinks,
  onNavigate,
}: {
  open: boolean;
  activeHref: string;
  links: SidebarLinkItem[];
  secondaryLinks: SidebarLinkItem[];
  sessionLinks: SidebarLinkItem[];
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-6 overflow-y-auto">
        <Link href="/overview" onClick={onNavigate} className="block">
          <div className={cn("rounded-xl transition-all", open ? "px-1 py-1" : "px-0 py-1")}>
            <GlareCard containerClassName={cn(open ? "w-full" : "w-10 [aspect-ratio:1/1]")} className="flex items-center justify-center">
              <div className={cn("flex items-center gap-3", open ? "justify-start px-3" : "justify-center")}>
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 66 65"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                >
                  <path
                    d="M8 8.05571C8 8.05571 54.9009 18.1782 57.8687 30.062C60.8365 41.9458 9.05432 57.4696 9.05432 57.4696"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeMiterlimit="3.86874"
                    strokeLinecap="round"
                  />
                </svg>
                <motion.div animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }} className="overflow-hidden whitespace-nowrap">
                  <p className="text-sm font-semibold tracking-wide text-neutral-100">YARAgent</p>
                  <p className="text-xs text-neutral-400">Control Plane</p>
                </motion.div>
              </div>
            </GlareCard>
          </div>
        </Link>

        <nav className="space-y-1">
          {links.map((link) => (
            <SidebarLink key={link.href} link={link} open={open} active={activeHref === link.href} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="pt-6">
          <p className="px-2 text-xs font-medium tracking-wide text-neutral-500">Tools</p>
          <nav className="mt-2 space-y-1">
            {secondaryLinks.map((link) => (
              <SidebarLink key={link.label} link={link} open={open} active={false} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      </div>

      <div className="space-y-2 border-t border-neutral-800/70 pt-4">
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
          ? "border border-neutral-700 bg-neutral-900 text-white shadow-lg shadow-black/30"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
      )}
    >
      {active && <motion.div layoutId="manuarora-sidebar-active" className="absolute inset-0 rounded-xl" />}
      <Icon className={cn("relative z-10 h-5 w-5", active ? "text-white" : "text-neutral-400")} />
      <motion.span
        animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
        className="relative z-10 overflow-hidden whitespace-nowrap text-sm font-medium"
      >
        {link.label}
      </motion.span>
    </Link>
  );
}
