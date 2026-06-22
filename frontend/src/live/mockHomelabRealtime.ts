import type {
  HomelabConnectionStatus,
  HomelabRealtimeEvent,
  HomelabRealtimeTransport,
} from "./homelabRealtime"

export function createMockHomelabRealtimeTransport(): HomelabRealtimeTransport {
  return {
    mode: "mock",
    connect: ({ onStatus }: { onEvent: (event: HomelabRealtimeEvent) => void; onStatus: (status: HomelabConnectionStatus, error?: string | null) => void }) => {
      onStatus("connected")

      return {
        close() {
          onStatus("disconnected")
        },
        send() {},
      }
    },
  }
}
