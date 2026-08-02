"use client";

import React, { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  /** Animation delay in ms, for staggered cascades. */
  delay?: number;
  className?: string;
}

/**
 * Scroll-triggered reveal. Fades content up into view when it enters the
 * viewport, using the same fadeInUp animation language as the hero entrance.
 * Respects prefers-reduced-motion by showing content instantly instead.
 */
export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduceMotion(reduced);

    const el = ref.current;
    if (!el) return;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visibleClass = reduceMotion ? "opacity-100" : "animate-fadeInUp";

  return (
    <div
      ref={ref}
      className={`${className} ${visible ? visibleClass : "opacity-0"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
