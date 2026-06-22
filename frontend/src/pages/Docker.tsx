import {
  IconBox,
  IconDownload,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  type IconProps,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { Alert, Badge, Button, Form } from "react-bootstrap"
import type { DockerContainer, DockerImage, DockerVolume } from "../domain/homelab"
import { useHomelabDocker, useHomelabLiveManager, useHomelabLiveState } from "../live/useHomelabLive"

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
    <div className="d-flex flex-row flex-wrap gap-2 mt-3">
      {actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={action.variant}
          className="d-flex align-items-center gap-1"
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
    <div className="d-flex flex-column border rounded p-3 bg-light">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <h5 className="mb-1">{container.name}</h5>
          <span className="text-secondary small">{shortId(container.id)}</span>
        </div>

        <Badge bg={container.cpuPercent > 70 ? "danger" : container.cpuPercent > 40 ? "warning" : "success"}>
          CPU {container.cpuPercent}%
        </Badge>
      </div>

      <hr />

      <div className="d-flex flex-column gap-1 small">
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
    <div className="d-flex flex-column border rounded p-3 bg-light">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <h5 className="mb-1">{image.name}</h5>
          <span className="text-secondary small">{shortId(image.id)}</span>
        </div>

        <Badge bg="secondary">{image.tag}</Badge>
      </div>

      <hr />

      <div className="d-flex flex-column gap-1 small">
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
    <div className="d-flex flex-column border rounded p-3 bg-light">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <h5 className="mb-1">{volume.name}</h5>
          <span className="text-secondary small">{shortId(volume.id)}</span>
        </div>

        <IconBox size={24} className="text-secondary" />
      </div>

      <hr />

      <div className="d-flex flex-column gap-1 small">
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

  const runContainerAction = async (action: DockerAction["id"], resourceId: string) => {
    if (action !== "start" && action !== "stop" && action !== "restart") return
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

  const trimmed = searchStr.trim().toLowerCase()

  const displayedContainers = useMemo(() => {
    if (!snapshot) {
      return []
    }

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
    if (!snapshot) {
      return []
    }

    return snapshot.images.filter(
      (image) =>
        trimmed === "" ||
        image.id.toLowerCase().includes(trimmed) ||
        image.name.toLowerCase().includes(trimmed) ||
        image.tag.toLowerCase().includes(trimmed),
    )
  }, [snapshot, trimmed])

  const displayedVolumes = useMemo(() => {
    if (!snapshot) {
      return []
    }

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
    <div className="d-flex flex-column h-100 w-100 p-3 gap-3">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-stretch align-items-lg-center gap-3">
        <h1 className="m-0">Docker manager</h1>

        <Form.Control
          className="rounded-5"
          type="search"
          placeholder="Rechercher un container, une image, un volume..."
          value={searchStr}
          onChange={(event) => setSearchStr(event.target.value)}
          style={{ maxWidth: 420 }}
        />
        <Button variant="outline-secondary" onClick={() => void liveManager.refreshAll()}>
          <IconRefresh />
        </Button>
      </div>

      {actionError ? <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert> : null}

      <div className="d-flex flex-column flex-md-row gap-3">
        <div className="border rounded p-3 bg-light w-100">
          <span className="text-secondary">Containers</span>
          <h3 className="m-0">{snapshot.containers.length}</h3>
        </div>

        <div className="border rounded p-3 bg-light w-100">
          <span className="text-secondary">Images</span>
          <h3 className="m-0">{snapshot.images.length}</h3>
        </div>

        <div className="border rounded p-3 bg-light w-100">
          <span className="text-secondary">Volumes</span>
          <h3 className="m-0">{snapshot.volumes.length}</h3>
        </div>
      </div>

      <div className="d-flex flex-column flex-xl-row align-items-stretch gap-3">
        <section className="d-flex flex-column w-100 gap-2">
          <h2>Containers</h2>

          {displayedContainers.length <= 0 ? (
            <Alert variant="warning">Aucun container ne correspond à cette recherche</Alert>
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
        </section>

        <section className="d-flex flex-column w-100 gap-2">
          <h2>Images</h2>

          {displayedImages.length <= 0 ? (
            <Alert variant="warning">Aucune image ne correspond à cette recherche</Alert>
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
        </section>

        <section className="d-flex flex-column w-100 gap-2">
          <h2>Volumes</h2>

          {displayedVolumes.length <= 0 ? (
            <Alert variant="warning">Aucun volume ne correspond à cette recherche</Alert>
          ) : (
            displayedVolumes.map((volume) => <VolumeCard volume={volume} key={volume.id} />)
          )}
        </section>
      </div>
    </div>
  )
}
