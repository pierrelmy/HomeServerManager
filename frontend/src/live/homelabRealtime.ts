import type {
  AccountProfile,
  AuthProvider,
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

export type HomelabConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

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

export type HomelabRealtimeEvent =
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
  | { type: "connection.status"; status: HomelabConnectionStatus; error?: string | null }

export type HomelabRealtimeCommand =
  | { type: "terminal.execute"; command: string; sessionId?: string }
  | { type: "refresh.request"; scope: "all" | keyof HomelabLiveBundle }

export interface HomelabRealtimeConnection {
  close(): void
  send(command: HomelabRealtimeCommand): void
}

export interface HomelabRealtimeTransport {
  mode: "mock" | "websocket"
  connect(handlers: {
    onEvent(event: HomelabRealtimeEvent): void
    onStatus(status: HomelabConnectionStatus, error?: string | null): void
  }): HomelabRealtimeConnection
}

export interface HomelabLiveEndpoints {
  session: string
  overview: string
  services: string
  docker: string
  nas: string
  tools: string
  terminal: string
  account: string
  settings: string
}

export type { AuthProvider }
