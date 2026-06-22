import type {
  AccountProfile,
  AuthProvider,
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
  uptime: "14j 6h",
  metrics: [
    {
      label: "CPU · 58°C",
      value: "37%",
      accent: "#185FA5",
      points: [22, 25, 30, 28, 33, 40, 38, 35, 30, 32, 37, 42, 45, 40, 36, 33, 30, 28, 32, 35, 38, 40, 37, 37],
    },
    {
      label: "Mémoire",
      value: "11,2 / 32 Go",
      accent: "#534AB7",
      points: [30, 31, 32, 33, 34, 33, 35, 36, 35, 34, 33, 34, 35, 36, 37, 36, 35, 34, 35, 36, 35, 34, 35, 35],
    },
    {
      label: "Réseau",
      value: "42 Mb/s / 8 Mb/s",
      accent: "#0F6E56",
      points: [10, 15, 12, 20, 18, 25, 30, 28, 22, 18, 15, 20, 25, 35, 40, 38, 30, 25, 20, 18, 22, 28, 35, 42],
    },
  ],
  disks: [
    { name: "system (nvme0)", used: 182, total: 500, unit: "Go", temp: 42, percent: 36 },
    { name: "pool-data (raid5)", used: 7.1, total: 8, unit: "To", temp: 39, percent: 89 },
    { name: "backups (hdd)", used: 1.8, total: 4, unit: "To", temp: 35, percent: 45 },
  ],
  alerts: [
    { level: "warning", label: "pool-data à 89% d'occupation", detail: "" },
    { level: "danger", label: "service plex redémarré 3x en 1h", detail: "" },
  ],
  logs: [
    { timestamp: "09:42:17", source: "docker", content: "container nginx started", level: "success" },
    { timestamp: "09:40:02", source: "plex", content: "connection reset", level: "danger" },
    { timestamp: "09:31:55", source: "system", content: "cron backup.sh ok", level: "muted" },
    { timestamp: "09:15:08", source: "ssh", content: "session opened pierre", level: "success" },
  ],
}

const services: ServiceRecord[] = [
  {
    id: "ollama",
    label: "Ollama",
    desc: "8 models ready to use",
    location: "tcp://...",
    status: "failed",
    logs: [
      { timestamp: "09:42:17", verbosity: "info", content: "Starting the service..." },
      { timestamp: "09:42:15", verbosity: "warning", content: "Unable to retrieve user subscription, defaulting to free models" },
      { timestamp: "09:42:11", verbosity: "debug", content: "Searching for free models" },
      { timestamp: "09:42:02", verbosity: "error", content: "Unable to start the service: No free models available" },
    ],
  },
  { id: "jenkins", label: "Jenkins", desc: "3 jobs running", location: "tcp://...", status: "stopped", logs: [] },
  { id: "docker-engine", label: "Docker Engine", desc: "5 containers • 4 running", location: "tcp://...", status: "running", logs: [] },
]

const docker: DockerSnapshot = {
  containers: [
    {
      id: "8d30b9e93aafe08e716d7c98460cd357e515939998f663993afa116699480788",
      name: "maltus_docker-logs-viewer",
      imageId: "sha256:9a6517f62b0ed16dd3019d5e185b6d769562cd0022e26fc516be488fcd5aed0e",
      volumeId: "9870983127957019843081273901",
      cpuPercent: 30,
      lastStarted: "6/22/2026, 6:29:54 PM",
    },
  ],
  images: [
    {
      id: "sha256:9a6517f62b0ed16dd3019d5e185b6d769562cd0022e26fc516be488fcd5aed0e",
      name: "maltus/docker-logs-viewer",
      tag: "0.0.2",
      created: "6/22/2026, 6:29:54 PM",
      sizeMB: 13.93,
    },
  ],
  volumes: [
    {
      id: "9870983127957019843081273901",
      name: "local-volume-1",
      sizeMB: 4,
      created: "6/22/2026, 6:29:54 PM",
    },
  ],
}

const nas: NasSnapshot = {
  capacityUsed: "9,1 To",
  healthSummary: "3/4 healthy",
  backupSummary: "4 dernières OK",
  temperatureSummary: "35 - 42 °C",
  pools: [
    { name: "pool-data", type: "raid5", used: 7.1, total: 8, temp: 39, health: "Warning" },
    { name: "backups", type: "hdd", used: 1.8, total: 4, temp: 35, health: "Healthy" },
    { name: "system", type: "nvme0", used: 182, total: 500, temp: 42, health: "Healthy" },
  ],
  backups: [
    { label: "Plex metadata", when: "Aujourd'hui, 03:15", result: "Succès" },
    { label: "Documents", when: "Hier, 02:40", result: "Succès" },
    { label: "Config système", when: "Hier, 01:10", result: "Succès" },
    { label: "Archive photos", when: "Il y a 3 jours", result: "Avertissement" },
  ],
  drives: [
    { slot: "bay-1", model: "WD Red Plus 4 To", temp: 35, status: "Healthy" },
    { slot: "bay-2", model: "WD Red Plus 4 To", temp: 36, status: "Healthy" },
    { slot: "bay-3", model: "Seagate IronWolf 8 To", temp: 39, status: "Warning" },
    { slot: "nvme", model: "Samsung 970 EVO Plus 500 Go", temp: 42, status: "Healthy" },
  ],
}

const tools: ToolsSnapshot = {
  tools: [
    { title: "Scan réseau", description: "Détecte les hôtes visibles et regroupe les ports courants.", tag: "Réseau" },
    { title: "Audit Docker", description: "Passe en revue les conteneurs, images inutilisées et volumes orphelins.", tag: "Conteneurs" },
    { title: "Export logs", description: "Récupère un paquet de logs pour dépannage ou archivage.", tag: "Support" },
    { title: "Vérif. sauvegardes", description: "Compare les dernières archives avec les checksums attendus.", tag: "Backups" },
    { title: "Refresh index", description: "Reconstruit les métadonnées visibles dans le tableau de bord.", tag: "Index" },
    { title: "Rapport santé", description: "Compile un état synthétique des alertes et des tendances.", tag: "Synthèse" },
  ],
  recentJobs: [
    { label: "Export logs - succès", when: "Aujourd'hui, 17:50" },
    { label: "Audit Docker - avertissement", when: "Aujourd'hui, 12:20" },
    { label: "Rapport santé - succès", when: "Hier, 18:05" },
  ],
}

const terminal: TerminalSnapshot = {
  activeSessionId: "local-shell",
  sessions: [
    {
      id: "local-shell",
      title: "Shell local",
      prompt: "pierre@homeserver01:~$",
      status: "connected",
      quickCommands: ["uptime", "docker ps", "df -h", "journalctl -p err -n 5"],
      lines: [
        {
          command: "uptime",
          timestamp: "09:42:17",
          status: "ok",
          output: [" 09:42:17 up 14 days,  6:12,  2 users,  load average: 0.19, 0.23, 0.21"],
        },
        {
          command: "docker ps --format 'table {{.Names}}\\t{{.Status}}'",
          timestamp: "09:42:11",
          status: "ok",
          output: [
            "NAMES                    STATUS",
            "plex                     Up 14 days",
            "nginx                    Up 14 days",
            "backup-agent             Up 2 days",
          ],
        },
      ],
    },
  ],
}

const account: AccountProfile = {
  name: "Pierre Martin",
  role: "Administrateur principal",
  email: "pierre@homeserver.local",
  status: "En ligne",
  providers: [
    { name: "Google", connected: true },
    { name: "GitHub", connected: true },
  ],
  sshKeys: [
    { name: "ed25519-pierre", fingerprint: "SHA256:vJm...wQ", status: "Valid" },
    { name: "backup-key", fingerprint: "SHA256:kT9...Lc", status: "Valid" },
  ],
  sessions: [
    { device: "MacBook Pro", status: "Active", lastSeen: "Maintenant" },
    { device: "iPhone", status: "Idle", lastSeen: "Il y a 12 min" },
  ],
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
  displayName: "Pierre Martin",
}

const delay = async <T,>(value: T): Promise<T> => Promise.resolve(value)

export function createMockHomelabRepository(): HomelabRepository {
  return {
    getSession: async () => delay(session),
    signIn: async (provider: AuthProvider) => {
      session = {
        isAuthenticated: true,
        provider,
        displayName: provider === "password" ? "Pierre Martin" : "Pierre Martin",
      }
      return delay(session)
    },
    signOut: async () => {
      session = { isAuthenticated: false, provider: null, displayName: null }
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
    actOnService: async (id, action) => {
      const service = services.find((item) => item.id === id)
      if (!service) throw new Error(`Service inconnu : ${id}`)
      service.status = action === "stop" ? "stopped" : "running"
      service.logs = [
        ...service.logs,
        { timestamp: new Date().toLocaleTimeString("fr-FR"), verbosity: "info" as const, content: `Service ${action} terminé` },
      ].slice(-100)
      return delay(structuredClone(service))
    },
    actOnContainer: async (id, action) => {
      const container = docker.containers.find((item) => item.id === id)
      if (!container) throw new Error(`Conteneur inconnu : ${id}`)
      container.cpuPercent = action === "stop" ? 0 : Math.max(1, container.cpuPercent)
      if (action !== "stop") container.lastStarted = new Date().toLocaleString("fr-FR")
      return delay(structuredClone(container))
    },
    actOnImage: async (id, action) => {
      const image = docker.images.find((item) => item.id === id)
      if (!image) throw new Error(`Image inconnue : ${id}`)
      image.created = new Date().toLocaleString("fr-FR")
      if (action === "run") {
        docker.containers.unshift({
          id: crypto.randomUUID().replaceAll("-", ""),
          name: `${image.name.replace(/[^a-z0-9]+/gi, "-")}-${docker.containers.length + 1}`,
          imageId: image.id,
          volumeId: docker.volumes[0]?.id ?? "",
          cpuPercent: 0,
          lastStarted: new Date().toLocaleString("fr-FR"),
        })
      }
      return delay(structuredClone(docker))
    },
    runNasScrub: async () => {
      const job = { label: "Scrub NAS - démarré", when: new Date().toLocaleString("fr-FR") }
      tools.recentJobs = [job, ...tools.recentJobs].slice(0, 20)
      return delay(job)
    },
    runTool: async (id) => {
      const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      const tool = tools.tools.find((item) => slug(item.title) === id)
      if (!tool) throw new Error(`Outil inconnu : ${id}`)
      const job = { label: `${tool.title} - succès`, when: new Date().toLocaleString("fr-FR") }
      tools.recentJobs = [job, ...tools.recentJobs].slice(0, 20)
      return delay(job)
    },
  }
}
