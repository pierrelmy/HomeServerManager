import {
  IconBox,
  IconDownload,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  type IconProps,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"
import type { DockerContainer, DockerImage, DockerVolume } from "../domain/homelab"
import { useHomelabDocker, useHomelabLiveManager, useHomelabLiveState } from "../live/useHomelabLive"
import { Alert, Button, EmptyState, Input, PageHeader, PageShell, SectionTitle, StatTile, StatusBadge } from "../components/ui"

interface DockerAction {
  id: "start" | "stop" | "restart" | "pull" | "run"
  label: string
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
  variant: string
}

function formatDate(date: string): string {
  return date
}

function shortId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 18)}...` : id
}

function getContainerActions(): DockerAction[] {
  return [
    { id: "start", label: "Démarrer", icon: IconPlayerPlay, variant: "primary" },
    { id: "stop", label: "Arrêter", icon: IconPlayerStop, variant: "danger" },
    { id: "restart", label: "Redémarrer", icon: IconRefresh, variant: "warning" },
  ]
}

function getImageActions(): DockerAction[] {
  return [
    { id: "pull", label: "Pull", icon: IconDownload, variant: "primary" },
    { id: "run", label: "Run", icon: IconPlayerPlay, variant: "success" },
  ]
}

function ActionButtons({
  actions,
  resourceId,
  busyAction,
  onAction,
}: {
  actions: DockerAction[]
  resourceId: string
  busyAction: string | null
  onAction: (action: DockerAction["id"], resourceId: string) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant === "danger" ? "danger" : action.variant === "primary" || action.variant === "success" ? "primary" : "secondary"}
          className="flex items-center gap-1 px-3 py-2 text-xs"
          disabled={busyAction === `${resourceId}:${action.id}`}
          onClick={() => onAction(action.id, resourceId)}
        >
          <action.icon size={18} />
          <span>{action.label}</span>
        </Button>
      ))}
    </div>
  )
}

function ContainerCard({
  container,
  image,
  volume,
  busyAction,
  onAction,
}: {
  container: DockerContainer
  image?: DockerImage
  volume?: DockerVolume
  busyAction: string | null
  onAction: (action: DockerAction["id"], resourceId: string) => void
}) {
  return (
    <div className="data-card flex flex-col">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h5 className="mb-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{container.name}</h5>
          <span className="text-sm text-slate-500 dark:text-slate-400">{shortId(container.id)}</span>
        </div>

        <StatusBadge tone={container.cpuPercent > 70 ? "danger" : container.cpuPercent > 40 ? "warning" : "success"}>
          CPU {container.cpuPercent}%
        </StatusBadge>
      </div>

      <div className="my-4 h-px bg-slate-200 dark:bg-slate-800" />

      <div className="flex flex-col gap-1 text-sm">
        <span>
          <strong>Image:</strong> {image ? `${image.name}:${image.tag}` : "Image inconnue"}
        </span>
        <span>
          <strong>Volume:</strong> {volume ? volume.name : "Volume inconnu"}
        </span>
        <span>
          <strong>Dernier démarrage:</strong> {formatDate(container.lastStarted)}
        </span>
      </div>

      <ActionButtons actions={getContainerActions()} resourceId={container.id} busyAction={busyAction} onAction={onAction} />
    </div>
  )
}

function ImageCard({ image, busyAction, onAction }: {
  image: DockerImage
  busyAction: string | null
  onAction: (action: DockerAction["id"], resourceId: string) => void
}) {
  return (
    <div className="data-card flex flex-col">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h5 className="mb-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{image.name}</h5>
          <span className="text-sm text-slate-500 dark:text-slate-400">{shortId(image.id)}</span>
        </div>

        <StatusBadge>{image.tag}</StatusBadge>
      </div>

      <div className="my-4 h-px bg-slate-200 dark:bg-slate-800" />

      <div className="flex flex-col gap-1 text-sm">
        <span>
          <strong>Taille:</strong> {image.sizeMB} MB
        </span>
        <span>
          <strong>Créée:</strong> {formatDate(image.created)}
        </span>
      </div>

      <ActionButtons actions={getImageActions()} resourceId={image.id} busyAction={busyAction} onAction={onAction} />
    </div>
  )
}

function VolumeCard({ volume }: { volume: DockerVolume }) {
  return (
    <div className="data-card flex flex-col">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h5 className="mb-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{volume.name}</h5>
          <span className="text-sm text-slate-500 dark:text-slate-400">{shortId(volume.id)}</span>
        </div>

        <IconBox size={24} className="text-slate-500 dark:text-slate-400" />
      </div>

      <div className="my-4 h-px bg-slate-200 dark:bg-slate-800" />

      <div className="flex flex-col gap-1 text-sm">
        <span>
          <strong>Taille:</strong> {volume.sizeMB} MB
        </span>
        <span>
          <strong>Créé:</strong> {formatDate(volume.created)}
        </span>
      </div>
    </div>
  )
}

export default function DockerPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const snapshot = useHomelabDocker()
  const [searchStr, setSearchStr] = useState("")
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const runContainerAction = async (action: DockerAction["id"], resourceId: string) => {
    if (action !== "start" && action !== "stop" && action !== "restart") return
    if (action !== "start" && !window.confirm(`Confirmer l’action « ${action} » sur ce conteneur ?`)) return
    const key = `${resourceId}:${action}`
    setBusyAction(key)
    setActionError(null)
    try {
      await liveManager.actOnContainer(resourceId, action)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "L’action Docker a échoué")
    } finally {
      setBusyAction(null)
    }
  }

  const runImageAction = async (action: DockerAction["id"], resourceId: string) => {
    if (action !== "pull" && action !== "run") return
    if (action === "run" && !window.confirm("Confirmer la création d’un nouveau conteneur depuis cette image ?")) return
    const key = `${resourceId}:${action}`
    setBusyAction(key)
    setActionError(null)
    try {
      await liveManager.actOnImage(resourceId, action)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "L’action Docker a échoué")
    } finally {
      setBusyAction(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshError(null)
    try {
      await liveManager.refreshAll()
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Le rafraîchissement Docker a échoué")
    }
  }

  const trimmed = searchStr.trim().toLowerCase()

  const displayedContainers = useMemo(() => {
    if (!snapshot) return []

    return snapshot.containers.filter((container) => {
      const image = snapshot.images.find((item) => item.id === container.imageId)
      const volume = snapshot.volumes.find((item) => item.id === container.volumeId)

      return (
        trimmed === "" ||
        container.name.toLowerCase().includes(trimmed) ||
        container.id.toLowerCase().includes(trimmed) ||
        image?.name.toLowerCase().includes(trimmed) ||
        image?.tag.toLowerCase().includes(trimmed) ||
        volume?.name.toLowerCase().includes(trimmed)
      )
    })
  }, [snapshot, trimmed])

  const displayedImages = useMemo(() => {
    if (!snapshot) return []

    return snapshot.images.filter(
      (image) =>
        trimmed === "" ||
        image.id.toLowerCase().includes(trimmed) ||
        image.name.toLowerCase().includes(trimmed) ||
        image.tag.toLowerCase().includes(trimmed),
    )
  }, [snapshot, trimmed])

  const displayedVolumes = useMemo(() => {
    if (!snapshot) return []

    return snapshot.volumes.filter(
      (volume) =>
        trimmed === "" ||
        volume.id.toLowerCase().includes(trimmed) ||
        volume.name.toLowerCase().includes(trimmed),
    )
  }, [snapshot, trimmed])

  if (!liveState.ready || !snapshot) {
    return <div className="p-3 p-lg-4">Chargement de Docker...</div>
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Containers"
        title="Docker"
        description="Supervision et actions courantes sur les conteneurs, images et volumes."
        actions={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              type="search"
              placeholder="Rechercher un conteneur, une image, un volume..."
              value={searchStr}
              onChange={(event) => setSearchStr(event.target.value)}
              className="w-full sm:min-w-[20rem] sm:max-w-[420px]"
            />
            <Button variant="secondary" onClick={() => void handleRefresh()}>
              <IconRefresh />
            </Button>
          </div>
        )}
      />

      {snapshot.error ? (
        <Alert tone="danger">
          Docker n’a pas pu être chargé correctement. {snapshot.error}
        </Alert>
      ) : null}

      {refreshError ? <Alert tone="danger">{refreshError}</Alert> : null}
      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div><StatTile label="Conteneurs" value={snapshot.containers.length} meta="Instances suivies" tone="primary" /></div>
        <div><StatTile label="Images" value={snapshot.images.length} meta="Références disponibles" /></div>
        <div><StatTile label="Volumes" value={snapshot.volumes.length} meta="Stockage Docker" /></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div>
          <SectionTitle title="Containers" />
          <div className="flex flex-col gap-3">
            {displayedContainers.length <= 0 ? (
              <EmptyState title={snapshot.error ? "Impossible de lister les conteneurs Docker" : "Aucun conteneur ne correspond à cette recherche"} />
            ) : (
              displayedContainers.map((container) => (
                <ContainerCard
                  key={container.id}
                  container={container}
                  image={snapshot.images.find((image) => image.id === container.imageId)}
                  volume={snapshot.volumes.find((volume) => volume.id === container.volumeId)}
                  busyAction={busyAction}
                  onAction={(action, resourceId) => void runContainerAction(action, resourceId)}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <SectionTitle title="Images" />
          <div className="flex flex-col gap-3">
            {displayedImages.length <= 0 ? (
              <EmptyState title={snapshot.error ? "Impossible de lister les images Docker" : "Aucune image ne correspond à cette recherche"} />
            ) : (
              displayedImages.map((image) => (
                <ImageCard
                  image={image}
                  key={image.id}
                  busyAction={busyAction}
                  onAction={(action, resourceId) => void runImageAction(action, resourceId)}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <SectionTitle title="Volumes" />
          <div className="flex flex-col gap-3">
            {displayedVolumes.length <= 0 ? (
              <EmptyState title={snapshot.error ? "Impossible de lister les volumes Docker" : "Aucun volume ne correspond à cette recherche"} />
            ) : (
              displayedVolumes.map((volume) => <VolumeCard volume={volume} key={volume.id} />)
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
