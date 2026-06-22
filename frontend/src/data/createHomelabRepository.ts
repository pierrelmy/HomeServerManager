import { createHttpHomelabRepository } from "./httpHomelabRepository"
import { createMockHomelabRepository } from "./mockHomelabRepository"
import type { HomelabRepository } from "./homelabRepository"

export function createHomelabRepository(): HomelabRepository {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

  if (!baseUrl) {
    return createMockHomelabRepository()
  }

  return createHttpHomelabRepository(baseUrl)
}
