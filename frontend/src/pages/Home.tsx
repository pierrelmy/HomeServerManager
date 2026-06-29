import { Alert, Badge, Card, ProgressBar } from "react-bootstrap"
import { IconAlertCircle, IconAlertTriangle, IconClock, IconServer2 } from "@tabler/icons-react"
import { useHomelabLiveState, useHomelabOverview } from "../live/useHomelabLive"
import type { MetricSparkline } from "../domain/homelab"

function LoadingState() {
  return (
    <div className="p-3 p-lg-4">
      <Alert variant="secondary" className="mb-0">
        Chargement du tableau de bord...
      </Alert>
    </div>
  )
}

function MetricCard({
  label,
  value,
  percent,
  accent,
}: {
  label: string
  value: string
  percent: number
  accent: "info" | "warning" | "success" | "primary"
}) {
  return (
    <Card className="h-100">
      <Card.Body>
        <p className="text-secondary small mb-1">{label}</p>
        <h3 className="mb-2">{value}</h3>
        <ProgressBar now={percent} variant={accent} style={{ height: 7 }} />
      </Card.Body>
    </Card>
  )
}

function metricPercent(metric: MetricSparkline): number {
  const lastPoint = metric.points.at(-1)
  if (typeof lastPoint === "number" && Number.isFinite(lastPoint)) {
    return Math.max(0, Math.min(100, lastPoint))
  }

  const percentMatch = metric.value.match(/(\d+(?:[.,]\d+)?)\s*%/)
  if (percentMatch?.[1]) {
    const parsed = Number.parseFloat(percentMatch[1].replace(",", "."))
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed))
  }

  return 0
}

export default function Home() {
  const overview = useHomelabOverview()
  const liveState = useHomelabLiveState()

  if (!liveState.ready || !overview) {
    return <LoadingState />
  }

  return (
    <div className="d-flex flex-column gap-4 p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <p className="text-uppercase text-secondary small mb-1">Vue globale</p>
          <h1 className="mb-0">{overview.hostName}</h1>
          <p className="text-secondary mb-0">Tableau de bord synthétique pour le suivi quotidien du homelab.</p>
        </div>

        <Badge bg="light" text="dark" className="d-flex align-items-center gap-2 px-3 py-2">
          <IconClock size={16} />
          uptime {overview.uptime}
        </Badge>
      </div>

      <div className="row g-3">
        {overview.metrics.map((metric, index) => (
          <div className="col-12 col-md-4" key={metric.label}>
            <MetricCard
              label={metric.label}
              value={metric.value}
              percent={metricPercent(metric)}
              accent={index === 0 ? "primary" : index === 1 ? "warning" : "success"}
            />
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="h5 mb-0">Disques</h2>
                <Badge bg="light" text="dark">
                  {overview.disks.length} disques
                </Badge>
              </div>

              <div className="d-flex flex-column gap-3">
                {overview.disks.length === 0 ? (
                  <Alert variant="light" className="mb-0">Aucun disque remonté par le backend.</Alert>
                ) : overview.disks.map((disk) => (
                  <div key={disk.name} className="border rounded p-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                      <div>
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          <IconServer2 size={16} />
                          {disk.name}
                        </div>
                        <div className="text-secondary small mt-1">
                          {disk.used} / {disk.total} {disk.unit}
                        </div>
                      </div>
                      <Badge bg={disk.percent >= 85 ? "warning" : "success"}>{disk.temp} °C</Badge>
                    </div>
                    <ProgressBar now={disk.percent} variant={disk.percent >= 85 ? "warning" : "info"} className="mt-3" />
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card className="h-100">
            <Card.Body>
              <h2 className="h5 mb-3">Alertes récentes</h2>
              <div className="d-flex flex-column gap-2">
                {overview.alerts.length === 0 ? (
                  <Alert variant="light" className="mb-0">Aucune alerte.</Alert>
                ) : overview.alerts.map((alert) => (
                  <div key={alert.label} className="d-flex align-items-start gap-2 p-3 border rounded">
                    {alert.level === "warning" ? (
                      <IconAlertTriangle size={16} className="text-warning mt-1" />
                    ) : (
                      <IconAlertCircle size={16} className="text-danger mt-1" />
                    )}
                    <div>
                      <div className="fw-semibold">{alert.label}</div>
                      {alert.detail ? <div className="text-secondary small">{alert.detail}</div> : null}
                    </div>
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
            <h2 className="h5 mb-0">Derniers logs</h2>
            <span className="text-secondary small">Flux système agrégé</span>
          </div>

          <div className="d-flex flex-column gap-2">
            {overview.logs.length === 0 ? (
              <Alert variant="light" className="mb-0">Aucun log récent.</Alert>
            ) : overview.logs.map((log) => (
              <div key={`${log.timestamp}-${log.source}`} className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2 border rounded p-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="font-monospace text-secondary">{log.timestamp}</span>
                  <Badge bg={log.level === "danger" ? "danger" : log.level === "success" ? "success" : "secondary"}>{log.source}</Badge>
                </div>
                <div className="flex-grow-1 text-md-end">{log.content}</div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}
