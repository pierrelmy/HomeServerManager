import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
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
  saveNas(value: NasSnapshot): void
  getTools(): ToolsSnapshot
  saveTools(value: ToolsSnapshot): void
  getTerminal(): TerminalSnapshot
  appendTerminalLine(sessionId: string, line: TerminalLine): void
  getAccount(): AccountProfile
  getSettings(ownerId: string): SettingsState
  saveSettings(ownerId: string, value: SettingsState): void
  appendAudit(entry: Omit<AuditEntry, "id" | "at">): AuditEntry
  listAudit(): AuditEntry[]
  close?(): void
  ping?(): void
}

type SnapshotKey = "overview" | "services" | "docker" | "nas" | "tools" | "terminal" | "account"

const seedByKey = {
  overview: overviewSeed,
  services: servicesSeed,
  docker: dockerSeed,
  nas: nasSeed,
  tools: toolsSeed,
  terminal: terminalSeed,
  account: accountSeed,
} satisfies Record<SnapshotKey, unknown>

export class SqliteHomelabRepository implements HomelabRepository {
  private readonly database: DatabaseSync

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true })
    this.database = new DatabaseSync(databasePath)
    this.database.exec("PRAGMA foreign_keys = ON")
    if (databasePath !== ":memory:") this.database.exec("PRAGMA journal_mode = WAL")
    this.migrate()
    this.seed()
  }

  getOverview() { return this.getSnapshot<OverviewSnapshot>("overview") }
  setOverview(value: OverviewSnapshot) { this.setSnapshot("overview", value) }
  listServices() { return this.getSnapshot<ServiceRecord[]>("services") }
  getService(id: string) { return this.listServices().find((service) => service.id === id) }
  saveService(value: ServiceRecord) {
    const services = this.listServices()
    const index = services.findIndex((service) => service.id === value.id)
    if (index < 0) services.unshift(clone(value)); else services[index] = clone(value)
    this.setSnapshot("services", services)
  }
  getDocker() { return this.getSnapshot<DockerSnapshot>("docker") }
  saveDocker(value: DockerSnapshot) { this.setSnapshot("docker", value) }
  getNas() { return this.getSnapshot<NasSnapshot>("nas") }
  saveNas(value: NasSnapshot) { this.setSnapshot("nas", value) }
  getTools() { return this.getSnapshot<ToolsSnapshot>("tools") }
  saveTools(value: ToolsSnapshot) { this.setSnapshot("tools", value) }
  getTerminal() { return this.getSnapshot<TerminalSnapshot>("terminal") }
  appendTerminalLine(sessionId: string, line: TerminalLine) {
    const terminal = this.getTerminal()
    const session = terminal.sessions.find((item) => item.id === sessionId)
    if (!session) throw new Error(`Unknown terminal session: ${sessionId}`)
    session.lines = [...session.lines, clone(line)].slice(-100)
    this.setSnapshot("terminal", terminal)
  }
  getAccount() { return this.getSnapshot<AccountProfile>("account") }
  getSettings(ownerId: string) {
    const row = this.database.prepare("SELECT value FROM user_settings WHERE owner_id = ?").get(ownerId) as { value: string } | undefined
    return row ? JSON.parse(row.value) as SettingsState : clone(settingsSeed)
  }
  saveSettings(ownerId: string, value: SettingsState) {
    this.database.prepare(`
      INSERT INTO user_settings (owner_id, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(owner_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(ownerId, JSON.stringify(value), new Date().toISOString())
  }
  appendAudit(entry: Omit<AuditEntry, "id" | "at">) {
    const value: AuditEntry = { ...entry, id: randomUUID(), at: new Date().toISOString() }
    this.database.prepare(`
      INSERT INTO audit_entries (id, at, session_id, actor, action, resource, outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(value.id, value.at, value.sessionId, value.actor, value.action, value.resource, value.outcome)
    this.database.prepare(`
      DELETE FROM audit_entries WHERE id NOT IN (
        SELECT id FROM audit_entries ORDER BY at DESC LIMIT 500
      )
    `).run()
    return value
  }
  listAudit() {
    return this.database.prepare(`
      SELECT id, at, session_id AS sessionId, actor, action, resource, outcome
      FROM audit_entries ORDER BY at DESC LIMIT 500
    `).all() as unknown as AuditEntry[]
  }
  close() { this.database.close() }
  ping() { this.database.prepare("SELECT 1").get() }

  private getSnapshot<T>(key: SnapshotKey): T {
    const row = this.database.prepare("SELECT value FROM snapshots WHERE key = ?").get(key) as { value: string } | undefined
    if (!row) return clone(seedByKey[key]) as T
    return JSON.parse(row.value) as T
  }

  private setSnapshot(key: SnapshotKey, value: unknown): void {
    this.database.prepare(`
      INSERT INTO snapshots (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), new Date().toISOString())
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        owner_id TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_entries (
        id TEXT PRIMARY KEY,
        at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure'))
      );
      CREATE INDEX IF NOT EXISTS audit_entries_at_idx ON audit_entries(at DESC);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (2, CURRENT_TIMESTAMP);
    `)
  }

  private seed(): void {
    const insert = this.database.prepare("INSERT OR IGNORE INTO snapshots (key, value, updated_at) VALUES (?, ?, ?)")
    const now = new Date().toISOString()
    for (const [key, value] of Object.entries(seedByKey)) insert.run(key, JSON.stringify(value), now)
  }
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
  saveNas(value: NasSnapshot) { this.nas = clone(value) }
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
