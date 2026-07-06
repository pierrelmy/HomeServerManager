import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { hostname, loadavg, uptime } from "node:os"
import type { EventHub } from "../events/event-hub.js"
import type { HomelabRepository } from "../repositories/homelab-repository.js"
import type {
  CreateServiceInput,
  HomelabLiveBundle,
  ServiceRecord,
  SettingsState,
  TerminalLine,
  TerminalSnapshot,
  ToolsSnapshot,
  UpdateStatus,
} from "../shared/contracts.js"
import { conflict, notFound } from "../shared/errors.js"
import type { SystemAdapter } from "../system/system-adapter.js"

function timeStamp(): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())
}

function relativeDate(): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date())
}

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function systemUptime(): number {
  try {
    return uptime()
  } catch {
    return process.uptime()
  }
}

const knownServiceMetadata: Record<string, { label: string; desc: string; webUrl?: string }> = {
  ollama: { label: "Ollama", desc: "Service LLM local", webUrl: "http://127.0.0.1:11434" },
  jenkins: { label: "Jenkins", desc: "Intégration continue", webUrl: "http://127.0.0.1:8080" },
  "docker-engine": { label: "Docker Engine", desc: "Moteur de conteneurs" },
  "demo-service": { label: "Demo Service", desc: "Service systemd de test" },
}

const knownToolMetadata: Record<string, { title: string; description: string; tag: string }> = {
  "scan-reseau": {
    title: "Scan réseau",
    description: "Détecte les hôtes visibles et regroupe les ports courants.",
    tag: "Réseau",
  },
  "audit-docker": {
    title: "Audit Docker",
    description: "Passe en revue les conteneurs, images inutilisées et volumes orphelins.",
    tag: "Conteneurs",
  },
  "export-logs": {
    title: "Export logs",
    description: "Récupère un paquet de logs pour dépannage ou archivage.",
    tag: "Support",
  },
  "verif-sauvegardes": {
    title: "Vérif. sauvegardes",
    description: "Compare les dernières archives avec les checksums attendus.",
    tag: "Backups",
  },
  "refresh-index": {
    title: "Refresh index",
    description: "Reconstruit les métadonnées visibles dans le tableau de bord.",
    tag: "Index",
  },
  "rapport-sante": {
    title: "Rapport santé",
    description: "Compile un état synthétique des alertes et des tendances.",
    tag: "Synthèse",
  },
  "update-hsm": {
    title: "Update HSM",
    description: "Lance le script de mise à jour, rebuild et redémarrage des services.",
    tag: "Maintenance",
  },
}

const UPDATE_STATUS_PATH = "/var/lib/homeservermanager/update-hsm-status.json"

function idleUpdateStatus(): UpdateStatus {
  return {
    status: "idle",
    currentStep: 0,
    totalSteps: 0,
    stepLabel: "",
    startedAt: null,
    updatedAt: null,
    finishedAt: null,
    revision: null,
    error: null,
  }
}

function humanizeId(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export class HomelabService {
  constructor(
    private readonly repository: HomelabRepository,
    private readonly events: EventHub,
    private readonly system: SystemAdapter,
  ) {}

  bundle(ownerId = "public"): HomelabLiveBundle {
    return {
      session: null,
      overview: this.repository.getOverview(),
      services: this.repository.listServices(),
      docker: this.repository.getDocker(),
      nas: this.repository.getNas(),
      tools: this.getToolsSnapshot(),
      account: this.repository.getAccount(),
      settings: this.repository.getSettings(ownerId),
      terminal: this.repository.getTerminal(),
    }
  }

  configureLocalTargets(serviceMap: Record<string, string>, toolCommands: Record<string, string[]>): void {
    if (this.system.mode !== "local") return

    const existingServices = new Map(this.repository.listServices().map((service) => [service.id, service]))
    const configuredServices = Object.entries(serviceMap).map(([id, unit]) => {
      const existing = existingServices.get(id)
      const metadata = knownServiceMetadata[id]
      this.system.registerService(id, unit)
      return {
        id,
        label: metadata?.label ?? humanizeId(id),
        desc: metadata?.desc ?? `Service mappé vers ${unit}`,
        location: unit,
        unit,
        servicePath: existing?.servicePath ?? null,
        webUrl: existing?.webUrl ?? metadata?.webUrl ?? null,
        status: existing?.status ?? "stopped",
        logs: existing?.logs ?? [],
      } satisfies ServiceRecord
    })
    const dynamicServices = this.repository.listServices()
      .filter((service) => !serviceMap[service.id] && service.unit.trim() !== "")
      .map((service) => {
        this.system.registerService(service.id, service.unit)
        return service
      })
    this.repository.replaceServices([...configuredServices, ...dynamicServices])

    const currentTools = this.getToolsSnapshot()
    const nextTools = {
      ...currentTools,
      tools: Object.keys(toolCommands).map((id) => {
        const metadata = knownToolMetadata[id]
        return {
          id,
          title: metadata?.title ?? humanizeId(id),
          description: metadata?.description ?? `Commande locale configurée pour ${id}.`,
          tag: metadata?.tag ?? "Support",
        }
      }),
    }
    this.repository.saveTools(nextTools)
  }

  refreshOverview(): void {
    const overview = this.repository.getOverview()
    const cpuPercent = Math.min(100, Math.round((loadavg()[0] ?? 0) * 25))
    const uptimeHours = Math.floor(systemUptime() / 3_600)
    const days = Math.floor(uptimeHours / 24)
    overview.hostName = hostname()
    overview.uptime = `${days}j ${uptimeHours % 24}h`
    const cpu = overview.metrics[0]
    if (cpu) {
      cpu.value = `${cpuPercent}%`
      cpu.points = [...cpu.points.slice(-23), cpuPercent]
    }
    this.repository.setOverview(overview)
    this.events.broadcast({ type: "overview.updated", overview })
  }

  async refreshSystemState(): Promise<Error[]> {
    this.refreshOverview()
    if (this.system.mode !== "local") return []
    this.syncUpdateStatus()

    const results = await Promise.allSettled([
      this.system.collectOverview(this.repository.getOverview()),
      this.system.collectServices(this.repository.listServices()),
      this.system.collectDocker(),
      this.system.collectNas(),
    ])
    const [overviewResult, servicesResult, dockerResult, nasResult] = results
    if (overviewResult?.status === "fulfilled" && overviewResult.value) {
      this.repository.setOverview(overviewResult.value)
      this.events.broadcast({ type: "overview.updated", overview: overviewResult.value })
    }
    if (servicesResult?.status === "fulfilled" && servicesResult.value) {
      for (const service of servicesResult.value) this.repository.saveService(service)
      this.events.broadcast({ type: "services.updated", services: servicesResult.value })
    }
    if (dockerResult?.status === "fulfilled" && dockerResult.value) {
      this.repository.saveDocker(dockerResult.value)
      this.events.broadcast({ type: "docker.updated", docker: dockerResult.value })
    } else if (dockerResult?.status === "rejected") {
      const error = dockerResult.reason instanceof Error ? dockerResult.reason.message : String(dockerResult.reason)
      const failedDockerSnapshot = {
        containers: [],
        images: [],
        volumes: [],
        error,
      }
      this.repository.saveDocker(failedDockerSnapshot)
      this.events.broadcast({ type: "docker.updated", docker: failedDockerSnapshot })
    }
    if (nasResult?.status === "fulfilled" && nasResult.value) {
      this.repository.saveNas(nasResult.value)
      this.events.broadcast({ type: "nas.updated", nas: nasResult.value })
    }
    return results.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason : new Error(String(result.reason))]
      : [])
  }

  async refreshServices(): Promise<ServiceRecord[]> {
    const nextServices = await this.system.collectServices(this.repository.listServices()) ?? this.repository.listServices()
    for (const service of nextServices) {
      this.repository.saveService(service)
      this.events.broadcast({ type: "service.updated", service })
    }
    this.events.broadcast({ type: "services.updated", services: nextServices })
    return nextServices
  }

  async refreshServiceLogs(id: string): Promise<ServiceRecord> {
    const service = this.repository.getService(id)
    if (!service) throw notFound(`Unknown service: ${id}`)
    const logs = await this.system.collectServiceLogs(id, 50)
    if (logs) {
      service.logs = logs
      this.repository.saveService(service)
      this.events.broadcast({ type: "service.updated", service })
    }
    return service
  }

  updateSettings(ownerId: string, patch: Partial<SettingsState>): SettingsState {
    const settings = { ...this.repository.getSettings(ownerId), ...patch }
    this.repository.saveSettings(ownerId, settings)
    return settings
  }

  async actOnService(id: string, action: "start" | "stop" | "restart"): Promise<ServiceRecord> {
    const service = this.repository.getService(id)
    if (!service) throw notFound(`Unknown service: ${id}`)
    if (action === "start" && !["stopped", "failed"].includes(service.status)) throw conflict(`Service ${id} cannot be started from ${service.status}`)
    if (action === "stop" && !["starting", "running"].includes(service.status)) throw conflict(`Service ${id} cannot be stopped from ${service.status}`)
    if (action === "restart" && service.status === "stopped") throw conflict(`Stopped service ${id} cannot be restarted`)

    await this.system.actOnService(id, action)
    service.status = action === "stop" ? "stopped" : "running"
    const log = { timestamp: timeStamp(), verbosity: "info" as const, content: `Service ${action} completed` }
    service.logs = [...service.logs, log].slice(-100)
    this.repository.saveService(service)
    this.events.broadcast({ type: "service.updated", service })
    return this.refreshServiceLogs(id)
  }

  async addService(input: CreateServiceInput): Promise<ServiceRecord> {
    const id = slug(input.label || input.serviceUnit.replace(/\.service$/, ""))
    if (this.repository.getService(id)) throw conflict(`Service ${id} already exists`)

    const service: ServiceRecord = {
      id,
      label: input.label.trim(),
      desc: input.description?.trim() || `Service géré via ${input.serviceUnit}`,
      location: input.servicePath?.trim() || input.serviceUnit.trim(),
      unit: input.serviceUnit.trim(),
      servicePath: input.servicePath?.trim() || null,
      webUrl: input.webUrl?.trim() || null,
      status: "starting",
      logs: [],
    }

    this.system.registerService(service.id, service.unit)
    this.repository.saveService(service)
    this.events.broadcast({ type: "service.updated", service })
    this.appendServiceLog(service.id, "info", "Initialisation de l'ajout du service")

    try {
      const result = await this.system.addService(input, (verbosity, content) => {
        this.appendServiceLog(service.id, verbosity, content)
      })
      service.status = result.status
      service.servicePath = result.servicePath
      service.location = result.servicePath ?? service.unit
      this.appendServiceLog(service.id, "info", "Service ajouté avec succès")
      this.repository.saveService(service)
      this.events.broadcast({ type: "service.updated", service })
      return service
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ajout du service impossible"
      this.appendServiceLog(service.id, "error", message)
      this.repository.removeService(service.id)
      this.events.broadcast({ type: "service.removed", serviceId: service.id })
      throw error
    }
  }

  async actOnContainer(id: string, action: "start" | "stop" | "restart") {
    const docker = this.repository.getDocker()
    const container = docker.containers.find((item) => item.id === id)
    if (!container) throw notFound(`Unknown container: ${id}`)
    await this.system.actOnContainer(id, action)
    if (action !== "stop") container.lastStarted = relativeDate()
    container.cpuPercent = action === "stop" ? 0 : Math.max(container.cpuPercent, 1)
    this.repository.saveDocker(docker)
    this.events.broadcast({ type: "docker.updated", docker })
    return container
  }

  async actOnImage(id: string, action: "pull" | "run") {
    const docker = this.repository.getDocker()
    const image = docker.images.find((item) => item.id === id)
    if (!image) throw notFound(`Unknown image: ${id}`)
    await this.system.actOnImage(`${image.name}:${image.tag}`, action)
    image.created = relativeDate()
    if (action === "run") {
      docker.containers.unshift({
        id: randomUUID().replaceAll("-", ""),
        name: `${slug(image.name)}-${docker.containers.length + 1}`,
        imageId: image.id,
        volumeId: docker.volumes[0]?.id ?? "",
        cpuPercent: 0,
        lastStarted: relativeDate(),
      })
    }
    this.repository.saveDocker(docker)
    this.events.broadcast({ type: "docker.updated", docker })
    return docker
  }

  async runNasScrub() {
    await this.system.runNasScrub()
    const tools = this.getToolsSnapshot()
    const job = { label: "Scrub NAS - démarré", when: relativeDate() }
    tools.recentJobs = [job, ...tools.recentJobs].slice(0, 20)
    this.repository.saveTools(tools)
    this.events.broadcast({ type: "tools.updated", tools })
    this.events.broadcast({ type: "nas.updated", nas: this.repository.getNas() })
    return job
  }

  async runTool(id: string) {
    const tools = this.getToolsSnapshot()
    const tool = tools.tools.find((item) => item.id === id)
    if (!tool) throw notFound(`Unknown tool: ${id}`)
    if (id === "update-hsm") {
      tools.updateStatus = {
        status: "running",
        currentStep: 0,
        totalSteps: 8,
        stepLabel: "Initialisation",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        finishedAt: null,
        revision: null,
        error: null,
      }
      this.repository.saveTools(tools)
      this.events.broadcast({ type: "tools.updated", tools })
    }
    await this.system.runTool(id)
    const job = {
      label: id === "update-hsm" ? `${tool.title} - démarré` : `${tool.title} - succès`,
      when: relativeDate(),
    }
    tools.recentJobs = [job, ...tools.recentJobs].slice(0, 20)
    this.repository.saveTools(tools)
    this.events.broadcast({ type: "tools.updated", tools })
    return job
  }

  getToolsSnapshot(): ToolsSnapshot {
    const tools = this.repository.getTools()
    const updateStatus = this.readUpdateStatusFile() ?? tools.updateStatus ?? idleUpdateStatus()
    if (JSON.stringify(tools.updateStatus) !== JSON.stringify(updateStatus)) {
      tools.updateStatus = updateStatus
      this.repository.saveTools(tools)
    }
    return tools
  }

  private syncUpdateStatus(): void {
    const tools = this.getToolsSnapshot()
    this.events.broadcast({ type: "tools.updated", tools })
  }

  private readUpdateStatusFile(): UpdateStatus | null {
    try {
      const parsed = JSON.parse(readFileSync(UPDATE_STATUS_PATH, "utf8")) as Partial<UpdateStatus>
      return {
        status: parsed.status === "running" || parsed.status === "completed" || parsed.status === "failed" ? parsed.status : "idle",
        currentStep: typeof parsed.currentStep === "number" ? Math.max(0, parsed.currentStep) : 0,
        totalSteps: typeof parsed.totalSteps === "number" ? Math.max(0, parsed.totalSteps) : 0,
        stepLabel: typeof parsed.stepLabel === "string" ? parsed.stepLabel : "",
        startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
        finishedAt: typeof parsed.finishedAt === "string" ? parsed.finishedAt : null,
        revision: typeof parsed.revision === "string" ? parsed.revision : null,
        error: typeof parsed.error === "string" ? parsed.error : null,
      }
    } catch {
      return null
    }
  }

  private appendServiceLog(serviceId: string, verbosity: "debug" | "info" | "warning" | "error", content: string): void {
    const service = this.repository.getService(serviceId)
    if (!service) return
    const log = { timestamp: timeStamp(), verbosity, content }
    service.logs = [...service.logs, log].slice(-100)
    this.repository.saveService(service)
    this.events.broadcast({ type: "service.log.appended", serviceId, log, limit: 100 })
  }

  async executeTerminal(command: string, requestedSessionId?: string): Promise<{ sessionId: string; line: TerminalLine }> {
    const terminal = this.repository.getTerminal()
    const sessionId = requestedSessionId ?? terminal.activeSessionId
    if (!terminal.sessions.some((session) => session.id === sessionId)) throw notFound(`Unknown terminal session: ${sessionId}`)
    const normalized = command.trim()
    const result = await this.system.executeTerminal(normalized) ?? {
      status: "warning" as const,
      output: ["Aucun adaptateur terminal n'est disponible pour cette commande."],
    }
    const line: TerminalLine = { command: normalized, timestamp: timeStamp(), ...result }
    this.repository.appendTerminalLine(sessionId, line)
    this.events.broadcast({ type: "terminal.line.appended", sessionId, line, limit: 100 })
    return { sessionId, line }
  }

  async clearTerminalSession(requestedSessionId?: string): Promise<TerminalSnapshot> {
    const terminal = this.repository.getTerminal()
    const sessionId = requestedSessionId ?? terminal.activeSessionId
    if (!terminal.sessions.some((session) => session.id === sessionId)) throw notFound(`Unknown terminal session: ${sessionId}`)
    this.repository.clearTerminalSession(sessionId)
    const nextTerminal = this.repository.getTerminal()
    this.events.broadcast({ type: "terminal.updated", terminal: nextTerminal })
    return nextTerminal
  }
}
