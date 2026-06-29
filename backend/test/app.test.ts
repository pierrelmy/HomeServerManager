import { afterEach, describe, expect, it } from "vitest"
import { WebSocket } from "ws"
import { buildApp, type BuiltApp } from "../src/app.js"
import type { AppConfig } from "../src/config.js"

const config: AppConfig = {
  host: "127.0.0.1",
  port: 3000,
  nodeEnv: "test",
  sessionSecret: "test-session-secret-with-more-than-32-characters",
  corsOrigins: ["http://localhost:5173"],
  logLevel: "silent",
  readAuthRequired: false,
  metricsIntervalMs: 60_000,
  databasePath: ":memory:",
  adminEmail: "admin@example.test",
  adminPassword: "test-password-1234",
  adminDisplayName: "Pierre Martin",
  systemAdapter: "simulation",
  systemServiceMap: "{}",
  nasScrubCommand: "[]",
  nasStatusCommand: "[]",
  toolCommands: "{}",
  metricsToken: "test-metrics-token-1234",
}

let built: BuiltApp | undefined

afterEach(async () => {
  if (built) await built.app.close()
  built = undefined
})

async function setup(): Promise<BuiltApp> {
  built = await buildApp(config)
  return built
}

async function login(instance: BuiltApp): Promise<string> {
  const response = await instance.app.inject({
    method: "POST",
    url: "/session",
    payload: { provider: "password", email: config.adminEmail, password: config.adminPassword },
  })
  expect(response.statusCode).toBe(200)
  const cookieHeader = response.headers["set-cookie"]
  if (!cookieHeader) throw new Error("Missing session cookie")
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
  return cookie!.split(";")[0]!
}

describe("homelab API", () => {
  it("returns health and all frontend snapshots", async () => {
    const instance = await setup()
    const paths = ["/health", "/ready", "/session", "/overview", "/services", "/docker", "/nas", "/tools", "/terminal", "/account", "/settings"]

    for (const path of paths) {
      const response = await instance.app.inject({ method: "GET", url: path })
      expect(response.statusCode, path).toBe(200)
    }
  })

  it("derives services and tools from local system configuration", async () => {
    built = await buildApp({
      ...config,
      systemAdapter: "local",
      systemServiceMap: '{"demo-service":"homelab-demo.service","docker-engine":"docker.service"}',
      nasScrubCommand: '["/usr/bin/true"]',
      nasStatusCommand: '["/usr/bin/printf","{\\"capacityUsed\\":\\"20 Go / 100 Go\\",\\"healthSummary\\":\\"OK\\",\\"backupSummary\\":\\"N/A\\",\\"temperatureSummary\\":\\"N/A\\",\\"pools\\":[],\\"backups\\":[],\\"drives\\":[]}"]',
      toolCommands: '{"scan-reseau":["/usr/bin/true"]}',
    })

    const servicesResponse = await built.app.inject({ method: "GET", url: "/services" })
    expect(servicesResponse.statusCode).toBe(200)
    expect(servicesResponse.json()).toEqual([
      expect.objectContaining({ id: "demo-service", label: "Demo Service", location: "homelab-demo.service", unit: "homelab-demo.service", servicePath: null }),
      expect.objectContaining({ id: "docker-engine", label: "Docker Engine", location: "docker.service", unit: "docker.service", servicePath: null }),
    ])

    const toolsResponse = await built.app.inject({ method: "GET", url: "/tools" })
    expect(toolsResponse.statusCode).toBe(200)
    expect(toolsResponse.json()).toMatchObject({
      tools: [
        {
          title: "Scan réseau",
          description: "Détecte les hôtes visibles et regroupe les ports courants.",
          tag: "Réseau",
        },
      ],
    })
  })

  it("creates and removes a signed session", async () => {
    const instance = await setup()
    const cookie = await login(instance)
    const current = await instance.app.inject({ method: "GET", url: "/session", headers: { cookie } })
    expect(current.json()).toMatchObject({ isAuthenticated: true, provider: "password", displayName: "Pierre Martin" })

    const logout = await instance.app.inject({ method: "DELETE", url: "/session", headers: { cookie } })
    expect(logout.json()).toEqual({ isAuthenticated: false, provider: null, displayName: null, email: null, role: null })
  })

  it("accepts alternate frontend origins in development mode", async () => {
    const instance = await setup()
    const response = await instance.app.inject({
      method: "OPTIONS",
      url: "/session",
      headers: {
        origin: "http://host-001.lan:5173",
        "access-control-request-method": "POST",
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers["access-control-allow-origin"]).toBe("http://host-001.lan:5173")
  })

  it("keeps origin checks strict in production", async () => {
    built = await buildApp({
      ...config,
      nodeEnv: "production",
      corsOrigins: ["https://homelab.example.test"],
    })

    const response = await built.app.inject({
      method: "OPTIONS",
      url: "/session",
      headers: {
        origin: "http://host-001.lan:5173",
        "access-control-request-method": "POST",
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("protects mutations and validates settings", async () => {
    const instance = await setup()
    const denied = await instance.app.inject({ method: "PATCH", url: "/settings", payload: { theme: "dark" } })
    expect(denied.statusCode).toBe(401)

    const cookie = await login(instance)
    const invalid = await instance.app.inject({ method: "PATCH", url: "/settings", headers: { cookie }, payload: { density: 200 } })
    expect(invalid.statusCode).toBe(400)

    const updated = await instance.app.inject({ method: "PATCH", url: "/settings", headers: { cookie }, payload: { theme: "dark", compactSidebar: true } })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({ theme: "dark", compactSidebar: true, density: 72 })
  })

  it("runs service actions and records an audit entry", async () => {
    const instance = await setup()
    instance.repository.saveService({
      id: "demo-service",
      label: "Demo Service",
      desc: "Service de test",
      location: "homelab-demo.service",
      unit: "homelab-demo.service",
      servicePath: null,
      status: "stopped",
      logs: [],
    })
    const cookie = await login(instance)
    const response = await instance.app.inject({ method: "POST", url: "/services/demo-service/start", headers: { cookie } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: "demo-service", status: "running" })

    const conflict = await instance.app.inject({ method: "POST", url: "/services/demo-service/start", headers: { cookie } })
    expect(conflict.statusCode).toBe(409)

    const audit = await instance.app.inject({ method: "GET", url: "/audit", headers: { cookie } })
    expect(audit.json()).toEqual(expect.arrayContaining([expect.objectContaining({ action: "service.start", resource: "demo-service" })]))
  })

  it("adds a service and persists its metadata", async () => {
    const instance = await setup()
    const cookie = await login(instance)
    const response = await instance.app.inject({
      method: "POST",
      url: "/services",
      headers: { cookie },
      payload: {
        label: "Ollama",
        description: "LLM local",
        serviceUnit: "ollama.service",
        servicePath: "/etc/systemd/system/ollama.service",
        startAfterInstall: false,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: "ollama",
      label: "Ollama",
      desc: "LLM local",
      unit: "ollama.service",
      servicePath: "/etc/systemd/system/ollama.service",
      status: "stopped",
    })

    const services = await instance.app.inject({ method: "GET", url: "/services" })
    expect(services.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ollama",
        unit: "ollama.service",
        servicePath: "/etc/systemd/system/ollama.service",
      }),
    ]))
  })

  it("only executes allowlisted terminal commands", async () => {
    const instance = await setup()
    const cookie = await login(instance)
    const rejected = await instance.app.inject({ method: "POST", url: "/terminal/execute", headers: { cookie }, payload: { command: "rm -rf /" } })
    expect(rejected.statusCode).toBe(409)

    const accepted = await instance.app.inject({ method: "POST", url: "/terminal/execute", headers: { cookie }, payload: { command: "uptime" } })
    expect(accepted.statusCode, accepted.body).toBe(201)
    expect(accepted.json()).toMatchObject({ sessionId: "terminal", line: { command: "uptime", status: "ok" } })

    const audit = await instance.app.inject({ method: "GET", url: "/audit", headers: { cookie } })
    expect(audit.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "terminal.execute", resource: "rm -rf /", outcome: "failure" }),
    ]))
  })

  it("rate-limits terminal command execution", async () => {
    const instance = await setup()
    const cookie = await login(instance)

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await instance.app.inject({
        method: "POST",
        url: "/terminal/execute",
        headers: { cookie },
        payload: { command: "uptime" },
      })
      expect(response.statusCode, `attempt ${attempt + 1}`).toBe(201)
    }

    const limited = await instance.app.inject({
      method: "POST",
      url: "/terminal/execute",
      headers: { cookie },
      payload: { command: "uptime" },
    })
    expect(limited.statusCode).toBe(429)
  })

  it("returns a client error when a local service command fails", async () => {
    built = await buildApp({
      ...config,
      systemAdapter: "local",
      systemServiceMap: '{"demo-service":"homelab-demo.service"}',
      nasScrubCommand: '["/usr/bin/true"]',
      nasStatusCommand: '["/usr/bin/printf","{\\"capacityUsed\\":\\"20 Go / 100 Go\\",\\"healthSummary\\":\\"OK\\",\\"backupSummary\\":\\"N/A\\",\\"temperatureSummary\\":\\"N/A\\",\\"pools\\":[],\\"backups\\":[],\\"drives\\":[]}"]',
      toolCommands: '{}',
    })
    built.repository.saveService({
      id: "demo-service",
      label: "Demo Service",
      desc: "Service de test",
      location: "homelab-demo.service",
      unit: "homelab-demo.service",
      servicePath: null,
      status: "stopped",
      logs: [],
    })
    const cookie = await login(built)
    const response = await built.app.inject({ method: "POST", url: "/services/demo-service/start", headers: { cookie } })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: "BAD_REQUEST" })
  })

  it("protects and exposes Prometheus metrics", async () => {
    const instance = await setup()
    const denied = await instance.app.inject({ method: "GET", url: "/metrics" })
    expect(denied.statusCode).toBe(401)

    const metrics = await instance.app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: `Bearer ${config.metricsToken}` },
    })
    expect(metrics.statusCode).toBe(200)
    expect(metrics.body).toContain("homelab_http_requests_total")
  })

  it("changes the password and rejects the previous credential", async () => {
    const instance = await setup()
    const cookie = await login(instance)
    const changed = await instance.app.inject({
      method: "PATCH",
      url: "/account/password",
      headers: { cookie },
      payload: { currentPassword: config.adminPassword, nextPassword: "a-new-strong-password" },
    })
    expect(changed.statusCode).toBe(200)

    const oldPassword = await instance.app.inject({
      method: "POST",
      url: "/session",
      payload: { provider: "password", email: config.adminEmail, password: config.adminPassword },
    })
    expect(oldPassword.statusCode).toBe(401)

    const newPassword = await instance.app.inject({
      method: "POST",
      url: "/session",
      payload: { provider: "password", email: config.adminEmail, password: "a-new-strong-password" },
    })
    expect(newPassword.statusCode).toBe(200)
  })

  it("syncs the bundle and executes commands over WebSocket", async () => {
    const instance = await setup()
    await instance.app.listen({ host: "127.0.0.1", port: 0 })
    const address = instance.app.server.address()
    if (!address || typeof address === "string") throw new Error("Missing server address")
    const cookie = await login(instance)
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/live`, { headers: { cookie } })

    const events: Array<Record<string, unknown>> = []
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket test timed out")), 3_000)
      socket.on("message", (raw) => {
        const event = JSON.parse(raw.toString()) as Record<string, unknown>
        events.push(event)
        if (event.type === "connection.status" && event.status === "connected") {
          socket.send(JSON.stringify({ type: "terminal.execute", command: "df -h" }))
        }
        if (event.type === "terminal.line.appended") {
          clearTimeout(timeout)
          resolve()
        }
      })
      socket.on("error", reject)
    })

    expect(events[0]).toMatchObject({ type: "bundle.synced", bundle: { session: { isAuthenticated: true } } })
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "terminal.line.appended" })]))
    socket.close()
  })
})
