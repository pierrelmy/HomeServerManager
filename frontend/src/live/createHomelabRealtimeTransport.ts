import { createMockHomelabRealtimeTransport } from "./mockHomelabRealtime"
import { createWebsocketHomelabRealtimeTransport } from "./websocketHomelabRealtime"
import type { HomelabRealtimeTransport } from "./homelabRealtime"

export function createHomelabRealtimeTransport(): HomelabRealtimeTransport {
  const wsUrl = import.meta.env.VITE_WS_URL?.trim()
  const allowMocks = import.meta.env.VITE_ALLOW_MOCKS === "true"

  if (!wsUrl) {
    if (allowMocks) {
      return createMockHomelabRealtimeTransport()
    }

    const inferredUrl = new URL(window.location.origin)
    if (["4173", "5173"].includes(inferredUrl.port)) {
      inferredUrl.port = "3000"
    }
    inferredUrl.protocol = inferredUrl.protocol === "https:" ? "wss:" : "ws:"
    inferredUrl.pathname = "/live"
    inferredUrl.search = ""
    inferredUrl.hash = ""
    return createWebsocketHomelabRealtimeTransport(inferredUrl.toString())
  }

  const resolvedUrl = wsUrl.startsWith("/")
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${wsUrl}`
    : wsUrl
  return createWebsocketHomelabRealtimeTransport(resolvedUrl)
}
