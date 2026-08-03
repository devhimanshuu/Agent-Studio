/** True when a query-string date parses to a real timestamp. Guards against
 * `new Date("garbage")` producing Invalid Date and bubbling into Prisma as a 500. */
export function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
