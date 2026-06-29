import { createHttpHomelabRepository } from "./httpHomelabRepository"
import { createMockHomelabRepository } from "./mockHomelabRepository"
import type { HomelabRepository } from "./homelabRepository"

export function createHomelabRepository(): HomelabRepository {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  const allowMocks = import.meta.env.VITE_ALLOW_MOCKS === "true"

  if (!baseUrl) {
    if (allowMocks) {
      return createMockHomelabRepository()
    }

    const inferredBaseUrl = new URL(window.location.origin)
    if (["4173", "5173"].includes(inferredBaseUrl.port)) {
      inferredBaseUrl.port = "3000"
    }

    return createHttpHomelabRepository(inferredBaseUrl.origin)
  }

  return createHttpHomelabRepository(baseUrl)
}
