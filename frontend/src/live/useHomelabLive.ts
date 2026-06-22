import { useContext } from "react"
import { HomelabLiveContext } from "./HomelabLiveProvider"
import { useStoreValue } from "./createStore"
import type { HomelabLiveManager } from "./homelabLiveManager"
import type { AuthSession, OverviewSnapshot, ServiceRecord, DockerSnapshot, NasSnapshot, ToolsSnapshot, AccountProfile, SettingsState, TerminalSnapshot } from "../domain/homelab"

export function useHomelabLiveManager(): HomelabLiveManager {
  const manager = useContext(HomelabLiveContext)

  if (!manager) {
    throw new Error("useHomelabLiveManager must be used within HomelabLiveProvider")
  }

  return manager
}

export function useHomelabLiveState() {
  return useStoreValue(useHomelabLiveManager().state)
}

export function useHomelabSession(): AuthSession | null {
  return useStoreValue(useHomelabLiveManager().session)
}

export function useHomelabOverview(): OverviewSnapshot | null {
  return useStoreValue(useHomelabLiveManager().overview)
}

export function useHomelabServices(): ServiceRecord[] | null {
  return useStoreValue(useHomelabLiveManager().services)
}

export function useHomelabDocker(): DockerSnapshot | null {
  return useStoreValue(useHomelabLiveManager().docker)
}

export function useHomelabNas(): NasSnapshot | null {
  return useStoreValue(useHomelabLiveManager().nas)
}

export function useHomelabTools(): ToolsSnapshot | null {
  return useStoreValue(useHomelabLiveManager().tools)
}

export function useHomelabAccount(): AccountProfile | null {
  return useStoreValue(useHomelabLiveManager().account)
}

export function useHomelabSettings(): SettingsState | null {
  return useStoreValue(useHomelabLiveManager().settings)
}

export function useHomelabTerminal(): TerminalSnapshot | null {
  return useStoreValue(useHomelabLiveManager().terminal)
}
