import { useState } from "react"
import { Alert, Badge, Button, Card } from "react-bootstrap"
import {
  IconDatabase,
  IconDownload,
  IconRefresh,
  IconServer,
  IconTools,
  IconChartBar,
  type IconProps,
} from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabTools } from "../live/useHomelabLive"

export default function ToolsPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const tools = useHomelabTools()
  const [runningTool, setRunningTool] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null)

  const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const runTool = async (title: string) => {
    const id = slug(title)
    setRunningTool(id)
    setActionMessage(null)
    try {
      await liveManager.runTool(id)
      setActionMessage({ type: "success", text: `${title} a été lancé.` })
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
  }

  return (
    <div className="d-flex flex-column gap-4 p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <p className="text-uppercase text-secondary small mb-1">Utilitaires</p>
          <h1 className="mb-0">Tools</h1>
          <p className="text-secondary mb-0">Raccourcis d’administration et actions de maintenance courantes.</p>
        </div>

        <Button variant="outline-secondary" className="d-flex align-items-center gap-2" onClick={() => void liveManager.refreshAll()}>
          <IconRefresh size={18} />
          Synchroniser
        </Button>
      </div>

      {actionMessage ? (
        <Alert variant={actionMessage.type} dismissible onClose={() => setActionMessage(null)}>{actionMessage.text}</Alert>
      ) : null}

      <div className="row g-3">
        {tools.tools.map((tool) => {
          const Icon = iconByTag[tool.tag] ?? IconTools

          return (
            <div className="col-12 col-md-6 col-xl-4" key={tool.title}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div className="rounded bg-body-tertiary p-3">
                      <Icon size={24} />
                    </div>
                    <Badge bg="light" text="dark">
                      {tool.tag}
                    </Badge>
                  </div>

                  <div>
                    <h2 className="h5 mb-2">{tool.title}</h2>
                    <p className="text-secondary mb-0">{tool.description}</p>
                  </div>

                  <Button
                    variant="outline-secondary"
                    className="mt-auto"
                    disabled={runningTool === slug(tool.title)}
                    onClick={() => void runTool(tool.title)}
                  >
                    Lancer
                  </Button>
                </Card.Body>
              </Card>
            </div>
          )
        })}
      </div>

      <Card>
        <Card.Body>
          <h2 className="h5 mb-3">Derniers travaux</h2>
          <div className="d-flex flex-column gap-2">
            {tools.recentJobs.map((job) => (
              <div key={job.label} className="d-flex justify-content-between align-items-center border rounded p-3">
                <span>{job.label}</span>
                <span className="text-secondary small">{job.when}</span>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}
