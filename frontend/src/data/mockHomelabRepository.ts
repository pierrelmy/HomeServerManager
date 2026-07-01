import type {
  AccountProfile,
  AuthSession,
  DockerSnapshot,
  NasSnapshot,
  OverviewSnapshot,
  SettingsState,
  ServiceRecord,
  ToolsSnapshot,
  TerminalSnapshot,
} from "../domain/homelab"
import type { HomelabRepository } from "./homelabRepository"

const overview: OverviewSnapshot = {
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

const services: ServiceRecord[] = []

const docker: DockerSnapshot = {
  containers: [],
  images: [],
  volumes: [],
}

const nas: NasSnapshot = {
  capacityUsed: "N/A",
  healthSummary: "Aucune donnée",
  backupSummary: "Aucune donnée",
  temperatureSummary: "N/A",
  pools: [],
  backups: [],
  drives: [],
}

const tools: ToolsSnapshot = {
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

const terminal: TerminalSnapshot = {
  activeSessionId: "terminal",
  sessions: [
    {
      id: "terminal",
      title: "Terminal",
      prompt: "homelab:~$",
      status: "connected",
      quickCommands: ["uptime", "docker ps", "df -h", "journalctl -p err -n 5"],
      lines: [],
    },
  ],
}

const account: AccountProfile = {
  name: "Utilisateur",
  role: "Non connecté",
  email: "",
  status: "Hors ligne",
  providers: [],
  sshKeys: [],
  sessions: [],
}

let settings: SettingsState = {
  theme: "system",
  density: 72,
  alertsEnabled: true,
  compactSidebar: false,
}

let session: AuthSession = {
  isAuthenticated: true,
  provider: "password",
  displayName: "Utilisateur",
  email: "admin@localhost.test",
  role: "admin",
}

const delay = async <T,>(value: T): Promise<T> => Promise.resolve(value)

export function createMockHomelabRepository(): HomelabRepository {
  return {
    getSession: async () => delay(session),
    signIn: async () => {
      session = {
        isAuthenticated: true,
        provider: "password",
        displayName: "Utilisateur",
        email: "admin@localhost.test",
        role: "admin",
      }
      return delay(session)
    },
    signOut: async () => {
      session = { isAuthenticated: false, provider: null, displayName: null, email: null, role: null }
      return delay(session)
    },
    getOverview: async () => delay(overview),
    listServices: async () => delay(services),
    getDockerSnapshot: async () => delay(docker),
    getNasSnapshot: async () => delay(nas),
    getToolsSnapshot: async () => delay(tools),
    getTerminalSnapshot: async () => delay(terminal),
    getAccountProfile: async () => delay(account),
    getSettings: async () => delay(settings),
    updateSettings: async (patch: Partial<SettingsState>) => {
      settings = { ...settings, ...patch }
      return delay(settings)
    },
    changePassword: async () => delay(undefined),
    addService: async (input) => {
      const id = (input.label || input.serviceUnit.replace(/\.service$/i, ""))
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      const service: ServiceRecord = {
        id,
        label: input.label,
        desc: input.description ?? `Service géré via ${input.serviceUnit}`,
        location: input.servicePath ?? input.serviceUnit,
        unit: input.serviceUnit,
        servicePath: input.servicePath ?? null,
        webUrl: input.webUrl ?? null,
        status: input.startAfterInstall ? "running" : "stopped",
        logs: [{ timestamp: "00:00:00", verbosity: "info", content: "Service simulé ajouté" }],
      }
      services.unshift(service)
      return delay(service)
    },
    refreshServices: async () => delay(services),
    refreshServiceLogs: async (id) => {
      const service = services.find((item) => item.id === id)
      if (!service) throw new Error("Service introuvable dans le mode mock.")
      return delay(service)
    },
    actOnService: async (_id, _action) => {
      throw new Error("Aucun service n'est configuré dans ce mode.")
    },
    actOnContainer: async (_id, _action) => {
      throw new Error("Aucun conteneur n'est configuré dans ce mode.")
    },
    actOnImage: async (_id, _action) => {
      throw new Error("Aucune image n'est configurée dans ce mode.")
    },
    runNasScrub: async () => {
      throw new Error("Aucun NAS n'est configuré dans ce mode.")
    },
    runTool: async () => {
      throw new Error("Aucun outil n'est configuré dans ce mode.")
    },
  }
}
