import type { WebSocket } from "ws"
import type { RealtimeEvent } from "../shared/contracts.js"

interface Client {
  socket: WebSocket
  sessionId?: string
}

export class EventHub {
  private readonly clients = new Set<Client>()

  add(socket: WebSocket, sessionId?: string): () => void {
    const client: Client = sessionId === undefined ? { socket } : { socket, sessionId }
    this.clients.add(client)
    return () => this.clients.delete(client)
  }

  broadcast(event: RealtimeEvent): void {
    const payload = JSON.stringify(event)
    for (const client of this.clients) {
      if (client.socket.readyState === client.socket.OPEN) client.socket.send(payload)
    }
  }

  sendToSession(sessionId: string, event: RealtimeEvent): void {
    const payload = JSON.stringify(event)
    for (const client of this.clients) {
      if (client.sessionId === sessionId && client.socket.readyState === client.socket.OPEN) client.socket.send(payload)
    }
  }

  get size(): number { return this.clients.size }
}
