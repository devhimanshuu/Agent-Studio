import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/agent_studio?schema=public"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXTAUTH_SECRET: z.string().default("dev-secret-key-change-in-production"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
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
    console.error("[Config Error] Invalid environment variables:", result.error.format());
    return envSchema.parse({});
  }
  return result.data;
}

export const env = parseEnv();
