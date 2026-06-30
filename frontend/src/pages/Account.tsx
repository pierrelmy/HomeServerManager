import { useState } from "react"
import { Alert, Button, Form, ListGroup } from "react-bootstrap"
import { IconKey, IconUserCircle } from "@tabler/icons-react"
import { useHomelabAccount, useHomelabLiveManager, useHomelabLiveState } from "../live/useHomelabLive"
import { useAuthSession } from "../hooks/useAuthSession"
import { useNavigate } from "react-router-dom"
import { EmptyState, PageHeader, PageShell, SectionTitle, StatusBadge, Surface } from "../components/ui"

export default function AccountPage() {
  const liveState = useHomelabLiveState()
  const account = useHomelabAccount()
  const liveManager = useHomelabLiveManager()
  const { signOut } = useAuthSession()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const changePassword = async () => {
    setSavingPassword(true)
    setPasswordMessage(null)
    try {
      await liveManager.changePassword(currentPassword, nextPassword)
      setCurrentPassword("")
      setNextPassword("")
      setPasswordMessage({ type: "success", text: "Mot de passe mis à jour. Les autres sessions ont été révoquées." })
    } catch (error) {
      setPasswordMessage({ type: "danger", text: error instanceof Error ? error.message : "La mise à jour a échoué" })
    } finally {
      setSavingPassword(false)
    }
  }

  if (!liveState.ready || !account) {
    return <div className="p-3 p-lg-4">Chargement du compte...</div>
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Identity & access"
        title="Account"
        description="Compte utilisateur, méthodes d’authentification et sessions actives."
        actions={<Button variant="outline-danger" onClick={() => void signOut().then(() => navigate("/login"))}>Se déconnecter</Button>}
      />

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <Surface className="h-100">
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="rounded-circle bg-body-tertiary d-flex align-items-center justify-content-center" style={{ width: 72, height: 72 }}>
                <IconUserCircle size={40} />
              </div>
              <div>
                <h2 className="h4 mb-1">{account.name}</h2>
                <div className="text-secondary">{account.role}</div>
                <StatusBadge tone="success">{account.status}</StatusBadge>
              </div>
            </div>

            <div className="data-card mb-3">
              <div className="text-secondary small mb-1">Email</div>
              <div className="fw-semibold">{account.email}</div>
            </div>

            <div className="data-card mb-3">
              <div className="text-secondary small mb-2">Méthodes reliées</div>
              <div className="d-flex flex-column gap-2">
                {account.providers.length === 0 ? (
                  <EmptyState title="Aucune méthode supplémentaire reliée." />
                ) : account.providers.map((provider) => (
                  <div key={provider.name} className="d-flex align-items-center justify-content-between">
                    <span className="d-flex align-items-center gap-2">
                      <IconKey size={18} />
                      {provider.name}
                    </span>
                    <StatusBadge tone={provider.connected ? "success" : "neutral"}>{provider.connected ? "Connecté" : "Déconnecté"}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>

            <Form onSubmit={(event) => { event.preventDefault(); void changePassword() }} className="data-card">
              <div className="fw-semibold mb-3">Changer le mot de passe</div>
              {passwordMessage ? <Alert variant={passwordMessage.type}>{passwordMessage.text}</Alert> : null}
              <Form.Group className="mb-3">
                <Form.Label>Mot de passe actuel</Form.Label>
                <Form.Control className="surface-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Nouveau mot de passe</Form.Label>
                <Form.Control className="surface-input" type="password" autoComplete="new-password" minLength={12} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
              </Form.Group>
              <Button type="submit" disabled={savingPassword}>Mettre à jour</Button>
            </Form>
          </Surface>
        </div>

        <div className="col-12 col-xl-7">
          <Surface className="h-100">
            <SectionTitle title="Clés et sessions" subtitle="Accès SSH et sessions actives remontées par le backend." />
            <div className="d-flex flex-column gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <IconKey size={18} />
                  <span className="fw-semibold">Clés SSH</span>
                </div>
                <ListGroup>
                  {account.sshKeys.length === 0 ? (
                    <ListGroup.Item className="text-secondary">Aucune clé SSH enregistrée.</ListGroup.Item>
                  ) : account.sshKeys.map((key) => (
                    <ListGroup.Item key={key.name} className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{key.name}</div>
                        <div className="text-secondary small">{key.fingerprint}</div>
                      </div>
                      <StatusBadge tone="success">{key.status}</StatusBadge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>

              <div>
                <div className="fw-semibold mb-2">Sessions actives</div>
                <ListGroup>
                  {account.sessions.length === 0 ? (
                    <ListGroup.Item className="text-secondary">Aucune session active listée.</ListGroup.Item>
                  ) : account.sessions.map((session) => (
                    <ListGroup.Item key={session.device} className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{session.device}</div>
                        <div className="text-secondary small">{session.lastSeen}</div>
                      </div>
                      <StatusBadge tone={session.status === "Active" ? "success" : "neutral"}>{session.status}</StatusBadge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  )
}
