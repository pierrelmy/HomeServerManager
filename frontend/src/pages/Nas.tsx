import { useState } from "react"
import { IconRefresh, IconShieldCheck } from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabNas } from "../live/useHomelabLive"
import { Alert, Button, EmptyState, PageHeader, PageShell, ProgressBar, SectionTitle, StatTile, StatusBadge, Surface } from "../components/ui"

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
          <div className="flex gap-2">
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => void liveManager.refreshAll()}>
              <IconRefresh size={18} />
              Synchroniser
            </Button>
            <Button variant="primary" className="flex items-center gap-2" disabled={scrubRunning} onClick={() => void runScrub()}>
              <IconShieldCheck size={18} />
              Lancer un scrub
            </Button>
          </div>
        )}
      />

      {actionMessage ? (
        <Alert tone={actionMessage.type}>{actionMessage.text}</Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div><StatTile label="Capacité utilisée" value={nas.capacityUsed} meta="Sur l’ensemble du stockage visible" tone="primary" /></div>
        <div><StatTile label="Santé" value={nas.healthSummary} meta="État synthétique des pools" /></div>
        <div><StatTile label="Sauvegarde" value={nas.backupSummary} meta="Derniers cycles connus" /></div>
        <div><StatTile label="Température" value={nas.temperatureSummary} meta="Signal thermique global" tone="warning" /></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <Surface className="h-100">
            <SectionTitle title="Pools" subtitle="Capacité, état et température." trailing={<StatusBadge>{nas.pools.length} pools</StatusBadge>} />

            <div className="flex flex-col gap-3">
              {nas.pools.length === 0 ? (
                <EmptyState title="Aucun pool remonté par le backend." />
              ) : nas.pools.map((pool) => (
                <div key={pool.name} className="data-card">
                  <div className="flex flex-col justify-between gap-2 md:flex-row">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{pool.name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{pool.type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={pool.health === "Healthy" ? "success" : "warning"}>{pool.health}</StatusBadge>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {pool.used} / {pool.total} To
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={(pool.used / pool.total) * 100} tone={pool.health === "Healthy" ? "primary" : "warning"} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Température disque: {pool.temp} °C</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <div>
          <Surface className="h-100">
            <SectionTitle title="Sauvegardes récentes" subtitle="Historique des derniers jobs connus." />
            <div className="flex flex-col gap-2">
              {nas.backups.length === 0 ? (
                <EmptyState title="Aucune sauvegarde remontée par le backend." />
              ) : nas.backups.map((item) => (
                <div key={item.label} className="data-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{item.when}</div>
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

        <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-3 pr-4 font-medium">Emplacement</th>
              <th className="py-3 pr-4 font-medium">Modèle</th>
              <th className="py-3 pr-4 font-medium">Température</th>
              <th className="py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {nas.drives.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-slate-500 dark:text-slate-400">Aucun disque remonté par le backend.</td>
              </tr>
            ) : nas.drives.map((drive) => (
              <tr key={drive.slot} className="border-b border-slate-100 dark:border-slate-800/70">
                <td className="py-3 pr-4">{drive.slot}</td>
                <td className="py-3 pr-4">{drive.model}</td>
                <td className="py-3 pr-4">{drive.temp} °C</td>
                <td className="py-3">
                  <StatusBadge tone={drive.status === "Healthy" ? "success" : "warning"}>{drive.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Surface>
    </PageShell>
  )
}
