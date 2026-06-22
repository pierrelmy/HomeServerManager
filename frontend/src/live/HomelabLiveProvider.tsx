import { createContext, useEffect, useMemo } from "react"
import { useHomelabRepository } from "../data/useHomelabRepository"
import { createHomelabRealtimeTransport } from "./createHomelabRealtimeTransport"
import { createHomelabLiveManager, type HomelabLiveManager } from "./homelabLiveManager"

const HomelabLiveContext = createContext<HomelabLiveManager | null>(null)

export function HomelabLiveProvider({ children }: { children: React.ReactNode }) {
  const repository = useHomelabRepository()
  const liveManager = useMemo(() => createHomelabLiveManager(repository, createHomelabRealtimeTransport()), [repository])

  useEffect(() => {
    const stop = liveManager.connect()
    void liveManager.bootstrap()

    return () => {
      stop()
    }
  }, [liveManager])

  return <HomelabLiveContext.Provider value={liveManager}>{children}</HomelabLiveContext.Provider>
}

export { HomelabLiveContext }
