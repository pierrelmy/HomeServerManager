import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify"
import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import websocket from "@fastify/websocket"
import { ZodError, z } from "zod"
import type { AppConfig } from "./config.js"
import { EventHub } from "./events/event-hub.js"
import { SESSION_COOKIE, SessionStore, toAuthSession, type StoredSession } from "./auth/session-store.js"
import { InMemoryHomelabRepository } from "./repositories/homelab-repository.js"
import { HomelabService } from "./services/homelab-service.js"
import { HttpError, forbidden, unauthorized } from "./shared/errors.js"
import {
  authProviderSchema,
  realtimeCommandSchema,
  settingsPatchSchema,
  terminalExecuteSchema,
  type RealtimeEvent,
} from "./shared/contracts.js"

const sessionBodySchema = z.object({ provider: authProviderSchema }).strict()
const idParamsSchema = z.object({ id: z.string().min(1).max(200) })
const serviceActionParamsSchema = idParamsSchema.extend({ action: z.enum(["start", "stop", "restart"]) })
const imageActionParamsSchema = idParamsSchema.extend({ action: z.enum(["pull", "run"]) })

export interface AppDependencies {
  repository?: InMemoryHomelabRepository
  sessions?: SessionStore
  events?: EventHub
}

export interface BuiltApp {
  app: FastifyInstance
  repository: InMemoryHomelabRepository
  sessions: SessionStore
  events: EventHub
  service: HomelabService
}

export async function buildApp(config: AppConfig, dependencies: AppDependencies = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger: config.nodeEnv === "test" ? false : { level: config.logLevel },
    requestIdHeader: "x-request-id",
    disableRequestLogging: config.nodeEnv === "test",
  })
  const repository = dependencies.repository ?? new InMemoryHomelabRepository()
  const sessions = dependencies.sessions ?? new SessionStore()
  const events = dependencies.events ?? new EventHub()
  const service = new HomelabService(repository, events)

  await app.register(cookie, { secret: config.sessionSecret, hook: "onRequest" })
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(null, !origin || config.corsOrigins.includes(origin))
    },
  })
  await app.register(rateLimit, { global: false, max: 100, timeWindow: "1 minute" })
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

  app.addHook("onRequest", async (request) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method) || request.url === "/session") return
    const origin = request.headers.origin
    if (origin && !config.corsOrigins.includes(origin)) throw forbidden("Request origin is not allowed")
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
    request.log.error({ err: error }, "request failed")
    void reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: config.nodeEnv === "test" && error instanceof Error ? error.message : "An unexpected error occurred",
      requestId: request.id,
    })
  })

  app.get("/health", async () => ({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }))
  app.get("/ready", async () => ({ status: "ready" }))

  app.get("/session", async (request) => toAuthSession(getSession(request)))
  app.post("/session", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { provider } = sessionBodySchema.parse(request.body)
    const session = sessions.create(provider)
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
  app.get("/tools", { preHandler: readGuard }, async () => repository.getTools())
  app.get("/terminal", { preHandler: readGuard }, async () => repository.getTerminal())
  app.get("/account", { preHandler: readGuard }, async () => repository.getAccount())
  app.get("/settings", { preHandler: readGuard }, async (request) => repository.getSettings(getSession(request)?.userId ?? "public"))

  app.patch("/settings", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const patch = settingsPatchSchema.parse(request.body)
    const settings = service.updateSettings(session.userId, patch)
    repository.appendAudit({ sessionId: session.id, actor: session.displayName, action: "settings.update", resource: session.userId, outcome: "success" })
    events.sendToSession(session.id, { type: "settings.updated", settings })
    return settings
  })

  app.post("/services/:id/:action", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const { id, action } = serviceActionParamsSchema.parse(request.params)
    const value = service.actOnService(id, action)
    audit(repository, session, `service.${action}`, id)
    return value
  })

  app.post("/docker/containers/:id/:action", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const { id, action } = serviceActionParamsSchema.parse(request.params)
    const value = service.actOnContainer(id, action)
    audit(repository, session, `docker.container.${action}`, id)
    return value
  })

  app.post("/docker/images/:id/:action", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const { id, action } = imageActionParamsSchema.parse(request.params)
    const value = service.actOnImage(id, action)
    audit(repository, session, `docker.image.${action}`, id)
    return value
  })

  app.post("/nas/scrub", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const job = service.runNasScrub()
    audit(repository, session, "nas.scrub", "nas")
    return job
  })

  app.post("/terminal/execute", { preHandler: requireAdmin }, async (request, reply) => {
    const session = getSession(request)!
    const body = terminalExecuteSchema.parse(request.body)
    const result = service.executeTerminal(body.command, body.sessionId)
    audit(repository, session, "terminal.execute", body.command)
    return reply.status(201).send(result)
  })

  app.post("/tools/:id/run", { preHandler: requireAdmin }, async (request) => {
    const session = getSession(request)!
    const { id } = idParamsSchema.parse(request.params)
    const job = service.runTool(id)
    audit(repository, session, "tool.run", id)
    return job
  })

  app.get("/audit", { preHandler: requireAdmin }, async () => repository.listAudit())

  app.get("/live", { websocket: true, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, (socket, request) => {
    const origin = request.headers.origin
    if (origin && !config.corsOrigins.includes(origin)) {
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

    socket.on("message", (raw) => {
      try {
        const command = realtimeCommandSchema.parse(JSON.parse(raw.toString()))
        if (command.type === "terminal.execute") {
          if (!session || session.role !== "admin") throw forbidden()
          service.executeTerminal(command.command, command.sessionId)
          audit(repository, session, "terminal.execute", command.command)
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
    metricsTimer = setInterval(() => service.refreshOverview(), config.metricsIntervalMs)
    metricsTimer.unref()
  })
  app.addHook("onClose", async () => {
    if (metricsTimer) clearInterval(metricsTimer)
  })

  return { app, repository, sessions, events, service }
}

function audit(repository: InMemoryHomelabRepository, session: StoredSession, action: string, resource: string): void {
  repository.appendAudit({ sessionId: session.id, actor: session.displayName, action, resource, outcome: "success" })
}

function scopeBundle(scope: string, bundle: ReturnType<HomelabService["bundle"]>): Partial<ReturnType<HomelabService["bundle"]>> {
  if (scope === "all") return bundle
  return { [scope]: bundle[scope as keyof typeof bundle] }
}
