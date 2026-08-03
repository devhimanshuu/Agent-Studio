import React from "react";
import { clsx } from "clsx";

/* ============================================================================
 * Skeleton primitives
 * A set of shimmering building blocks that mirror the app's terminal/pixel
 * design language (indigo-tinted, mono, bordered). Each primitive maps 1:1 to
 * a real UI element so skeleton → content swaps cause zero layout shift.
 * ==========================================================================*/

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton-shimmer rounded bg-indigo-950/20", className)} aria-hidden />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonBadge({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-5 w-16 rounded", className)} />;
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-9 w-28 rounded", className)} />;
}

export function SkeletonPageHeader({
  subtitle = true,
  action,
}: {
  subtitle?: boolean;
  action?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        {subtitle && <Skeleton className="h-2.5 w-64" />}
      </div>
      {action && <SkeletonButton className="w-36" />}
    </div>
  );
}

export function SkeletonToolbar({ controls = 3 }: { controls?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3" aria-hidden>
      <Skeleton className="h-9 w-56 rounded" />
      {Array.from({ length: controls }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx("p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-3", className)}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2.5 w-40" />
    </div>
  );
}

export function SkeletonGrid({
  cards = 6,
  cols = "sm:grid-cols-2 lg:grid-cols-3",
  className,
}: {
  cards?: number;
  cols?: string;
  className?: string;
}) {
  return (
    <div className={clsx("grid grid-cols-1 gap-4", cols, className)} aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 p-4 rounded border border-indigo-900/40 bg-[#0a0a0a]/60"
        >
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ cols = 4, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded border border-indigo-900/40 bg-[#0a0a0a]/60" aria-hidden>
      <div className="flex items-center gap-4 border-b border-indigo-950/60 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-indigo-950/40 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={clsx("h-3", c === 0 ? "w-1/3" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMetrics({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPanels({ panels = 2, rows = 4 }: { panels?: number; rows?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-hidden>
      {Array.from({ length: panels }).map((_, i) => (
        <div key={i} className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <SkeletonList rows={rows} />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
 * Composed page skeletons
 * Full-page loaders that mirror each route's real container structure so the
 * skeleton → content swap never shifts the layout. Full-page skeletons expose
 * role="status" + a visually-hidden "Loading…" for screen readers.
 * ==========================================================================*/

function FullPageSkeleton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <FullPageSkeleton label="Loading dashboard">
      <SkeletonPageHeader action />
      <SkeletonMetrics cards={6} />
      <div className="border-t border-indigo-950/80 pt-6 space-y-6">
        <Skeleton className="h-3.5 w-64" />
        <SkeletonPanels panels={4} rows={3} />
      </div>
    </FullPageSkeleton>
  );
}

export function SkeletonSkills() {
  return (
    <FullPageSkeleton label="Loading skills">
      <SkeletonPageHeader action />
      <SkeletonToolbar controls={3} />
      <SkeletonGrid cards={6} />
    </FullPageSkeleton>
  );
}

export function SkeletonSkillDetail() {
  return (
    <FullPageSkeleton label="Loading skill">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <SkeletonButton />
          <SkeletonButton />
          <SkeletonButton />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonCard className="min-h-40" />
          <SkeletonCard className="min-h-40" />
        </div>
        <div className="space-y-4">
          <SkeletonCard className="min-h-32" />
          <SkeletonCard className="min-h-32" />
        </div>
      </div>
    </FullPageSkeleton>
  );
}

export function SkeletonSkillForm() {
  return (
    <FullPageSkeleton label="Loading skill form">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-10 w-full rounded" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
      <div className="p-5 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-32 w-full rounded" />
      </div>
      <SkeletonButton className="w-40" />
    </FullPageSkeleton>
  );
}

export function SkeletonVersions() {
  return (
    <FullPageSkeleton label="Loading versions">
      <SkeletonPageHeader />
      <SkeletonTable cols={4} rows={5} />
    </FullPageSkeleton>
  );
}

export function SkeletonExecutions() {
  return (
    <FullPageSkeleton label="Loading executions">
      <SkeletonPageHeader />
      <SkeletonToolbar controls={4} />
      <SkeletonTable cols={5} rows={7} />
    </FullPageSkeleton>
  );
}

export function SkeletonExecutionDetail() {
  return (
    <FullPageSkeleton label="Loading execution">
      <SkeletonPageHeader />
      <SkeletonMetrics cards={3} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard className="min-h-48" />
        <SkeletonCard className="min-h-48" />
      </div>
    </FullPageSkeleton>
  );
}

export function SkeletonReview() {
  return (
    <FullPageSkeleton label="Loading review queue">
      <SkeletonPageHeader />
      <SkeletonToolbar controls={2} />
      <SkeletonGrid cards={2} cols="lg:grid-cols-2" />
    </FullPageSkeleton>
  );
}

export function SkeletonHistory() {
  return (
    <FullPageSkeleton label="Loading history">
      <SkeletonPageHeader />
      <SkeletonMetrics cards={4} />
      <SkeletonTable cols={6} rows={7} />
    </FullPageSkeleton>
  );
}

export function SkeletonAudit() {
  return (
    <FullPageSkeleton label="Loading audit log">
      <SkeletonPageHeader />
      <SkeletonToolbar controls={2} />
      <SkeletonTable cols={4} rows={8} />
    </FullPageSkeleton>
  );
}

export function SkeletonCompare() {
  return (
    <FullPageSkeleton label="Loading comparison">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-10 rounded" />
        <Skeleton className="h-10 rounded" />
      </div>
      <SkeletonPanels panels={2} rows={6} />
    </FullPageSkeleton>
  );
}

export function SkeletonSettings() {
  return (
    <FullPageSkeleton label="Loading settings">
      <SkeletonPageHeader />
      <div className="space-y-6">
        <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <SkeletonText lines={2} />
        </div>
        <SkeletonCard className="min-h-32" />
        <SkeletonCard className="min-h-32" />
      </div>
    </FullPageSkeleton>
  );
}

export function SkeletonToolRegistry() {
  return (
    <FullPageSkeleton label="Loading tool registry">
      <SkeletonPageHeader />
      <SkeletonToolbar controls={2} />
      <SkeletonGrid cards={4} cols="sm:grid-cols-2 2xl:grid-cols-3" />
    </FullPageSkeleton>
  );
}

export function SkeletonToolDetail() {
  return (
    <FullPageSkeleton label="Loading tool details">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <SkeletonButton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonCard className="min-h-40" />
        <SkeletonCard className="min-h-40" />
        <SkeletonCard className="min-h-40" />
      </div>
      <SkeletonTable cols={5} rows={5} />
    </FullPageSkeleton>
  );
}
