import type {
  HomelabConnectionStatus,
  HomelabRealtimeCommand,
  HomelabRealtimeConnection,
  HomelabRealtimeEvent,
  HomelabRealtimeTransport,
} from "./homelabRealtime"

const eventPayloadKey: Partial<Record<HomelabRealtimeEvent["type"], string>> = {
  "bundle.synced": "bundle",
  "session.updated": "session",
  "overview.updated": "overview",
  "services.updated": "services",
  "service.updated": "service",
  "service.removed": "serviceId",
  "service.log.appended": "log",
  "docker.updated": "docker",
  "nas.updated": "nas",
  "tools.updated": "tools",
  "account.updated": "account",
  "settings.updated": "settings",
  "terminal.updated": "terminal",
  "terminal.line.appended": "line",
  "terminal.session.updated": "session",
  "terminal.session.removed": "sessionId",
  "connection.status": "status",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseEvent(payload: string): HomelabRealtimeEvent | null {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!isRecord(parsed) || typeof parsed.type !== "string" || !(parsed.type in eventPayloadKey)) return null
    const type = parsed.type as HomelabRealtimeEvent["type"]
    const payloadKey = eventPayloadKey[type]
    if (!payloadKey || !(payloadKey in parsed)) return null
    if (type === "connection.status" && !["connecting", "connected", "disconnected", "error"].includes(String(parsed.status))) return null
    if (["service.removed", "terminal.session.removed"].includes(type) && typeof parsed[payloadKey] !== "string") return null
    return parsed as unknown as HomelabRealtimeEvent
  } catch {
    return null
  }
}

export function createWebsocketHomelabRealtimeTransport(url: string): HomelabRealtimeTransport {
  return {
    mode: "websocket",
    connect: ({ onEvent, onStatus }): HomelabRealtimeConnection => {
      let socket: WebSocket | null = null
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null
      let reconnectAttempt = 0
      let closedByClient = false
      const pendingCommands: string[] = []

      const emitStatus = (status: HomelabConnectionStatus, error?: string | null) => onStatus(status, error)

      const scheduleReconnect = () => {
        if (closedByClient || reconnectTimer) return
        const delay = Math.min(10_000, 500 * 2 ** reconnectAttempt)
        reconnectAttempt += 1
        emitStatus("connecting")
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          openSocket()
        }, delay)
      }

      const openSocket = () => {
        if (closedByClient) return
        emitStatus("connecting")
        const nextSocket = new WebSocket(url)
        socket = nextSocket

        nextSocket.addEventListener("open", () => {
          if (socket !== nextSocket) return
          reconnectAttempt = 0
          emitStatus("connected")
          while (pendingCommands.length > 0 && nextSocket.readyState === WebSocket.OPEN) {
            nextSocket.send(pendingCommands.shift()!)
          }
        })

        nextSocket.addEventListener("message", (event) => {
          if (socket !== nextSocket || typeof event.data !== "string") return
          const nextEvent = parseEvent(event.data)
          if (nextEvent) onEvent(nextEvent)
        })

        nextSocket.addEventListener("error", () => {
          if (socket === nextSocket) emitStatus("error", "La connexion temps réel a échoué")
        })

        nextSocket.addEventListener("close", () => {
          if (socket !== nextSocket) return
          socket = null
          if (!closedByClient) {
            emitStatus("disconnected")
            scheduleReconnect()
          }
        })
      }

      openSocket()

      return {
        close() {
          closedByClient = true
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = null
          socket?.close()
          socket = null
          pendingCommands.length = 0
        },
        send(command: HomelabRealtimeCommand) {
          const payload = JSON.stringify(command)
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(payload)
            return
          }
          pendingCommands.push(payload)
          if (pendingCommands.length > 50) pendingCommands.shift()
        },
      }
    },
  }
}
