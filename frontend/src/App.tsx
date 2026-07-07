import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { useEffect, useState } from "react"
import SideBar from "./components/SideBar"
import NotFound from "./pages/NotFound"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Services from "./pages/Services"
import DockerPage from "./pages/Docker"
import NasPage from "./pages/Nas"
import TerminalPage from "./pages/Terminal"
import ToolsPage from "./pages/Tools"
import AccountPage from "./pages/Account"
import SettingsPage from "./pages/Settings"
import ServiceWebView from "./pages/ServiceWebView"
import { HomelabRepositoryProvider } from "./data/HomelabRepositoryProvider"
import { HomelabLiveProvider } from "./live/HomelabLiveProvider"
import { useAuthSession } from "./hooks/useAuthSession"
import { Alert, Button, ProgressBar, Spinner, StatusBadge } from "./components/ui"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabSettings, useHomelabTools } from "./live/useHomelabLive"

function ThemeSync() {
  const settings = useHomelabSettings()

  useEffect(() => {
    const root = document.documentElement
    const density = settings?.density ?? 100
    root.style.fontSize = `${Math.max(87.5, Math.min(112.5, density))}%`

    if (!settings) return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const isDark = settings.theme === "dark" || (settings.theme === "system" && media.matches)
      root.classList.toggle("dark", isDark)
      root.dataset.theme = settings.theme
    }

    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [settings])

  return null
}

function AppShell() {
  const liveState = useHomelabLiveState()

  return (
    <div className="min-h-screen md:flex md:items-start">
      <SideBar />

      <main className="min-w-0 flex-1">
        <div className="min-h-screen p-4 lg:p-6">
          {liveState.error ? <Alert tone="warning" className="mb-4">{liveState.error}</Alert> : null}
          <UpdateProgressToast />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:serviceId/web" element={<ServiceWebView />} />
            <Route path="/docker" element={<DockerPage />} />
            <Route path="/nas" element={<NasPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function UpdateProgressToast() {
  const liveManager = useHomelabLiveManager()
  const tools = useHomelabTools()
  const update = tools?.updateStatus
  const [hiddenForFinishedAt, setHiddenForFinishedAt] = useState<string | null>(null)
  const hidden = hiddenForFinishedAt !== null && hiddenForFinishedAt === update?.finishedAt
  const updateStatus = update?.status ?? "idle"
  const finishedAt = update?.finishedAt ?? null

  useEffect(() => {
    if (updateStatus === "idle") {
      return
    }

    const interval = window.setInterval(() => {
      void liveManager.refreshTools()
    }, updateStatus === "running" ? 2000 : 5000)

    return () => window.clearInterval(interval)
  }, [liveManager, updateStatus])

  useEffect(() => {
    if (!finishedAt) return
    const delay = updateStatus === "completed" ? 5_000 : 60_000
    const remaining = Math.max(0, new Date(finishedAt).getTime() + delay - Date.now())
    const timer = window.setTimeout(() => setHiddenForFinishedAt(finishedAt), remaining)
    return () => window.clearTimeout(timer)
  }, [finishedAt, updateStatus])

  if (!update || update.status === "idle" || hidden) {
    return null
  }

  const total = Math.max(1, update.totalSteps || 1)
  const progress = Math.max(0, Math.min(100, Math.round((update.currentStep / total) * 100)))
  const isRunning = update.status === "running"
  const tone = isRunning ? "warning" : update.status === "completed" ? "success" : "danger"
  const badgeTone = isRunning ? "warning" : update.status === "completed" ? "success" : "danger"
  const statusLabel = isRunning ? `Étape ${Math.min(update.currentStep, total)}/${total}` : update.status === "completed" ? "Terminé" : "Échec"

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(28rem,calc(100vw-2rem))]">
      <Alert
        tone={tone}
        className="pointer-events-auto border shadow-2xl backdrop-blur-sm bg-white/95 dark:bg-slate-950/95"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Mise à jour HomeServerManager</div>
              <StatusBadge tone={badgeTone}>{statusLabel}</StatusBadge>
            </div>
            <div className="mt-2 text-sm">
              {update.stepLabel || (isRunning ? "Exécution en cours" : update.status === "completed" ? "Déploiement terminé." : "La mise à jour a échoué.")}
            </div>
            <div className="mt-3">
              <ProgressBar value={isRunning ? progress : update.status === "completed" ? 100 : progress} tone={tone === "warning" ? "warning" : tone === "success" ? "success" : "danger"} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
              {update.startedAt ? <span>Démarré: {new Date(update.startedAt).toLocaleTimeString("fr-FR")}</span> : null}
              {update.revision ? <span>Révision: {update.revision}</span> : null}
            </div>
            {update.error ? <div className="mt-2 text-xs font-medium">{update.error}</div> : null}
          </div>
        </div>
      </Alert>
    </div>
  )
}

export default function App()
{
  return (
    <HomelabRepositoryProvider>
      <HomelabLiveProvider>
        <ThemeSync />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </HomelabLiveProvider>
    </HomelabRepositoryProvider>
  )
}

function AppRoutes() {
  const { isAuthenticated, loading, error, retry } = useAuthSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <Spinner />
          <span>Chargement...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert tone="danger" className="max-w-xl">
          <div className="text-base font-semibold">Impossible de charger le homelab</div>
          <p className="mt-2">{error}</p>
          <div className="mt-4">
            <Button variant="danger" onClick={() => void retry()}>Réessayer</Button>
          </div>
        </Alert>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="*" element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
