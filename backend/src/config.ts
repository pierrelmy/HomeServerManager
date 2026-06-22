import { z } from "zod"

const environmentSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(32).default("development-only-session-secret-change-me"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  READ_AUTH_REQUIRED: z.string().default("false").transform((value) => value === "true"),
  METRICS_INTERVAL_MS: z.coerce.number().int().min(1_000).default(5_000),
})

export interface AppConfig {
  host: string
  port: number
  nodeEnv: "development" | "test" | "production"
  sessionSecret: string
  corsOrigins: string[]
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
  readAuthRequired: boolean
  metricsIntervalMs: number
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment)

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    sessionSecret: parsed.SESSION_SECRET,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    logLevel: parsed.LOG_LEVEL,
    readAuthRequired: parsed.READ_AUTH_REQUIRED,
    metricsIntervalMs: parsed.METRICS_INTERVAL_MS,
  }
}
