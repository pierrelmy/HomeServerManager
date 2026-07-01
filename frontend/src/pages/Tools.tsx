import { useState } from "react"
import {
  IconDatabase,
  IconDownload,
  IconRefresh,
  IconServer,
  IconTools,
  IconChartBar,
  IconSettingsAutomation,
  IconShield,
  type IconProps,
} from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabTools } from "../live/useHomelabLive"
import { Alert, Button, EmptyState, PageHeader, PageShell, SectionTitle, StatusBadge, Surface } from "../components/ui"

export default function ToolsPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const tools = useHomelabTools()
  const [runningTool, setRunningTool] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null)
  const updateInProgress = tools?.updateStatus.status === "running"

  const runTool = async (id: string, title: string) => {
    setRunningTool(id)
    setActionMessage(null)
    try {
      await liveManager.runTool(id)
      setActionMessage({
        type: "success",
        text: id === "update-hsm"
          ? "La mise à jour a été lancée. L’interface peut devenir indisponible pendant le redémarrage des services."
          : `${title} a été lancé.`,
      })
    } catch (error) {
      setActionMessage({ type: "danger", text: error instanceof Error ? error.message : "Le lancement de l’outil a échoué" })
    } finally {
      setRunningTool(null)
    }
  }

  if (!liveState.ready || !tools) {
    return <div className="p-3 p-lg-4">Chargement des outils...</div>
  }

  const iconByTag: Record<string, React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>> = {
    Réseau: IconServer,
    Conteneurs: IconTools,
    Support: IconDownload,
    Backups: IconDatabase,
    Index: IconRefresh,
    Synthèse: IconChartBar,
    Maintenance: IconSettingsAutomation,
    Sécurité: IconShield,
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Utility actions"
        title="Tools"
        description="Raccourcis d’administration et actions de maintenance courantes."
        actions={
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => void liveManager.refreshAll()}>
            <IconRefresh size={18} />
            Synchroniser
          </Button>
        }
      />

      {actionMessage ? (
        <Alert tone={actionMessage.type}>{actionMessage.text}</Alert>
      ) : null}

      {tools.tools.some((tool) => tool.id === "update-hsm") ? (
        <Alert tone="warning">
          <div className="font-semibold">Maintenance système</div>
          <div className="mt-1">
            Le lancement de <code>update-hsm</code> peut interrompre temporairement le frontend et le backend pendant le redéploiement.
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.tools.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState title="Aucun outil configuré sur cette instance." />
          </div>
        ) : tools.tools.map((tool) => {
          const Icon = iconByTag[tool.tag] ?? IconTools
          const isMaintenance = tool.id === "update-hsm"
          const isBusy = runningTool === tool.id || (isMaintenance && updateInProgress)

          return (
            <div key={tool.title}>
              <Surface className={`flex h-full flex-col gap-3 ${isMaintenance ? "border-amber-300 dark:border-amber-800" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`rounded-2xl border p-3 ${isMaintenance ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`}>
                      <Icon size={24} />
                    </div>
                    <StatusBadge>{tool.tag}</StatusBadge>
                  </div>

                  <div>
                    <h2 className="mb-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{tool.title}</h2>
                    <p className="text-slate-600 dark:text-slate-300">{tool.description}</p>
                    {isMaintenance ? (
                      <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                        Rebuild + redémarrage des services VM.
                      </p>
                    ) : null}
                  </div>

                  <Button
                    variant={isMaintenance ? "primary" : "secondary"}
                    className="mt-auto"
                    disabled={isBusy}
                    onClick={() => void runTool(tool.id, tool.title)}
                  >
                    {isBusy ? (isMaintenance && updateInProgress ? "Mise à jour en cours..." : "Lancement...") : "Lancer"}
                  </Button>
              </Surface>
            </div>
          )
        })}
      </div>

      <Surface>
        <SectionTitle title="Derniers travaux" subtitle="Historique récent des actions exécutées." />
        <div className="flex flex-col gap-2">
          {tools.recentJobs.length === 0 ? (
            <EmptyState title="Aucun travail récent." />
          ) : tools.recentJobs.map((job) => (
            <div key={job.label} className="data-card flex items-center justify-between gap-3">
              <span>{job.label}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{job.when}</span>
            </div>
          ))}
        </div>
      </Surface>
    </PageShell>
  )
}
