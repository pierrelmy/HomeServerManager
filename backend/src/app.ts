import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify"
import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import websocket from "@fastify/websocket"
import { ZodError, z } from "zod"
import type { AppConfig } from "./config.js"
import { EventHub } from "./events/event-hub.js"
import { SESSION_COOKIE, SessionStore, toAuthSession, type StoredSession } from "./auth/session-store.js"
import { SqliteHomelabRepository, type HomelabRepository } from "./repositories/homelab-repository.js"
import { HomelabService } from "./services/homelab-service.js"
import { HttpError, forbidden, unauthorized } from "./shared/errors.js"
import { LocalSystemAdapter, SimulationSystemAdapter, parseCommand, parseCommandMap, parseStringMap } from "./system/system-adapter.js"
import {
  createServiceSchema,
  realtimeCommandSchema,
  settingsPatchSchema,
  terminalExecuteSchema,
  type RealtimeEvent,
} from "./shared/contracts.js"

const sessionBodySchema = z.object({
  provider: z.literal("password"),
  email: z.string().email().max(254),
  password: z.string().min(1).max(1_024),
}).strict()
const idParamsSchema = z.object({ id: z.string().min(1).max(200) })
const serviceActionParamsSchema = idParamsSchema.extend({ action: z.enum(["start", "stop", "restart"]) })
const imageActionParamsSchema = idParamsSchema.extend({ action: z.enum(["pull", "run"]) })
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(1_024),
  nextPassword: z.string().min(12).max(1_024),
}).strict()

export interface AppDependencies {
  repository?: HomelabRepository
  sessions?: SessionStore
  events?: EventHub
}

export interface BuiltApp {
  app: FastifyInstance
  repository: HomelabRepository
  sessions: SessionStore
  events: EventHub
  service: HomelabService
}

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin) return true
  if (config.corsOrigins.includes(origin)) return true
  if (config.nodeEnv === "production") return false

  try {
    const parsed = new URL(origin)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export async function buildApp(config: AppConfig, dependencies: AppDependencies = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger: config.nodeEnv === "test" ? false : { level: config.logLevel },
    requestIdHeader: "x-request-id",
    disableRequestLogging: config.nodeEnv === "test",
  })
  const repository = dependencies.repository ?? new SqliteHomelabRepository(config.databasePath)
  const sessions = dependencies.sessions ?? new SessionStore({
    databasePath: config.databasePath,
    adminEmail: config.adminEmail,
    adminPassword: config.adminPassword,
    adminDisplayName: config.adminDisplayName,
    syncAdminOnBoot: config.nodeEnv !== "production",
  })
  const events = dependencies.events ?? new EventHub()
  const serviceMap = parseStringMap(config.systemServiceMap, "SYSTEM_SERVICE_MAP")
  const nasScrubCommand = parseCommand(config.nasScrubCommand, "NAS_SCRUB_COMMAND")
  const nasStatusCommand = parseCommand(config.nasStatusCommand, "NAS_STATUS_COMMAND")
  const toolCommands = parseCommandMap(config.toolCommands, "TOOL_COMMANDS")
  const system = config.systemAdapter === "local"
    ? new LocalSystemAdapter({
        serviceMap,
        nasScrubCommand,
        nasStatusCommand,
        toolCommands,
      })
    : new SimulationSystemAdapter()
  const service = new HomelabService(repository, events, system)
  service.configureLocalTargets(serviceMap, toolCommands)

  await app.register(cookie, { secret: config.sessionSecret, hook: "onRequest" })
  await app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin, config))
    },
  })
  await app.register(rateLimit, { global: true, max: 100, timeWindow: "1 minute" })
  await app.register(websocket, { options: { maxPayload: 16 * 1_024 } })

  const getSession = (request: FastifyRequest): StoredSession | undefined => {
    const raw = request.cookies[SESSION_COOKIE]
    if (!raw) return undefined
    const unsigned = app.unsignCookie(raw)
    return unsigned.valid ? sessions.get(unsigned.value) : undefined
  }

  const requireSession = async (request: FastifyRequest): Promise<void> => {
    if (!getSession(request)) throw unauthorized()
  }

  const requireAdmin = async (request: FastifyRequest): Promise<void> => {
    const session = getSession(request)
    if (!session) throw unauthorized()
    if (session.role !== "admin") throw forbidden()
  }

  const readGuard = async (request: FastifyRequest): Promise<void> => {
    if (config.readAuthRequired) await requireSession(request)
  }

  const requestCounts = new Map<string, number>()
  const websocketTerminalLimits = new Map<string, { count: number; windowStartedAt: number }>()
  let systemReady = config.systemAdapter !== "local"
  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? "unknown"
    const key = `${request.method}|${route}|${reply.statusCode}`
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1)
  })

  app.addHook("onSend", async (_request, reply) => {
    void reply.header("X-Content-Type-Options", "nosniff")
    void reply.header("X-Frame-Options", "DENY")
    void reply.header("Referrer-Policy", "no-referrer")
    void reply.header("Cache-Control", "no-store")
  })

  app.addHook("onRequest", async (request) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method) || request.url === "/session") return
    const origin = request.headers.origin
    if (!isAllowedOrigin(origin, config)) throw forbidden("Request origin is not allowed")
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({ error: "VALIDATION_ERROR", message: "Request validation failed", issues: error.issues, requestId: request.id })
      return
    }
    if (error instanceof HttpError) {
      void reply.status(error.statusCode).send({ error: error.code, message: error.message, requestId: request.id })
      return
    }
    if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      void reply.status(error.statusCode).send({
        error: "code" in error && typeof error.code === "string" ? error.code : "REQUEST_ERROR",
        message: error.message,
        requestId: request.id,
      })
      return
    }
    request.log.error({ err: error }, "request failed")
    void reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: config.nodeEnv === "test" && error instanceof Error ? error.message : "An unexpected error occurred",
      requestId: request.id,
    })
  })

  app.get("/health", async () => ({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }))
  app.get("/ready", async (_request, reply) => {
    try {
      repository.ping?.()
      sessions.ping()
      if (!systemReady) throw new Error("System adapter is not ready")
      return { status: "ready" }
    } catch {
      return reply.status(503).send({ status: "not-ready" })
    }
  })
  app.get("/metrics", async (request, reply) => {
    if (request.headers.authorization !== `Bearer ${config.metricsToken}`) throw unauthorized()
    const lines = [
      "# HELP homelab_uptime_seconds Process uptime in seconds",
      "# TYPE homelab_uptime_seconds gauge",
      `homelab_uptime_seconds ${Math.floor(process.uptime())}`,
      "# HELP homelab_websocket_connections Active WebSocket connections",
      "# TYPE homelab_websocket_connections gauge",
      `homelab_websocket_connections ${events.size}`,
      "# HELP homelab_system_adapter_ready System adapter readiness",
      "# TYPE homelab_system_adapter_ready gauge",
      `homelab_system_adapter_ready ${systemReady ? 1 : 0}`,
      "# HELP homelab_http_requests_total HTTP requests handled",
      "# TYPE homelab_http_requests_total counter",
    ]
    for (const [key, count] of requestCounts) {
      const [method, route, status] = key.split("|")
      lines.push(`homelab_http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`)
    }
    return reply.type("text/plain; version=0.0.4").send(`${lines.join("\n")}\n`)
  })

  app.get("/session", async (request) => toAuthSession(getSession(request)))
  app.post("/session", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { provider, email, password } = sessionBodySchema.parse(request.body)
    const session = sessions.authenticatePassword(email, password)
    if (!session) throw unauthorized("Invalid email or password")
    reply.setCookie(SESSION_COOKIE, session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: config.nodeEnv === "production",
      signed: true,
      maxAge: 24 * 60 * 60,
    })
    repository.appendAudit({ sessionId: session.id, actor: session.displayName, action: "session.login", resource: provider, outcome: "success" })
    events.sendToSession(session.id, { type: "session.updated", session: toAuthSession(session) })
    return toAuthSession(session)
  })
  app.delete("/session", async (request, reply) => {
    const session = getSession(request)
    if (session) repository.appendAudit({ sessionId: session.id, actor: session.displayName, action: "session.logout", resource: session.provider, outcome: "success" })
    sessions.delete(session?.id)
    reply.clearCookie(SESSION_COOKIE, { path: "/" })
    return toAuthSession(undefined)
  })

  app.get("/overview", { preHandler: readGuard }, async () => repository.getOverview())
  app.get("/services", { preHandler: readGuard }, async () => repository.listServices())
  app.get("/docker", { preHandler: readGuard }, async () => repository.getDocker())
  app.get("/nas", { preHandler: readGuard }, async () => repository.getNas())
  app.get("/tools", { preHandler: readGuard }, async () => service.getToolsSnapshot())
  app.get("/terminal", { preHandler: readGuard }, async () => repository.getTerminal())
  app.get("/account", { preHandler: readGuard }, async (request) => {
    const session = getSession(request)
    const account = repository.getAccount()
    if (!session) return account
    return {
      ...account,
      name: session.displayName,
      email: session.email,
      role: session.role === "admin" ? "Administrateur" : "Lecture seule",
      providers: [{ name: "Password", connected: true }],
      sshKeys: [],
      sessions: sessions.listUserSessions(session.userId).map((item) => ({
        device: item.id === session.id ? "Session actuelle" : `Session ${item.id.slice(0, 8)}`,
        status: item.id === session.id ? "Active" as const : "Idle" as const,
        lastSeen: `Expire le ${new Date(item.expiresAt).toLocaleString("fr-FR")}`,
      })),
    }
  })
  app.patch("/account/password", { preHandler: requireSession }, async (request) => {
    const session = getSession(request)!
    const body = passwordChangeSchema.parse(request.body)
    return audited(repository, session, "account.password.update", session.userId, async () => {
      if (!sessions.changePassword(session.userId, body.currentPassword, body.nextPassword, session.id)) {
        throw unauthorized("Current password is invalid")
      }
      return { success: true }
    })
  })
  app.get("/settings", { preHandler: readGuard }, async (request) => repository.getSettings(getSession(request)?.userId ?? "public"))

  app.patch("/settings", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const patch = settingsPatchSchema.parse(request.body)
    const settings = service.updateSettings(session.userId, patch)
    repository.appendAudit({ sessionId: session.id, actor: session.displayName, action: "settings.update", resource: session.userId, outcome: "success" })
    events.sendToSession(session.id, { type: "settings.updated", settings })
    return settings
  })

  app.post("/services", { preHandler: requireAdmin, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const body = createServiceSchema.parse(request.body)
    return audited(repository, session, "service.add", body.serviceUnit, () => service.addService(body))
  })

  app.post("/services/refresh", { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    return audited(repository, session, "services.refresh", "services", () => service.refreshServices())
  })

  app.post("/services/:id/logs/refresh", { preHandler: requireAdmin, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const { id } = idParamsSchema.parse(request.params)
    return audited(repository, session, "service.logs.refresh", id, () => service.refreshServiceLogs(id))
  })

  app.post("/services/:id/:action", { preHandler: requireAdmin, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const { id, action } = serviceActionParamsSchema.parse(request.params)
    return audited(repository, session, `service.${action}`, id, () => service.actOnService(id, action))
  })

  app.post("/docker/containers/:id/:action", { preHandler: requireAdmin, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const { id, action } = serviceActionParamsSchema.parse(request.params)
    return audited(repository, session, `docker.container.${action}`, id, () => service.actOnContainer(id, action))
  })

  app.post("/docker/images/:id/:action", { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const { id, action } = imageActionParamsSchema.parse(request.params)
    return audited(repository, session, `docker.image.${action}`, id, () => service.actOnImage(id, action))
  })

  app.post("/nas/scrub", { preHandler: requireAdmin, config: { rateLimit: { max: 2, timeWindow: "1 hour" } } }, async (request) => {
    const session = getSession(request)!
    return audited(repository, session, "nas.scrub", "nas", () => service.runNasScrub())
  })

  app.post("/terminal/execute", { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const session = getSession(request)!
    const body = terminalExecuteSchema.parse(request.body)
    const result = await audited(repository, session, "terminal.execute", body.command, () => service.executeTerminal(body.command, body.sessionId))
    return reply.status(201).send(result)
  })

  app.post("/terminal/sessions/:id/clear", { preHandler: requireAdmin, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const { id } = idParamsSchema.parse(request.params)
    return audited(repository, session, "terminal.clear", id, () => service.clearTerminalSession(id))
  })

  app.post("/tools/:id/run", { preHandler: requireAdmin, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request) => {
    const session = getSession(request)!
    const { id } = idParamsSchema.parse(request.params)
    return audited(repository, session, "tool.run", id, () => service.runTool(id))
  })

  app.get("/audit", { preHandler: requireAdmin }, async () => repository.listAudit())

  app.get("/live", { websocket: true, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, (socket, request) => {
    const origin = request.headers.origin
    if (!isAllowedOrigin(origin, config)) {
      socket.close(1008, "Origin is not allowed")
      return
    }
    const session = getSession(request)
    if (config.readAuthRequired && !session) {
      socket.close(1008, "Authentication required")
      return
    }
    const remove = events.add(socket, session?.id)
    const bundle = service.bundle(session?.userId ?? "public")
    bundle.session = toAuthSession(session)
    socket.send(JSON.stringify({ type: "bundle.synced", bundle } satisfies RealtimeEvent))
    socket.send(JSON.stringify({ type: "connection.status", status: "connected" } satisfies RealtimeEvent))

    socket.on("message", async (raw) => {
      try {
        const command = realtimeCommandSchema.parse(JSON.parse(raw.toString()))
        if (command.type === "terminal.execute") {
          if (!session || session.role !== "admin") throw forbidden()
          if (!consumeFixedWindow(websocketTerminalLimits, session.id, 10, 60_000)) {
            throw new HttpError(429, "Terminal command rate limit exceeded", "RATE_LIMITED")
          }
          await audited(repository, session, "terminal.execute", command.command, () => service.executeTerminal(command.command, command.sessionId))
          return
        }
        const nextBundle = scopeBundle(command.scope, service.bundle(session?.userId ?? "public"))
        if (command.scope === "all" || command.scope === "session") nextBundle.session = toAuthSession(session)
        socket.send(JSON.stringify({ type: "bundle.synced", bundle: nextBundle } satisfies RealtimeEvent))
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid WebSocket command"
        socket.send(JSON.stringify({ type: "connection.status", status: "error", error: message } satisfies RealtimeEvent))
      }
    })
    socket.on("close", remove)
  })

  let metricsTimer: NodeJS.Timeout | undefined
  app.addHook("onReady", async () => {
    const refresh = async () => {
      const errors = await service.refreshSystemState()
      systemReady = errors.length === 0
      for (const error of errors) app.log.error({ err: error }, "system state refresh failed")
    }
    await refresh()
    metricsTimer = setInterval(() => void refresh(), config.metricsIntervalMs)
    metricsTimer.unref()
  })
  app.addHook("onClose", async () => {
    if (metricsTimer) clearInterval(metricsTimer)
    repository.close?.()
    sessions.close()
  })

  return { app, repository, sessions, events, service }
}

function audit(repository: HomelabRepository, session: StoredSession, action: string, resource: string): void {
  repository.appendAudit({ sessionId: session.id, actor: session.displayName, action, resource, outcome: "success" })
}

async function audited<T>(
  repository: HomelabRepository,
  session: StoredSession,
  action: string,
  resource: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const result = await operation()
    audit(repository, session, action, resource)
    return result
  } catch (error) {
    repository.appendAudit({ sessionId: session.id, actor: session.displayName, action, resource, outcome: "failure" })
    throw error
  }
}

function scopeBundle(scope: string, bundle: ReturnType<HomelabService["bundle"]>): Partial<ReturnType<HomelabService["bundle"]>> {
  if (scope === "all") return bundle
  return { [scope]: bundle[scope as keyof typeof bundle] }
}

function consumeFixedWindow(
  limits: Map<string, { count: number; windowStartedAt: number }>,
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const current = limits.get(key)
  if (!current || now - current.windowStartedAt >= windowMs) {
    limits.set(key, { count: 1, windowStartedAt: now })
    return true
  }
  if (current.count >= max) return false
  current.count += 1
  return true
}
