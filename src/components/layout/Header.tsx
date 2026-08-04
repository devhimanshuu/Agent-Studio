"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu, X } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarContext";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { resolvedTheme, setTheme } = useTheme();
  const { toggleMobileOpen, mobileOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [landingMenuOpen, setLandingMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close landing menu when path changes
  useEffect(() => {
    setLandingMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-black/90 backdrop-blur-md font-mono text-slate-900 dark:text-slate-100 transition-colors duration-200 shadow-sm dark:shadow-none">
        {/* Main Header Row */}
        <div className="px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Hamburger (on dashboard) + Brand Logo */}
          <div className="flex items-center gap-2">
            {!isLanding && (
              <button
                type="button"
                onClick={toggleMobileOpen}
                aria-label="Toggle Navigation Drawer"
                className="md:hidden p-1.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all cursor-pointer"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}

            <Link href="/" className="group flex items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-pixel tracking-wide text-indigo-600 dark:text-pixel-glow whitespace-nowrap">
                AGENT STUDIO
              </h1>
            </Link>
          </div>

          {/* SaaS Section Navigation (Visible on Landing Page Desktop) */}
          {isLanding && (
            <nav className="hidden lg:flex items-center gap-6 text-xs text-slate-600 dark:text-slate-300 font-medium dark:font-normal">
              <a href="#runtime" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">[ RUNTIME ]</a>
              <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">[ FEATURES ]</a>
              <a href="#tools" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">[ TOOLS ]</a>
              <a href="#guardrails" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">[ GUARDRAILS ]</a>
              <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">[ FAQ ]</a>
            </nav>
          )}

          {/* Right Side Actions & Clerk Auth */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isLanding && (
              <button
                type="button"
                onClick={() => setLandingMenuOpen(!landingMenuOpen)}
                aria-label="Toggle Navigation Menu"
                className="lg:hidden p-1.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all"
              >
                {landingMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            )}

            {mounted && (
              <button
                type="button"
                onClick={toggleTheme}
                title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
                aria-label="Toggle theme"
                className="p-1.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all cursor-pointer flex items-center gap-1 text-xs"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600" />
                )}
              </button>
            )}

            <SignedOut>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <SignInButton mode="modal">
                  <button className="px-2 sm:px-3 py-1.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[11px] sm:text-xs font-mono text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 hover:text-indigo-900 dark:hover:text-white transition-all whitespace-nowrap">
                    [ SIGN IN ]
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-2 sm:px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-[11px] sm:text-xs font-mono text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all whitespace-nowrap">
                    [ GET STARTED ]
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>

        {/* Mobile Nav Dropdown for Landing Page */}
        {isLanding && landingMenuOpen && (
          <nav className="lg:hidden border-t border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black p-4 flex flex-col gap-3 text-xs font-mono">
            <a
              href="#runtime"
              onClick={() => setLandingMenuOpen(false)}
              className="px-2 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300"
            >
              [ RUNTIME ]
            </a>
            <a
              href="#features"
              onClick={() => setLandingMenuOpen(false)}
              className="px-2 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300"
            >
              [ FEATURES ]
            </a>
            <a
              href="#tools"
              onClick={() => setLandingMenuOpen(false)}
              className="px-2 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300"
            >
              [ TOOLS ]
            </a>
            <a
              href="#guardrails"
              onClick={() => setLandingMenuOpen(false)}
              className="px-2 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300"
            >
              [ GUARDRAILS ]
            </a>
            <a
              href="#faq"
              onClick={() => setLandingMenuOpen(false)}
              className="px-2 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300"
            >
              [ FAQ ]
            </a>
          </nav>
        )}
      </header>
    </>
  );
}

export default Header;
