"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "danger" | "warning";
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  variant = "danger",
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded border border-indigo-900/50 bg-black p-6 font-mono shadow-2xl shadow-indigo-950/80 animate-fadeInUp"
      >
        <div className="flex items-start gap-3">
          <div
            className={
              isDanger
                ? "p-2 rounded border border-red-500/40 bg-red-950/30 text-red-400 shrink-0"
                : "p-2 rounded border border-amber-500/40 bg-amber-950/30 text-amber-400 shrink-0"
            }
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">{title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="w-full sm:w-auto px-4 py-2 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-200 hover:border-indigo-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 text-center"
          >
            [ CANCEL ]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={
              (isDanger
                ? "px-4 py-2 rounded border border-red-400 bg-red-600 text-xs font-mono font-semibold text-white hover:bg-red-500 shadow-md shadow-red-500/30 transition-all cursor-pointer disabled:opacity-50"
                : "px-4 py-2 rounded border border-amber-400 bg-amber-600 text-xs font-mono font-semibold text-black hover:bg-amber-500 shadow-md shadow-amber-500/30 transition-all cursor-pointer disabled:opacity-50") +
              " w-full sm:w-auto text-center"
            }
          >
            {isPending ? "[ PROCESSING ]" : `[ ${confirmLabel} ]`}
          </button>
        </div>
      </div>
    </div>
  );
}
