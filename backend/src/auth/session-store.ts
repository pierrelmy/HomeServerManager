import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { AuthProvider, AuthSession, Role } from "../shared/contracts.js"

export const SESSION_COOKIE = "homelab_session"

export interface StoredSession {
  id: string
  userId: string
  provider: AuthProvider
  displayName: string
  email: string
  role: Role
  expiresAt: number
}

interface SessionStoreOptions {
  databasePath?: string
  adminEmail?: string
  adminPassword?: string
  adminDisplayName?: string
  syncAdminOnBoot?: boolean
}

interface SessionRow {
  id: string
  user_id: string
  provider: AuthProvider
  display_name: string
  email: string
  role: Role
  expires_at: number
}

interface UserRow {
  id: string
  email: string
  display_name: string
  password_hash: string
  role: Role
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `${salt.toString("base64")}:${hash.toString("base64")}`
}

function verifyPassword(password: string, encoded: string): boolean {
  const [saltValue, hashValue] = encoded.split(":")
  if (!saltValue || !hashValue) return false
  const expected = Buffer.from(hashValue, "base64")
  const actual = scryptSync(password, Buffer.from(saltValue, "base64"), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export class SessionStore {
  private readonly database: DatabaseSync
  private readonly dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"))

  constructor(options: SessionStoreOptions = {}) {
    const databasePath = options.databasePath ?? ":memory:"
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true })
    this.database = new DatabaseSync(databasePath)
    this.database.exec("PRAGMA foreign_keys = ON")
    if (databasePath !== ":memory:") this.database.exec("PRAGMA journal_mode = WAL")
    this.migrate()

    if (options.adminEmail && options.adminPassword) {
      this.ensureAdmin(
        options.adminEmail,
        options.adminPassword,
        options.adminDisplayName ?? "Administrator",
        options.syncAdminOnBoot ?? false,
      )
    }
  }

  authenticatePassword(email: string, password: string): StoredSession | undefined {
    const user = this.database.prepare(`
      SELECT id, email, display_name, password_hash, role
      FROM users
      WHERE email = ?
    `).get(normalizeEmail(email)) as unknown as UserRow | undefined

    const passwordValid = verifyPassword(password, user?.password_hash ?? this.dummyPasswordHash)
    if (!user || !passwordValid) return undefined

    const session: StoredSession = {
      id: randomUUID(),
      userId: user.id,
      provider: "password",
      displayName: user.display_name,
      email: user.email,
      role: user.role,
      expiresAt: Date.now() + 24 * 60 * 60 * 1_000,
    }
    this.database.prepare(`
      INSERT INTO sessions (id, user_id, provider, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(session.id, session.userId, session.provider, session.expiresAt)
    return session
  }

  get(id: string | undefined): StoredSession | undefined {
    if (!id) return undefined
    const row = this.database.prepare(`
      SELECT sessions.id, sessions.user_id, sessions.provider, sessions.expires_at,
             users.display_name, users.email, users.role
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
    `).get(id) as unknown as SessionRow | undefined
    if (!row) return undefined
    if (row.expires_at <= Date.now()) {
      this.delete(id)
      return undefined
    }
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
    }
  }

  delete(id: string | undefined): void {
    if (id) this.database.prepare("DELETE FROM sessions WHERE id = ?").run(id)
  }

  changePassword(userId: string, currentPassword: string, nextPassword: string, currentSessionId: string): boolean {
    const user = this.database.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined
    if (!user || !verifyPassword(currentPassword, user.password_hash)) return false
    this.database.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(nextPassword), userId)
    this.database.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, currentSessionId)
    return true
  }

  listUserSessions(userId: string): Array<{ id: string; expiresAt: number }> {
    return (this.database.prepare("SELECT id, expires_at AS expiresAt FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY expires_at DESC")
      .all(userId, Date.now()) as unknown as Array<{ id: string; expiresAt: number }>)
  }

  close(): void {
    this.database.close()
  }

  ping(): void {
    this.database.prepare("SELECT 1").get()
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, CURRENT_TIMESTAMP);
      DELETE FROM sessions WHERE expires_at <= CAST(strftime('%s', 'now') AS INTEGER) * 1000;
    `)
  }

  private ensureAdmin(email: string, password: string, displayName: string, syncOnBoot: boolean): void {
    const normalizedEmail = normalizeEmail(email)
    const existing = this.database.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail) as { id: string } | undefined
    if (existing) {
      if (!syncOnBoot) return
      this.database.prepare(`
        UPDATE users
        SET display_name = ?, password_hash = ?, role = 'admin'
        WHERE id = ?
      `).run(displayName, hashPassword(password), existing.id)
      return
    }
    this.database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `).run(randomUUID(), normalizedEmail, displayName, hashPassword(password), new Date().toISOString())
  }
}

export function toAuthSession(session: StoredSession | undefined): AuthSession {
  if (!session) return { isAuthenticated: false, provider: null, displayName: null, email: null, role: null }
  return {
    isAuthenticated: true,
    provider: session.provider,
    displayName: session.displayName,
    email: session.email,
    role: session.role,
  }
}
