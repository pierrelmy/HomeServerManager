import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { DockerSnapshot, NasSnapshot, ServiceRecord, ServiceStatus } from "../shared/contracts.js"

const execFileAsync = promisify(execFile)

export interface CommandResult {
  output: string[]
  status: "ok" | "warning" | "error"
}

export interface SystemAdapter {
  readonly mode: "simulation" | "local"
  actOnService(id: string, action: "start" | "stop" | "restart"): Promise<void>
  actOnContainer(id: string, action: "start" | "stop" | "restart"): Promise<void>
  actOnImage(reference: string, action: "pull" | "run"): Promise<void>
  runNasScrub(): Promise<void>
  runTool(id: string): Promise<void>
  executeTerminal(command: string): Promise<CommandResult | null>
  collectServices(services: ServiceRecord[]): Promise<ServiceRecord[] | null>
  collectDocker(): Promise<DockerSnapshot | null>
  collectNas(): Promise<NasSnapshot | null>
}

export class SimulationSystemAdapter implements SystemAdapter {
  readonly mode = "simulation" as const
  async actOnService() {}
  async actOnContainer() {}
  async actOnImage() {}
  async runNasScrub() {}
  async runTool() {}
  async executeTerminal() { return null }
  async collectServices() { return null }
  async collectDocker() { return null }
  async collectNas() { return null }
}

interface LocalSystemAdapterOptions {
  serviceMap: Record<string, string>
  nasScrubCommand: string[]
  nasStatusCommand: string[]
  toolCommands: Record<string, string[]>
  timeoutMs?: number
}

export class LocalSystemAdapter implements SystemAdapter {
  readonly mode = "local" as const
  private readonly timeoutMs: number

  constructor(private readonly options: LocalSystemAdapterOptions) {
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  async actOnService(id: string, action: "start" | "stop" | "restart") {
    const unit = this.options.serviceMap[id]
    if (!unit) throw new Error(`Service system mapping is missing for ${id}`)
    await this.execute("sudo", ["-n", "systemctl", action, unit])
  }

  async actOnContainer(id: string, action: "start" | "stop" | "restart") {
    await this.execute("docker", [action, id])
  }

  async actOnImage(reference: string, action: "pull" | "run") {
    if (action === "pull") await this.execute("docker", ["pull", reference])
    else await this.execute("docker", ["run", "--detach", reference])
  }

  async runNasScrub() {
    await this.executeConfigured(this.options.nasScrubCommand, "NAS scrub")
  }

  async runTool(id: string) {
    await this.executeConfigured(this.options.toolCommands[id] ?? [], `tool ${id}`)
  }

  async executeTerminal(command: string): Promise<CommandResult> {
    const commands: Record<string, [string, string[]]> = {
      uptime: ["uptime", []],
      "docker ps": ["docker", ["ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.CPUPerc}}"]],
      "df -h": ["df", ["-h"]],
      "journalctl -p err -n 5": ["journalctl", ["-p", "err", "-n", "5", "--no-pager"]],
    }
    const selected = commands[command]
    if (!selected) throw new Error("Command is not allowed")
    const output = await this.execute(selected[0], selected[1])
    return { output, status: command.startsWith("journalctl") ? "warning" : "ok" }
  }

  async collectServices(services: ServiceRecord[]): Promise<ServiceRecord[]> {
    return Promise.all(services.map(async (service) => ({
      ...service,
      status: await this.getServiceStatus(service.id),
    })))
  }

  async collectDocker(): Promise<DockerSnapshot> {
    const [containerRows, imageRows, volumeRows, statRows] = await Promise.all([
      this.execute("docker", ["ps", "-a", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Mounts}}"]),
      this.execute("docker", ["images", "--format", "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"]),
      this.execute("docker", ["volume", "ls", "--format", "{{.Name}}"]),
      this.execute("docker", ["stats", "--no-stream", "--format", "{{.Name}}\t{{.CPUPerc}}"]),
    ])
    const images = imageRows.map((row) => {
      const [id = "", name = "<none>", tag = "latest", created = "", size = "0"] = row.split("\t")
      return { id, name, tag, created, sizeMB: parseDockerSize(size) }
    })
    const imageIdByReference = new Map(images.map((image) => [`${image.name}:${image.tag}`, image.id]))
    const cpuByName = new Map(statRows.map((row) => {
      const [name = "", value = "0"] = row.split("\t")
      return [name, Number.parseFloat(value.replace("%", "")) || 0]
    }))
    const volumes = volumeRows.map((name) => ({ id: name, name, sizeMB: 0, created: "managed by Docker" }))
    const containers = containerRows.map((row) => {
      const [id = "", name = "", imageReference = "", mounts = ""] = row.split("\t")
      const volumeId = mounts.split(",").map((item) => item.trim()).find((item) => volumeRows.includes(item)) ?? ""
      return {
        id,
        name,
        imageId: imageIdByReference.get(imageReference) ?? imageReference,
        volumeId,
        cpuPercent: cpuByName.get(name) ?? 0,
        lastStarted: "reported by Docker",
      }
    })
    return { containers, images, volumes }
  }

  async collectNas(): Promise<NasSnapshot> {
    const output = await this.executeConfigured(this.options.nasStatusCommand, "NAS status")
    const parsed: unknown = JSON.parse(output.join("\n"))
    if (!isNasSnapshot(parsed)) throw new Error("NAS status command returned an invalid payload")
    return parsed
  }

  private async executeConfigured(command: string[], label: string): Promise<string[]> {
    const [executable, ...args] = command
    if (!executable) throw new Error(`Command mapping is missing for ${label}`)
    return this.execute(executable, args)
  }

  private async execute(executable: string, args: string[]): Promise<string[]> {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      timeout: this.timeoutMs,
      maxBuffer: 1_024 * 1_024,
      windowsHide: true,
    })
    return `${stdout}${stderr}`.trim().split("\n").filter(Boolean)
  }

  private async getServiceStatus(id: string): Promise<ServiceStatus> {
    const unit = this.options.serviceMap[id]
    if (!unit) return "failed"
    try {
      const output = await this.execute("systemctl", ["is-active", unit])
      const state = output[0]
      if (state === "active") return "running"
      if (state === "activating") return "starting"
      if (state === "deactivating") return "stopping"
      if (state === "inactive") return "stopped"
      return "failed"
    } catch {
      return "failed"
    }
  }
}

function parseDockerSize(value: string): number {
  const match = value.match(/^([\d.]+)\s*([kMGT]?B)$/i)
  if (!match) return 0
  const amount = Number.parseFloat(match[1] ?? "0")
  const unit = (match[2] ?? "B").toUpperCase()
  const multiplier = unit === "KB" ? 1 / 1_000 : unit === "MB" ? 1 : unit === "GB" ? 1_000 : unit === "TB" ? 1_000_000 : 1 / 1_000_000
  return Math.round(amount * multiplier * 100) / 100
}

function isNasSnapshot(value: unknown): value is NasSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.capacityUsed === "string"
    && typeof item.healthSummary === "string"
    && typeof item.backupSummary === "string"
    && typeof item.temperatureSummary === "string"
    && Array.isArray(item.pools)
    && Array.isArray(item.backups)
    && Array.isArray(item.drives)
}

export function parseStringMap(value: string, label: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`)
  for (const item of Object.values(parsed)) if (typeof item !== "string") throw new Error(`${label} values must be strings`)
  return parsed as Record<string, string>
}

export function parseCommandMap(value: string, label: string): Record<string, string[]> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`)
  for (const item of Object.values(parsed)) {
    if (!Array.isArray(item) || item.some((part) => typeof part !== "string")) throw new Error(`${label} values must be string arrays`)
  }
  return parsed as Record<string, string[]>
}

export function parseCommand(value: string, label: string): string[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.some((part) => typeof part !== "string")) throw new Error(`${label} must be a JSON string array`)
  return parsed
}
