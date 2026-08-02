"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Play, GitCompare, CheckSquare, Wrench } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tag: "SYS_01" },
  { name: "Skills Studio", href: "/skills", icon: Sparkles, tag: "SKILL_V1" },
  { name: "Executions", href: "/executions", icon: Play, tag: "TRACE_LOG" },
  { name: "Versions", href: "/versions", icon: GitCompare, tag: "DIFF_VIEW" },
  { name: "Approvals", href: "/approvals", icon: CheckSquare, tag: "HITL_LOCK" },
];

export function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar on the main public landing page
  if (pathname === "/") return null;

  return (
    <aside className="w-64 border-r border-indigo-900/40 bg-[#060813]/60 flex flex-col justify-between p-4 min-h-[calc(100vh-5.5rem)] font-mono">
      <div className="space-y-6">
        <div className="px-3 py-2 text-[11px] font-mono tracking-widest uppercase text-indigo-400/80 border-b border-indigo-950/60 flex items-center justify-between">
          <span>// WORKSPACE</span>
          <span className="text-[10px] text-slate-500">v1.0</span>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center justify-between px-3 py-2.5 rounded border text-xs font-mono transition-all duration-150",
                  isActive
                    ? "border-indigo-500/60 bg-indigo-950/60 text-indigo-200 shadow-sm shadow-indigo-500/20 font-semibold"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-indigo-950/20 hover:border-indigo-900/30"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-indigo-400" />
                  <span>{item.name}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-900/40 text-indigo-400">
                  {item.tag}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 rounded border border-indigo-900/40 bg-indigo-950/20 text-xs font-mono space-y-2">
        <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-indigo-400" />
          <span>BOUNDED TOOLS</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Calculator • Doc Search • Record Lookup • Task Creator
        </p>
      </div>
    </aside>
  );
}
