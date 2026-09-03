import { z } from "zod";

/**
 * Validation for inbound A2A protocol messages.
 *
 * Keeps the wire shape tight so a misconfigured client can't smuggle huge
 * prompts or non-text payloads into the LLM call and spike token spend.
 */

export const A2AMessageRoleSchema = z.enum(["agent", "user", "system", "mediator"]);

export const A2AMessageSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  sender: z.string().min(1).max(120),
  recipient: z.string().min(1).max(120).optional(),
  role: A2AMessageRoleSchema.default("agent"),
  content: z.string().min(1).max(8_000),
  turn: z.number().int().nonnegative().max(1000).optional(),
  timestamp: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type A2AMessagePayload = z.infer<typeof A2AMessageSchema>;