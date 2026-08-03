"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export function FooterPortfolioWidget() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mainEl = document.getElementById("main-content");

    const handleCheck = () => {
      let scrollY = window.scrollY;
      let maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      if (mainEl) {
        const mainScroll = mainEl.scrollTop;
        const mainMax = mainEl.scrollHeight - mainEl.clientHeight;
        if (mainMax > 0) {
          scrollY = mainScroll;
          maxScroll = mainMax;
        }
      }

      // Reveal widget ONLY when user reaches the very end of the page (bottom footer area)
      const distanceFromBottom = maxScroll - scrollY;
      const isAtEnd = maxScroll > 0 ? (distanceFromBottom <= 220 || scrollY / maxScroll >= 0.88) : false;

      if (isAtEnd) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    handleCheck();

    if (mainEl) {
      mainEl.addEventListener("scroll", handleCheck, { passive: true });
    }
    window.addEventListener("scroll", handleCheck, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener("scroll", handleCheck);
      window.removeEventListener("scroll", handleCheck);
    };
  }, []);

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 font-mono transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-6 pointer-events-none"
      }`}
    >
      <a
        href="https://himanshuguptaa.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        title="Portfolio of Himanshu Gupta"
        aria-label="Himanshu Gupta Portfolio"
        className="group relative flex items-center h-9 rounded-full border border-indigo-400/80 dark:border-indigo-500/60 bg-indigo-600 dark:bg-indigo-950 text-white shadow-lg shadow-indigo-500/25 dark:shadow-indigo-950/80 transition-all duration-500 ease-out hover:pr-3.5 overflow-hidden backdrop-blur-md cursor-pointer"
      >
        {/* Compact Glowing Pulsing Circle Icon (36x36px) */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative bg-indigo-600 dark:bg-indigo-900 group-hover:bg-indigo-500 transition-colors">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-80"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300"></span>
          </span>
          <Sparkles className="h-3.5 w-3.5 text-white absolute animate-pulse opacity-90" />
        </div>

        {/* Sliding Animated Text Wrapper */}
        <div className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 transition-all duration-500 ease-in-out whitespace-nowrap overflow-hidden flex items-center gap-1.5 pl-0.5 pr-1">
          <span className="text-[10px] font-mono text-indigo-100 dark:text-slate-300 font-medium">
            // CRAFTED BY
          </span>
          <span className="text-[10px] font-mono font-bold text-white dark:text-cyan-300 flex items-center gap-1">
            [ HIMANSHU GUPTA ]
            <ArrowRight className="h-3 w-3 text-cyan-300 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </a>
    </div>
  );
}
