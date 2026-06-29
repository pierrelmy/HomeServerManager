import { describe, expect, it } from "vitest"
import { createMockHomelabRepository } from "../data/mockHomelabRepository"
import { createHomelabLiveManager } from "./homelabLiveManager"
import { createMockHomelabRealtimeTransport } from "./mockHomelabRealtime"

describe("homelab live manager", () => {
  it("bootstraps and applies mutations to its stores", async () => {
    const manager = createHomelabLiveManager(createMockHomelabRepository(), createMockHomelabRealtimeTransport())
    const stop = manager.connect()

    await manager.bootstrap()
    expect(manager.state.getSnapshot()).toMatchObject({ ready: true, bootstrapError: null })
    expect(manager.services.getSnapshot()).toEqual([])
    expect(manager.tools.getSnapshot()?.tools).toEqual([])

    const nextSettings = await manager.updateSettings({ compactSidebar: true })
    expect(nextSettings.compactSidebar).toBe(true)
    expect(manager.settings.getSnapshot()?.compactSidebar).toBe(true)

    await manager.signOut()
    expect(manager.session.getSnapshot()?.isAuthenticated).toBe(false)
    expect(manager.services.getSnapshot()).toBeNull()
    stop()
  })

  it("exposes bootstrap failures instead of hanging", async () => {
    const repository = createMockHomelabRepository()
    repository.getSession = async () => { throw new Error("API unavailable") }
    const manager = createHomelabLiveManager(repository, createMockHomelabRealtimeTransport())

    await manager.bootstrap()

    expect(manager.state.getSnapshot()).toMatchObject({ ready: true, bootstrapError: "API unavailable" })
  })
})
