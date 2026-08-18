"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import {
  Terminal,
  Home,
  Network,
  LayoutDashboard,
  Wrench,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Radio,
  ArrowRight,
  Zap,
  LogIn,
} from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [repairStep, setRepairStep] = useState<string>("INITIATE SELF-HEALING");
  const [pings, setPings] = useState<{ x: number; y: number; id: number }[]>([]);
  const [radarAngle, setRadarAngle] = useState<number>(0);
  const [hexMemory, setHexMemory] = useState<string>("0xDEAD_4040");

  // Rotating search radar beam
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarAngle((prev) => (prev + 3) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Randomized hex memory dump
  useEffect(() => {
    const interval = setInterval(() => {
      const hexes = ["0xDEAD_4040", "0x0000_NULL", "0xBAAD_F00D", "0x404_ORPHAN", "0xSEVERED_01"];
      setHexMemory(hexes[Math.floor(Math.random() * hexes.length)]);
    }, 450);
    return () => clearInterval(interval);
  }, []);

  // Sonar radar click pulse effect
  const handleRadarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newPing = { x, y, id: Date.now() };
    setPings((prev) => [...prev.slice(-3), newPing]);
  };

  // Interactive Autonomous Healing Reroute sequence
  const handleAutoRepair = () => {
    if (isRepairing) return;
    setIsRepairing(true);
    setRepairStep("[01/03] SCANNING TOPOLOGY...");

    setTimeout(() => {
      setRepairStep("[02/03] LOCATING ACTIVE ROOT GRAPH...");
    }, 600);

    setTimeout(() => {
      setRepairStep("[03/03] HEALING ROUTE -> TELEPORTING");
    }, 1200);

    setTimeout(() => {
      router.push("/");
    }, 1800);
  };

  return (
    <div className="relative min-h-[82vh] w-full flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 font-mono select-none overflow-hidden text-foreground">
      
      {/* Background Cyber Grid & Ambient Radial Vignette */}
      <div className="absolute inset-0 pointer-events-none preloader-grid-bg opacity-60" />
      <div
        className="absolute w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 opacity-25"
        style={{
          background: "radial-gradient(circle, hsla(var(--destructive) / 0.3) 0%, hsla(var(--primary) / 0.15) 45%, transparent 70%)",
        }}
      />

      {/* Screen Corner Sci-Fi Brackets */}
      <div className="hidden sm:block absolute top-4 left-4 pointer-events-none text-[10px] text-muted-foreground font-mono opacity-50">
        [EXCEPTION::GRAPH_TOPOLOGY_404]
      </div>
      <div className="hidden sm:block absolute top-4 right-4 pointer-events-none text-[10px] text-muted-foreground font-mono opacity-50">
        [STATUS::NODE_DISCONNECTED]
      </div>
      <div className="hidden sm:block absolute bottom-4 left-4 pointer-events-none text-[10px] text-muted-foreground font-mono opacity-50">
        [RESCUE_PROTOCOL::ACTIVE]
      </div>
      <div className="hidden sm:block absolute bottom-4 right-4 pointer-events-none text-[10px] text-muted-foreground font-mono opacity-50">
        [MEMORY_OFFSET::{hexMemory}]
      </div>

      {/* Main 404 Incident Container */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center text-center space-y-5 sm:space-y-6">

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-destructive/40 bg-destructive/10 text-[11px] font-semibold text-destructive shadow-lg shadow-destructive/10 backdrop-blur-md">
          <ShieldAlert className="h-3.5 w-3.5 animate-pulse text-destructive" />
          <span className="tracking-widest uppercase">FATAL_EXCEPTION // NODE_NOT_FOUND (404)</span>
        </div>

        {/* Interactive Lost Agent Radar & Glitch 404 Headline */}
        <div className="relative w-full flex flex-col items-center justify-center my-1">
          
          {/* Animated Interactive Sonar Search Grid */}
          <div
            onClick={handleRadarClick}
            title="Click to emit radar scan ping"
            className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full border border-destructive/40 bg-card/80 dark:bg-black/60 flex items-center justify-center overflow-hidden cursor-crosshair group shadow-2xl backdrop-blur-sm transition-all hover:border-destructive not-found-radar-glow"
          >
            {/* Concentric Radar Rings */}
            <div className="absolute inset-4 rounded-full border border-destructive/20 pointer-events-none" />
            <div className="absolute inset-10 rounded-full border border-destructive/20 pointer-events-none" />
            <div className="absolute inset-16 rounded-full border border-dashed border-destructive/25 pointer-events-none" />
            
            {/* Crosshair Grids */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-[1px] bg-destructive/20" />
              <div className="h-full w-[1px] bg-destructive/20 absolute" />
            </div>

            {/* Sweeping Radar Beam */}
            <div
              className="absolute inset-0 origin-center pointer-events-none"
              style={{
                transform: `rotate(${radarAngle}deg)`,
                background: "conic-gradient(from 0deg, hsla(var(--destructive) / 0.45) 0deg, transparent 60deg, transparent 360deg)",
              }}
            />

            {/* Click Pings */}
            {pings.map((ping) => (
              <div
                key={ping.id}
                className="absolute w-8 h-8 rounded-full border-2 border-primary -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-ping"
                style={{ left: ping.x, top: ping.y }}
              />
            ))}

            {/* Central Lost AI Agent Drone */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative w-12 h-12 rounded-lg border-2 border-destructive bg-destructive/20 dark:bg-destructive/30 flex items-center justify-center shadow-lg shadow-destructive/30 animate-bounce" style={{ animationDuration: "2.4s" }}>
                <Terminal className="h-6 w-6 text-destructive" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
              </div>
              <span className="text-[9px] font-bold text-destructive mt-1.5 tracking-wider bg-card/90 dark:bg-black/90 px-1.5 py-0.5 rounded border border-destructive/40">
                LOST_AGENT #04
              </span>
            </div>

            {/* Hover Tooltip Overlay */}
            <div className="absolute bottom-2 text-[8px] text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity">
              [ CLICK TO PING RADAR ]
            </div>
          </div>

          {/* Retro Pixel 404 Headline */}
          <div className="mt-4 sm:mt-5 text-center">
            <h1
              className="text-4xl sm:text-6xl md:text-7xl font-pixel font-bold tracking-widest text-destructive glitch not-found-title-glow"
              data-text="404"
            >
              404
            </h1>
            <p className="font-pixel text-xs sm:text-sm md:text-base text-foreground/80 mt-1 uppercase tracking-wider text-pixel-glow">
              GRAPH EDGE DISCONNECTED
            </p>
          </div>
        </div>

        {/* Retro Terminal Diagnostic Logs Window */}
        <div className="w-full max-w-2xl bg-slate-900 text-slate-100 dark:bg-black/70 dark:text-slate-200 border border-slate-700/60 dark:border-slate-800 rounded-lg p-3 sm:p-4 text-left shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-700/60 dark:border-slate-800 pb-2 mb-2 text-[10px] text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="pl-2 font-bold text-slate-200">DIAGNOSTIC_TRACE.LOG</span>
            </div>
            <span className="text-destructive font-bold">ERROR_CODE: 0x404_ORPHANED_LEAF</span>
          </div>

          <div className="font-mono text-xs sm:text-[13px] space-y-1">
            <p className="text-destructive font-semibold">
              &gt; FATAL: Requested node coordinate not found in state graph.
            </p>
            <p className="text-slate-400 text-[11px] sm:text-xs">
              &gt; LangGraph State Machine traversed 0x00 edges — reached unmapped void leaf.
            </p>
            <p className="text-primary text-[11px] sm:text-xs">
              &gt; SUGGESTION: Initiate autonomous healing or re-route to an active node.
            </p>
          </div>
        </div>

        {/* Action Controls & Quick Teleport Nodes */}
        <div className="w-full max-w-2xl flex flex-col items-center space-y-3 pt-1">
          
          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            
            {/* Auto-Heal Button */}
            <button
              onClick={handleAutoRepair}
              disabled={isRepairing}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-md text-xs sm:text-sm font-bold tracking-wide transition-all shadow-lg active:scale-95 cursor-pointer
                ${
                  isRepairing
                    ? "bg-emerald-600 text-white shadow-emerald-500/30 animate-pulse cursor-wait"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-destructive/30 hover:shadow-destructive/50"
                }
              `}
            >
              {isRepairing ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 fill-current" />
              )}
              <span>{repairStep}</span>
            </button>

            {/* Return Home Button */}
            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-md border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary text-xs sm:text-sm font-bold transition-all shadow-md shadow-primary/20 hover:border-primary active:scale-95"
            >
              <Home className="h-4 w-4" />
              <span>[ RETURN TO HOME GRAPH ]</span>
            </Link>
          </div>

          {/* Secondary Quick Teleport Hub (Auth Aware) */}
          <div className="w-full pt-3 border-t border-border mt-2">
            {isLoaded && isSignedIn ? (
              <>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                  <Radio className="h-3 w-3 text-primary" />
                  <span>ACTIVE NETWORK TELEPORT NODES:</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href="/dashboard/canvas"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border border-border bg-card hover:border-primary hover:bg-primary/10 text-card-foreground hover:text-primary transition-all shadow-sm"
                  >
                    <Network className="h-3.5 w-3.5 text-primary" />
                    <span>Agent Canvas</span>
                    <ArrowRight className="h-3 w-3 opacity-50" />
                  </Link>

                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border border-border bg-card hover:border-primary hover:bg-primary/10 text-card-foreground hover:text-primary transition-all shadow-sm"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                    <span>Dashboard</span>
                    <ArrowRight className="h-3 w-3 opacity-50" />
                  </Link>

                  <Link
                    href="/dashboard/tools"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border border-border bg-card hover:border-primary hover:bg-primary/10 text-card-foreground hover:text-primary transition-all shadow-sm"
                  >
                    <Wrench className="h-3.5 w-3.5 text-primary" />
                    <span>Tool Registry</span>
                    <ArrowRight className="h-3 w-3 opacity-50" />
                  </Link>

                  <Link
                    href="/dashboard/skills"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border border-border bg-card hover:border-primary hover:bg-primary/10 text-card-foreground hover:text-primary transition-all shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Studio</span>
                    <ArrowRight className="h-3 w-3 opacity-50" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <Radio className="h-3 w-3 text-destructive" />
                  <span>UNAUTHENTICATED SESSION:</span>
                </div>
                <SignInButton mode="modal">
                  <button className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold border border-primary/60 bg-primary/10 hover:bg-primary/20 text-primary transition-all shadow-md active:scale-95 cursor-pointer">
                    <LogIn className="h-3.5 w-3.5" />
                    <span>SIGN IN TO ACCESS AGENT WORKSPACE</span>
                  </button>
                </SignInButton>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
