"use client";

import React, { useEffect } from "react";
import { AlertTriangle, LogOut, X } from "lucide-react";

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SignOutModal({ isOpen, onClose, onConfirm }: SignOutModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="w-full max-w-md rounded border border-red-500/40 bg-[#09090b] p-6 shadow-2xl shadow-red-950/50 space-y-5 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800/50"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Warning Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] text-red-400 uppercase tracking-widest font-semibold">
              // SESSION TERMINATION
            </div>
            <h3 className="text-base font-pixel text-amber-200 uppercase tracking-tight">
              CONFIRM SIGN OUT
            </h3>
          </div>
        </div>

        {/* Message Content */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans border-y border-red-900/30 py-3">
          Are you sure you want to sign out of <span className="text-white font-medium">Agent Studio</span>? Any active session token will be invalidated and you will return to the login screen.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-700 bg-slate-900 text-slate-300 text-xs font-mono hover:bg-slate-800 hover:text-white transition-all"
          >
            [ CANCEL ]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-500 bg-red-600/90 text-white text-xs font-mono font-semibold hover:bg-red-500 shadow-md shadow-red-600/30 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            [ YES, SIGN OUT ]
          </button>
        </div>
      </div>
    </div>
  );
}
