import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { useEffect } from "react"
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
import { Alert, Button, Spinner } from "./components/ui"
import { useHomelabLiveState, useHomelabSettings } from "./live/useHomelabLive"

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
    <div className="min-h-screen md:flex">
      <SideBar />

      <main className="min-w-0 flex-1">
        <div className="min-h-screen p-4 lg:p-6">
          {liveState.error ? <Alert tone="warning" className="mb-4">{liveState.error}</Alert> : null}
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
