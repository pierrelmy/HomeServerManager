import { Alert, ProgressBar } from "react-bootstrap"
import { IconAlertCircle, IconAlertTriangle, IconClock, IconServer2 } from "@tabler/icons-react"
import { useHomelabLiveState, useHomelabOverview } from "../live/useHomelabLive"
import type { MetricSparkline } from "../domain/homelab"
import { EmptyState, PageHeader, PageShell, SectionTitle, StatTile, StatusBadge, Surface } from "../components/ui"

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
    <Surface className="h-100 metric-progress">
      <p className="text-secondary small mb-1">{label}</p>
      <h3 className="mb-2">{value}</h3>
      <ProgressBar now={percent} variant={accent} style={{ height: 7 }} />
    </Surface>
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
    <PageShell>
      <PageHeader
        eyebrow="Overview"
        title={overview.hostName}
        description="Tableau de bord synthétique pour le suivi quotidien du homelab, avec capacité, alertes et activité récente."
        actions={<StatusBadge tone="primary"><IconClock size={14} className="me-2" />uptime {overview.uptime}</StatusBadge>}
      />

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
        <div className="col-12 col-md-4">
          <StatTile label="Ressources suivies" value={overview.metrics.length} meta="CPU, mémoire, réseau" tone="primary" />
        </div>
        <div className="col-12 col-md-4">
          <StatTile label="Volumes visibles" value={overview.disks.length} meta="Disques et points de montage" />
        </div>
        <div className="col-12 col-md-4">
          <StatTile label="Alertes actives" value={overview.alerts.length} meta="Événements nécessitant une attention" tone={overview.alerts.length > 0 ? "warning" : "success"} />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Surface className="h-100">
            <SectionTitle title="Disques" subtitle="Capacité, température et pression de stockage." trailing={<StatusBadge>{overview.disks.length} disques</StatusBadge>} />

              <div className="d-flex flex-column gap-3">
                {overview.disks.length === 0 ? (
                  <EmptyState title="Aucun disque remonté par le backend." />
                ) : overview.disks.map((disk) => (
                  <div key={disk.name} className="data-card">
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
                      <StatusBadge tone={disk.percent >= 85 ? "warning" : "success"}>{disk.temp} °C</StatusBadge>
                    </div>
                    <ProgressBar now={disk.percent} variant={disk.percent >= 85 ? "warning" : "info"} className="mt-3" />
                  </div>
                ))}
              </div>
          </Surface>
        </div>

        <div className="col-12 col-xl-5">
          <Surface className="h-100">
              <SectionTitle title="Alertes récentes" subtitle="Anomalies ou signaux à surveiller." />
              <div className="d-flex flex-column gap-2">
                {overview.alerts.length === 0 ? (
                  <EmptyState title="Aucune alerte." />
                ) : overview.alerts.map((alert) => (
                  <div key={alert.label} className="data-card d-flex align-items-start gap-2">
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
          </Surface>
        </div>
      </div>

      <Surface>
          <SectionTitle title="Derniers logs" subtitle="Flux système agrégé." />

          <div className="d-flex flex-column gap-2">
            {overview.logs.length === 0 ? (
              <EmptyState title="Aucun log récent." />
            ) : overview.logs.map((log) => (
              <div key={`${log.timestamp}-${log.source}`} className="data-card d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="font-monospace text-secondary">{log.timestamp}</span>
                  <StatusBadge tone={log.level === "danger" ? "danger" : log.level === "success" ? "success" : "neutral"}>{log.source}</StatusBadge>
                </div>
                <div className="flex-grow-1 text-md-end">{log.content}</div>
              </div>
            ))}
          </div>
      </Surface>
    </PageShell>
  )
}
