import { InvalidInputError } from "@/modules/execution/executor/errors";

export const MAX_JSON_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1MB cap per JSON payload

/**
 * Calculates stringified byte size of a JSON payload and verifies it does not
 * exceed maximum size bounds (default 1MB).
 */
export function validateJsonByteSize(
  payload: unknown,
  maxBytes = MAX_JSON_PAYLOAD_BYTES,
  label = "Payload"
): void {
  if (payload === undefined || payload === null) return;

  try {
    const jsonString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const sizeInBytes = Buffer.byteLength(jsonString, "utf8");

    if (sizeInBytes > maxBytes) {
      const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
      throw new InvalidInputError(`${label} size exceeds maximum threshold of ${maxMb}MB`);
    }
  } catch (error) {
    if (error instanceof InvalidInputError) throw error;
    throw new InvalidInputError(`Failed to serialize ${label.toLowerCase()} for size validation`);
  }
}
