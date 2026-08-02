import React from "react";
import Link from "next/link";
import { Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 font-mono">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-indigo-900/50 bg-indigo-950/30 text-[10px] text-indigo-300 uppercase tracking-widest">
          <Terminal className="h-3.5 w-3.5" />
          ERR_404
        </div>
        <h1 className="text-4xl font-pixel text-pixel-glow uppercase">NOT FOUND</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all"
        >
          [ RETURN HOME ]
        </Link>
      </div>
    </div>
  );
}
