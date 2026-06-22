import { Badge, Card, ListGroup } from "react-bootstrap"
import { IconBrandGithub, IconBrandGoogle, IconKey, IconUserCircle } from "@tabler/icons-react"
import { useHomelabAccount, useHomelabLiveState } from "../live/useHomelabLive"

export default function AccountPage() {
  const liveState = useHomelabLiveState()
  const account = useHomelabAccount()

  if (!liveState.ready || !account) {
    return <div className="p-3 p-lg-4">Chargement du compte...</div>
  }

  return (
    <div className="d-flex flex-column gap-4 p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <p className="text-uppercase text-secondary small mb-1">Profil</p>
          <h1 className="mb-0">Account</h1>
          <p className="text-secondary mb-0">Compte utilisateur, méthodes d’authentification et sessions actives.</p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <Card className="h-100">
            <Card.Body className="d-flex flex-column gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-body-tertiary d-flex align-items-center justify-content-center" style={{ width: 72, height: 72 }}>
                  <IconUserCircle size={40} />
                </div>
                <div>
                  <h2 className="h4 mb-1">{account.name}</h2>
                  <div className="text-secondary">{account.role}</div>
                  <Badge bg="success" className="mt-2">
                    {account.status}
                  </Badge>
                </div>
              </div>

              <div className="border rounded p-3">
                <div className="text-secondary small mb-1">Email</div>
                <div className="fw-semibold">{account.email}</div>
              </div>

              <div className="border rounded p-3">
                <div className="text-secondary small mb-2">Méthodes reliées</div>
                <div className="d-flex flex-column gap-2">
                  {account.providers.map((provider) => (
                    <div key={provider.name} className="d-flex align-items-center justify-content-between">
                      <span className="d-flex align-items-center gap-2">
                        {provider.name === "Google" ? <IconBrandGoogle size={18} /> : <IconBrandGithub size={18} />}
                        {provider.name}
                      </span>
                      <Badge bg={provider.connected ? "success" : "secondary"}>{provider.connected ? "Connecté" : "Déconnecté"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-xl-7">
          <Card className="h-100">
            <Card.Body>
              <h2 className="h5 mb-3">Clés et sessions</h2>
              <div className="d-flex flex-column gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <IconKey size={18} />
                    <span className="fw-semibold">Clés SSH</span>
                  </div>
                  <ListGroup>
                    {account.sshKeys.map((key) => (
                      <ListGroup.Item key={key.name} className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold">{key.name}</div>
                          <div className="text-secondary small">{key.fingerprint}</div>
                        </div>
                        <Badge bg="success">{key.status}</Badge>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>

                <div>
                  <div className="fw-semibold mb-2">Sessions actives</div>
                  <ListGroup>
                    {account.sessions.map((session) => (
                      <ListGroup.Item key={session.device} className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold">{session.device}</div>
                          <div className="text-secondary small">{session.lastSeen}</div>
                        </div>
                        <Badge bg={session.status === "Active" ? "success" : "secondary"}>{session.status}</Badge>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  )
}
