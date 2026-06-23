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
  DATABASE_PATH: z.string().min(1).default("./data/homelab.db"),
  ADMIN_EMAIL: z.string().email().default("admin@localhost.test"),
  ADMIN_PASSWORD: z.string().min(12).default("development-password"),
  ADMIN_DISPLAY_NAME: z.string().min(1).max(100).default("Homelab Admin"),
  SYSTEM_ADAPTER: z.enum(["simulation", "local"]).default("simulation"),
  SYSTEM_SERVICE_MAP: z.string().default("{}"),
  NAS_SCRUB_COMMAND: z.string().default("[]"),
  NAS_STATUS_COMMAND: z.string().default("[]"),
  TOOL_COMMANDS: z.string().default("{}"),
  METRICS_TOKEN: z.string().min(16).default("development-metrics-token"),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && value.SESSION_SECRET === "development-only-session-secret-change-me") {
    context.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "SESSION_SECRET must be changed in production" })
  }
  if (value.NODE_ENV === "production" && value.ADMIN_PASSWORD === "development-password") {
    context.addIssue({ code: "custom", path: ["ADMIN_PASSWORD"], message: "ADMIN_PASSWORD must be changed in production" })
  }
  if (value.NODE_ENV === "production" && value.SYSTEM_ADAPTER !== "local") {
    context.addIssue({ code: "custom", path: ["SYSTEM_ADAPTER"], message: "SYSTEM_ADAPTER must be local in production" })
  }
  if (value.NODE_ENV === "production" && [value.SYSTEM_SERVICE_MAP, value.NAS_SCRUB_COMMAND, value.NAS_STATUS_COMMAND].includes("{}")) {
    context.addIssue({ code: "custom", path: ["SYSTEM_ADAPTER"], message: "System command mappings must be configured in production" })
  }
  if (value.NODE_ENV === "production" && [value.NAS_SCRUB_COMMAND, value.NAS_STATUS_COMMAND].includes("[]")) {
    context.addIssue({ code: "custom", path: ["SYSTEM_ADAPTER"], message: "NAS commands must be configured in production" })
  }
  if (value.NODE_ENV === "production" && value.METRICS_TOKEN === "development-metrics-token") {
    context.addIssue({ code: "custom", path: ["METRICS_TOKEN"], message: "METRICS_TOKEN must be changed in production" })
  }
  if (value.NODE_ENV === "production" && !value.READ_AUTH_REQUIRED) {
    context.addIssue({ code: "custom", path: ["READ_AUTH_REQUIRED"], message: "READ_AUTH_REQUIRED must be true in production" })
  }
  if (value.NODE_ENV === "production" && value.CORS_ORIGINS.includes("localhost")) {
    context.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "CORS_ORIGINS must use the production origin" })
  }
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
  databasePath: string
  adminEmail: string
  adminPassword: string
  adminDisplayName: string
  systemAdapter: "simulation" | "local"
  systemServiceMap: string
  nasScrubCommand: string
  nasStatusCommand: string
  toolCommands: string
  metricsToken: string
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
    databasePath: parsed.DATABASE_PATH,
    adminEmail: parsed.ADMIN_EMAIL,
    adminPassword: parsed.ADMIN_PASSWORD,
    adminDisplayName: parsed.ADMIN_DISPLAY_NAME,
    systemAdapter: parsed.SYSTEM_ADAPTER,
    systemServiceMap: parsed.SYSTEM_SERVICE_MAP,
    nasScrubCommand: parsed.NAS_SCRUB_COMMAND,
    nasStatusCommand: parsed.NAS_STATUS_COMMAND,
    toolCommands: parsed.TOOL_COMMANDS,
    metricsToken: parsed.METRICS_TOKEN,
  }
}
