import { useState } from "react"
import { Alert, Button, ProgressBar, Table } from "react-bootstrap"
import { IconRefresh, IconShieldCheck } from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabNas } from "../live/useHomelabLive"
import { EmptyState, PageHeader, PageShell, SectionTitle, StatTile, StatusBadge, Surface } from "../components/ui"

export default function NasPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const nas = useHomelabNas()
  const [scrubRunning, setScrubRunning] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null)

  const runScrub = async () => {
    if (!window.confirm("Confirmer le lancement du scrub NAS ? Cette opération peut être longue.")) return
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
    <PageShell>
      <PageHeader
        eyebrow="Storage"
        title="NAS"
        description="Vue d’ensemble des pools, des disques et des sauvegardes récentes."
        actions={(
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
        )}
      />

      {actionMessage ? (
        <Alert variant={actionMessage.type} dismissible onClose={() => setActionMessage(null)}>{actionMessage.text}</Alert>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-md-6 col-xl-3"><StatTile label="Capacité utilisée" value={nas.capacityUsed} meta="Sur l’ensemble du stockage visible" tone="primary" /></div>
        <div className="col-12 col-md-6 col-xl-3"><StatTile label="Santé" value={nas.healthSummary} meta="État synthétique des pools" /></div>
        <div className="col-12 col-md-6 col-xl-3"><StatTile label="Sauvegarde" value={nas.backupSummary} meta="Derniers cycles connus" /></div>
        <div className="col-12 col-md-6 col-xl-3"><StatTile label="Température" value={nas.temperatureSummary} meta="Signal thermique global" tone="warning" /></div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Surface className="h-100">
            <SectionTitle title="Pools" subtitle="Capacité, état et température." trailing={<StatusBadge>{nas.pools.length} pools</StatusBadge>} />

            <div className="d-flex flex-column gap-3">
              {nas.pools.length === 0 ? (
                <EmptyState title="Aucun pool remonté par le backend." />
              ) : nas.pools.map((pool) => (
                <div key={pool.name} className="data-card">
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                    <div>
                      <div className="fw-semibold">{pool.name}</div>
                      <div className="text-secondary small">{pool.type}</div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <StatusBadge tone={pool.health === "Healthy" ? "success" : "warning"}>{pool.health}</StatusBadge>
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
          </Surface>
        </div>

        <div className="col-12 col-xl-5">
          <Surface className="h-100">
            <SectionTitle title="Sauvegardes récentes" subtitle="Historique des derniers jobs connus." />
            <div className="d-flex flex-column gap-2">
              {nas.backups.length === 0 ? (
                <EmptyState title="Aucune sauvegarde remontée par le backend." />
              ) : nas.backups.map((item) => (
                <div key={item.label} className="data-card d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{item.label}</div>
                    <div className="text-secondary small">{item.when}</div>
                  </div>
                  <StatusBadge tone={item.result === "Succès" ? "success" : "warning"}>{item.result}</StatusBadge>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>

      <Surface>
        <SectionTitle title="Disques" subtitle="Contrôle SMART synthétique." />

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
            {nas.drives.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-secondary">Aucun disque remonté par le backend.</td>
              </tr>
            ) : nas.drives.map((drive) => (
              <tr key={drive.slot}>
                <td>{drive.slot}</td>
                <td>{drive.model}</td>
                <td>{drive.temp} °C</td>
                <td>
                  <StatusBadge tone={drive.status === "Healthy" ? "success" : "warning"}>{drive.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Surface>
    </PageShell>
  )
}
