"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ColourfulText } from "@/components/ui/colourful-text";

export const LayoutTextFlip = ({
  text = "",
  words = [],
  duration = 2200,
  textClassName,
  wordClassName,
  colourfulWords = [],
}: {
  text?: string;
  words: string[];
  duration?: number;
  textClassName?: string;
  wordClassName?: string;
  colourfulWords?: string[];
}) => {
  const safeWords = useMemo(() => words.filter(Boolean), [words]);
  const colourfulSet = useMemo(
    () => new Set(colourfulWords.map((w) => w.trim().toLowerCase()).filter(Boolean)),
    [colourfulWords]
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (safeWords.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % safeWords.length);
    }, duration);
    return () => clearInterval(interval);
  }, [duration, safeWords]);

  if (safeWords.length === 0) return null;
  const currentWord = safeWords[currentIndex];
  const isColourful = colourfulSet.has(currentWord.trim().toLowerCase());

  return (
    <>
      {text ? (
        <motion.span layoutId="subtext" className={cn("text-base font-semibold tracking-tight md:text-xl", textClassName)}>
          {text}
        </motion.span>
      ) : null}

      <motion.span
        layout
        className={cn(
          "relative inline-flex min-w-[8ch] items-center justify-center overflow-hidden rounded-md border border-slate-300/80 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 shadow-sm md:text-base",
          wordClassName
        )}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={currentIndex}
            initial={{ y: -24, filter: "blur(8px)", opacity: 0 }}
            animate={{ y: 0, filter: "blur(0px)", opacity: 1 }}
            exit={{ y: 24, filter: "blur(8px)", opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-block whitespace-nowrap"
          >
            {isColourful ? <ColourfulText text={currentWord} /> : currentWord}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
};
