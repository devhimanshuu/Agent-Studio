"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore, ToastVariant } from "@/stores/toastStore";
import { clsx } from "clsx";

const variantStyles: Record<ToastVariant, { border: string; bg: string; icon: React.ReactNode; text: string }> = {
  success: {
    border: "border-emerald-300 dark:border-emerald-500/40",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-300",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  },
  error: {
    border: "border-red-300 dark:border-red-500/40",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-800 dark:text-red-300",
    icon: <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />,
  },
  info: {
    border: "border-indigo-300 dark:border-indigo-500/40",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-800 dark:text-indigo-300",
    icon: <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
  },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 font-mono w-[min(92vw,380px)]">
      {toasts.map((t) => {
        const style = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={clsx(
              "rounded border p-3 shadow-xl backdrop-blur-sm animate-fadeInUp",
              style.border,
              style.bg
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <div className="space-y-0.5">
                  <p className={clsx("text-xs font-semibold uppercase tracking-wide", style.text)}>{t.title}</p>
                  {t.description && <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{t.description}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {t.action && (
              <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-indigo-900/40 flex items-center justify-end">
                {t.action.href ? (
                  <Link
                    href={t.action.href}
                    onClick={() => dismiss(t.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
                  >
                    {t.action.label} →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick?.();
                      dismiss(t.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Toaster;
