import { useState } from "react"
import { Alert, Badge, Button, Card, ProgressBar, Table } from "react-bootstrap"
import { IconDatabase, IconRefresh, IconShieldCheck } from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabNas } from "../live/useHomelabLive"

export default function NasPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const nas = useHomelabNas()
  const [scrubRunning, setScrubRunning] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null)

  const runScrub = async () => {
    setScrubRunning(true)
    setActionMessage(null)
    try {
      await liveManager.runNasScrub()
      setActionMessage({ type: "success", text: "Le scrub NAS a été démarré." })
    } catch (error) {
      setActionMessage({ type: "danger", text: error instanceof Error ? error.message : "Le scrub NAS a échoué" })
    } finally {
      setScrubRunning(false)
    }
  }

  if (!liveState.ready || !nas) {
    return <div className="p-3 p-lg-4">Chargement du NAS...</div>
  }

  return (
    <div className="d-flex flex-column gap-4 p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <p className="text-uppercase text-secondary small mb-1">Stockage</p>
          <h1 className="mb-0">NAS</h1>
          <p className="text-secondary mb-0">Vue d’ensemble des pools, des disques et des sauvegardes récentes.</p>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" className="d-flex align-items-center gap-2" onClick={() => void liveManager.refreshAll()}>
            <IconRefresh size={18} />
            Synchroniser
          </Button>
          <Button variant="primary" className="d-flex align-items-center gap-2" disabled={scrubRunning} onClick={() => void runScrub()}>
            <IconShieldCheck size={18} />
            Lancer un scrub
          </Button>
        </div>
      </div>

      {actionMessage ? (
        <Alert variant={actionMessage.type} dismissible onClose={() => setActionMessage(null)}>{actionMessage.text}</Alert>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-md-6 col-xl-3">
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-secondary small mb-1">Capacité utilisée</p>
                  <h3 className="mb-0">{nas.capacityUsed}</h3>
                </div>
                <IconDatabase />
              </div>
              <p className="text-secondary small mb-0 mt-2">Sur 12,5 To au total.</p>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <Card className="h-100">
            <Card.Body>
              <p className="text-secondary small mb-1">Santé</p>
              <h3 className="mb-0">{nas.healthSummary}</h3>
              <p className="text-secondary small mb-0 mt-2">Un pool doit être surveillé.</p>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <Card className="h-100">
            <Card.Body>
              <p className="text-secondary small mb-1">Sauvegarde</p>
              <h3 className="mb-0">{nas.backupSummary}</h3>
              <p className="text-secondary small mb-0 mt-2">La dernière alerte concerne une archive photo.</p>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <Card className="h-100">
            <Card.Body>
              <p className="text-secondary small mb-1">Température</p>
              <h3 className="mb-0">{nas.temperatureSummary}</h3>
              <p className="text-secondary small mb-0 mt-2">Aucune valeur critique pour le moment.</p>
            </Card.Body>
          </Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="h5 mb-0">Pools</h2>
                <Badge bg="light" text="dark">
                  {nas.pools.length} pools
                </Badge>
              </div>

              <div className="d-flex flex-column gap-3">
                {nas.pools.map((pool) => (
                  <div key={pool.name} className="border rounded p-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                      <div>
                        <div className="fw-semibold">{pool.name}</div>
                        <div className="text-secondary small">{pool.type}</div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg={pool.health === "Healthy" ? "success" : "warning"}>{pool.health}</Badge>
                        <span className="text-secondary small">
                          {pool.used} / {pool.total} To
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      now={(pool.used / pool.total) * 100}
                      className="mt-3"
                      variant={pool.health === "Healthy" ? "info" : "warning"}
                    />
                    <div className="text-secondary small mt-2">Température disque: {pool.temp} °C</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card className="h-100">
            <Card.Body>
              <h2 className="h5 mb-3">Sauvegardes récentes</h2>
              <div className="d-flex flex-column gap-2">
                {nas.backups.map((item) => (
                  <div key={item.label} className="d-flex justify-content-between align-items-center border rounded p-3">
                    <div>
                      <div className="fw-semibold">{item.label}</div>
                      <div className="text-secondary small">{item.when}</div>
                    </div>
                    <Badge bg={item.result === "Succès" ? "success" : "warning"}>{item.result}</Badge>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Card>
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="h5 mb-0">Disques</h2>
            <span className="text-secondary small">Contrôle SMART synthétique</span>
          </div>

          <Table responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Emplacement</th>
                <th>Modèle</th>
                <th>Température</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {nas.drives.map((drive) => (
                <tr key={drive.slot}>
                  <td>{drive.slot}</td>
                  <td>{drive.model}</td>
                  <td>{drive.temp} °C</td>
                  <td>
                    <Badge bg={drive.status === "Healthy" ? "success" : "warning"}>{drive.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  )
}
