import type {
  AccountProfile,
  AuthProvider,
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
  const response = await fetch(new URL(path, baseUrl), {
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
    signIn: (provider: AuthProvider) =>
      fetchJson<AuthSession>(baseUrl, "/session", {
        method: "POST",
        body: JSON.stringify({ provider }),
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
