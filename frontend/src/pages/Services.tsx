import {
  IconRefresh,
  IconPlayerStop,
  IconPlayerPlay,
  IconAlertHexagon,
  IconPlus,
  IconBrandDocker,
  IconBox,
  IconCpu,
  IconDatabase,
  IconServer,
  IconShieldCheck,
  IconBrandGithub,
  IconNetwork,
  IconCloudLock,
  IconArchive,
  IconMessageCircle,
  IconWorldWww,
  type IconProps,
  IconLogs,
  IconExternalLink,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { Alert, Button, Form, Modal, Nav, Offcanvas, Spinner } from "react-bootstrap"
import { useNavigate } from "react-router-dom"
import type { CreateServiceInput, LogVerbosity, ServiceRecord, ServiceStatus } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabServices } from "../live/useHomelabLive"

interface ServiceAction {
  id: "start" | "stop" | "restart" | "see-logs"
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
  label: string
  availableWhile: ServiceStatus[]
  variant: string
}

interface KnownServiceTemplate {
  id: string
  label: string
  description: string
  serviceUnit: string
  servicePath?: string
  installCommand?: string
  webUrl?: string
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
}

const knownServices: KnownServiceTemplate[] = [
  {
    id: "ollama",
    label: "Ollama",
    description: "Service LLM local",
    serviceUnit: "ollama.service",
    servicePath: "/etc/systemd/system/ollama.service",
    installCommand: "curl -fsSL https://ollama.com/install.sh | sh\nsystemctl enable ollama\nsystemctl start ollama",
    webUrl: "http://127.0.0.1:11434",
    icon: IconCpu,
  },
  {
    id: "docker",
    label: "Docker Engine",
    description: "Moteur de conteneurs",
    serviceUnit: "docker.service",
    servicePath: "/lib/systemd/system/docker.service",
    icon: IconBrandDocker,
  },
  {
    id: "jenkins",
    label: "Jenkins",
    description: "Intégration continue",
    serviceUnit: "jenkins.service",
    servicePath: "/lib/systemd/system/jenkins.service",
    installCommand: "apt-get update\napt-get install -y fontconfig openjdk-21-jre wget\ninstall -d -m 0755 /etc/apt/keyrings\nwget -O /etc/apt/keyrings/jenkins-keyring.asc https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key\necho 'deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/' | tee /etc/apt/sources.list.d/jenkins.list >/dev/null\napt-get update\napt-get install -y jenkins\nsystemctl enable jenkins\nsystemctl start jenkins",
    webUrl: "http://127.0.0.1:8080",
    icon: IconBox,
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    description: "Base de données locale",
    serviceUnit: "postgresql.service",
    servicePath: "/lib/systemd/system/postgresql.service",
    installCommand: "apt-get update\napt-get install -y postgresql\nsystemctl enable postgresql\nsystemctl start postgresql",
    icon: IconDatabase,
  },
  {
    id: "caddy",
    label: "Caddy",
    description: "Reverse proxy",
    serviceUnit: "caddy.service",
    servicePath: "/lib/systemd/system/caddy.service",
    installCommand: "apt-get update\napt-get install -y debian-keyring debian-archive-keyring apt-transport-https\ncurl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg\ncurl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list\napt-get update\napt-get install -y caddy\nsystemctl enable caddy\nsystemctl start caddy",
    webUrl: "http://127.0.0.1",
    icon: IconServer,
  },
  {
    id: "tailscale",
    label: "Tailscale",
    description: "Réseau privé mesh",
    serviceUnit: "tailscaled.service",
    servicePath: "/lib/systemd/system/tailscaled.service",
    installCommand: "curl -fsSL https://tailscale.com/install.sh | sh\nsystemctl enable tailscaled\nsystemctl start tailscaled",
    icon: IconShieldCheck,
  },
  {
    id: "github-runner",
    label: "GitHub Runner",
    description: "Runner self-hosted GitHub Actions",
    serviceUnit: "actions.runner.service",
    servicePath: "/etc/systemd/system/actions.runner.service",
    icon: IconBrandGithub,
  },
  {
    id: "nginx",
    label: "Nginx",
    description: "Serveur web et reverse proxy",
    serviceUnit: "nginx.service",
    servicePath: "/lib/systemd/system/nginx.service",
    installCommand: "apt-get update\napt-get install -y nginx\nsystemctl enable nginx\nsystemctl start nginx",
    webUrl: "http://127.0.0.1",
    icon: IconWorldWww,
  },
  {
    id: "fail2ban",
    label: "Fail2ban",
    description: "Protection contre les tentatives d'intrusion",
    serviceUnit: "fail2ban.service",
    servicePath: "/lib/systemd/system/fail2ban.service",
    installCommand: "apt-get update\napt-get install -y fail2ban\nsystemctl enable fail2ban\nsystemctl start fail2ban",
    icon: IconCloudLock,
  },
  {
    id: "netdata",
    label: "Netdata",
    description: "Supervision système temps réel",
    serviceUnit: "netdata.service",
    servicePath: "/lib/systemd/system/netdata.service",
    installCommand: "apt-get update\napt-get install -y netdata\nsystemctl enable netdata\nsystemctl start netdata",
    webUrl: "http://127.0.0.1:19999",
    icon: IconNetwork,
  },
  {
    id: "duplicati",
    label: "Duplicati",
    description: "Sauvegarde chiffrée et planifiée",
    serviceUnit: "duplicati.service",
    servicePath: "/etc/systemd/system/duplicati.service",
    webUrl: "http://127.0.0.1:8200",
    icon: IconArchive,
  },
  {
    id: "mosquitto",
    label: "Mosquitto",
    description: "Broker MQTT léger",
    serviceUnit: "mosquitto.service",
    servicePath: "/lib/systemd/system/mosquitto.service",
    installCommand: "apt-get update\napt-get install -y mosquitto mosquitto-clients\nsystemctl enable mosquitto\nsystemctl start mosquitto",
    icon: IconMessageCircle,
  },
  {
    id: "plex",
    label: "Plex Media Server",
    description: "Serveur multimédia",
    serviceUnit: "plexmediaserver.service",
    servicePath: "/lib/systemd/system/plexmediaserver.service",
    webUrl: "http://127.0.0.1:32400/web",
    icon: IconPlayerPlay,
  },
]

function getServiceActions(status: ServiceStatus): ServiceAction[] {
  const actions: ServiceAction[] = [
    { id: "start", label: "Démarrer", icon: IconPlayerPlay, availableWhile: ["stopped", "failed"], variant: "primary" },
    { id: "stop", label: "Arrêter", icon: IconPlayerStop, availableWhile: ["starting", "running"], variant: "danger" },
    { id: "restart", label: "Redémarrer", icon: IconRefresh, availableWhile: ["starting", "running", "failed"], variant: "warning" },
    { id: "see-logs", label: "Voir les logs", icon: IconLogs, availableWhile: ["starting", "running", "stopping", "failed", "stopped"], variant: "secondary" },
  ]

  return actions.filter((action) => action.availableWhile.includes(status))
}

function stopClickPropagation(event: React.MouseEvent | React.KeyboardEvent): void {
  event.stopPropagation()
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
    installCommand: "",
    webUrl: "",
    startAfterInstall: false,
  }
}

function ServiceCard({
  service,
  onOpenLogs,
  onAction,
  busyAction,
  onOpenWeb,
}: {
  service: ServiceRecord
  onOpenLogs: (serviceId: string) => void
  onAction: (serviceId: string, action: "start" | "stop" | "restart") => void
  busyAction: string | null
  onOpenWeb: (serviceId: string) => void
}) {
  return (
    <div
      className={`d-flex flex-column border rounded p-3 bg-light ${service.webUrl ? "cursor-pointer" : ""}`}
      role={service.webUrl ? "button" : undefined}
      tabIndex={service.webUrl ? 0 : undefined}
      onClick={() => {
        if (service.webUrl) onOpenWeb(service.id)
      }}
      onKeyDown={(event) => {
        if (service.webUrl && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onOpenWeb(service.id)
        }
      }}
    >
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fs-3">{service.label}</span>
          {service.webUrl ? (
            <span className="badge text-bg-primary d-inline-flex align-items-center gap-1">
              <IconExternalLink size={14} />
              <span>Interface web</span>
            </span>
          ) : null}
        </div>
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
        {service.webUrl ? (
          <Button
            className="d-flex flex-row justify-content-center align-items-center gap-1"
            variant="outline-primary"
            onClick={(event) => {
              stopClickPropagation(event)
              onOpenWeb(service.id)
            }}
          >
            <IconExternalLink size={18} />
            <span>Ouvrir l’UI</span>
          </Button>
        ) : null}
        {getServiceActions(service.status).map((action) => (
          <Button
            key={action.id}
            className="d-flex flex-row justify-content-center align-items-center gap-1"
            variant={action.variant}
            disabled={busyAction === `${service.id}:${action.id}`}
            onClick={(event) => {
              stopClickPropagation(event)
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

function KnownServiceCard({
  service,
  onSelect,
}: {
  service: KnownServiceTemplate
  onSelect: (service: KnownServiceTemplate) => void
}) {
  return (
    <button
      type="button"
      className="text-start border rounded p-3 bg-light w-100 h-100"
      style={{ minHeight: 180 }}
      onClick={() => onSelect(service)}
    >
      <div className="d-flex align-items-center gap-2 mb-2">
        <service.icon size={24} className="text-secondary" />
        <span className="fs-5 fw-semibold">{service.label}</span>
      </div>
      <div className="small text-secondary mb-3">{service.description}</div>
      <div className="small text-muted mb-1">{service.serviceUnit}</div>
      <div className="small text-muted">
        {service.installCommand ? "Préremplit l’installation et le mode déjà installé." : "Préremplit le mode service déjà installé."}
      </div>
    </button>
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
  const navigate = useNavigate()
  const [searchStr, setSearchStr] = useState("")
  const [displayedLogsServiceId, setDisplayedLogsServiceId] = useState("")
  const [statusFilters, setStatusFilters] = useState<ServiceStatus[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshingServices, setRefreshingServices] = useState(false)
  const [refreshingLogsFor, setRefreshingLogsFor] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMode, setCreateMode] = useState<"catalog" | "installed" | "install">("catalog")
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
    createMode !== "catalog"
    && createDraft.label.trim() !== ""
    && createDraft.serviceUnit.trim() !== ""
    && (createMode === "installed" ? Boolean(createDraft.servicePath?.trim()) : Boolean(createDraft.installCommand?.trim()))

  const applyKnownService = (service: KnownServiceTemplate) => {
    setCreateError(null)
    setCreateDraft({
      label: service.label,
      description: service.description,
      serviceUnit: service.serviceUnit,
      servicePath: service.servicePath ?? "",
      installCommand: service.installCommand ?? "",
      webUrl: service.webUrl ?? "",
      startAfterInstall: false,
    })
    setCreateMode(service.installCommand ? "install" : "installed")
  }

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
        servicePath: createMode === "installed" ? createDraft.servicePath?.trim() || undefined : undefined,
        installCommand: createMode === "install" ? createDraft.installCommand?.trim() || undefined : undefined,
        webUrl: createDraft.webUrl?.trim() || undefined,
        startAfterInstall: createDraft.startAfterInstall,
      })
      setShowCreateModal(false)
      setCreateMode("installed")
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
              setCreateMode("catalog")
              setCreateDraft(emptyDraft())
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
                onOpenWeb={(serviceId) => navigate(`/services/${encodeURIComponent(serviceId)}/web`)}
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
              La commande bash d'installation sera exécutée sur la machine avec des privilèges élevés.
              Toute injection, substitution non maîtrisée, expansion shell ou commande destructive peut compromettre entièrement la VM.
              Tu es responsable du contenu exécuté, de sa provenance et de ses effets.
            </div>
          </Alert>

          <Nav
            variant="tabs"
            activeKey={createMode}
            onSelect={(eventKey) => {
              if (eventKey === "catalog" || eventKey === "installed" || eventKey === "install") setCreateMode(eventKey)
            }}
            className="mb-3"
          >
            <Nav.Item>
              <Nav.Link eventKey="catalog">Recherche un service</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="installed">Service déjà installé</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="install">Service à installer</Nav.Link>
            </Nav.Item>
          </Nav>

          <Form
            onSubmit={(event) => {
              event.preventDefault()
              if (canCreateService) void handleCreateService()
            }}
          >
            {createMode === "catalog" ? (
              <div className="row g-3 mb-3">
                {knownServices.map((service) => (
                  <div key={service.id} className="col-12 col-md-6 col-xl-4">
                    <KnownServiceCard service={service} onSelect={applyKnownService} />
                  </div>
                ))}
              </div>
            ) : null}

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
              <Form.Label>URL web exposée</Form.Label>
              <Form.Control
                value={createDraft.webUrl ?? ""}
                onChange={(event) => setCreateDraft((current) => ({ ...current, webUrl: event.target.value }))}
                placeholder="http://127.0.0.1:8080"
                type="url"
              />
              <Form.Text className="text-muted">
                Si le service expose une interface web, elle sera ouvrable depuis la liste des services dans une iframe.
              </Form.Text>
            </Form.Group>

            {createMode === "catalog" ? (
              <Alert variant="light" className="mb-3">
                Sélectionne un service connu ci-dessus pour préremplir le formulaire, puis complète ou ajuste les champs avant validation.
              </Alert>
            ) : null}

            {createMode === "installed" ? (
              <Form.Group className="mb-3">
                <Form.Label>Chemin du service déjà installé</Form.Label>
                <Form.Control
                  value={createDraft.servicePath ?? ""}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, servicePath: event.target.value }))}
                  placeholder="/etc/systemd/system/ollama.service"
                  required
                />
                <Form.Text className="text-muted">
                  Renseigne le chemin absolu du fichier `.service` déjà présent sur la machine.
                </Form.Text>
              </Form.Group>
            ) : createMode === "install" ? (
              <Form.Group className="mb-3">
                <Form.Label>Commande bash d'installation</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={createDraft.installCommand ?? ""}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, installCommand: event.target.value }))}
                  placeholder={"curl -fsSL https://ollama.com/install.sh | sh\nsystemctl enable ollama\nsystemctl start ollama"}
                  required
                />
                <Form.Text className="text-muted">
                  Cette commande sera exécutée via `sudo -n /bin/bash -lc ...`. Vérifie chaque ligne avant exécution.
                </Form.Text>
              </Form.Group>
            ) : null}

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
