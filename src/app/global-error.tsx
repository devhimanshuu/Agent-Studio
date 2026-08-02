"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-slate-200 font-mono min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-red-900/50 bg-red-950/30 text-[10px] text-red-300 uppercase tracking-widest">
            <AlertTriangle className="h-3.5 w-3.5" />
            ERR_500 · SYSTEM FAULT
          </div>
          <h1 className="text-4xl font-pixel text-pixel-glow uppercase">SYSTEM ERROR</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error.message || "An unexpected error occurred. The system is still operational."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer"
          >
            [ RETRY ]
          </button>
        </div>
      </body>
    </html>
  );
}
