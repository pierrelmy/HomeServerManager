import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
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
import { HomelabRepositoryProvider } from "./data/HomelabRepositoryProvider"
import { HomelabLiveProvider } from "./live/HomelabLiveProvider"
import { useAuthSession } from "./hooks/useAuthSession"
import { Alert, Button, Spinner } from "react-bootstrap"
import { useHomelabLiveState } from "./live/useHomelabLive"

function AppShell() {
  const liveState = useHomelabLiveState()

  return (
    <div className="app-shell d-flex flex-column flex-md-row bg-body-tertiary">
      <SideBar />

      <main className="app-main flex-grow-1 min-vw-0 overflow-auto">
        {liveState.error ? <Alert variant="warning" className="m-3 mb-0">{liveState.error}</Alert> : null}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/docker" element={<DockerPage />} />
          <Route path="/nas" element={<NasPage />} />
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App()
{
  return (
    <HomelabRepositoryProvider>
      <HomelabLiveProvider>
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
      <div className="min-vh-100 d-flex align-items-center justify-content-center" role="status">
        <Spinner animation="border" />
        <span className="visually-hidden">Chargement...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center p-3">
        <Alert variant="danger" className="mb-0" style={{ maxWidth: 560 }}>
          <Alert.Heading>Impossible de charger le homelab</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={() => void retry()}>Réessayer</Button>
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
