import type {
  AccountProfile,
  AuthSession,
  DockerSnapshot,
  DockerContainer,
  NasSnapshot,
  OverviewSnapshot,
  SettingsState,
  ServiceRecord,
  ToolsSnapshot,
  ToolJob,
  TerminalSnapshot,
} from "../domain/homelab"
import type { HomelabRepository } from "./homelabRepository"

async function fetchJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const response = await fetch(`${normalizedBase}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message ?? `HTTP ${response.status} when requesting ${path}`)
  }

  return response.json() as Promise<T>
}

export function createHttpHomelabRepository(baseUrl: string): HomelabRepository {
  return {
    getSession: () => fetchJson<AuthSession>(baseUrl, "/session"),
    signIn: (email: string, password: string) =>
      fetchJson<AuthSession>(baseUrl, "/session", {
        method: "POST",
        body: JSON.stringify({ provider: "password", email, password }),
      }),
    signOut: () =>
      fetchJson<AuthSession>(baseUrl, "/session", {
        method: "DELETE",
      }),
    getOverview: () => fetchJson<OverviewSnapshot>(baseUrl, "/overview"),
    listServices: () => fetchJson<ServiceRecord[]>(baseUrl, "/services"),
    getDockerSnapshot: () => fetchJson<DockerSnapshot>(baseUrl, "/docker"),
    getNasSnapshot: () => fetchJson<NasSnapshot>(baseUrl, "/nas"),
    getToolsSnapshot: () => fetchJson<ToolsSnapshot>(baseUrl, "/tools"),
    getTerminalSnapshot: () => fetchJson<TerminalSnapshot>(baseUrl, "/terminal"),
    getAccountProfile: () => fetchJson<AccountProfile>(baseUrl, "/account"),
    getSettings: () => fetchJson<SettingsState>(baseUrl, "/settings"),
    updateSettings: (patch: Partial<SettingsState>) =>
      fetchJson<SettingsState>(baseUrl, "/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    changePassword: async (currentPassword, nextPassword) => {
      await fetchJson<{ success: true }>(baseUrl, "/account/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, nextPassword }),
      })
    },
    actOnService: (id, action) =>
      fetchJson<ServiceRecord>(baseUrl, `/services/${encodeURIComponent(id)}/${action}`, { method: "POST" }),
    actOnContainer: (id, action) =>
      fetchJson<DockerContainer>(baseUrl, `/docker/containers/${encodeURIComponent(id)}/${action}`, { method: "POST" }),
    actOnImage: (id, action) =>
      fetchJson<DockerSnapshot>(baseUrl, `/docker/images/${encodeURIComponent(id)}/${action}`, { method: "POST" }),
    runNasScrub: () => fetchJson<ToolJob>(baseUrl, "/nas/scrub", { method: "POST" }),
    runTool: (id) => fetchJson<ToolJob>(baseUrl, `/tools/${encodeURIComponent(id)}/run`, { method: "POST" }),
  }
}
