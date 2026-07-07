export type ServiceStatus = "starting" | "running" | "stopping" | "stopped" | "failed"
export type LogVerbosity = "debug" | "info" | "warning" | "error"

export interface MetricSparkline {
  label: string
  value: string
  accent: string
  points: number[]
}

export interface DiskInfo {
  name: string
  used: number
  total: number
  unit: "Go" | "To"
  temp: number
  percent: number
}

export interface AlertItem {
  level: "warning" | "danger"
  label: string
  detail: string
}

export interface LogEntry {
  timestamp: string
  source: string
  content: string
  level: "success" | "danger" | "muted"
}

export interface OverviewSnapshot {
  hostName: string
  uptime: string
  metrics: MetricSparkline[]
  disks: DiskInfo[]
  alerts: AlertItem[]
  logs: LogEntry[]
}

export interface ServiceLogEntry {
  timestamp: string
  verbosity: LogVerbosity
  content: string
}

export interface CreateServiceInput {
  label: string
  description?: string
  serviceUnit: string
  servicePath?: string
  installCommand?: string
  webUrl?: string
  startAfterInstall: boolean
}

export interface ServiceRecord {
  id: string
  label: string
  desc: string
  location: string
  unit: string
  servicePath: string | null
  webUrl: string | null
  status: ServiceStatus
  logs: ServiceLogEntry[]
}

export interface DockerContainer {
  id: string
  name: string
  imageId: string
  volumeId: string
  cpuPercent: number
  lastStarted: string
}

export interface DockerImage {
  id: string
  name: string
  tag: string
  created: string
  sizeMB: number
}

export interface DockerVolume {
  id: string
  name: string
  sizeMB: number
  created: string
}

export interface DockerSnapshot {
  containers: DockerContainer[]
  images: DockerImage[]
  volumes: DockerVolume[]
  error: string | null
}

export interface NasPool {
  name: string
  type: string
  used: number
  total: number
  temp: number
  health: "Healthy" | "Warning"
}

export interface NasDrive {
  slot: string
  model: string
  temp: number
  status: "Healthy" | "Warning"
}

export interface NasBackup {
  label: string
  when: string
  result: "Succès" | "Avertissement"
}

export interface NasSnapshot {
  capacityUsed: string
  healthSummary: string
  backupSummary: string
  temperatureSummary: string
  pools: NasPool[]
  backups: NasBackup[]
  drives: NasDrive[]
}

export interface ToolShortcut {
  id: string
  title: string
  description: string
  tag: string
}

export interface ToolJob {
  label: string
  when: string
}

export interface UpdateStatus {
  status: "idle" | "running" | "completed" | "failed"
  currentStep: number
  totalSteps: number
  stepLabel: string
  startedAt: string | null
  updatedAt: string | null
  finishedAt: string | null
  revision: string | null
  error: string | null
}

export interface ToolsSnapshot {
  tools: ToolShortcut[]
  recentJobs: ToolJob[]
  updateStatus: UpdateStatus
}

export interface TerminalLine {
  command: string
  output: string[]
  status: "ok" | "warning" | "error"
  timestamp: string
}

export interface TerminalSession {
  id: string
  title: string
  prompt: string
  status: "connected" | "reconnecting" | "disconnected"
  quickCommands: string[]
  lines: TerminalLine[]
}

export interface TerminalSnapshot {
  activeSessionId: string
  sessions: TerminalSession[]
}

export interface AccountProfile {
  name: string
  role: string
  email: string
  status: "En ligne" | "Hors ligne"
  providers: Array<{ name: string; connected: boolean }>
  sshKeys: Array<{ name: string; fingerprint: string; status: "Valid" }>
  sessions: Array<{ device: string; status: "Active" | "Idle"; lastSeen: string }>
}

export interface SettingsState {
  theme: "system" | "light" | "dark"
  density: number
  alertsEnabled: boolean
  compactSidebar: boolean
}

export type AuthProvider = "google" | "github" | "password"

export interface AuthSession {
  isAuthenticated: boolean
  provider: AuthProvider | null
  displayName: string | null
  email: string | null
  role: "admin" | "viewer" | null
}
