import { describe, expect, it } from "vitest"
import { loadConfig } from "../src/config.js"
import { parseCommand, parseCommandMap, parseStringMap } from "../src/system/system-adapter.js"

describe("production configuration", () => {
  it("rejects development defaults", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow()
  })

  it("accepts an explicit hardened configuration", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      SESSION_SECRET: "a-secure-session-secret-with-32-chars",
      ADMIN_PASSWORD: "a-secure-admin-password",
      ADMIN_EMAIL: "admin@example.test",
      CORS_ORIGINS: "https://homelab.example.test",
      READ_AUTH_REQUIRED: "true",
      SYSTEM_ADAPTER: "local",
      SYSTEM_SERVICE_MAP: '{"docker-engine":"docker.service"}',
      NAS_SCRUB_COMMAND: '["zpool","scrub","pool-data"]',
      NAS_STATUS_COMMAND: '["nas-status"]',
      METRICS_TOKEN: "a-secure-metrics-token",
    })
    expect(config).toMatchObject({ nodeEnv: "production", readAuthRequired: true, systemAdapter: "local" })
  })
})

describe("system command configuration", () => {
  it("only accepts typed JSON mappings", () => {
    expect(parseStringMap('{"app":"app.service"}', "services")).toEqual({ app: "app.service" })
    expect(parseCommand('["tool","--safe"]', "tool")).toEqual(["tool", "--safe"])
    expect(parseCommandMap('{"scan":["scanner"]}', "tools")).toEqual({ scan: ["scanner"] })
    expect(() => parseCommandMap('{"scan":"scanner"}', "tools")).toThrow()
  })
})
