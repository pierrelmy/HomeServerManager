import type { AuthProvider, AuthSession } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabSession } from "../live/useHomelabLive"

export function useAuthSession() {
  const liveManager = useHomelabLiveManager()
  const session = useHomelabSession()
  const state = useHomelabLiveState()

  const signIn = async (provider: AuthProvider): Promise<AuthSession> => liveManager.signIn(provider)
  const signOut = async (): Promise<AuthSession> => liveManager.signOut()

  return {
    isAuthenticated: session?.isAuthenticated ?? false,
    loading: !state.ready,
    error: state.bootstrapError,
    session,
    signIn,
    signOut,
    retry: () => liveManager.bootstrap(),
  }
}
