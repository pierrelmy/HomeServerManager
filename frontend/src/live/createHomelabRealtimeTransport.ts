import { createMockHomelabRealtimeTransport } from "./mockHomelabRealtime"
import { createWebsocketHomelabRealtimeTransport } from "./websocketHomelabRealtime"
import type { HomelabRealtimeTransport } from "./homelabRealtime"

export function createHomelabRealtimeTransport(): HomelabRealtimeTransport {
  const wsUrl = import.meta.env.VITE_WS_URL?.trim()

  if (!wsUrl) {
    return createMockHomelabRealtimeTransport()
  }

  const resolvedUrl = wsUrl.startsWith("/")
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${wsUrl}`
    : wsUrl
  return createWebsocketHomelabRealtimeTransport(resolvedUrl)
}
