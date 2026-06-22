import { z } from "zod"

export const authProviderSchema = z.enum(["google", "github", "password"])
export type AuthProvider = z.infer<typeof authProviderSchema>

export interface MetricSparkline { label: string; value: string; accent: string; points: number[] }
export interface DiskInfo { name: string; used: number; total: number; unit: "Go" | "To"; temp: number; percent: number }
export interface AlertItem { level: "warning" | "danger"; label: string; detail: string }
export interface LogEntry { timestamp: string; source: string; content: string; level: "success" | "danger" | "muted" }
export interface OverviewSnapshot { hostName: string; uptime: string; metrics: MetricSparkline[]; disks: DiskInfo[]; alerts: AlertItem[]; logs: LogEntry[] }

export type ServiceStatus = "starting" | "running" | "stopping" | "stopped" | "failed"
export type LogVerbosity = "debug" | "info" | "warning" | "error"
export interface ServiceLogEntry { timestamp: string; verbosity: LogVerbosity; content: string }
export interface ServiceRecord { id: string; label: string; desc: string; location: string; status: ServiceStatus; logs: ServiceLogEntry[] }

export interface DockerContainer { id: string; name: string; imageId: string; volumeId: string; cpuPercent: number; lastStarted: string }
export interface DockerImage { id: string; name: string; tag: string; created: string; sizeMB: number }
export interface DockerVolume { id: string; name: string; sizeMB: number; created: string }
export interface DockerSnapshot { containers: DockerContainer[]; images: DockerImage[]; volumes: DockerVolume[] }

export interface NasPool { name: string; type: string; used: number; total: number; temp: number; health: "Healthy" | "Warning" }
export interface NasDrive { slot: string; model: string; temp: number; status: "Healthy" | "Warning" }
export interface NasBackup { label: string; when: string; result: "Succès" | "Avertissement" }
export interface NasSnapshot { capacityUsed: string; healthSummary: string; backupSummary: string; temperatureSummary: string; pools: NasPool[]; backups: NasBackup[]; drives: NasDrive[] }

export interface ToolShortcut { title: string; description: string; tag: string }
export interface ToolJob { label: string; when: string }
export interface ToolsSnapshot { tools: ToolShortcut[]; recentJobs: ToolJob[] }

export interface TerminalLine { command: string; output: string[]; status: "ok" | "warning" | "error"; timestamp: string }
export interface TerminalSession { id: string; title: string; prompt: string; status: "connected" | "reconnecting" | "disconnected"; quickCommands: string[]; lines: TerminalLine[] }
export interface TerminalSnapshot { activeSessionId: string; sessions: TerminalSession[] }

export interface AccountProfile {
  name: string
  role: string
  email: string
  status: "En ligne" | "Hors ligne"
  providers: Array<{ name: string; connected: boolean }>
  sshKeys: Array<{ name: string; fingerprint: string; status: "Valid" }>
  sessions: Array<{ device: string; status: "Active" | "Idle"; lastSeen: string }>
}

export const settingsPatchSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  density: z.number().int().min(0).max(100).optional(),
  alertsEnabled: z.boolean().optional(),
  compactSidebar: z.boolean().optional(),
}).strict()
export type SettingsState = Required<z.infer<typeof settingsPatchSchema>>

export interface AuthSession {
  isAuthenticated: boolean
  provider: AuthProvider | null
  displayName: string | null
  email: string | null
  role: Role | null
}
export type Role = "admin" | "viewer"

export interface HomelabLiveBundle {
  session: AuthSession | null
  overview: OverviewSnapshot | null
  services: ServiceRecord[] | null
  docker: DockerSnapshot | null
  nas: NasSnapshot | null
  tools: ToolsSnapshot | null
  account: AccountProfile | null
  settings: SettingsState | null
  terminal: TerminalSnapshot | null
}

export type RealtimeEvent =
  | { type: "bundle.synced"; bundle: Partial<HomelabLiveBundle> }
  | { type: "session.updated"; session: AuthSession }
  | { type: "overview.updated"; overview: OverviewSnapshot }
  | { type: "services.updated"; services: ServiceRecord[] }
  | { type: "service.updated"; service: ServiceRecord }
  | { type: "service.removed"; serviceId: string }
  | { type: "service.log.appended"; serviceId: string; log: ServiceLogEntry; limit?: number }
  | { type: "docker.updated"; docker: DockerSnapshot }
  | { type: "nas.updated"; nas: NasSnapshot }
  | { type: "tools.updated"; tools: ToolsSnapshot }
  | { type: "account.updated"; account: AccountProfile }
  | { type: "settings.updated"; settings: SettingsState }
  | { type: "terminal.updated"; terminal: TerminalSnapshot }
  | { type: "terminal.line.appended"; sessionId?: string; line: TerminalLine; limit?: number }
  | { type: "terminal.session.updated"; session: TerminalSession }
  | { type: "terminal.session.removed"; sessionId: string }
  | { type: "connection.status"; status: "connecting" | "connected" | "disconnected" | "error"; error?: string | null }

export const realtimeCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("terminal.execute"), command: z.string().trim().min(1).max(200), sessionId: z.string().min(1).max(100).optional() }),
  z.object({ type: z.literal("refresh.request"), scope: z.enum(["all", "session", "overview", "services", "docker", "nas", "tools", "account", "settings", "terminal"]) }),
])
export type RealtimeCommand = z.infer<typeof realtimeCommandSchema>

export const terminalExecuteSchema = z.object({
  command: z.string().trim().min(1).max(200),
  sessionId: z.string().min(1).max(100).optional(),
}).strict()

export interface AuditEntry {
  id: string
  at: string
  sessionId: string
  actor: string
  action: string
  resource: string
  outcome: "success" | "failure"
}
