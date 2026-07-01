import type {
  AccountProfile,
  DockerSnapshot,
  NasSnapshot,
  OverviewSnapshot,
  ServiceRecord,
  SettingsState,
  TerminalSnapshot,
  ToolsSnapshot,
} from "../shared/contracts.js"

export const overviewSeed: OverviewSnapshot = {
  hostName: "Homelab",
  uptime: "0j 0h",
  metrics: [
    { label: "CPU", value: "0%", accent: "#185FA5", points: [] },
    { label: "Mémoire", value: "0 / 0 Go", accent: "#534AB7", points: [] },
    { label: "Réseau", value: "0 Mb/s / 0 Mb/s", accent: "#0F6E56", points: [] },
  ],
  disks: [],
  alerts: [],
  logs: [],
}

export const servicesSeed: ServiceRecord[] = []

export const dockerSeed: DockerSnapshot = {
  containers: [],
  images: [],
  volumes: [],
}

export const nasSeed: NasSnapshot = {
  capacityUsed: "N/A",
  healthSummary: "Aucune donnée",
  backupSummary: "Aucune donnée",
  temperatureSummary: "N/A",
  pools: [],
  backups: [],
  drives: [],
}

export const toolsSeed: ToolsSnapshot = {
  tools: [],
  recentJobs: [],
  updateStatus: {
    status: "idle",
    currentStep: 0,
    totalSteps: 0,
    stepLabel: "",
    startedAt: null,
    updatedAt: null,
    finishedAt: null,
    revision: null,
    error: null,
  },
}

export const terminalSeed: TerminalSnapshot = {
  activeSessionId: "terminal",
  sessions: [{
    id: "terminal",
    title: "Terminal",
    prompt: "homelab:~$",
    status: "connected",
    quickCommands: ["uptime", "docker ps", "df -h", "journalctl -p err -n 5"],
    lines: [],
  }],
}

export const accountSeed: AccountProfile = {
  name: "Utilisateur",
  role: "Non connecté",
  email: "",
  status: "Hors ligne",
  providers: [],
  sshKeys: [],
  sessions: [],
}

export const settingsSeed: SettingsState = { theme: "system", density: 72, alertsEnabled: true, compactSidebar: false }
