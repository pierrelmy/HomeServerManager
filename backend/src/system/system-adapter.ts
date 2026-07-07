import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { hostname, uptime as osUptime } from "node:os"
import type {
  CreateServiceInput,
  DiskInfo,
  DockerSnapshot,
  LogVerbosity,
  MetricSparkline,
  NasSnapshot,
  OverviewSnapshot,
  ServiceRecord,
  ServiceStatus,
} from "../shared/contracts.js"
import { badRequest } from "../shared/errors.js"

const execFileAsync = promisify(execFile)

interface ExecOutput {
  stdout: string[]
  stderr: string[]
}

export interface CommandResult {
  output: string[]
  status: "ok" | "warning" | "error"
}

export interface SystemAdapter {
  readonly mode: "simulation" | "local"
  registerService(id: string, unit: string): void
  addService(input: CreateServiceInput, onLog: (verbosity: LogVerbosity, content: string) => void): Promise<{ servicePath: string | null; status: ServiceStatus }>
  collectServiceLogs(id: string, limit?: number): Promise<ServiceRecord["logs"] | null>
  actOnService(id: string, action: "start" | "stop" | "restart"): Promise<void>
  actOnContainer(id: string, action: "start" | "stop" | "restart"): Promise<void>
  actOnImage(reference: string, action: "pull" | "run"): Promise<void>
  runNasScrub(): Promise<void>
  runTool(id: string): Promise<void>
  executeTerminal(command: string): Promise<CommandResult | null>
  collectOverview(current: OverviewSnapshot): Promise<OverviewSnapshot | null>
  collectServices(services: ServiceRecord[]): Promise<ServiceRecord[] | null>
  collectDocker(): Promise<DockerSnapshot | null>
  collectNas(): Promise<NasSnapshot | null>
}

export class SimulationSystemAdapter implements SystemAdapter {
  readonly mode = "simulation" as const
  registerService() {}
  async addService(input: CreateServiceInput, onLog: (verbosity: LogVerbosity, content: string) => void) {
    onLog("info", `Simulation: préparation du service ${input.serviceUnit}`)
    if (input.installCommand) onLog("debug", `Simulation: commande bash fournie`)
    return { servicePath: input.servicePath ?? null, status: input.startAfterInstall ? "running" : "stopped" as ServiceStatus }
  }
  async collectServiceLogs() { return null }
  async actOnService() {}
  async actOnContainer() {}
  async actOnImage() {}
  async runNasScrub() {}
  async runTool() {}
  async executeTerminal(command: string) {
    return {
      status: "warning" as const,
      output: [
        `Simulation: ${command}`,
        "Aucune commande réelle n'est exécutée dans cet environnement.",
      ],
    }
  }
  async collectOverview() { return null }
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
  installTimeoutMs?: number
}

export class LocalSystemAdapter implements SystemAdapter {
  readonly mode = "local" as const
  private readonly timeoutMs: number
  private readonly installTimeoutMs: number

  constructor(private readonly options: LocalSystemAdapterOptions) {
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.installTimeoutMs = options.installTimeoutMs ?? 10 * 60_000
  }

  registerService(id: string, unit: string) {
    this.options.serviceMap[id] = unit
  }

  async addService(input: CreateServiceInput, onLog: (verbosity: LogVerbosity, content: string) => void) {
    const servicePath = input.servicePath?.trim() || null
    const installCommand = input.installCommand?.trim() || null

    this.validateServiceUnit(input.serviceUnit)
    if (servicePath) this.validateAbsolutePath(servicePath, "servicePath")

    onLog("info", `Vérification du service ${input.serviceUnit}`)

    let serviceFilePresent = false
    if (servicePath) {
      serviceFilePresent = await this.pathExists(servicePath)
      if (serviceFilePresent) onLog("info", `Fichier service détecté: ${servicePath}`)
    }

    if (!serviceFilePresent && installCommand) {
      onLog("info", "Exécution de la commande d'installation bash")
      await this.executeStreaming("sudo", ["-n", "/bin/bash", "-lc", `set -Eeuo pipefail\n${installCommand}`], onLog, this.installTimeoutMs)
    }

    onLog("info", "Rechargement de systemd")
    await this.executeStreaming("sudo", ["-n", "systemctl", "daemon-reload"], onLog)

    if (servicePath) {
      await this.ensurePathExists(servicePath, onLog)
    }

    onLog("info", `Validation de l'unité ${input.serviceUnit}`)
    await this.executeStreaming("systemctl", ["cat", input.serviceUnit], onLog)

    this.registerService(slugFromUnit(input.serviceUnit), input.serviceUnit)

    if (input.startAfterInstall) {
      onLog("info", `Démarrage de ${input.serviceUnit}`)
      await this.executeStreaming("sudo", ["-n", "systemctl", "start", input.serviceUnit], onLog)
    }

    const status = await this.getServiceStatusByUnit(input.serviceUnit)
    return { servicePath, status }
  }

  async collectServiceLogs(id: string, limit = 50): Promise<ServiceRecord["logs"]> {
    const unit = this.options.serviceMap[id]
    if (!unit) throw badRequest(`Service system mapping is missing for ${id}`)

    const output = await this.executeLenient("systemctl", ["status", unit, "--no-pager", "--full", `--lines=${limit}`])
    return output
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        timestamp: timeStamp(),
        verbosity: inferVerbosity(line),
        content: line,
      }))
      .slice(-limit)
  }

  async actOnService(id: string, action: "start" | "stop" | "restart") {
    const unit = this.options.serviceMap[id]
    if (!unit) throw badRequest(`Service system mapping is missing for ${id}`)
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
    const command = this.options.toolCommands[id] ?? []
    if (id === "update-hsm") {
      await this.executeDetached(command, `tool ${id}`)
      return
    }
    await this.executeConfigured(command, `tool ${id}`)
  }

  async executeTerminal(command: string): Promise<CommandResult> {
    return this.executeShellCommand(command)
  }

  async collectOverview(current: OverviewSnapshot): Promise<OverviewSnapshot> {
    const nextOverview = structuredClone(current)
    nextOverview.hostName = hostname()

    const uptimeHours = Math.floor(osUptime() / 3_600)
    const days = Math.floor(uptimeHours / 24)
    nextOverview.uptime = `${days}j ${uptimeHours % 24}h`

    const [memory, disks] = await Promise.all([
      this.collectMemoryMetric(nextOverview.metrics[1]),
      this.collectDiskInfo(),
    ])

    if (memory && nextOverview.metrics[1]) nextOverview.metrics[1] = memory
    if (disks.length > 0) nextOverview.disks = disks
    return nextOverview
  }

  async collectServices(services: ServiceRecord[]): Promise<ServiceRecord[]> {
    return Promise.all(services.map(async (service) => ({
      ...service,
      status: await this.getServiceStatus(service.id),
    })))
  }

  async collectDocker(): Promise<DockerSnapshot> {
    const [containersResult, imagesResult, volumesResult, statsResult] = await Promise.all([
      this.executeWithOutput("docker", ["ps", "-a", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Mounts}}"]),
      this.executeWithOutput("docker", ["images", "--format", "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"]),
      this.executeWithOutput("docker", ["volume", "ls", "--format", "{{.Name}}"]),
      this.executeWithOutput("docker", ["stats", "--no-stream", "--format", "{{.Name}}\t{{.CPUPerc}}"]),
    ])
    const imageRows = imagesResult.stdout
    const volumeRows = volumesResult.stdout
    const statRows = statsResult.stdout
    const containerRows = containersResult.stdout

    const dockerWarnings = [
      ...containersResult.stderr,
      ...imagesResult.stderr,
      ...volumesResult.stderr,
      ...statsResult.stderr,
    ]
    const error = dockerWarnings.length > 0 ? [...new Set(dockerWarnings)].join("\n") : null

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
    return { containers, images, volumes, error }
  }

  async collectNas(): Promise<NasSnapshot> {
    const output = await this.executeConfigured(this.options.nasStatusCommand, "NAS status")
    const parsed: unknown = JSON.parse(output.join("\n"))
    if (!isNasSnapshot(parsed)) throw new Error("NAS status command returned an invalid payload")
    return parsed
  }

  private async executeConfigured(command: string[], label: string): Promise<string[]> {
    const [executable, ...args] = command
    if (!executable) throw badRequest(`Command mapping is missing for ${label}`)
    return this.execute(executable, args)
  }

  private async executeDetached(command: string[], label: string): Promise<void> {
    const [executable, ...args] = command
    if (!executable) throw badRequest(`Command mapping is missing for ${label}`)

    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, {
        detached: true,
        stdio: "ignore",
      })
      child.once("error", reject)
      child.once("spawn", () => {
        child.unref()
        resolve()
      })
    })
  }

  private async execute(executable: string, args: string[]): Promise<string[]> {
    const result = await this.executeWithOutput(executable, args)
    return result.stdout
  }

  private async executeShellCommand(command: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execFileAsync("/bin/bash", ["-c", command], {
        timeout: this.timeoutMs,
        maxBuffer: 1_024 * 1_024,
        windowsHide: true,
        env: {
          ...process.env,
          HOME: "/var/lib/homeservermanager",
          XDG_CONFIG_HOME: "/var/lib/homeservermanager/xdg-config",
          DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/var/lib/homeservermanager/docker",
          BASH_ENV: "",
          ENV: "",
        },
      })
      const stdoutLines = stdout.trim().split("\n").map((line) => line.trimEnd()).filter(Boolean)
      const stderrLines = stderr.trim().split("\n").map((line) => line.trimEnd()).filter(Boolean)
      return {
        output: [...stdoutLines, ...stderrLines],
        status: stderrLines.length > 0 ? "warning" : "ok",
      }
    } catch (error) {
      if (error instanceof Error && ("stderr" in error || "stdout" in error)) {
        const stdout = String((error as { stdout?: string }).stdout ?? "")
        const stderr = String((error as { stderr?: string }).stderr ?? "")
        const output = `${stdout}\n${stderr}`
          .split("\n")
          .map((line) => line.trimEnd())
          .filter(Boolean)
        return {
          output: output.length > 0 ? output : [error.message],
          status: "error",
        }
      }
      return {
        output: [error instanceof Error ? error.message : String(error)],
        status: "error",
      }
    }
  }

  private async executeWithOutput(executable: string, args: string[]): Promise<ExecOutput> {
    try {
      const { stdout, stderr } = await execFileAsync(executable, args, {
        timeout: this.timeoutMs,
        maxBuffer: 1_024 * 1_024,
        windowsHide: true,
      })
      return {
        stdout: stdout.trim().split("\n").map((line) => line.trim()).filter(Boolean),
        stderr: stderr.trim().split("\n").map((line) => line.trim()).filter(Boolean),
      }
    } catch (error) {
      if (error instanceof Error && "stderr" in error) {
        const stderr = String((error as { stderr?: string }).stderr ?? "").trim()
        const stdout = String((error as { stdout?: string }).stdout ?? "").trim()
        const details = stderr || stdout || error.message
        throw badRequest(details)
      }
      throw error
    }
  }

  private async executeLenient(executable: string, args: string[]): Promise<string[]> {
    try {
      return await this.execute(executable, args)
    } catch (error) {
      if (error instanceof Error && "message" in error) {
        const message = error.message.trim()
        return message ? message.split("\n").filter(Boolean) : []
      }
      return []
    }
  }

  private async getServiceStatus(id: string): Promise<ServiceStatus> {
    const unit = this.options.serviceMap[id]
    if (!unit) return "failed"
    return this.getServiceStatusByUnit(unit)
  }

  private async getServiceStatusByUnit(unit: string): Promise<ServiceStatus> {
    try {
      const output = await this.execute("systemctl", ["show", unit, "--property=ActiveState", "--value"])
      const state = output[0]?.trim()
      if (state === "active") return "running"
      if (state === "activating") return "starting"
      if (state === "deactivating") return "stopping"
      if (state === "inactive") return "stopped"
      if (state === "failed") return "failed"
      return "failed"
    } catch {
      return "failed"
    }
  }

  private validateServiceUnit(unit: string): void {
    if (!/^[a-zA-Z0-9@_.-]+\.service$/.test(unit)) {
      throw badRequest("serviceUnit must be a valid systemd unit name ending with .service")
    }
  }

  private validateAbsolutePath(value: string, label: string): void {
    if (!value.startsWith("/")) throw badRequest(`${label} must be an absolute path`)
  }
  private async ensurePathExists(path: string, onLog: (verbosity: LogVerbosity, content: string) => void): Promise<void> {
    if (!await this.pathExists(path)) {
      onLog("error", `Fichier introuvable: ${path}`)
      throw badRequest(`Service file is missing: ${path}`)
    }
  }

  private async executeStreaming(
    executable: string,
    args: string[],
    onLog: (verbosity: LogVerbosity, content: string) => void,
    timeoutMs = this.timeoutMs,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, {
        stdio: ["ignore", "pipe", "pipe"],
      })
      const timer = setTimeout(() => {
        child.kill("SIGTERM")
        reject(badRequest(`${executable} ${args.join(" ")} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      let stdoutBuffer = ""
      let stderrBuffer = ""

      const flush = (buffer: string, verbosity: LogVerbosity) => {
        const lines = buffer.split(/\r?\n/)
        const pending = lines.pop() ?? ""
        for (const line of lines.map((item) => item.trim()).filter(Boolean)) onLog(verbosity, line)
        return pending
      }

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdoutBuffer += chunk.toString()
        stdoutBuffer = flush(stdoutBuffer, "info")
      })
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderrBuffer += chunk.toString()
        stderrBuffer = flush(stderrBuffer, "warning")
      })
      child.on("error", (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.on("close", (code) => {
        clearTimeout(timer)
        if (stdoutBuffer.trim()) onLog("info", stdoutBuffer.trim())
        if (stderrBuffer.trim()) onLog("warning", stderrBuffer.trim())
        if (code === 0) {
          resolve()
          return
        }
        reject(badRequest(`${executable} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`))
      })
    })
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await this.execute("test", ["-f", path])
      return true
    } catch {
      return false
    }
  }

  private async collectMemoryMetric(current: MetricSparkline | undefined): Promise<MetricSparkline | null> {
    const rows = await this.execute("free", ["-k"])
    const memoryRow = rows.find((line) => line.trim().startsWith("Mem:"))
    if (!memoryRow || !current) return current ?? null

    const parts = memoryRow.trim().split(/\s+/)
    const totalKb = Number.parseInt(parts[1] ?? "0", 10)
    const usedKb = Number.parseInt(parts[2] ?? "0", 10)
    if (!totalKb || !Number.isFinite(usedKb)) return current ?? null

    const usedGiB = usedKb / 1024 / 1024
    const totalGiB = totalKb / 1024 / 1024
    const percent = Math.round((usedKb / totalKb) * 100)

    return {
      ...current,
      value: `${usedGiB.toFixed(1).replace(".", ",")} / ${totalGiB.toFixed(0)} Go`,
      points: [...current.points.slice(-23), percent],
    }
  }

  private async collectDiskInfo(): Promise<DiskInfo[]> {
    try {
      const rows = await this.execute("df", ["-k", "--output=target,size,used,pcent"])
      return rows
        .slice(1)
        .map((row) => row.trim().split(/\s+/))
        .filter((parts) => parts.length >= 4)
        .map(([target = "", sizeKb = "0", usedKb = "0", percentValue = "0%"]) =>
          toDiskInfo(target, sizeKb, usedKb, percentValue))
        .filter((disk) => Number.isFinite(disk.total) && disk.total > 0)
    } catch {
      const rows = await this.execute("df", ["-kP"])
      return rows
        .slice(1)
        .map((row) => row.trim().split(/\s+/))
        .filter((parts) => parts.length >= 6)
        .map((parts) => {
          const [, sizeKb = "0", usedKb = "0", , percentValue = "0%", ...targetParts] = parts
          return toDiskInfo(targetParts.join(" "), sizeKb, usedKb, percentValue)
        })
        .filter((disk) => Number.isFinite(disk.total) && disk.total > 0)
    }
  }
}

function toDiskInfo(target: string, sizeKb: string, usedKb: string, percentValue: string): DiskInfo {
  const totalGiB = Number(sizeKb) / 1024 / 1024
  const usedGiB = Number(usedKb) / 1024 / 1024
  const percent = Number.parseInt(percentValue.replace("%", ""), 10) || 0
  return {
    name: target,
    used: Number(usedGiB.toFixed(1)),
    total: Number(totalGiB.toFixed(0)),
    unit: "Go" as const,
    temp: 0,
    percent,
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

function slugFromUnit(unit: string): string {
  return unit.replace(/\.service$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase()
}

function inferVerbosity(line: string): LogVerbosity {
  const lower = line.toLowerCase()
  if (lower.includes("failed") || lower.includes("error")) return "error"
  if (lower.includes("warning") || lower.includes("inactive (dead)") || lower.includes("activating")) return "warning"
  if (lower.startsWith("loaded:") || lower.startsWith("active:") || lower.startsWith("cgroup:")) return "debug"
  return "info"
}

function timeStamp(): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())
}
