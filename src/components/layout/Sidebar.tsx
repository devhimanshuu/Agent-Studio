"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LayoutDashboard, Sparkles, Play, GitCompare, Shield, Wrench, LogOut, ChevronsLeft, ChevronsRight, Gauge, ScrollText, Settings } from "lucide-react";
import { clsx } from "clsx";
import { SignOutModal } from "@/components/feedback/SignOutModal";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tag: "SYS_01" },
  { name: "Skills Studio", href: "/dashboard/skills", icon: Sparkles, tag: "SKILL_V1" },
  { name: "Executions", href: "/dashboard/executions", icon: Play, tag: "TRACE_LOG" },
  { name: "Observability", href: "/dashboard/history", icon: Gauge, tag: "OBS_07" },
  { name: "Audit Log", href: "/dashboard/audit", icon: ScrollText, tag: "AUDIT" },
  { name: "Versions", href: "/versions", icon: GitCompare, tag: "DIFF_VIEW" },
  { name: "Compare", href: "/dashboard/compare", icon: GitCompare, tag: "DIFF_07" },
  { name: "Tool Registry", href: "/dashboard/tools", icon: Wrench, tag: "TOOL_V1" },
  { name: "Human Review", href: "/dashboard/review", icon: Shield, tag: "HITL_V2" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, tag: "CFG_V1" },
];

const STORAGE_KEY = "agent-studio-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the collapsed preference after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  // Hide sidebar on the main public landing page
  if (pathname === "/") return null;

  return (
    <>
      <aside
        className={clsx(
          "border-r border-slate-400 dark:border-indigo-900/40 bg-slate-300/90 dark:bg-black/60 flex flex-col justify-between font-mono transition-all duration-300 ease-in-out shrink-0 select-none h-full overflow-y-auto",
          collapsed ? "w-16 p-2" : "w-64 p-4"
        )}
      >
        {/* Top Section */}
        <div className="space-y-4">
          {/* Header & Toggle Button */}
          <div className={clsx("flex items-center pb-2 border-b border-indigo-200 dark:border-indigo-900/30", collapsed ? "justify-center" : "justify-between px-1")}>
            {!collapsed && (
              <span className="text-[10px] font-mono tracking-widest uppercase text-indigo-700 dark:text-indigo-400/70 font-semibold">
                NAVIGATION
              </span>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex items-center justify-center h-7 w-7 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all duration-150 cursor-pointer shrink-0"
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={clsx(
                    "flex items-center rounded border text-xs font-mono transition-all duration-150",
                    collapsed
                      ? "h-10 w-10 mx-auto justify-center"
                      : "justify-between px-3 py-2.5",
                    isActive
                      ? "border-indigo-400/80 dark:border-indigo-500/60 bg-indigo-100/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 shadow-sm font-semibold"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-200 dark:hover:border-indigo-900/30"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </div>
                  {!collapsed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-medium">
                      {item.tag}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="space-y-2 pt-4">
          <button
            type="button"
            onClick={() => setIsSignOutModalOpen(true)}
            title={collapsed ? "Sign out" : undefined}
            className={clsx(
              "flex items-center rounded border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 text-xs font-mono text-red-700 dark:text-red-300 hover:border-red-400 dark:hover:border-red-400/60 hover:bg-red-100 dark:hover:bg-red-950/40 hover:text-red-800 dark:hover:text-red-200 transition-all duration-150 cursor-pointer",
              collapsed
                ? "h-10 w-10 mx-auto justify-center"
                : "w-full justify-between px-3 py-2.5"
            )}
          >
            <span className="flex items-center gap-2.5">
              <LogOut className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              {!collapsed && <span>[ SIGN OUT ]</span>}
            </span>
            {!collapsed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 font-medium">
                EXIT
              </span>
            )}
          </button>
        </div>
      </aside>

      <SignOutModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
        onConfirm={() => {
          setIsSignOutModalOpen(false);
          signOut({ redirectUrl: "/" });
        }}
      />
    </>
  );
}

export default Sidebar;
