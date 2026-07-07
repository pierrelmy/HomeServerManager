import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { SessionStore } from "../src/auth/session-store.js"

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "homelab-session-store-"))
  tempDirs.push(dir)
  return join(dir, "sessions.db")
}

describe("SessionStore admin bootstrap", () => {
  it("keeps production-like credentials stable when sync is disabled", () => {
    const databasePath = createDatabasePath()
    const first = new SessionStore({
      databasePath,
      adminEmail: "admin@example.test",
      adminPassword: "initial-password-123",
      adminDisplayName: "Initial Admin",
      syncAdminOnBoot: false,
    })
    first.close()

    const second = new SessionStore({
      databasePath,
      adminEmail: "admin@example.test",
      adminPassword: "new-password-456",
      adminDisplayName: "Updated Admin",
      syncAdminOnBoot: false,
    })

    expect(second.authenticatePassword("admin@example.test", "initial-password-123")).toBeDefined()
    expect(second.authenticatePassword("admin@example.test", "new-password-456")).toBeUndefined()
    second.close()
  })

  it("resynchronizes the admin password on boot in non-production flows", () => {
    const databasePath = createDatabasePath()
    const first = new SessionStore({
      databasePath,
      adminEmail: "admin@example.test",
      adminPassword: "initial-password-123",
      adminDisplayName: "Initial Admin",
      syncAdminOnBoot: false,
    })
    first.close()

    const second = new SessionStore({
      databasePath,
      adminEmail: "admin@example.test",
      adminPassword: "new-password-456",
      adminDisplayName: "Updated Admin",
      syncAdminOnBoot: true,
    })

    expect(second.authenticatePassword("admin@example.test", "initial-password-123")).toBeUndefined()
    const session = second.authenticatePassword("admin@example.test", "new-password-456")
    expect(session).toMatchObject({
      email: "admin@example.test",
      displayName: "Updated Admin",
      role: "admin",
    })
    second.close()
  })
})
