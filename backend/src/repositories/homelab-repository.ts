import { randomUUID } from "node:crypto"
import type {
  AccountProfile,
  AuditEntry,
  DockerSnapshot,
  NasSnapshot,
  OverviewSnapshot,
  ServiceRecord,
  SettingsState,
  TerminalLine,
  TerminalSnapshot,
  ToolsSnapshot,
} from "../shared/contracts.js"
import { accountSeed, dockerSeed, nasSeed, overviewSeed, servicesSeed, settingsSeed, terminalSeed, toolsSeed } from "./seed.js"

const clone = <T>(value: T): T => structuredClone(value)

export interface HomelabRepository {
  getOverview(): OverviewSnapshot
  setOverview(value: OverviewSnapshot): void
  listServices(): ServiceRecord[]
  getService(id: string): ServiceRecord | undefined
  saveService(value: ServiceRecord): void
  getDocker(): DockerSnapshot
  saveDocker(value: DockerSnapshot): void
  getNas(): NasSnapshot
  getTools(): ToolsSnapshot
  saveTools(value: ToolsSnapshot): void
  getTerminal(): TerminalSnapshot
  appendTerminalLine(sessionId: string, line: TerminalLine): void
  getAccount(): AccountProfile
  getSettings(ownerId: string): SettingsState
  saveSettings(ownerId: string, value: SettingsState): void
  appendAudit(entry: Omit<AuditEntry, "id" | "at">): AuditEntry
  listAudit(): AuditEntry[]
}

export class InMemoryHomelabRepository implements HomelabRepository {
  private overview = clone(overviewSeed)
  private services = clone(servicesSeed)
  private docker = clone(dockerSeed)
  private nas = clone(nasSeed)
  private tools = clone(toolsSeed)
  private terminal = clone(terminalSeed)
  private readonly settings = new Map<string, SettingsState>()
  private readonly audit: AuditEntry[] = []

  getOverview() { return clone(this.overview) }
  setOverview(value: OverviewSnapshot) { this.overview = clone(value) }
  listServices() { return clone(this.services) }
  getService(id: string) { const value = this.services.find((service) => service.id === id); return value ? clone(value) : undefined }
  saveService(value: ServiceRecord) {
    const index = this.services.findIndex((service) => service.id === value.id)
    if (index < 0) this.services.unshift(clone(value)); else this.services[index] = clone(value)
  }
  getDocker() { return clone(this.docker) }
  saveDocker(value: DockerSnapshot) { this.docker = clone(value) }
  getNas() { return clone(this.nas) }
  getTools() { return clone(this.tools) }
  saveTools(value: ToolsSnapshot) { this.tools = clone(value) }
  getTerminal() { return clone(this.terminal) }
  appendTerminalLine(sessionId: string, line: TerminalLine) {
    const session = this.terminal.sessions.find((item) => item.id === sessionId)
    if (!session) throw new Error(`Unknown terminal session: ${sessionId}`)
    session.lines = [...session.lines, clone(line)].slice(-100)
  }
  getAccount() { return clone(accountSeed) }
  getSettings(ownerId: string) { return clone(this.settings.get(ownerId) ?? settingsSeed) }
  saveSettings(ownerId: string, value: SettingsState) { this.settings.set(ownerId, clone(value)) }
  appendAudit(entry: Omit<AuditEntry, "id" | "at">) {
    const value: AuditEntry = { ...entry, id: randomUUID(), at: new Date().toISOString() }
    this.audit.unshift(value)
    this.audit.splice(500)
    return clone(value)
  }
  listAudit() { return clone(this.audit) }
}
