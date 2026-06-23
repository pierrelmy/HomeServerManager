import { randomUUID } from "node:crypto"
import { hostname, loadavg, totalmem, freemem, uptime } from "node:os"
import type { EventHub } from "../events/event-hub.js"
import type { HomelabRepository } from "../repositories/homelab-repository.js"
import type {
  HomelabLiveBundle,
  ServiceRecord,
  SettingsState,
  TerminalLine,
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
      tools: this.repository.getTools(),
      account: this.repository.getAccount(),
      settings: this.repository.getSettings(ownerId),
      terminal: this.repository.getTerminal(),
    }
  }

  refreshOverview(): void {
    const overview = this.repository.getOverview()
    const memoryUsed = totalmem() - freemem()
    const memoryPercent = Math.round((memoryUsed / totalmem()) * 100)
    const cpuPercent = Math.min(100, Math.round((loadavg()[0] ?? 0) * 25))
    const uptimeHours = Math.floor(systemUptime() / 3_600)
    const days = Math.floor(uptimeHours / 24)
    overview.hostName = hostname()
    overview.uptime = `${days}j ${uptimeHours % 24}h`
    const cpu = overview.metrics[0]
    const memory = overview.metrics[1]
    if (cpu) {
      cpu.value = `${cpuPercent}%`
      cpu.points = [...cpu.points.slice(-23), cpuPercent]
    }
    if (memory) {
      memory.value = `${(memoryUsed / 1024 ** 3).toFixed(1).replace(".", ",")} / ${(totalmem() / 1024 ** 3).toFixed(0)} Go`
      memory.points = [...memory.points.slice(-23), memoryPercent]
    }
    this.repository.setOverview(overview)
    this.events.broadcast({ type: "overview.updated", overview })
  }

  async refreshSystemState(): Promise<Error[]> {
    this.refreshOverview()
    if (this.system.mode !== "local") return []

    const results = await Promise.allSettled([
      this.system.collectServices(this.repository.listServices()),
      this.system.collectDocker(),
      this.system.collectNas(),
    ])
    const [servicesResult, dockerResult, nasResult] = results
    if (servicesResult?.status === "fulfilled" && servicesResult.value) {
      for (const service of servicesResult.value) this.repository.saveService(service)
      this.events.broadcast({ type: "services.updated", services: servicesResult.value })
    }
    if (dockerResult?.status === "fulfilled" && dockerResult.value) {
      this.repository.saveDocker(dockerResult.value)
      this.events.broadcast({ type: "docker.updated", docker: dockerResult.value })
    }
    if (nasResult?.status === "fulfilled" && nasResult.value) {
      this.repository.saveNas(nasResult.value)
      this.events.broadcast({ type: "nas.updated", nas: nasResult.value })
    }
    return results.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason : new Error(String(result.reason))]
      : [])
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
    return service
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
    const tools = this.repository.getTools()
    const job = { label: "Scrub NAS - démarré", when: relativeDate() }
    tools.recentJobs = [job, ...tools.recentJobs].slice(0, 20)
    this.repository.saveTools(tools)
    this.events.broadcast({ type: "tools.updated", tools })
    this.events.broadcast({ type: "nas.updated", nas: this.repository.getNas() })
    return job
  }

  async runTool(id: string) {
    const tools = this.repository.getTools()
    const tool = tools.tools.find((item) => slug(item.title) === id)
    if (!tool) throw notFound(`Unknown tool: ${id}`)
    await this.system.runTool(id)
    const job = { label: `${tool.title} - succès`, when: relativeDate() }
    tools.recentJobs = [job, ...tools.recentJobs].slice(0, 20)
    this.repository.saveTools(tools)
    this.events.broadcast({ type: "tools.updated", tools })
    return job
  }

  async executeTerminal(command: string, requestedSessionId?: string): Promise<{ sessionId: string; line: TerminalLine }> {
    const terminal = this.repository.getTerminal()
    const sessionId = requestedSessionId ?? terminal.activeSessionId
    if (!terminal.sessions.some((session) => session.id === sessionId)) throw notFound(`Unknown terminal session: ${sessionId}`)
    const normalized = command.trim().replace(/\s+/g, " ")
    const allowed: Record<string, () => Pick<TerminalLine, "output" | "status">> = {
      "uptime": () => ({ status: "ok", output: [`up ${Math.floor(systemUptime() / 86_400)} days, load average: ${loadavg().map((value) => value.toFixed(2)).join(", ")}`] }),
      "docker ps": () => ({ status: "ok", output: ["NAMES                              CPU", ...this.repository.getDocker().containers.map((container) => `${container.name.padEnd(34)} ${container.cpuPercent}%`)] }),
      "df -h": () => ({ status: "ok", output: ["Filesystem      Size  Used Avail Use% Mounted on", ...this.repository.getOverview().disks.map((disk) => `${disk.name.padEnd(15)} ${disk.total}${disk.unit} ${disk.used}${disk.unit} - ${disk.percent}%`)] }),
      "journalctl -p err -n 5": () => ({ status: "warning", output: this.repository.getOverview().logs.filter((log) => log.level === "danger").slice(-5).map((log) => `${log.timestamp} ${log.source} ${log.content}`) }),
    }
    const executor = allowed[normalized]
    if (!executor) throw conflict("Command is not allowed")
    const result = await this.system.executeTerminal(normalized) ?? executor()
    const line: TerminalLine = { command, timestamp: timeStamp(), ...result }
    this.repository.appendTerminalLine(sessionId, line)
    this.events.broadcast({ type: "terminal.line.appended", sessionId, line, limit: 100 })
    return { sessionId, line }
  }
}
