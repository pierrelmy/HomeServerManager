import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { SessionStore } from "../src/auth/session-store.js"
import { SqliteHomelabRepository } from "../src/repositories/homelab-repository.js"

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("SQLite persistence", () => {
  it("keeps sessions and settings across restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "homelab-"))
    directories.push(directory)
    const databasePath = join(directory, "homelab.db")
    const options = {
      databasePath,
      adminEmail: "admin@example.test",
      adminPassword: "strong-test-password",
      adminDisplayName: "Admin",
    }

    const sessions = new SessionStore(options)
    const session = sessions.authenticatePassword(options.adminEmail, options.adminPassword)
    expect(session).toBeDefined()
    sessions.close()

    const repository = new SqliteHomelabRepository(databasePath)
    repository.saveSettings(session!.userId, { theme: "dark", density: 50, alertsEnabled: true, compactSidebar: true })
    repository.close()

    const reopenedSessions = new SessionStore(options)
    const reopenedRepository = new SqliteHomelabRepository(databasePath)
    expect(reopenedSessions.get(session!.id)?.displayName).toBe("Admin")
    expect(reopenedRepository.getSettings(session!.userId)).toMatchObject({ theme: "dark", compactSidebar: true })
    reopenedRepository.close()
    reopenedSessions.close()
  })
})
