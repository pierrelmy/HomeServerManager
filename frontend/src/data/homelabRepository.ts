import type {
  AccountProfile,
  AuthSession,
  CreateServiceInput,
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

export interface HomelabRepository {
  getSession(): Promise<AuthSession>
  signIn(email: string, password: string): Promise<AuthSession>
  signOut(): Promise<AuthSession>
  getOverview(): Promise<OverviewSnapshot>
  listServices(): Promise<ServiceRecord[]>
  getDockerSnapshot(): Promise<DockerSnapshot>
  getNasSnapshot(): Promise<NasSnapshot>
  getToolsSnapshot(): Promise<ToolsSnapshot>
  getTerminalSnapshot(): Promise<TerminalSnapshot>
  getAccountProfile(): Promise<AccountProfile>
  getSettings(): Promise<SettingsState>
  updateSettings(patch: Partial<SettingsState>): Promise<SettingsState>
  changePassword(currentPassword: string, nextPassword: string): Promise<void>
  addService(input: CreateServiceInput): Promise<ServiceRecord>
  refreshServices(): Promise<ServiceRecord[]>
  refreshServiceLogs(id: string): Promise<ServiceRecord>
  actOnService(id: string, action: "start" | "stop" | "restart"): Promise<ServiceRecord>
  actOnContainer(id: string, action: "start" | "stop" | "restart"): Promise<DockerContainer>
  actOnImage(id: string, action: "pull" | "run"): Promise<DockerSnapshot>
  runNasScrub(): Promise<ToolJob>
  runTool(id: string): Promise<ToolJob>
}
