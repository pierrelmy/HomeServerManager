import {
  IconRefresh,
  IconPlayerStop,
  IconPlayerPlay,
  IconAlertHexagon,
  IconPlus,
  type IconProps,
  IconLogs,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { Alert, Button, Form, Modal, Offcanvas, Spinner } from "react-bootstrap"
import type { CreateServiceInput, LogVerbosity, ServiceRecord, ServiceStatus } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabServices } from "../live/useHomelabLive"

interface ServiceAction {
  id: "start" | "stop" | "restart" | "see-logs"
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
  label: string
  availableWhile: ServiceStatus[]
  variant: string
}

function getServiceActions(status: ServiceStatus): ServiceAction[] {
  const actions: ServiceAction[] = [
    { id: "start", label: "Démarrer", icon: IconPlayerPlay, availableWhile: ["stopped", "failed"], variant: "primary" },
    { id: "stop", label: "Arrêter", icon: IconPlayerStop, availableWhile: ["starting", "running"], variant: "danger" },
    { id: "restart", label: "Redémarrer", icon: IconRefresh, availableWhile: ["starting", "running", "failed"], variant: "warning" },
    { id: "see-logs", label: "Voir les logs", icon: IconLogs, availableWhile: ["starting", "running", "stopping", "failed", "stopped"], variant: "secondary" },
  ]

  return actions.filter((action) => action.availableWhile.includes(status))
}

function capitalize(value: string): string {
  const trimmed = value.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

function predictServiceId(label: string, unit: string): string {
  const value = (label.trim() || unit.replace(/\.service$/i, "").trim())
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function emptyDraft(): CreateServiceInput {
  return {
    label: "",
    description: "",
    serviceUnit: "",
    servicePath: "",
    installScriptPath: "",
    startAfterInstall: false,
  }
}

function ServiceCard({
  service,
  onOpenLogs,
  onAction,
  busyAction,
}: {
  service: ServiceRecord
  onOpenLogs: (serviceId: string) => void
  onAction: (serviceId: string, action: "start" | "stop" | "restart") => void
  busyAction: string | null
}) {
  return (
    <div className="d-flex flex-column border rounded p-3 bg-light">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-2">
        <span className="fs-3">{service.label}</span>
        <div className="d-flex flex-row justify-content-center align-items-center gap-2">
          <span
            className={`rounded-circle border border-1 bg-${
              service.status === "starting" || service.status === "stopping"
                ? "warning"
                : service.status === "running"
                  ? "success"
                  : service.status === "stopped"
                    ? "body-secondary"
                    : "danger"
            } d-inline-block`}
            style={{ width: 15, height: 15 }}
          />
          <span className="fs-5 fw-medium">{capitalize(service.status)}</span>
        </div>
      </div>

      <div className="d-flex flex-column flex-lg-row justify-content-between gap-2">
        <span className="text-secondary">{service.desc}</span>
        <div className="d-flex flex-column text-secondary text-lg-end">
          <span>{service.unit}</span>
          {service.servicePath ? <span className="small">{service.servicePath}</span> : <span className="small">{service.location}</span>}
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-start gap-2 mt-2">
        {getServiceActions(service.status).map((action) => (
          <Button
            key={action.id}
            className="d-flex flex-row justify-content-center align-items-center gap-1"
            variant={action.variant}
            disabled={busyAction === `${service.id}:${action.id}`}
            onClick={() => {
              if (action.id === "see-logs") {
                onOpenLogs(service.id)
              } else {
                onAction(service.id, action.id)
              }
            }}
          >
            <action.icon />
            <span>{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function LogLine({
  timestamp,
  verbosity,
  content,
}: {
  timestamp: string
  verbosity: LogVerbosity
  content: string
}) {
  let contentClass = "fs-5"

  switch (verbosity) {
    case "debug":
      contentClass += " text-secondary fw-light"
      break
    case "warning":
      contentClass += " text-warning fw-semibold"
      break
    case "error":
      contentClass += " text-danger fw-bold"
      break
  }

  return (
    <div className="d-flex flex-row gap-2">
      <span className="text-secondary fs-5">{timestamp}</span>
      <span className={contentClass}>{content}</span>
    </div>
  )
}

export default function Services() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const services = useHomelabServices()
  const [searchStr, setSearchStr] = useState("")
  const [displayedLogsServiceId, setDisplayedLogsServiceId] = useState("")
  const [statusFilters, setStatusFilters] = useState<ServiceStatus[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshingServices, setRefreshingServices] = useState(false)
  const [refreshingLogsFor, setRefreshingLogsFor] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateServiceInput>(emptyDraft)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creatingServiceId, setCreatingServiceId] = useState<string | null>(null)

  const handleAction = async (serviceId: string, action: "start" | "stop" | "restart") => {
    if (action !== "start" && !window.confirm(`Confirmer l’action « ${action} » sur le service ${serviceId} ?`)) return
    const key = `${serviceId}:${action}`
    setBusyAction(key)
    setActionError(null)
    try {
      await liveManager.actOnService(serviceId, action)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "L’action sur le service a échoué")
    } finally {
      setBusyAction(null)
    }
  }

  const handleRefreshServices = async () => {
    setRefreshingServices(true)
    setActionError(null)
    try {
      await liveManager.refreshServices()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Le rafraîchissement des services a échoué")
    } finally {
      setRefreshingServices(false)
    }
  }

  const handleOpenLogs = async (serviceId: string) => {
    setDisplayedLogsServiceId(serviceId)
    setRefreshingLogsFor(serviceId)
    setActionError(null)
    try {
      await liveManager.refreshServiceLogs(serviceId)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Le chargement des logs a échoué")
    } finally {
      setRefreshingLogsFor(null)
    }
  }

  const displayedServices = useMemo(() => {
    if (!services) {
      return []
    }

    const trimmed = searchStr.trim().toLowerCase()

    return services.filter((service) => {
      const matchesSearch =
        trimmed === "" ||
        service.desc.toLowerCase().includes(trimmed) ||
        service.label.toLowerCase().includes(trimmed) ||
        service.location.toLowerCase().includes(trimmed) ||
        service.status.toLowerCase().includes(trimmed)

      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(service.status)
      return matchesSearch && matchesStatus
    })
  }, [searchStr, services, statusFilters])

  const displayedLogs = useMemo(() => {
    return services?.find((service) => service.id === displayedLogsServiceId)?.logs ?? []
  }, [displayedLogsServiceId, services])

  const creationLogs = useMemo(() => {
    if (!creatingServiceId) return []
    return services?.find((service) => service.id === creatingServiceId)?.logs ?? []
  }, [creatingServiceId, services])

  const canCreateService =
    createDraft.label.trim() !== ""
    && createDraft.serviceUnit.trim() !== ""
    && (createDraft.servicePath?.trim() || createDraft.installScriptPath?.trim())

  const handleCreateService = async () => {
    const nextId = predictServiceId(createDraft.label, createDraft.serviceUnit)
    setCreateError(null)
    setCreatingServiceId(nextId)
    setDisplayedLogsServiceId(nextId)
    try {
      await liveManager.addService({
        label: createDraft.label.trim(),
        description: createDraft.description?.trim() || undefined,
        serviceUnit: createDraft.serviceUnit.trim(),
        servicePath: createDraft.servicePath?.trim() || undefined,
        installScriptPath: createDraft.installScriptPath?.trim() || undefined,
        startAfterInstall: createDraft.startAfterInstall,
      })
      setShowCreateModal(false)
      setCreateDraft(emptyDraft())
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Impossible d'ajouter le service")
    } finally {
      setCreatingServiceId(null)
    }
  }

  if (!liveState.ready || !services) {
    return <div className="p-3 p-lg-4">Chargement des services...</div>
  }

  return (
    <>
      <div className="d-flex flex-column h-100 w-100 p-3">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-stretch align-items-lg-center gap-3">
          <h1>Services • {services.length}</h1>
          <div className="form flex-grow-1 flex-lg-grow-0" style={{ maxWidth: 420 }}>
            <input
              className="form-control rounded-5"
              type="search"
              placeholder="Rechercher un service"
              value={searchStr}
              onChange={(event) => setSearchStr(event.target.value)}
            />
          </div>
          <Button
            variant="primary"
            className="d-flex align-items-center gap-2"
            onClick={() => {
              setCreateError(null)
              setShowCreateModal(true)
            }}
          >
            <IconPlus />
            <span>Ajouter un service</span>
          </Button>
          <Button variant="outline-secondary" onClick={() => void handleRefreshServices()} disabled={refreshingServices}>
            {refreshingServices ? <Spinner animation="border" size="sm" /> : <IconRefresh />}
          </Button>
        </div>

        <br />

        {actionError ? <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert> : null}

        <div className="d-flex flex-wrap justify-content-start align-items-center gap-3">
          <div className="form-check d-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="radio"
              id="filterAll"
              checked={statusFilters.length === 0}
              onChange={() => setStatusFilters([])}
            />
            <label className="form-check-label fs-5 m-0" htmlFor="filterAll">
              Tous
            </label>
          </div>
          {(["starting", "running", "stopping", "stopped", "failed"] as ServiceStatus[]).map((status) => (
            <div key={status} className="form-check d-flex align-items-center gap-2">
              <input
                className="form-check-input"
                type="checkbox"
                id={status}
                onChange={() =>
                  setStatusFilters((prev) =>
                    prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
                  )
                }
                checked={statusFilters.includes(status)}
              />
              <label className="form-check-label fs-5 m-0" htmlFor={status}>
                {capitalize(status)}
              </label>
            </div>
          ))}
        </div>

        <br />

        <div className="d-flex flex-column gap-2">
          {displayedServices.length <= 0 ? (
            <Alert variant="warning">Aucun service ne correspond à cette recherche</Alert>
          ) : (
            displayedServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onOpenLogs={(serviceId) => void handleOpenLogs(serviceId)}
                onAction={(serviceId, action) => void handleAction(serviceId, action)}
                busyAction={busyAction}
              />
            ))
          )}
        </div>
      </div>

      <Offcanvas
        show={displayedLogsServiceId.trim() !== ""}
        onHide={() => setDisplayedLogsServiceId("")}
        placement="end"
        style={{ "--bs-offcanvas-width": "min(560px, 100vw)" } as React.CSSProperties}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            {services.find((service) => service.id === displayedLogsServiceId)?.label ?? "Unknown service"}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div>
            {refreshingLogsFor === displayedLogsServiceId ? (
              <Alert variant="light" className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                <span>Chargement des logs système...</span>
              </Alert>
            ) : null}
            {displayedLogs.length > 0 ? (
              displayedLogs.map((log, index) => (
                <LogLine key={`${log.timestamp}-${index}`} timestamp={log.timestamp} verbosity={log.verbosity} content={log.content} />
              ))
            ) : (
              <Alert variant="warning" className="d-flex flex-row gap-2 align-items-center">
                <IconAlertHexagon />
                <span className="fs-4">Aucun log disponible</span>
              </Alert>
            )}
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      <Modal show={showCreateModal} onHide={() => !creatingServiceId && setShowCreateModal(false)} size="lg" centered>
        <Modal.Header closeButton={!creatingServiceId}>
          <Modal.Title>Ajouter un service</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {createError ? <Alert variant="danger">{createError}</Alert> : null}
          <Alert variant="warning">
            <div className="fw-semibold mb-1">Avertissement sécurité</div>
            <div>
              Le script d'installation indiqué sera exécuté sur la machine avec des privilèges élevés.
              Toute injection, commande destructive ou script non maîtrisé peut compromettre entièrement la VM.
              Tu es responsable du contenu exécuté, de sa provenance et de ses effets.
            </div>
          </Alert>

          <Form
            onSubmit={(event) => {
              event.preventDefault()
              if (canCreateService) void handleCreateService()
            }}
          >
            <Form.Group className="mb-3">
              <Form.Label>Nom affiché</Form.Label>
              <Form.Control
                value={createDraft.label}
                onChange={(event) => setCreateDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder="Ollama"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={createDraft.description ?? ""}
                onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Service LLM local"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Unité systemd</Form.Label>
              <Form.Control
                value={createDraft.serviceUnit}
                onChange={(event) => setCreateDraft((current) => ({ ...current, serviceUnit: event.target.value }))}
                placeholder="ollama.service"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Chemin du service déjà installé</Form.Label>
              <Form.Control
                value={createDraft.servicePath ?? ""}
                onChange={(event) => setCreateDraft((current) => ({ ...current, servicePath: event.target.value }))}
                placeholder="/etc/systemd/system/ollama.service"
              />
              <Form.Text className="text-muted">
                Renseigne ce champ si le service existe déjà sur la machine.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Script d'installation</Form.Label>
              <Form.Control
                value={createDraft.installScriptPath ?? ""}
                onChange={(event) => setCreateDraft((current) => ({ ...current, installScriptPath: event.target.value }))}
                placeholder="/opt/scripts/install-ollama.sh"
              />
              <Form.Text className="text-muted">
                Le backend accepte maintenant tout chemin absolu accessible depuis la VM. Vérifie manuellement le script avant exécution.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Démarrer le service après installation"
                checked={createDraft.startAfterInstall}
                onChange={(event) => setCreateDraft((current) => ({ ...current, startAfterInstall: event.target.checked }))}
              />
            </Form.Group>

            <div className="border rounded p-3 bg-light">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold">Progression</span>
                {creatingServiceId ? (
                  <span className="d-flex align-items-center gap-2 text-secondary">
                    <Spinner animation="border" size="sm" />
                    <span>Exécution en cours</span>
                  </span>
                ) : null}
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {creationLogs.length > 0 ? (
                  creationLogs.map((log, index) => (
                    <LogLine key={`${log.timestamp}-${index}`} timestamp={log.timestamp} verbosity={log.verbosity} content={log.content} />
                  ))
                ) : (
                  <Alert variant="light" className="mb-0">
                    Les logs d’installation et d’ajout apparaîtront ici.
                  </Alert>
                )}
              </div>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCreateModal(false)} disabled={creatingServiceId !== null}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => void handleCreateService()} disabled={!canCreateService || creatingServiceId !== null}>
            {creatingServiceId ? "Ajout..." : "Ajouter"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
