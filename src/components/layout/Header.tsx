"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-400 dark:border-indigo-900/40 bg-slate-300/90 dark:bg-black/90 backdrop-blur-md font-mono text-slate-900 dark:text-slate-100 transition-colors duration-200">
        {/* Main Header Row */}
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link href="/" className="group">
            <div>
              <h1 className="text-sm sm:text-base font-pixel tracking-wide text-indigo-600 dark:text-pixel-glow whitespace-nowrap">AGENT STUDIO</h1>
            </div>
          </Link>

          {/* SaaS Section Navigation (Visible on Landing Page) */}
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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="px-2.5 sm:px-3 py-1.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-mono text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 hover:text-indigo-900 dark:hover:text-white transition-all whitespace-nowrap">
                    [ SIGN IN ]
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-2.5 sm:px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-xs font-mono text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all whitespace-nowrap">
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
      </header>
    </>
  );
}

export default Header;
