"use client";

import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type DockItem = {
  title: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: DockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({ items, className }: { items: DockItem[]; className?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div layoutId="nav" className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2">
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10, transition: { delay: idx * 0.05 } }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <DockAction item={item} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-900" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({ items, className }: { items: DockItem[]; className?: string }) => {
  return (
    <motion.div className={cn("mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-gray-50 px-4 pb-3 md:flex dark:bg-neutral-900", className)}>
      {items.map((item) => (
        <IconContainer key={item.title} item={item} />
      ))}
    </motion.div>
  );
};

function DockAction({ item, className }: { item: DockItem; className?: string }) {
  if (item.href && !item.onClick) {
    return (
      <a href={item.href} className={className}>
        <div className="h-4 w-4">{item.icon}</div>
      </a>
    );
  }
  return (
    <button type="button" disabled={item.disabled} onClick={item.onClick} className={cn(className, item.disabled && "cursor-not-allowed opacity-50")}>
      <div className="h-4 w-4">{item.icon}</div>
    </button>
  );
}

function IconContainer({ item }: { item: DockItem }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: item.disabled ? 1 : 1.12 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-neutral-800",
        item.disabled && "opacity-60"
      )}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 2, x: "-50%" }}
            className="absolute -top-8 left-1/2 w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
          >
            {item.title}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className="flex h-5 w-5 items-center justify-center">
        <DockAction item={item} className="flex h-full w-full items-center justify-center rounded-full" />
      </motion.div>
    </motion.div>
  );
}
