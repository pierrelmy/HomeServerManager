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
  hostName: "homeserver01",
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

const services: ServiceRecord[] = [
  {
    id: "ollama",
    label: "Ollama",
    desc: "LLM local",
    location: "ollama.service",
    unit: "ollama.service",
    servicePath: null,
    webUrl: null,
    status: "failed",
    logs: [
      { timestamp: "00:00:01", verbosity: "info", content: "Starting the service..." },
      { timestamp: "00:00:02", verbosity: "error", content: "Failed to start ollama.service: exit code 1" },
    ],
  },
  {
    id: "jenkins",
    label: "Jenkins",
    desc: "Serveur CI/CD",
    location: "jenkins.service",
    unit: "jenkins.service",
    servicePath: null,
    webUrl: null,
    status: "stopped",
    logs: [],
  },
  {
    id: "docker-engine",
    label: "Docker Engine",
    desc: "Moteur de conteneurs",
    location: "docker.service",
    unit: "docker.service",
    servicePath: null,
    webUrl: null,
    status: "running",
    logs: [],
  },
]

const docker: DockerSnapshot = {
  containers: [],
  images: [],
  volumes: [],
  error: null,
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
      prompt: "pierre@homeserver01:~$",
      status: "connected",
      quickCommands: ["uptime", "docker ps", "df -h", "journalctl -p err -n 5"],
      lines: [
        { command: "uptime", output: [" 10:32:14 up 3 days, 4:17, 1 user, load average: 0.12, 0.08, 0.05"], status: "ok", timestamp: "10:32:14" },
        { command: "docker ps", output: ["CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS   NAMES"], status: "ok", timestamp: "10:32:20" },
      ],
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
    actOnService: async (id, action) => {
      const service = services.find((item) => item.id === id)
      if (!service) throw new Error("Service introuvable dans le mode mock.")
      service.status = action === "stop" ? "stopped" : "running"
      return delay({ ...service })
    },
    actOnContainer: async () => {
      throw new Error("Aucun conteneur n'est configuré dans ce mode.")
    },
    actOnImage: async () => {
      throw new Error("Aucune image n'est configurée dans ce mode.")
    },
    runNasScrub: async () => {
      throw new Error("Aucun NAS n'est configuré dans ce mode.")
    },
    runTool: async () => {
      throw new Error("Aucun outil n'est configuré dans ce mode.")
    },
    clearTerminalSession: async (id) => {
      const sessionState = terminal.sessions.find((item) => item.id === id)
      if (!sessionState) throw new Error("Session terminal introuvable dans le mode mock.")
      sessionState.lines = []
      return delay(terminal)
    },
  }
}
