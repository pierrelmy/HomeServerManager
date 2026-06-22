import { useContext } from "react"
import { HomelabRepositoryContext } from "./HomelabRepositoryProvider"
import type { HomelabRepository } from "./homelabRepository"

export function useHomelabRepository(): HomelabRepository {
  const repository = useContext(HomelabRepositoryContext)

  if (!repository) {
    throw new Error("useHomelabRepository must be used within HomelabRepositoryProvider")
  }

  return repository
}
