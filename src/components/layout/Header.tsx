"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { SignOutModal } from "@/components/feedback/SignOutModal";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { signOut } = useClerk();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-indigo-900/40 bg-black/90 backdrop-blur-md font-mono">
        {/* Main Header Row */}
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link href="/" className="group">
            <div>
              <h1 className="text-sm sm:text-base font-pixel tracking-wide text-pixel-glow whitespace-nowrap">AGENT STUDIO</h1>
            </div>
          </Link>

          {/* SaaS Section Navigation (Visible on Landing Page) */}
          {isLanding && (
            <nav className="hidden lg:flex items-center gap-6 text-xs text-slate-300">
              <a href="#features" className="hover:text-indigo-400 transition-colors">[ FEATURES ]</a>
              <a href="#tools" className="hover:text-indigo-400 transition-colors">[ TOOLS ]</a>
              <a href="#guardrails" className="hover:text-indigo-400 transition-colors">[ GUARDRAILS ]</a>
              <a href="#faq" className="hover:text-indigo-400 transition-colors">[ FAQ ]</a>
            </nav>
          )}

          {/* Right Side Actions & Clerk Auth */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SignedOut>
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="px-2.5 sm:px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-200 hover:border-indigo-400 hover:text-white transition-all whitespace-nowrap">
                    [ SIGN IN ]
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-2.5 sm:px-3 py-1.5 rounded border border-indigo-400 bg-indigo-600 text-xs font-mono text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all whitespace-nowrap">
                    [ GET STARTED ]
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>

            <SignedIn>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSignOutModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded border border-red-500/30 bg-red-950/20 text-xs font-mono text-red-300 hover:border-red-400 hover:text-white transition-all whitespace-nowrap cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-400" />
                  <span>[ SIGN OUT ]</span>
                </button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

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
