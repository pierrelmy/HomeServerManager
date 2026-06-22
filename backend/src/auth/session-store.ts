import { randomUUID } from "node:crypto"
import type { AuthProvider, AuthSession, Role } from "../shared/contracts.js"

export const SESSION_COOKIE = "homelab_session"

export interface StoredSession {
  id: string
  userId: string
  provider: AuthProvider
  displayName: string
  role: Role
  expiresAt: number
}

export class SessionStore {
  private readonly sessions = new Map<string, StoredSession>()

  create(provider: AuthProvider): StoredSession {
    const session: StoredSession = {
      id: randomUUID(),
      userId: "pierre",
      provider,
      displayName: "Pierre Martin",
      role: "admin",
      expiresAt: Date.now() + 24 * 60 * 60 * 1_000,
    }
    this.sessions.set(session.id, session)
    return session
  }

  get(id: string | undefined): StoredSession | undefined {
    if (!id) return undefined
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(id)
      return undefined
    }
    return session
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(id)
  }
}

export function toAuthSession(session: StoredSession | undefined): AuthSession {
  if (!session) return { isAuthenticated: false, provider: null, displayName: null }
  return { isAuthenticated: true, provider: session.provider, displayName: session.displayName }
}
