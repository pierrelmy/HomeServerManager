import type {
  AccountProfile,
  AuthSession,
  DockerSnapshot,
  NasSnapshot,
  OverviewSnapshot,
  SettingsState,
  ServiceLogEntry,
  ServiceRecord,
  TerminalLine,
  TerminalSession,
  TerminalSnapshot,
  ToolsSnapshot,
} from "../domain/homelab"
import type { HomelabRepository } from "../data/homelabRepository"
import { createStore, type Store } from "./createStore"
import type {
  HomelabConnectionStatus,
  HomelabLiveBundle,
  HomelabRealtimeCommand,
  HomelabRealtimeConnection,
  HomelabRealtimeEvent,
  HomelabRealtimeTransport,
} from "./homelabRealtime"

export interface HomelabLiveState {
  ready: boolean
  connectionStatus: HomelabConnectionStatus
  error: string | null
  bootstrapError: string | null
  lastSyncedAt: string | null
}

export interface HomelabLiveManager {
  state: Store<HomelabLiveState>
  session: Store<AuthSession | null>
  overview: Store<OverviewSnapshot | null>
  services: Store<ServiceRecord[] | null>
  docker: Store<DockerSnapshot | null>
  nas: Store<NasSnapshot | null>
  tools: Store<ToolsSnapshot | null>
  account: Store<AccountProfile | null>
  settings: Store<SettingsState | null>
  terminal: Store<TerminalSnapshot | null>
  bootstrap(): Promise<void>
  connect(): () => void
  refreshAll(): Promise<void>
  signIn(email: string, password: string): Promise<AuthSession>
  signOut(): Promise<AuthSession>
  updateSettings(patch: Partial<SettingsState>): Promise<SettingsState>
  changePassword(currentPassword: string, nextPassword: string): Promise<void>
  actOnService(id: string, action: "start" | "stop" | "restart"): Promise<ServiceRecord>
  actOnContainer(id: string, action: "start" | "stop" | "restart"): Promise<void>
  actOnImage(id: string, action: "pull" | "run"): Promise<void>
  runNasScrub(): Promise<void>
  runTool(id: string): Promise<void>
  executeTerminalCommand(command: string): void
  requestRefresh(scope: keyof HomelabLiveBundle | "all"): void
}

function nowStamp(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function trimTo<T>(items: T[], limit = 10): T[] {
  return items.length > limit ? items.slice(items.length - limit) : items
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id)
  if (index < 0) {
    return [next, ...items]
  }

  const clone = [...items]
  clone[index] = next
  return clone
}

function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id)
}

function updateServiceLogs(services: ServiceRecord[], serviceId: string, log: ServiceLogEntry, limit = 10): ServiceRecord[] {
  return services.map((service) => {
    if (service.id !== serviceId) {
      return service
    }

    return {
      ...service,
      logs: trimTo([...service.logs, log], limit),
    }
  })
}

function updateTerminalSession(snapshot: TerminalSnapshot, sessionId: string | undefined, updater: (session: TerminalSession) => TerminalSession): TerminalSnapshot {
  const requestedSessionId = sessionId ?? snapshot.activeSessionId
  const activeSessionId = snapshot.sessions.some((session) => session.id === requestedSessionId)
    ? requestedSessionId
    : snapshot.sessions[0]?.id ?? requestedSessionId

  return {
    ...snapshot,
    activeSessionId,
    sessions: snapshot.sessions.map((session) => {
      if (session.id !== activeSessionId) {
        return session
      }

      return updater(session)
    }),
  }
}

function simulateTerminalLine(command: string): TerminalLine {
  const normalized = command.trim().toLowerCase()

  if (normalized === "df -h") {
    return {
      command,
      timestamp: nowStamp(),
      status: "ok",
      output: [
        "Filesystem      Size  Used Avail Use% Mounted on",
        "/dev/nvme0n1    500G  182G  318G  37% /",
        "/dev/md0        8.0T  7.1T  0.9T  89% /pool-data",
      ],
    }
  }

  if (normalized === "journalctl -p err -n 5") {
    return {
      command,
      timestamp: nowStamp(),
      status: "warning",
      output: [
        "Jun 22 17:02:14 plex connection reset",
        "Jun 22 16:58:40 backup-agent transient write timeout",
        "Jun 22 16:40:03 nginx upstream unavailable",
      ],
    }
  }

  if (normalized === "kubectl get pods") {
    return {
      command,
      timestamp: nowStamp(),
      status: "warning",
      output: [
        "No cluster configured in this environment.",
        "Connect a cluster before using Kubernetes commands.",
      ],
    }
  }

  return {
    command,
    timestamp: nowStamp(),
    status: "ok",
    output: [`Commande simulée: ${command}`, "Aucun backend n'est branché sur cette vue."],
  }
}

export function createHomelabLiveManager(repository: HomelabRepository, transport: HomelabRealtimeTransport): HomelabLiveManager {
  const state = createStore<HomelabLiveState>({
    ready: false,
    connectionStatus: "connecting",
    error: null,
    bootstrapError: null,
    lastSyncedAt: null,
  })
  const session = createStore<AuthSession | null>(null)
  const overview = createStore<OverviewSnapshot | null>(null)
  const services = createStore<ServiceRecord[] | null>(null)
  const docker = createStore<DockerSnapshot | null>(null)
  const nas = createStore<NasSnapshot | null>(null)
  const tools = createStore<ToolsSnapshot | null>(null)
  const account = createStore<AccountProfile | null>(null)
  const settings = createStore<SettingsState | null>(null)
  const terminal = createStore<TerminalSnapshot | null>(null)

  let connection: HomelabRealtimeConnection | null = null
  let bootstrapPromise: Promise<void> | null = null

  const setReady = (patch: Partial<HomelabLiveState>) => {
    state.update((current) => ({ ...current, ...patch }))
  }

  const syncBundle = (bundle: Partial<HomelabLiveBundle>) => {
    if (Object.hasOwn(bundle, "session")) session.setState(bundle.session ?? null)
    if (Object.hasOwn(bundle, "overview")) overview.setState(bundle.overview ?? null)
    if (Object.hasOwn(bundle, "services")) services.setState(bundle.services ?? null)
    if (Object.hasOwn(bundle, "docker")) docker.setState(bundle.docker ?? null)
    if (Object.hasOwn(bundle, "nas")) nas.setState(bundle.nas ?? null)
    if (Object.hasOwn(bundle, "tools")) tools.setState(bundle.tools ?? null)
    if (Object.hasOwn(bundle, "account")) account.setState(bundle.account ?? null)
    if (Object.hasOwn(bundle, "settings")) settings.setState(bundle.settings ?? null)
    if (Object.hasOwn(bundle, "terminal")) terminal.setState(bundle.terminal ?? null)
  }

  const applyRealtimeEvent = (event: HomelabRealtimeEvent) => {
    switch (event.type) {
      case "bundle.synced":
        syncBundle(event.bundle)
        return
      case "session.updated":
        session.setState(event.session)
        return
      case "overview.updated":
        overview.setState(event.overview)
        return
      case "services.updated":
        services.setState(event.services)
        return
      case "service.updated":
        services.update((current) => upsertById(current ?? [], event.service))
        return
      case "service.removed":
        services.update((current) => removeById(current ?? [], event.serviceId))
        return
      case "service.log.appended":
        services.update((current) => updateServiceLogs(current ?? [], event.serviceId, event.log, event.limit))
        return
      case "docker.updated":
        docker.setState(event.docker)
        return
      case "nas.updated":
        nas.setState(event.nas)
        return
      case "tools.updated":
        tools.setState(event.tools)
        return
      case "account.updated":
        account.setState(event.account)
        return
      case "settings.updated":
        settings.setState(event.settings)
        return
      case "terminal.updated":
        terminal.setState(event.terminal)
        return
      case "terminal.line.appended":
        terminal.update((current) => {
          const snapshot = current ?? {
            activeSessionId: "terminal",
            sessions: [
              {
                id: "terminal",
                title: "Terminal",
                prompt: "homeserver:~$",
                status: "connected",
                quickCommands: ["uptime"],
                lines: [],
              },
            ],
          }

          return updateTerminalSession(snapshot, event.sessionId, (sessionState) => ({
            ...sessionState,
            lines: trimTo([...sessionState.lines, event.line], event.limit),
          }))
        })
        return
      case "terminal.session.updated":
        terminal.update((current) => {
          const snapshot = current ?? {
            activeSessionId: event.session.id,
            sessions: [event.session],
          }
          const updatedSessions = upsertById(snapshot.sessions, event.session)
          return {
            ...snapshot,
            activeSessionId: event.session.id,
            sessions: updatedSessions,
          }
        })
        return
      case "terminal.session.removed":
        terminal.update((current) => {
          if (!current) {
            return current
          }

          const nextSessions = removeById(current.sessions, event.sessionId)
          return {
            ...current,
            activeSessionId: current.activeSessionId === event.sessionId ? nextSessions[0]?.id ?? "" : current.activeSessionId,
            sessions: nextSessions,
          }
        })
        return
      case "connection.status":
        setReady({ connectionStatus: event.status, error: event.error ?? null })
        return
    }
  }

  const openRealtimeConnection = () => transport.connect({
    onEvent: applyRealtimeEvent,
    onStatus: (status, error) => {
      setReady({ connectionStatus: status, error: error ?? null })
    },
  })

  const reconnectRealtime = () => {
    connection?.close()
    connection = openRealtimeConnection()
  }

  const loadAll = async () => {
    const nextSession = await repository.getSession()
    session.setState(nextSession)

    if (!nextSession.isAuthenticated) {
      setReady({
        ready: true,
        lastSyncedAt: new Date().toISOString(),
        error: null,
        bootstrapError: null,
      })
      return
    }

    const [nextOverview, nextServices, nextDocker, nextNas, nextTools, nextTerminal, nextAccount, nextSettings] =
      await Promise.all([
        repository.getOverview(),
        repository.listServices(),
        repository.getDockerSnapshot(),
        repository.getNasSnapshot(),
        repository.getToolsSnapshot(),
        repository.getTerminalSnapshot(),
        repository.getAccountProfile(),
        repository.getSettings(),
      ])

    syncBundle({
      overview: nextOverview,
      services: nextServices,
      docker: nextDocker,
      nas: nextNas,
      tools: nextTools,
      terminal: nextTerminal,
      account: nextAccount,
      settings: nextSettings,
    })
    setReady({
      ready: true,
      lastSyncedAt: new Date().toISOString(),
      error: null,
      bootstrapError: null,
    })
  }

  return {
    state,
    session,
    overview,
    services,
    docker,
    nas,
    tools,
    account,
    settings,
    terminal,
    async bootstrap() {
      if (bootstrapPromise) {
        return bootstrapPromise
      }

      setReady({ ready: false, bootstrapError: null })
      bootstrapPromise = loadAll()
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Impossible de charger les données"
          setReady({ ready: true, bootstrapError: message })
        })
        .finally(() => {
          bootstrapPromise = null
        })

      return bootstrapPromise
    },
    connect() {
      if (connection) {
        return () => {
          connection?.close()
          connection = null
        }
      }

      connection = openRealtimeConnection()

      return () => {
        connection?.close()
        connection = null
      }
    },
    async refreshAll() {
      try {
        await loadAll()
      } catch (error) {
        setReady({ error: error instanceof Error ? error.message : "La synchronisation a échoué" })
      }
    },
    async signIn(email: string, password: string) {
      const nextSession = await repository.signIn(email, password)
      session.setState(nextSession)
      await loadAll()
      if (!session.getSnapshot()?.isAuthenticated) {
        throw new Error("La session n'a pas pu être persistée dans le navigateur. En développement local, utilisez la même origine pour le frontend et l'API, par exemple 127.0.0.1 des deux côtés.")
      }
      reconnectRealtime()
      return nextSession
    },
    async signOut() {
      const nextSession = await repository.signOut()
      syncBundle({
        session: nextSession,
        overview: null,
        services: null,
        docker: null,
        nas: null,
        tools: null,
        account: null,
        settings: null,
        terminal: null,
      })
      reconnectRealtime()
      return nextSession
    },
    async updateSettings(patch: Partial<SettingsState>) {
      const nextSettings = await repository.updateSettings(patch)
      settings.setState(nextSettings)
      return nextSettings
    },
    async changePassword(currentPassword, nextPassword) {
      await repository.changePassword(currentPassword, nextPassword)
    },
    async actOnService(id, action) {
      const nextService = await repository.actOnService(id, action)
      services.update((current) => upsertById(current ?? [], nextService))
      return nextService
    },
    async actOnContainer(id, action) {
      await repository.actOnContainer(id, action)
      docker.setState(await repository.getDockerSnapshot())
    },
    async actOnImage(id, action) {
      const nextDocker = await repository.actOnImage(id, action)
      docker.setState(nextDocker)
    },
    async runNasScrub() {
      await repository.runNasScrub()
      const [nextTools, nextNas] = await Promise.all([repository.getToolsSnapshot(), repository.getNasSnapshot()])
      tools.setState(nextTools)
      nas.setState(nextNas)
    },
    async runTool(id) {
      await repository.runTool(id)
      tools.setState(await repository.getToolsSnapshot())
    },
    executeTerminalCommand(command: string) {
      if (transport.mode === "websocket") {
        const commandPayload: HomelabRealtimeCommand = { type: "terminal.execute", command }
        connection?.send(commandPayload)
        return
      }

      const nextLine = simulateTerminalLine(command)
      const nextSessionId = terminal.getSnapshot()?.activeSessionId ?? "local-shell"

      applyRealtimeEvent({
        type: "terminal.line.appended",
        sessionId: nextSessionId,
        line: nextLine,
      })
    },
    requestRefresh(scope: keyof HomelabLiveBundle | "all") {
      const payload: HomelabRealtimeCommand = { type: "refresh.request", scope }
      connection?.send(payload)
      if (transport.mode !== "websocket" && scope === "all") {
        void loadAll()
      }
    },
  }
}
