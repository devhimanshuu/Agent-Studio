import React from "react";

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 w-full animate-pulse p-4">
      <div className="h-8 bg-secondary/80 rounded-md w-1/3"></div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 bg-secondary/40 rounded-lg border border-border/40"></div>
        ))}
      </div>
    </div>
  );
}
