"use client";

import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";

export default function DashboardError({ error }: { error: Error }) {
  return (
    <div className="p-6">
      <ErrorBoundary fallback={null}>
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-center space-y-2">
          <h3 className="font-semibold text-foreground">Dashboard Error</h3>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </ErrorBoundary>
    </div>
  );
}
