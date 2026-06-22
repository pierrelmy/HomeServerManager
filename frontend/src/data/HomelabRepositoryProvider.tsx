import { createContext, useMemo } from "react"
import { createHomelabRepository } from "./createHomelabRepository"
import type { HomelabRepository } from "./homelabRepository"

const HomelabRepositoryContext = createContext<HomelabRepository | null>(null)

export function HomelabRepositoryProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => createHomelabRepository(), [])

  return (
    <HomelabRepositoryContext.Provider value={repository}>
      {children}
    </HomelabRepositoryContext.Provider>
  )
}

export { HomelabRepositoryContext }
