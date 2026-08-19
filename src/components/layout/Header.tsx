"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu, X, LogIn, Sparkles } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarContext";
import { usePixelThemeTransition } from "@/components/effects/PixelThemeTransition";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { theme, resolvedTheme } = useTheme();
  const { togglePixelTheme, isTransitioning } = usePixelThemeTransition();
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

  const currentTheme = theme || resolvedTheme || "dark";
  const isDark = currentTheme === "dark";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black font-mono text-slate-900 dark:text-slate-100 transition-colors duration-200 shadow-sm dark:shadow-none">
        {/* Main Header Row */}
        <div className="px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Hamburger (on dashboard) + Brand Logo */}
          <div className="flex items-center gap-2">
            {!isLanding && (
              <button
                type="button"
                onClick={toggleMobileOpen}
                aria-label="Toggle Navigation Drawer"
                className="md:hidden p-1.5 rounded border border-indigo-300 dark:border-indigo-500/60 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-all cursor-pointer"
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
                className="lg:hidden p-1.5 rounded border border-indigo-300 dark:border-indigo-500/60 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-all"
              >
                {landingMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            )}

            {mounted && (
              <button
                type="button"
                onClick={(e) => togglePixelTheme(e)}
                disabled={isTransitioning}
                title={isDark ? "Switch to Studio Light Mode (Pixel Wave)" : "Switch to Midnight Dark Mode (Pixel Wave)"}
                aria-label="Toggle light/dark theme"
                className={`p-2 rounded border border-indigo-300 dark:border-indigo-500/60 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-all cursor-pointer flex items-center justify-center select-none active:scale-95 ${
                  isTransitioning ? "ring-2 ring-cyan-400 dark:ring-indigo-400 animate-pulse" : ""
                }`}
              >
                {isDark ? (
                  <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                )}
              </button>
            )}

            <SignedOut>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <SignInButton mode="modal">
                  <button
                    title="Sign In"
                    aria-label="Sign In"
                    className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded border border-indigo-300 dark:border-indigo-500/60 bg-indigo-100 dark:bg-indigo-900 text-xs font-mono text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 hover:text-indigo-900 dark:hover:text-white transition-all whitespace-nowrap cursor-pointer"
                  >
                    <LogIn className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">[ SIGN IN ]</span>
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    title="Get Started"
                    aria-label="Get Started"
                    className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded border border-indigo-500 bg-indigo-600 text-xs font-mono text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 text-indigo-200" />
                    <span className="hidden sm:inline">[ GET STARTED ]</span>
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
            <SignedOut>
              <div className="pt-2 border-t border-slate-200 dark:border-indigo-900/40 flex flex-col gap-2">
                <SignUpButton mode="modal">
                  <button
                    onClick={() => setLandingMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded border border-indigo-500 bg-indigo-600 text-xs font-mono text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all font-semibold"
                  >
                    <Sparkles className="h-4 w-4 shrink-0" />
                    [ GET STARTED FREE ]
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button
                    onClick={() => setLandingMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/60 bg-indigo-100 dark:bg-indigo-900 text-xs font-mono text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800 hover:border-indigo-400 transition-all"
                  >
                    <LogIn className="h-4 w-4 shrink-0" />
                    [ SIGN IN ]
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
          </nav>
        )}
      </header>
    </>
  );
}

export default Header;
