/**
 * Prisma JSON column type helpers.
 *
 * Prisma's generated types expose Json as `Prisma.InputJsonValue` for writes
 * and `Prisma.JsonValue` for reads, but neither aligns cleanly with the
 * TypeScript types our domain layer uses (Record<string, unknown>, arrays, etc.).
 *
 * These helpers provide a single, documented cast point instead of scattering
 * `as unknown as Prisma.InputJsonValue` throughout repository code.
 */

import { Prisma } from "@prisma/client";

/**
 * Cast a domain value to Prisma's JSON input type for write operations.
 * Use this when passing domain objects (schemas, configs, arrays) to Prisma
 * create/update calls.
 *
 * @example
 * ```ts
 * await tx.skillVersion.create({
 *   data: {
 *     inputSchema: jsonInput(input.inputSchema),
 *     examples: jsonInput(input.examples),
 *   },
 * });
 * ```
 */
export function jsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * Cast a Prisma JSON column read to a specific domain type.
 * Use this when reading Json columns from Prisma and you know the shape.
 *
 * @example
 * ```ts
 * const schema = jsonOutput<Record<string, unknown>>(version.inputSchema);
 * ```
 */
export function jsonOutput<T>(value: unknown): T {
  return value as T;
}

/**
 * Cast a value to Prisma.InputJsonValue, handling null → DbNull conversion.
 * Use this for optional JSON fields where null means "clear the field".
 *
 * @example
 * ```ts
 * await tx.skillVersion.update({
 *   data: {
 *     approvalPolicy: jsonOrNull(input.approvalPolicy),
 *     graphDefinition: jsonOrNull(input.graphDefinition),
 *   },
 * });
 * ```
 */
export function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as unknown as Prisma.InputJsonValue);
}
