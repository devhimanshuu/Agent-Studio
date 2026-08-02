import pino from "pino";
import { env } from "@/lib/config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  browser: {
    asObject: true,
  },
  base: {
    env: env.NODE_ENV,
    service: "agent-studio",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
