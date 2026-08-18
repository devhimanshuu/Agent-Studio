/** True when a query-string date parses to a real timestamp. Guards against
 * `new Date("garbage")` producing Invalid Date and bubbling into Prisma as a 500. */
export function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/** Formats a Date or ISO string into a concise human-readable string (e.g., 'Aug 16, 2026') */
export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

