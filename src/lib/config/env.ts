import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET must be set in production"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Bearer token external MCP clients (Cursor, Claude Desktop) present when
   * connecting to /api/mcp/sse. When unset, only Clerk-authenticated sessions
   * may connect.
   */
  MCP_ACCESS_TOKEN: z.string().optional(),
  COMPOSIO_API_KEY: z.string().optional(),
  ARCADE_API_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();

    // In production, crash immediately — a misconfigured deploy should never
    // silently serve requests with wrong/missing credentials.
    if (process.env.NODE_ENV === "production") {
      console.error("[FATAL] Invalid environment variables in production:");
      console.error(JSON.stringify(formatted, null, 2));
      process.exit(1);
    }

    // In development/test, log the error but fall back to defaults so local
    // dev still works without a full .env file.
    console.warn("[Config Warning] Some environment variables are missing or invalid:");
    console.warn(JSON.stringify(formatted, null, 2));

    // Re-parse with safe defaults for dev — NODE_ENV gets a default so it
    // won't fail, and optional keys are simply undefined.
    const fallback = envSchema.partial().parse({});
    return envSchema.parse({
      DATABASE_URL: fallback.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_studio?schema=public",
      NEXTAUTH_SECRET: fallback.NEXTAUTH_SECRET ?? "dev-only-secret-not-for-production",
    });
  }
  return result.data;
}

export const env = parseEnv();
