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
  const response = await instance.app.inject({ method: "POST", url: "/session", payload: { provider: "password" } })
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

  it("creates and removes a signed session", async () => {
    const instance = await setup()
    const cookie = await login(instance)
    const current = await instance.app.inject({ method: "GET", url: "/session", headers: { cookie } })
    expect(current.json()).toMatchObject({ isAuthenticated: true, provider: "password", displayName: "Pierre Martin" })

    const logout = await instance.app.inject({ method: "DELETE", url: "/session", headers: { cookie } })
    expect(logout.json()).toEqual({ isAuthenticated: false, provider: null, displayName: null })
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
    const cookie = await login(instance)
    const response = await instance.app.inject({ method: "POST", url: "/services/jenkins/start", headers: { cookie } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: "jenkins", status: "running" })

    const conflict = await instance.app.inject({ method: "POST", url: "/services/jenkins/start", headers: { cookie } })
    expect(conflict.statusCode).toBe(409)

    const audit = await instance.app.inject({ method: "GET", url: "/audit", headers: { cookie } })
    expect(audit.json()).toEqual(expect.arrayContaining([expect.objectContaining({ action: "service.start", resource: "jenkins" })]))
  })

  it("only executes allowlisted terminal commands", async () => {
    const instance = await setup()
    const cookie = await login(instance)
    const rejected = await instance.app.inject({ method: "POST", url: "/terminal/execute", headers: { cookie }, payload: { command: "rm -rf /" } })
    expect(rejected.statusCode).toBe(409)

    const accepted = await instance.app.inject({ method: "POST", url: "/terminal/execute", headers: { cookie }, payload: { command: "uptime" } })
    expect(accepted.statusCode, accepted.body).toBe(201)
    expect(accepted.json()).toMatchObject({ sessionId: "local-shell", line: { command: "uptime", status: "ok" } })
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
