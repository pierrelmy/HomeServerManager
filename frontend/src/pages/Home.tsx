import { IconAlertCircle, IconAlertTriangle, IconClock, IconServer2 } from "@tabler/icons-react"
import { useHomelabLiveState, useHomelabOverview } from "../live/useHomelabLive"
import type { MetricSparkline } from "../domain/homelab"
import { Alert, EmptyState, PageHeader, PageShell, ProgressBar, SectionTitle, StatTile, StatusBadge, Surface } from "../components/ui"

function LoadingState() {
  return (
    <div className="p-3 p-lg-4">
      <Alert tone="neutral">
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
  accent: "warning" | "success" | "primary"
}) {
  return (
    <Surface className="h-full">
      <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <h3 className="mb-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">{value}</h3>
      <ProgressBar value={percent} tone={accent} />
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

      <div className="grid gap-3 md:grid-cols-3">
        {overview.metrics.map((metric, index) => (
          <div key={metric.label}>
            <MetricCard
              label={metric.label}
              value={metric.value}
              percent={metricPercent(metric)}
              accent={index === 0 ? "primary" : index === 1 ? "warning" : "success"}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <StatTile label="Ressources suivies" value={overview.metrics.length} meta="CPU, mémoire, réseau" tone="primary" />
        </div>
        <div>
          <StatTile label="Volumes visibles" value={overview.disks.length} meta="Disques et points de montage" />
        </div>
        <div>
          <StatTile label="Alertes actives" value={overview.alerts.length} meta="Événements nécessitant une attention" tone={overview.alerts.length > 0 ? "warning" : "success"} />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <Surface className="h-100">
            <SectionTitle title="Disques" subtitle="Capacité, température et pression de stockage." trailing={<StatusBadge>{overview.disks.length} disques</StatusBadge>} />

              <div className="flex flex-col gap-3">
                {overview.disks.length === 0 ? (
                  <EmptyState title="Aucun disque remonté par le backend." />
                ) : overview.disks.map((disk) => (
                  <div key={disk.name} className="data-card">
                    <div className="flex flex-col justify-between gap-2 md:flex-row">
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <IconServer2 size={16} />
                          {disk.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {disk.used} / {disk.total} {disk.unit}
                        </div>
                      </div>
                      <StatusBadge tone={disk.percent >= 85 ? "warning" : "success"}>{disk.temp} °C</StatusBadge>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={disk.percent} tone={disk.percent >= 85 ? "warning" : "primary"} />
                    </div>
                  </div>
                ))}
              </div>
          </Surface>
        </div>

        <div>
          <Surface className="h-100">
              <SectionTitle title="Alertes récentes" subtitle="Anomalies ou signaux à surveiller." />
              <div className="flex flex-col gap-2">
                {overview.alerts.length === 0 ? (
                  <EmptyState title="Aucune alerte." />
                ) : overview.alerts.map((alert) => (
                  <div key={alert.label} className="data-card flex items-start gap-2">
                    {alert.level === "warning" ? (
                      <IconAlertTriangle size={16} className="mt-1 text-amber-500" />
                    ) : (
                      <IconAlertCircle size={16} className="mt-1 text-rose-500" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{alert.label}</div>
                      {alert.detail ? <div className="text-sm text-slate-500 dark:text-slate-400">{alert.detail}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
          </Surface>
        </div>
      </div>

      <Surface>
          <SectionTitle title="Derniers logs" subtitle="Flux système agrégé." />

          <div className="flex flex-col gap-2">
            {overview.logs.length === 0 ? (
              <EmptyState title="Aucun log récent." />
            ) : overview.logs.map((log) => (
              <div key={`${log.timestamp}-${log.source}`} className="data-card flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{log.timestamp}</span>
                  <StatusBadge tone={log.level === "danger" ? "danger" : log.level === "success" ? "success" : "neutral"}>{log.source}</StatusBadge>
                </div>
                <div className="flex-1 md:text-right">{log.content}</div>
              </div>
            ))}
          </div>
      </Surface>
    </PageShell>
  )
}
