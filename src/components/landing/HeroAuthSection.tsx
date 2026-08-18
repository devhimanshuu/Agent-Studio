"use client";

import React from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { UserCheck, Sparkles, ArrowRight, LogIn, MousePointerClick, Terminal } from "lucide-react";

/**
 * Client-side auth section for the landing page hero.
 * By moving Clerk's auth-aware components (`SignedIn`, `SignedOut`, etc.)
 * into a client component, the main landing page can remain a fully static
 * Server Component — eliminating per-request auth calls and enabling
 * instant page loads.
 */
export function HeroAuthSection() {
  return (
    <>
      {/* Dynamic Auth Status Indicator */}
      <div className="animate-fadeInUp font-mono text-xs" style={{ animationDelay: "250ms" }}>
        <SignedIn>
          <div className="inline-flex max-w-full items-center gap-2 px-3 py-1.5 rounded border border-emerald-400/40 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 shadow-sm text-[11px] font-semibold">
            <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">AUTHENTICATED · WORKSPACE ACCESS GRANTED</span>
          </div>
        </SignedIn>
      </div>

      {/* All CTAs in one unified single row */}
      <div className="animate-fadeInUp flex flex-wrap items-center gap-3 sm:gap-4 pt-2 font-mono text-xs" style={{ animationDelay: "300ms" }}>
        <SignedOut>
          <SignUpButton mode="modal">
            <button className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded border border-indigo-500 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all text-sm cursor-pointer whitespace-nowrap">
              <Sparkles className="h-4 w-4" />
              Get Started Free <ArrowRight className="h-4 w-4" />
            </button>
          </SignUpButton>

          <SignInButton mode="modal">
            <button className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 shadow-sm transition-all text-sm cursor-pointer text-center font-medium whitespace-nowrap">
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded border border-indigo-500 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all text-sm cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" />
            Open Studio Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </SignedIn>

        {/* Live Interactive Demo */}
        <a
          href="#canvas"
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-white/80 dark:bg-black/60 text-slate-800 dark:text-slate-200 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 shadow-sm transition-all text-sm cursor-pointer font-medium whitespace-nowrap"
        >
          <MousePointerClick className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Live Interactive Demo
        </a>

        {/* GitHub */}
        <a
          href="https://github.com/devhimanshuu/Agent-Studio"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/60 dark:bg-indigo-950/30 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 shadow-sm transition-all text-xs whitespace-nowrap"
        >
          <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          GitHub
        </a>
      </div>
    </>
  );
}

/**
 * Client-side footer CTA section. Same pattern — moves Clerk's SignUpButton
 * out of the server component tree.
 */
export function FooterAuthCTA() {
  return (
    <SignUpButton mode="modal">
      <button className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded border border-indigo-500 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all text-sm cursor-pointer w-full sm:w-auto">
        <Sparkles className="h-4 w-4" />
        Get Started Free <ArrowRight className="h-4 w-4" />
      </button>
    </SignUpButton>
  );
}
