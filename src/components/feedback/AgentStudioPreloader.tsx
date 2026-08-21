"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";

export interface AgentStudioPreloaderProps {
  /**
   * Controlled loading state. When false, triggers smooth exit transition.
   * If undefined, preloader automatically simulates a full boot sequence.
   */
  isLoading?: boolean;
  /**
   * Callback fired after smooth exit transition finishes.
   */
  onComplete?: () => void;
  /**
   * Duration in ms for the simulated boot sequence (default: 3400ms).
   */
  duration?: number;
  /**
   * Custom sequence of telemetry stage messages.
   * Defaults to:
   * [01/04] BOOTING AGENT RUNTIME...
   * [02/04] COMPILING GRAPH NODES...
   * [03/04] CONNECTING MCP TOOL SERVERS...
   * [04/04] AGENT STUDIO READY.
   */
  customSteps?: string[];
  /**
   * Title text rendered in retro pixel header.
   */
  title?: string;
  /**
   * Subtitle / system version tag.
   */
  subtitle?: string;
  /**
   * If true (default), covers the entire viewport with high z-index and backdrop blur.
   * If false, renders relative to parent container.
   */
  fullscreen?: boolean;
  /**
   * Allow user to click or press ESC / Space to skip preloader immediately.
   */
  allowSkip?: boolean;
  /**
   * Show advanced hex telemetry & latency metrics matrix.
   */
  showTelemetry?: boolean;
  /**
   * Additional CSS class names.
   */
  className?: string;
}

const DEFAULT_STEPS = [
  "[01/04] BOOTING AGENT RUNTIME...",
  "[02/04] COMPILING GRAPH NODES...",
  "[03/04] CONNECTING MCP TOOL SERVERS...",
  "[04/04] AGENT STUDIO READY.",
];

const GLYPH_CHARS = "0101XYZ_#@$%=*[]<>/+~█▓▒░";

export function AgentStudioPreloader({
  isLoading,
  onComplete,
  duration = 3400,
  customSteps = DEFAULT_STEPS,
  title = "AGENT STUDIO",
  subtitle = "KERNEL v1.0 // MULTI-AGENT RUNTIME",
  fullscreen = true,
  allowSkip = true,
  showTelemetry = true,
  className = "",
}: AgentStudioPreloaderProps) {
  const steps = useMemo(() => (customSteps.length > 0 ? customSteps : DEFAULT_STEPS), [customSteps]);

  const [progress, setProgress] = useState<number>(0);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [displayedText, setDisplayedText] = useState<string>(steps[0] || "");
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(true);
  const [hexOffset, setHexOffset] = useState<string>("0x7FFE_4A01");
  const [activePackets, setActivePackets] = useState<number>(142);
  const [systemLatency, setSystemLatency] = useState<string>("0.42ms");
  const [currentTime, setCurrentTime] = useState<string>("22:35:00 UTC");

  const currentStepMessage = steps[currentStepIdx] || steps[steps.length - 1];

  // Realtime clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toTimeString().split(" ")[0] + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle exit trigger
  const handleExit = useCallback(() => {
    setIsExiting(true);
    const timeout = setTimeout(() => {
      setIsMounted(false);
      onComplete?.();
    }, 650);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  // Handle skip action
  const handleSkip = useCallback(() => {
    if (!allowSkip || isExiting) return;
    setProgress(100);
    setCurrentStepIdx(steps.length - 1);
    setDisplayedText(steps[steps.length - 1]);
    handleExit();
  }, [allowSkip, isExiting, steps, handleExit]);

  // Keyboard shortcut for skipping (ESC or Space)
  useEffect(() => {
    if (!allowSkip) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Space") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowSkip, handleSkip]);

  // Controlled vs Autonomous Progress Simulation
  useEffect(() => {
    if (isLoading !== undefined) {
      if (!isLoading && progress >= 100 && !isExiting) {
        handleExit();
      } else if (!isLoading && !isExiting) {
        setProgress(100);
        setCurrentStepIdx(steps.length - 1);
        handleExit();
      }
      return;
    }

    const intervalTime = 35;
    const totalSteps = duration / intervalTime;
    let currentTick = 0;

    const timer = setInterval(() => {
      currentTick++;
      const rawProgress = Math.min(100, (currentTick / totalSteps) * 100);

      let easedProgress = rawProgress;
      if (rawProgress < 25) {
        easedProgress = rawProgress * 0.95;
      } else if (rawProgress < 55) {
        easedProgress = 25 + (rawProgress - 25) * 1.05;
      } else if (rawProgress < 85) {
        easedProgress = 55 + (rawProgress - 55) * 1.0;
      } else {
        easedProgress = 85 + (rawProgress - 85) * 1.0;
      }

      const clamped = Math.min(100, Math.max(0, easedProgress));
      setProgress(clamped);

      const stepIndex = Math.min(
        steps.length - 1,
        Math.floor((clamped / 100) * steps.length)
      );
      setCurrentStepIdx(stepIndex);

      if (clamped >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          handleExit();
        }, 350);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isLoading, duration, steps, isExiting, handleExit, progress]);

  // Telemetry metric randomization
  useEffect(() => {
    const metricTimer = setInterval(() => {
      const hexes = [
        "0x7FFE_4A01", "0x8B14_2C80", "0x9F0A_B110", "0x00FF_88E2",
        "0x1A4C_7E09", "0x4D20_FF1B", "0x6E82_00AA", "0xA3B9_5C44"
      ];
      setHexOffset(hexes[Math.floor(Math.random() * hexes.length)]);
      setActivePackets(prev => Math.floor(135 + Math.random() * 35));
      setSystemLatency(`${(0.32 + Math.random() * 0.22).toFixed(2)}ms`);
    }, 280);

    return () => clearInterval(metricTimer);
  }, []);

  // Retro Cyber Glitch / Scramble Decoder Effect
  useEffect(() => {
    let iteration = 0;
    const target = currentStepMessage;

    const scrambleTimer = setInterval(() => {
      const scrambled = target
        .split("")
        .map((char, index) => {
          if (index < iteration || char === " " || char === "[" || char === "]" || char === "/") {
            return target[index];
          }
          return GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)];
        })
        .join("");

      setDisplayedText(scrambled);
      iteration += 1.6;

      if (iteration >= target.length) {
        setDisplayedText(target);
        clearInterval(scrambleTimer);
      }
    }, 22);

    return () => clearInterval(scrambleTimer);
  }, [currentStepMessage]);

  if (!isMounted) return null;

  // 32 Segment ticks for widescreen progress bar
  const totalSegments = 32;
  const activeSegmentsCount = Math.round((progress / 100) * totalSegments);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-label="Agent Studio Runtime Initialization"
      aria-live="polite"
      onClick={handleSkip}
      className={`
        ${fullscreen ? "fixed inset-0 z-[9999]" : "relative w-full min-h-[560px]"}
        flex flex-col justify-between p-2.5 xs:p-3.5 sm:p-5 md:p-6 lg:p-8
        select-none overflow-y-auto overflow-x-hidden
        transition-all duration-700 ease-out
        ${isExiting ? "opacity-0 scale-[1.03] blur-xl pointer-events-none" : "opacity-100 scale-100 blur-0"}
        ${className}
      `}
      style={{
        backgroundColor: "hsla(var(--preloader-bg) / 0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        color: "hsl(var(--preloader-text))",
      }}
    >
      {/* Background Cyber Grid with Theme-Adaptive Lines */}
      <div className="fixed inset-0 pointer-events-none preloader-grid-bg opacity-80" />

      {/* Radial Ambient Center Glow */}
      <div
        className="fixed w-[900px] h-[900px] rounded-full pointer-events-none transition-all duration-1000 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 opacity-60"
        style={{
          background: `radial-gradient(circle, hsla(var(--preloader-primary) / 0.18) 0%, hsla(var(--preloader-secondary) / 0.08) 50%, transparent 75%)`,
        }}
      />

      {/* CRT Scanline Beam Simulation */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div
          className="w-full h-32 animate-preloader-scanline"
          style={{
            background: "linear-gradient(180deg, transparent 0%, hsla(var(--preloader-primary) / 0.15) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Screen Corner Sci-Fi Brackets (Desktop only) */}
      <div className="hidden sm:block absolute top-3 left-3 pointer-events-none font-mono text-[9px] md:text-[10px] opacity-40 text-[hsl(var(--preloader-muted))]">
        [SYS.KERNEL::TOP_LEFT]
      </div>
      <div className="hidden sm:block absolute top-3 right-3 pointer-events-none font-mono text-[9px] md:text-[10px] opacity-40 text-[hsl(var(--preloader-muted))]">
        [SYS.SEC_PORT::443]
      </div>
      <div className="hidden sm:block absolute bottom-3 left-3 pointer-events-none font-mono text-[9px] md:text-[10px] opacity-40 text-[hsl(var(--preloader-muted))]">
        [GRID::1920x1080]
      </div>
      <div className="hidden sm:block absolute bottom-3 right-3 pointer-events-none font-mono text-[9px] md:text-[10px] opacity-40 text-[hsl(var(--preloader-muted))]">
        [STATUS::STABLE]
      </div>

      {/* Main Container Wrapper with max-width restraint on ultra-wide screens */}
      <div className="relative z-10 w-full max-w-[1600px] mx-auto flex-1 flex flex-col justify-between gap-3 sm:gap-4 md:gap-6 min-h-0">

        {/* ── TOP BAR: Responsive Widescreen System Header ────────────── */}
        <div className="w-full flex items-center justify-between border-b border-[hsl(var(--preloader-border))] pb-2.5 sm:pb-3.5 flex-shrink-0 gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm animate-pulse flex-shrink-0"
              style={{
                backgroundColor: "hsl(var(--preloader-primary))",
                boxShadow: "0 0 12px hsl(var(--preloader-primary))",
              }}
            />
            <div className="min-w-0">
              <h1
                className="font-pixel text-xs sm:text-sm md:text-base lg:text-lg font-bold tracking-wider preloader-glow-text truncate"
                style={{ color: "hsl(var(--preloader-primary))" }}
              >
                {title}
              </h1>
              <div className="hidden xs:block text-[9px] sm:text-[10px] font-mono text-[hsl(var(--preloader-muted))] truncate">
                AUTONOMOUS MULTI-AGENT EXECUTION GRAPH
              </div>
            </div>
          </div>

          {/* Center HUD status badges (visible on md/lg) */}
          <div className="hidden md:flex items-center space-x-2 font-mono text-[10px] lg:text-[11px] flex-shrink-0">
            <span className="px-2.5 py-0.5 sm:py-1 rounded border border-[hsl(var(--preloader-border))] bg-[hsla(var(--preloader-surface)/0.6)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>ORCHESTRATOR: ONLINE</span>
            </span>
            <span className="hidden lg:flex px-2.5 py-1 rounded border border-[hsl(var(--preloader-border))] bg-[hsla(var(--preloader-surface)/0.6)] items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>MCP_BUS: LINKED</span>
            </span>
            <span className="px-2.5 py-0.5 sm:py-1 rounded border border-[hsl(var(--preloader-border))] bg-[hsla(var(--preloader-surface)/0.6)] flex items-center gap-1.5 text-[hsl(var(--preloader-secondary))]">
              <span>{currentTime}</span>
            </span>
          </div>

          {/* Right Info & Skip Button */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <span
              className="font-mono text-[9px] sm:text-[11px] font-semibold px-2 py-0.5 sm:py-1 rounded border border-[hsl(var(--preloader-border))] truncate max-w-[140px] sm:max-w-none"
              style={{
                backgroundColor: "hsla(var(--preloader-surface) / 0.8)",
                color: "hsl(var(--preloader-muted))",
              }}
            >
              {subtitle}
            </span>
            {allowSkip && (
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-1 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider px-2 sm:px-2.5 py-0.5 sm:py-1 rounded border border-dashed border-[hsl(var(--preloader-border))] hover:border-[hsl(var(--preloader-primary))] opacity-80 hover:opacity-100 transition-all cursor-pointer bg-[hsla(var(--preloader-surface)/0.5)] flex-shrink-0"
                style={{ color: "hsl(var(--preloader-text))" }}
                title="Click anywhere or press ESC to skip"
              >
                <span>[ESC]</span>
              </button>
            )}
          </div>
        </div>

        {/* ── MIDDLE SECTION: Fully Responsive Multi-Column/Stack HUD ─── */}
        <div className="w-full flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4 md:gap-6 lg:gap-8 my-auto py-1 sm:py-2">
          
          {/* LEFT COLUMN: Subsystem Telemetry Monitor (Desktop lg/xl/2xl) */}
          <div className="hidden lg:flex flex-col justify-center w-60 xl:w-72 2xl:w-80 h-full space-y-2.5 xl:space-y-3 font-mono flex-shrink-0">
            <div className="text-xs font-bold tracking-wider border-b border-[hsl(var(--preloader-border))] pb-1 text-[hsl(var(--preloader-primary))] flex items-center justify-between">
              <span>[SUBSYSTEM TELEMETRY]</span>
              <span className="text-[10px] text-emerald-400">SYNCED</span>
            </div>

            <div className="space-y-1.5 xl:space-y-2 text-[11px] xl:text-xs bg-[hsla(var(--preloader-surface)/0.5)] p-2.5 xl:p-3 rounded border border-[hsl(var(--preloader-border))]">
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--preloader-muted))]">LLM REASONER:</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--preloader-muted))]">TOOL REGISTRY:</span>
                <span className="font-semibold text-[hsl(var(--preloader-secondary))]">
                  42 PLUGINS
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--preloader-muted))]">GRAPH ENGINE:</span>
                <span className="font-semibold text-cyan-300">
                  LANGGRAPH v1.4
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--preloader-muted))]">VECTOR MEMORY:</span>
                <span className="font-semibold text-[hsl(var(--preloader-accent))]">
                  4,096 CHUNKS
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--preloader-muted))]">SANDBOX EXEC:</span>
                <span className="font-semibold text-emerald-400">
                  ISOLATED
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--preloader-muted))]">SECURITY GUARD:</span>
                <span className="font-semibold text-emerald-400">
                  ENFORCED
                </span>
              </div>
            </div>

            {/* Hex Memory Dump Stream */}
            <div className="bg-[hsla(var(--preloader-surface)/0.3)] p-2.5 xl:p-3 rounded border border-[hsl(var(--preloader-border))] text-[9.5px] xl:text-[10px] space-y-1">
              <div className="text-[hsl(var(--preloader-muted))] text-[8.5px] uppercase tracking-widest pb-0.5 border-b border-[hsl(var(--preloader-border))]">
                HEX ADDRESS DUMP
              </div>
              <div className="text-[hsl(var(--preloader-secondary))]">{hexOffset} : MOV [EAX], 0x00</div>
              <div className="text-[hsl(var(--preloader-muted))]">0x7FFE_4A08 : CALL AGENT_DISPATCH</div>
              <div className="text-[hsl(var(--preloader-muted))]">0x7FFE_4A10 : JMP LANGGRAPH_EVAL</div>
              <div className="text-emerald-400/80">0x7FFE_4A18 : STATUS_OK (0x00)</div>
            </div>
          </div>

          {/* CENTER STAGE: Scalable Multi-Agent Node Network SVG */}
          <div className="relative w-full max-w-[270px] xs:max-w-[310px] sm:max-w-[370px] md:max-w-[430px] lg:max-w-[470px] xl:max-w-[530px] 2xl:max-w-[580px] max-h-[42vh] lg:max-h-[52vh] aspect-square flex items-center justify-center mx-auto my-auto flex-shrink">
            <svg
              viewBox="0 0 460 460"
              className="w-full h-full drop-shadow-2xl overflow-visible"
              aria-hidden="true"
            >
              <defs>
                {/* Core Node Glow Gradient */}
                <radialGradient id="preloader-core-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--preloader-primary))" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="hsl(var(--preloader-secondary))" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="hsl(var(--preloader-bg))" stopOpacity="0.1" />
                </radialGradient>

                {/* Sub-node Background Gradient */}
                <radialGradient id="preloader-node-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsla(var(--preloader-surface) / 0.95)" />
                  <stop offset="100%" stopColor="hsla(var(--preloader-bg) / 0.9)" />
                </radialGradient>

                {/* Conduit Gradient */}
                <linearGradient id="preloader-conduit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--preloader-primary))" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="hsl(var(--preloader-secondary))" stopOpacity="0.45" />
                </linearGradient>

                {/* Glowing Packet Gradient */}
                <radialGradient id="preloader-packet-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="40%" stopColor="hsl(var(--preloader-primary))" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(var(--preloader-primary))" stopOpacity="0" />
                </radialGradient>

                {/* Return Packet Gradient */}
                <radialGradient id="preloader-packet-return" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="50%" stopColor="hsl(var(--preloader-accent))" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(var(--preloader-accent))" stopOpacity="0" />
                </radialGradient>

                {/* Drop Glow Filter */}
                <filter id="preloader-glow-filter" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background PCB Grid Crosshairs & Compass Ticks */}
              <g opacity="0.25" stroke="hsl(var(--preloader-border))" strokeWidth="1">
                <line x1="230" y1="20" x2="230" y2="440" strokeDasharray="3 6" />
                <line x1="20" y1="230" x2="440" y2="230" strokeDasharray="3 6" />
                <circle cx="230" cy="230" r="160" fill="none" strokeDasharray="2 12" />
                <circle cx="230" cy="230" r="195" fill="none" strokeDasharray="1 8" />
              </g>

              {/* ── Conduit Interconnect Paths ────────────────────────── */}
              <path
                id="path-node-1"
                d="M 230 230 Q 150 170 100 95"
                fill="none"
                stroke="hsla(var(--preloader-border) / 0.5)"
                strokeWidth="2"
              />
              <path
                d="M 230 230 Q 150 170 100 95"
                fill="none"
                stroke="url(#preloader-conduit-grad)"
                strokeWidth="1.8"
                strokeDasharray="6 8"
                className="animate-preloader-packet-flow"
              />

              <path
                id="path-node-2"
                d="M 230 230 Q 310 170 360 95"
                fill="none"
                stroke="hsla(var(--preloader-border) / 0.5)"
                strokeWidth="2"
              />
              <path
                d="M 230 230 Q 310 170 360 95"
                fill="none"
                stroke="url(#preloader-conduit-grad)"
                strokeWidth="1.8"
                strokeDasharray="6 8"
                className="animate-preloader-packet-flow"
              />

              <path
                id="path-node-3"
                d="M 230 230 L 405 230"
                fill="none"
                stroke="hsla(var(--preloader-border) / 0.5)"
                strokeWidth="2"
              />
              <path
                d="M 230 230 L 405 230"
                fill="none"
                stroke="url(#preloader-conduit-grad)"
                strokeWidth="1.8"
                strokeDasharray="6 8"
                className="animate-preloader-packet-flow"
              />

              <path
                id="path-node-4"
                d="M 230 230 Q 310 290 360 365"
                fill="none"
                stroke="hsla(var(--preloader-border) / 0.5)"
                strokeWidth="2"
              />
              <path
                d="M 230 230 Q 310 290 360 365"
                fill="none"
                stroke="url(#preloader-conduit-grad)"
                strokeWidth="1.8"
                strokeDasharray="6 8"
                className="animate-preloader-packet-flow"
              />

              <path
                id="path-node-5"
                d="M 230 230 Q 150 290 100 365"
                fill="none"
                stroke="hsla(var(--preloader-border) / 0.5)"
                strokeWidth="2"
              />
              <path
                d="M 230 230 Q 150 290 100 365"
                fill="none"
                stroke="url(#preloader-conduit-grad)"
                strokeWidth="1.8"
                strokeDasharray="6 8"
                className="animate-preloader-packet-flow"
              />

              <path
                id="path-node-6"
                d="M 230 230 L 55 230"
                fill="none"
                stroke="hsla(var(--preloader-border) / 0.5)"
                strokeWidth="2"
              />
              <path
                d="M 230 230 L 55 230"
                fill="none"
                stroke="url(#preloader-conduit-grad)"
                strokeWidth="1.8"
                strokeDasharray="6 8"
                className="animate-preloader-packet-flow"
              />

              {/* ── Transmitting Packet Pulses (Zero External Dependencies SVG Animation) ── */}
              <circle r="4" fill="url(#preloader-packet-glow)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.0s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-1" />
                </animateMotion>
              </circle>
              <circle r="4" fill="url(#preloader-packet-glow)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="1.9s" repeatCount="indefinite" begin="0.3s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-2" />
                </animateMotion>
              </circle>
              <circle r="4" fill="url(#preloader-packet-glow)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="1.7s" repeatCount="indefinite" begin="0.6s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-3" />
                </animateMotion>
              </circle>
              <circle r="4" fill="url(#preloader-packet-glow)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="2.0s" repeatCount="indefinite" begin="0.9s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-4" />
                </animateMotion>
              </circle>
              <circle r="4" fill="url(#preloader-packet-glow)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="1.8s" repeatCount="indefinite" begin="1.2s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-5" />
                </animateMotion>
              </circle>
              <circle r="4" fill="url(#preloader-packet-glow)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="1.6s" repeatCount="indefinite" begin="1.5s" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-6" />
                </animateMotion>
              </circle>

              {/* Inbound Telemetry Packets (Workers -> Core) */}
              <circle r="3" fill="url(#preloader-packet-return)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.5s" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-1" />
                </animateMotion>
              </circle>
              <circle r="3" fill="url(#preloader-packet-return)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="2.4s" repeatCount="indefinite" begin="1.1s" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-3" />
                </animateMotion>
              </circle>
              <circle r="3" fill="url(#preloader-packet-return)" filter="url(#preloader-glow-filter)">
                <animateMotion dur="2.1s" repeatCount="indefinite" begin="1.7s" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                  <mpath href="#path-node-5" />
                </animateMotion>
              </circle>

              {/* ── 6 Branching Child Agent Nodes ───────────────────────── */}
              {/* Node 1: LLM_REASONER */}
              <g transform="translate(100, 95)">
                <circle r="22" fill="url(#preloader-node-grad)" stroke="hsl(var(--preloader-border))" strokeWidth="1.5" />
                <circle r="26" fill="none" stroke="hsl(var(--preloader-primary))" strokeWidth="1" strokeDasharray="3 4" className="animate-preloader-orbit-cw" />
                {/* AI Intelligence Spark / Neural Core */}
                <path
                  d="M 0 -9 Q 0 0 -9 0 Q 0 0 0 9 Q 0 0 9 0 Q 0 0 0 -9 Z"
                  fill="none"
                  stroke="hsl(var(--preloader-primary))"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="0" cy="0" r="2.5" fill="hsl(var(--preloader-primary))" />
                <circle cx="-5" cy="-5" r="1" fill="hsl(var(--preloader-primary))" opacity="0.75" />
                <circle cx="5" cy="5" r="1" fill="hsl(var(--preloader-primary))" opacity="0.75" />
                <circle cx="5" cy="-5" r="1" fill="hsl(var(--preloader-primary))" opacity="0.75" />
                <circle cx="-5" cy="5" r="1" fill="hsl(var(--preloader-primary))" opacity="0.75" />
                <text x="0" y="36" textAnchor="middle" fill="hsl(var(--preloader-text))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  LLM_REASON
                </text>
                <text x="0" y="46" textAnchor="middle" fill="hsl(var(--preloader-muted))" fontSize="7.5" fontFamily="monospace">
                  PLANNER
                </text>
              </g>

              {/* Node 2: TOOL_MCP */}
              <g transform="translate(360, 95)">
                <circle r="22" fill="url(#preloader-node-grad)" stroke="hsl(var(--preloader-border))" strokeWidth="1.5" />
                <circle r="26" fill="none" stroke="hsl(var(--preloader-secondary))" strokeWidth="1" strokeDasharray="4 4" className="animate-preloader-orbit-ccw" />
                <path
                  d="M -6 -6 L -2 -2 M 6 -6 L 2 -2 M -5 0 L 5 0 L 4 6 L -4 6 Z M 0 6 L 0 9"
                  fill="none"
                  stroke="hsl(var(--preloader-secondary))"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <text x="0" y="36" textAnchor="middle" fill="hsl(var(--preloader-text))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  TOOL_MCP
                </text>
                <text x="0" y="46" textAnchor="middle" fill="hsl(var(--preloader-muted))" fontSize="7.5" fontFamily="monospace">
                  PROTOCOL
                </text>
              </g>

              {/* Node 3: GRAPH_STATE */}
              <g transform="translate(405, 230)">
                <circle r="22" fill="url(#preloader-node-grad)" stroke="hsl(var(--preloader-border))" strokeWidth="1.5" />
                <circle r="26" fill="none" stroke="hsl(var(--preloader-primary))" strokeWidth="1" strokeDasharray="2 5" className="animate-preloader-orbit-cw" />
                <circle cx="-5" cy="-4" r="2.5" fill="hsl(var(--preloader-primary))" />
                <circle cx="5" cy="-4" r="2.5" fill="hsl(var(--preloader-primary))" />
                <circle cx="0" cy="5" r="2.5" fill="hsl(var(--preloader-accent))" />
                <line x1="-5" y1="-4" x2="0" y2="5" stroke="hsl(var(--preloader-primary))" strokeWidth="1.2" />
                <line x1="5" y1="-4" x2="0" y2="5" stroke="hsl(var(--preloader-primary))" strokeWidth="1.2" />
                <text x="0" y="36" textAnchor="middle" fill="hsl(var(--preloader-text))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  GRAPH_FSM
                </text>
                <text x="0" y="46" textAnchor="middle" fill="hsl(var(--preloader-muted))" fontSize="7.5" fontFamily="monospace">
                  LANGGRAPH
                </text>
              </g>

              {/* Node 4: VECTOR_MEM */}
              <g transform="translate(360, 365)">
                <circle r="22" fill="url(#preloader-node-grad)" stroke="hsl(var(--preloader-border))" strokeWidth="1.5" />
                <circle r="26" fill="none" stroke="hsl(var(--preloader-accent))" strokeWidth="1" strokeDasharray="3 4" className="animate-preloader-orbit-ccw" />
                <ellipse cx="0" cy="-5" rx="7" ry="3" fill="none" stroke="hsl(var(--preloader-accent))" strokeWidth="1.5" />
                <path d="M -7 -5 L -7 4 A 7 3 0 0 0 7 4 L 7 -5" fill="none" stroke="hsl(var(--preloader-accent))" strokeWidth="1.5" />
                <path d="M -7 0 A 7 3 0 0 0 7 0" fill="none" stroke="hsl(var(--preloader-accent))" strokeWidth="1.2" strokeDasharray="2 2" />
                <text x="0" y="36" textAnchor="middle" fill="hsl(var(--preloader-text))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  VECTOR_MEM
                </text>
                <text x="0" y="46" textAnchor="middle" fill="hsl(var(--preloader-muted))" fontSize="7.5" fontFamily="monospace">
                  RAG_STORE
                </text>
              </g>

              {/* Node 5: CODE_EXEC */}
              <g transform="translate(100, 365)">
                <circle r="22" fill="url(#preloader-node-grad)" stroke="hsl(var(--preloader-border))" strokeWidth="1.5" />
                <circle r="26" fill="none" stroke="hsl(var(--preloader-primary))" strokeWidth="1" strokeDasharray="3 4" className="animate-preloader-orbit-cw" />
                {/* Cyber Terminal / Code Sandbox Icon */}
                <path
                  d="M -6 -5 L -1 0 L -6 5 M 2 5 L 7 5"
                  fill="none"
                  stroke="hsl(var(--preloader-primary))"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text x="0" y="36" textAnchor="middle" fill="hsl(var(--preloader-text))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  CODE_EXEC
                </text>
                <text x="0" y="46" textAnchor="middle" fill="hsl(var(--preloader-muted))" fontSize="7.5" fontFamily="monospace">
                  SANDBOX
                </text>
              </g>

              {/* Node 6: GUARDRAIL */}
              <g transform="translate(55, 230)">
                <circle r="22" fill="url(#preloader-node-grad)" stroke="hsl(var(--preloader-border))" strokeWidth="1.5" />
                <circle r="26" fill="none" stroke="hsl(var(--preloader-secondary))" strokeWidth="1" strokeDasharray="2 4" className="animate-preloader-orbit-ccw" />
                <path
                  d="M 0 -8 L 6 -5 L 6 1 C 6 6 0 9 0 9 C 0 9 -6 6 -6 1 L -6 -5 Z"
                  fill="none"
                  stroke="hsl(var(--preloader-secondary))"
                  strokeWidth="1.5"
                />
                <text x="0" y="36" textAnchor="middle" fill="hsl(var(--preloader-text))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  GUARDRAIL
                </text>
                <text x="0" y="46" textAnchor="middle" fill="hsl(var(--preloader-muted))" fontSize="7.5" fontFamily="monospace">
                  POLICY_SEC
                </text>
              </g>

              {/* ── Central Pulsing Core Node (Orchestrator Agent) ────── */}
              <g transform="translate(230, 230)">
                {/* 3 Concentric Expanding Radar Waves */}
                <circle
                  r="36"
                  fill="none"
                  stroke="hsl(var(--preloader-primary))"
                  className="animate-preloader-radar-1"
                />
                <circle
                  r="36"
                  fill="none"
                  stroke="hsl(var(--preloader-secondary))"
                  className="animate-preloader-radar-2"
                />
                <circle
                  r="36"
                  fill="none"
                  stroke="hsl(var(--preloader-accent))"
                  className="animate-preloader-radar-3"
                />

                {/* HUD Orbiting Tech Ticks */}
                <circle
                  r="72"
                  fill="none"
                  stroke="hsl(var(--preloader-border))"
                  strokeWidth="1.5"
                  strokeDasharray="6 14"
                  className="animate-preloader-orbit-cw"
                />
                <circle
                  r="56"
                  fill="none"
                  stroke="hsl(var(--preloader-primary))"
                  strokeWidth="1.2"
                  strokeDasharray="18 10"
                  className="animate-preloader-orbit-ccw"
                />

                {/* Core Hub Body */}
                <circle
                  r="38"
                  fill="url(#preloader-core-grad)"
                  filter="url(#preloader-glow-filter)"
                />
                <circle
                  r="34"
                  fill="hsla(var(--preloader-bg) / 0.85)"
                  stroke="hsl(var(--preloader-primary))"
                  strokeWidth="2"
                />

                {/* Core AI Orchestrator Glyph */}
                <g filter="url(#preloader-glow-filter)">
                  <rect x="-9" y="-9" width="18" height="18" rx="3" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="0" cy="0" r="3.5" fill="hsl(var(--preloader-primary))" />
                  <line x1="0" y1="-9" x2="0" y2="-15" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="0" y1="9" x2="0" y2="15" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="-9" y1="0" x2="-15" y2="0" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="9" y1="0" x2="15" y2="0" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Core Text Label Badge */}
                <g transform="translate(0, 50)">
                  <rect
                    x="-48"
                    y="-8"
                    width="96"
                    height="16"
                    rx="3"
                    fill="hsla(var(--preloader-surface) / 0.95)"
                    stroke="hsl(var(--preloader-border))"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="hsl(var(--preloader-primary))"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    letterSpacing="0.05em"
                  >
                    ORCHESTRATOR
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* RIGHT COLUMN: Live Kernel Event Log Feed (Desktop lg/xl/2xl) */}
          <div className="hidden lg:flex flex-col justify-center w-60 xl:w-72 2xl:w-80 h-full space-y-2.5 xl:space-y-3 font-mono flex-shrink-0">
            <div className="text-xs font-bold tracking-wider border-b border-[hsl(var(--preloader-border))] pb-1 text-[hsl(var(--preloader-secondary))] flex items-center justify-between">
              <span>[KERNEL EVENT STREAM]</span>
              <span className="text-[10px] text-cyan-400">TLS 1.3</span>
            </div>

            <div className="space-y-1.5 text-[10.5px] xl:text-[11px] bg-[hsla(var(--preloader-surface)/0.5)] p-2.5 xl:p-3 rounded border border-[hsl(var(--preloader-border))]">
              <div className="text-emerald-400 truncate">
                &gt; [0.00s] V8_ISOLATE::SPAWN
              </div>
              <div className="text-[hsl(var(--preloader-text))] truncate">
                &gt; [0.42s] GRAPH_VERTICES: 128
              </div>
              <div className="text-[hsl(var(--preloader-secondary))] truncate">
                &gt; [0.88s] MCP_SERVERS_HANDSHAKE
              </div>
              <div className="text-cyan-300 truncate">
                &gt; [1.34s] MEM_VECTORS_SYNCED
              </div>
              <div className="text-emerald-300 font-semibold truncate">
                &gt; [1.90s] ALL_PIPELINES_LINKED
              </div>
            </div>

            {/* Real-time Packet & Latency Counters */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[hsla(var(--preloader-surface)/0.5)] p-2 xl:p-2.5 rounded border border-[hsl(var(--preloader-border))]">
                <div className="text-[8.5px] xl:text-[9px] text-[hsl(var(--preloader-muted))] uppercase">PACKET RATE</div>
                <div className="font-bold text-[hsl(var(--preloader-accent))] text-xs xl:text-sm">{activePackets} /s</div>
              </div>
              <div className="bg-[hsla(var(--preloader-surface)/0.5)] p-2 xl:p-2.5 rounded border border-[hsl(var(--preloader-border))]">
                <div className="text-[8.5px] xl:text-[9px] text-[hsl(var(--preloader-muted))] uppercase">LATENCY</div>
                <div className="font-bold text-[hsl(var(--preloader-primary))] text-xs xl:text-sm">{systemLatency}</div>
              </div>
            </div>
          </div>

        </div>

        {/* COMPACT TELEMETRY STRIP FOR MOBILE & TABLET (Hidden on desktop lg+) */}
        {showTelemetry && (
          <div className="lg:hidden w-full grid grid-cols-2 xs:grid-cols-4 gap-1.5 font-mono text-[9px] sm:text-[10px] bg-[hsla(var(--preloader-surface)/0.5)] p-2 rounded border border-[hsl(var(--preloader-border))] flex-shrink-0">
            <div className="truncate">
              <span className="text-[hsl(var(--preloader-muted))]">OFFSET: </span>
              <span className="font-semibold" style={{ color: "hsl(var(--preloader-secondary))" }}>
                {hexOffset}
              </span>
            </div>
            <div className="truncate">
              <span className="text-[hsl(var(--preloader-muted))]">NODES: </span>
              <span className="font-semibold text-emerald-400">
                6/6 ON
              </span>
            </div>
            <div className="truncate">
              <span className="text-[hsl(var(--preloader-muted))]">PKTS: </span>
              <span className="font-semibold" style={{ color: "hsl(var(--preloader-accent))" }}>
                {activePackets}/s
              </span>
            </div>
            <div className="truncate">
              <span className="text-[hsl(var(--preloader-muted))]">PING: </span>
              <span className="font-semibold" style={{ color: "hsl(var(--preloader-primary))" }}>
                {systemLatency}
              </span>
            </div>
          </div>
        )}

        {/* ── BOTTOM SECTION: Responsive Telemetry Banner & Segmented Bar ─ */}
        <div className="w-full flex flex-col space-y-2 sm:space-y-3 border-t border-[hsl(var(--preloader-border))] pt-2 sm:pt-3 flex-shrink-0">
          
          {/* Dynamic Telemetry Terminal Stage Cycling Banner */}
          <div
            className="w-full rounded-md border border-[hsl(var(--preloader-border))] p-2 sm:p-3 flex items-center justify-between transition-all"
            style={{
              backgroundColor: "hsla(var(--preloader-surface) / 0.7)",
              boxShadow: "inset 0 1px 2px hsla(var(--preloader-primary) / 0.15)",
            }}
          >
            <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
              <span
                className="font-mono text-[11px] xs:text-xs sm:text-sm md:text-base font-bold tracking-wide break-all preloader-glow-text"
                style={{ color: "hsl(var(--preloader-primary))" }}
              >
                {displayedText}
              </span>
              <span
                className="inline-block w-2 h-3.5 sm:w-2.5 sm:h-4 md:h-5 animate-pulse flex-shrink-0"
                style={{ backgroundColor: "hsl(var(--preloader-primary))" }}
              />
            </div>

            <div
              className="font-pixel text-xs sm:text-base md:text-lg font-bold pl-2 flex items-center gap-1.5 flex-shrink-0"
              style={{ color: "hsl(var(--preloader-secondary))" }}
            >
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* High-Tech Responsive Segmented Progress Bar (32 Ticks) */}
          <div className="w-full space-y-1">
            <div
              className="w-full h-4 sm:h-5 md:h-6 p-0.5 sm:p-1 rounded border border-[hsl(var(--preloader-border))] flex items-center gap-[2px] sm:gap-1 md:gap-1.5 overflow-hidden"
              style={{ backgroundColor: "hsla(var(--preloader-bg) / 0.9)" }}
            >
              {Array.from({ length: totalSegments }).map((_, index) => {
                const isFilled = index < activeSegmentsCount;
                const isLeading = index === activeSegmentsCount - 1;

                return (
                  <div
                    key={index}
                    className={`
                      flex-1 h-full rounded-[1px] transition-all duration-150
                      ${isFilled ? "opacity-100" : "opacity-15"}
                      ${isLeading ? "animate-preloader-segment-active" : ""}
                    `}
                    style={{
                      backgroundColor: isFilled
                        ? "hsl(var(--preloader-primary))"
                        : "hsl(var(--preloader-muted))",
                      boxShadow: isFilled
                        ? "0 0 10px hsla(var(--preloader-primary) / 0.7)"
                        : "none",
                    }}
                  />
                );
              })}
            </div>

            {/* Bottom Telemetry Bus Metadata Status */}
            <div className="flex items-center justify-between font-mono text-[8px] sm:text-[10px] md:text-[11px] text-[hsl(var(--preloader-muted))] px-0.5">
              <span className="flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                MCP_SSE_v1.3
              </span>
              <span className="hidden sm:inline truncate">
                ENCRYPTION: AES-GCM-256 (SHA-512)
              </span>
              <span className="truncate">
                6/6 NODES SYNCED
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default AgentStudioPreloader;
