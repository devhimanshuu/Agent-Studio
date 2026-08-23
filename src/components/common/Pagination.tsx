"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  totalCount?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  totalCount,
  className,
}: PaginationProps) {
  // Build page numbers to show (with ellipsis)
  const pages = useMemo(() => {
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const result: (number | "...")[] = [];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    result.push(1);
    if (left > 2) result.push("...");
    for (let i = left; i <= right; i++) result.push(i);
    if (right < totalPages - 1) result.push("...");
    result.push(totalPages);

    return result;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className={clsx("flex items-center justify-center gap-1 pt-6 pb-2", className)}>
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || loading}
        className="inline-flex items-center justify-center h-8 w-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous Page"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* Page Numbers */}
      {pages.map((page, i) =>
        page === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-600 select-none"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            disabled={loading}
            className={clsx(
              "inline-flex items-center justify-center h-8 min-w-[32px] px-2 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50",
              currentPage === page
                ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                : "border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
            )}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages || loading}
        className="inline-flex items-center justify-center h-8 w-8 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next Page"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Page Info */}
      <span className="ml-3 text-[10px] font-mono text-slate-500">
        {currentPage} / {totalPages}
        {totalCount !== undefined && ` (${totalCount.toLocaleString()} total)`}
      </span>
    </div>
  );
}
