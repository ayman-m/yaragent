"use client";

import { cn } from "@/lib/utils";
import {
  IconApi,
  IconArrowLeft,
  IconBrandTabler,
  IconChecklist,
  IconMenu2,
  IconMessagePlus,
  IconRotate,
  IconSettings,
  IconUserBolt,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";

type SidebarLinkItem = {
  label: string;
  href: string;
  subtitle?: string;
  icon: React.JSX.Element | React.ReactNode;
  onClick?: () => void;
};

const primaryLinks: SidebarLinkItem[] = [
  {
    label: "Overview",
    href: "/overview",
    subtitle: "Fleet posture",
    icon: <IconBrandTabler className="h-5 w-5 flex-shrink-0 text-slate-300" />,
  },
  {
    label: "Agents",
    href: "/agents",
    subtitle: "Connectivity and control",
    icon: <IconUserBolt className="h-5 w-5 flex-shrink-0 text-slate-300" />,
  },
  {
    label: "Telemetry",
    href: "/telemetry",
    subtitle: "Logs and observability",
    icon: <IconApi className="h-5 w-5 flex-shrink-0 text-slate-300" />,
  },
  {
    label: "Alerts",
    href: "/alerts",
    subtitle: "Findings and failures",
    icon: <IconChecklist className="h-5 w-5 flex-shrink-0 text-slate-300" />,
  },
];

const secondaryLinks: SidebarLinkItem[] = [
  {
    label: "Settings",
    href: "#",
    icon: <IconSettings className="h-5 w-5 flex-shrink-0 text-slate-400" />,
  },
  {
    label: "Support",
    href: "#",
    icon: <IconMessagePlus className="h-5 w-5 flex-shrink-0 text-slate-400" />,
  },
  {
    label: "Docs",
    href: "#",
    icon: <IconRotate className="h-5 w-5 flex-shrink-0 text-slate-400" />,
  },
  {
    label: "Back",
    href: "#",
    icon: <IconArrowLeft className="h-5 w-5 flex-shrink-0 text-slate-400" />,
  },
];

export function DashboardSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeHref = useMemo(() => {
    const found = primaryLinks.find((x) => pathname.startsWith(x.href));
    return found?.href || "/overview";
  }, [pathname]);

  const sessionLink: SidebarLinkItem = {
    label: "Sign Out",
    href: "#",
    icon: (
      <img
        src="https://assets.aceternity.com/manu.png"
        className="h-7 w-7 flex-shrink-0 rounded-full"
        width={50}
        height={50}
        alt="Avatar"
      />
    ),
    onClick: onLogout,
  };

  return (
    <>
      <motion.aside
        className={cn(
          "hidden h-full w-[300px] flex-shrink-0 border-r border-slate-800 bg-slate-900 px-4 py-4 md:flex md:flex-col"
        )}
        animate={{ width: 300 }}
      >
        <SidebarBody
          activeHref={activeHref}
          primary={primaryLinks}
          secondary={secondaryLinks}
          sessionLink={sessionLink}
          closeMobile={() => setOpen(false)}
        />
      </motion.aside>

      <div className="flex h-12 w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-4 md:hidden">
        <p className="text-sm font-semibold text-slate-100">YARAgent</p>
        <IconMenu2 className="text-slate-200" onClick={() => setOpen(true)} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[120] flex h-full w-full flex-col justify-between bg-slate-950 p-4 md:hidden"
          >
            <div
              className="absolute right-6 top-6 z-50 text-slate-200"
              onClick={() => {
                setOpen(false);
              }}
            >
              <IconX />
            </div>
            <SidebarBody
              activeHref={activeHref}
              primary={primaryLinks}
              secondary={secondaryLinks}
              sessionLink={sessionLink}
              closeMobile={() => setOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarBody({
  activeHref,
  primary,
  secondary,
  sessionLink,
  closeMobile,
}: {
  activeHref: string;
  primary: SidebarLinkItem[];
  secondary: SidebarLinkItem[];
  sessionLink: SidebarLinkItem;
  closeMobile: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-8">
      <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <Logo />
        <div className="mt-8 flex flex-col gap-1">
          {primary.map((link, idx) => (
            <SidebarLink
              key={link.href}
              link={link}
              id={`primary-link-${idx}`}
              active={activeHref === link.href}
              onNavigate={closeMobile}
            />
          ))}
        </div>

        <div className="mt-4">
          <div className="h-px w-full bg-slate-800" />
          <div className="h-px w-full bg-slate-900" />
        </div>

        <div className="mt-4 flex flex-col gap-1">
          {secondary.map((link, idx) => (
            <SidebarLink
              key={`${link.label}-${idx}`}
              link={link}
              id={`secondary-link-${idx}`}
              active={false}
              onNavigate={closeMobile}
            />
          ))}
        </div>
      </div>

      <div>
        <SidebarLink link={sessionLink} id="session-link" active={false} onNavigate={closeMobile} />
      </div>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/overview" className="relative z-20 flex items-center space-x-2 px-4 py-1 text-sm font-normal text-slate-100">
      <div className="h-5 w-6 flex-shrink-0 rounded-bl-sm rounded-br-lg rounded-tl-lg rounded-tr-sm bg-white" />
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-pre text-slate-100">
        YARAgent
      </motion.span>
    </Link>
  );
}

function SidebarLink({
  link,
  className,
  id,
  active,
  onNavigate,
  ...props
}: {
  link: SidebarLinkItem;
  className?: string;
  id?: string;
  active: boolean;
  onNavigate: () => void;
} & Omit<React.ComponentProps<typeof Link>, "href" | "onClick" | "className">) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <Link
      href={link.href}
      className={cn("group/sidebar relative px-4 py-1", className)}
      onMouseEnter={() => setHovered(id ?? null)}
      onMouseLeave={() => setHovered(null)}
      onClick={(e) => {
        if (link.onClick) {
          e.preventDefault();
          link.onClick();
        }
        onNavigate();
      }}
      {...props}
    >
      {(hovered === id || active) && (
        <motion.div
          layoutId="hovered-sidebar-link"
          className={cn("absolute inset-0 z-10 rounded-lg", active ? "bg-slate-700/90" : "bg-slate-800/80")}
        />
      )}
      <div className="relative z-20 flex items-center justify-start gap-2 py-2">
        {link.icon}
        <div>
          <motion.span
            animate={{ display: "inline-block", opacity: 1 }}
            className={cn(
              "!m-0 inline-block !p-0 text-sm whitespace-pre transition duration-150 group-hover/sidebar:translate-x-1",
              active ? "text-slate-100" : "text-slate-300"
            )}
          >
            {link.label}
          </motion.span>
          {link.subtitle ? <p className="text-xs text-slate-400">{link.subtitle}</p> : null}
        </div>
      </div>
    </Link>
  );
}
