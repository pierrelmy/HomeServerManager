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
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { CreateServiceInput, LogVerbosity, ServiceRecord, ServiceStatus } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabServices } from "../live/useHomelabLive"
import { Alert, Button, EmptyState, Input, PageHeader, PageShell, SectionTitle, Spinner, StatTile, StatusBadge, Surface, Textarea } from "../components/ui"

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
    installCommand: "export DEBIAN_FRONTEND=noninteractive\napt-get update\napt-get install -y fontconfig wget curl gpg ca-certificates\nif apt-cache show openjdk-21-jre >/dev/null 2>&1; then\n  apt-get install -y openjdk-21-jre\nelse\n  install -d -m 0755 /etc/apt/keyrings\n  wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg\n  . /etc/os-release\n  echo \"deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb ${VERSION_CODENAME} main\" | tee /etc/apt/sources.list.d/adoptium.list >/dev/null\n  apt-get update\n  apt-get install -y temurin-21-jre\nfi\ninstall -d -m 0755 /etc/apt/keyrings\nwget -O /etc/apt/keyrings/jenkins-keyring.asc https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key\necho 'deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/' | tee /etc/apt/sources.list.d/jenkins.list >/dev/null\napt-get update\napt-get install -y jenkins\nsystemctl enable jenkins\nsystemctl start jenkins",
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
      className={`service-card flex flex-col ${service.webUrl ? "service-card--interactive cursor-pointer" : ""}`}
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
      <div className="flex flex-col items-start justify-between gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{service.label}</span>
          {service.webUrl ? (
            <StatusBadge tone="primary">
              <IconExternalLink size={14} />
              <span>Interface web</span>
            </StatusBadge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            tone={
              service.status === "starting" || service.status === "stopping"
                ? "warning"
                : service.status === "running"
                  ? "success"
                  : service.status === "stopped"
                    ? "neutral"
                    : "danger"
            }
          >
            {capitalize(service.status)}
          </StatusBadge>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-2 lg:flex-row">
        <span className="text-slate-600 dark:text-slate-300">{service.desc}</span>
        <div className="flex flex-col text-sm text-slate-500 dark:text-slate-400 lg:text-right">
          <span>{service.unit}</span>
          {service.servicePath ? <span className="text-xs">{service.servicePath}</span> : <span className="text-xs">{service.location}</span>}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
        {service.webUrl ? (
          <Button
            className="flex w-full items-center gap-1 sm:w-auto"
            variant="secondary"
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
            className="flex w-full items-center gap-1 sm:w-auto"
            variant={action.variant === "danger" ? "danger" : action.variant === "primary" ? "primary" : "secondary"}
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
      className="catalog-card"
      onClick={() => onSelect(service)}
    >
      <div className="mb-2 flex items-center gap-2">
        <service.icon size={24} className="text-slate-500 dark:text-slate-400" />
        <span className="text-lg font-semibold text-slate-950 dark:text-slate-50">{service.label}</span>
      </div>
      <div className="mb-3 text-sm text-slate-600 dark:text-slate-300">{service.description}</div>
      <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">{service.serviceUnit}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
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
  let contentClass = "text-sm"

  switch (verbosity) {
    case "debug":
      contentClass += " text-slate-500 dark:text-slate-400"
      break
    case "warning":
      contentClass += " font-semibold text-amber-500"
      break
    case "error":
      contentClass += " font-semibold text-rose-500"
      break
    default:
      contentClass += " text-slate-800 dark:text-slate-100"
      break
  }

  return (
    <div className="flex gap-2">
      <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{timestamp}</span>
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
  const [createProgressLogs, setCreateProgressLogs] = useState<Array<{ timestamp: string; verbosity: LogVerbosity; content: string }>>([])

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

  useEffect(() => {
    if (!creatingServiceId) return
    const currentLogs = services?.find((service) => service.id === creatingServiceId)?.logs
    if (currentLogs && currentLogs.length > 0) {
      setCreateProgressLogs(currentLogs)
    }
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
    setCreateProgressLogs([])
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
      const message = error instanceof Error ? error.message : "Impossible d'ajouter le service"
      setCreateError(message)
      setCreateProgressLogs((current) => [
        ...current,
        {
          timestamp: new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          verbosity: "error",
          content: message,
        },
      ])
    } finally {
      setCreatingServiceId(null)
    }
  }

  if (!liveState.ready || !services) {
    return <div className="p-3 p-lg-4">Chargement des services...</div>
  }

  return (
    <>
      <PageShell>
        <PageHeader
          eyebrow="Service registry"
          title="Services"
          description="Pilotage des unités systemd, ajout de services connus ou personnalisés, accès aux logs et aux interfaces web."
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                className="flex items-center gap-2"
                onClick={() => {
                  setCreateError(null)
                  setCreateMode("catalog")
                  setCreateDraft(emptyDraft())
                  setCreateProgressLogs([])
                  setShowCreateModal(true)
                }}
              >
                <IconPlus />
                <span>Ajouter un service</span>
              </Button>
              <Button variant="secondary" onClick={() => void handleRefreshServices()} disabled={refreshingServices}>
                {refreshingServices ? <Spinner /> : <IconRefresh />}
              </Button>
            </div>
          )}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <StatTile label="Services suivis" value={services.length} meta="Inventaire courant de l’instance" tone="primary" />
          </div>
          <div>
            <StatTile label="En exécution" value={services.filter((service) => service.status === "running").length} meta="Unités systemd actives" tone="success" />
          </div>
          <div>
            <StatTile label="En anomalie" value={services.filter((service) => service.status === "failed").length} meta="Intervention potentiellement requise" tone={services.some((service) => service.status === "failed") ? "danger" : "neutral"} />
          </div>
        </div>

        <Surface className="flex flex-col gap-3">
            <SectionTitle title="Liste des services" subtitle="Recherche, filtrage, actions d’administration et ouverture d’interface web." />
            <div className="surface-toolbar">
              <div className="flex-1 lg:max-w-[420px]">
            <Input
              type="search"
              placeholder="Rechercher un service"
              value={searchStr}
              onChange={(event) => setSearchStr(event.target.value)}
            />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                    type="radio"
                    id="filterAll"
                    checked={statusFilters.length === 0}
                    onChange={() => setStatusFilters([])}
                  />
                  <span>Tous</span>
                </label>
                {(["starting", "running", "stopping", "stopped", "failed"] as ServiceStatus[]).map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                      type="checkbox"
                      id={status}
                      onChange={() =>
                        setStatusFilters((prev) =>
                          prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
                        )
                      }
                      checked={statusFilters.includes(status)}
                    />
                    <span>{capitalize(status)}</span>
                  </label>
                ))}
              </div>
            </div>

            {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

            <div className="flex flex-col gap-3">
              {displayedServices.length <= 0 ? (
                <EmptyState title="Aucun service ne correspond à cette recherche" />
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
        </Surface>
      </PageShell>

      {displayedLogsServiceId.trim() !== "" ? (
      <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50">
        <div className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-slate-950 dark:text-slate-50">
            {services.find((service) => service.id === displayedLogsServiceId)?.label ?? "Unknown service"}
            </div>
            <Button variant="secondary" onClick={() => setDisplayedLogsServiceId("")}>Fermer</Button>
          </div>
          <div>
            {refreshingLogsFor === displayedLogsServiceId ? (
              <Alert tone="neutral" className="mb-3 flex items-center gap-2">
                <Spinner />
                <span>Chargement des logs système...</span>
              </Alert>
            ) : null}
            {displayedLogs.length > 0 ? (
              displayedLogs.map((log, index) => (
                <LogLine key={`${log.timestamp}-${index}`} timestamp={log.timestamp} verbosity={log.verbosity} content={log.content} />
              ))
            ) : (
              <Alert tone="warning" className="flex items-center gap-2">
                <IconAlertHexagon />
                <span>Aucun log disponible</span>
              </Alert>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {showCreateModal ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
        <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xl font-semibold text-slate-950 dark:text-slate-50">Ajouter un service</div>
            <Button variant="secondary" onClick={() => !creatingServiceId && setShowCreateModal(false)} disabled={creatingServiceId !== null}>Fermer</Button>
          </div>
          {createError ? <Alert tone="danger" className="mb-3">{createError}</Alert> : null}
          <Alert tone="warning" className="mb-4">
            <div className="mb-1 font-semibold">Avertissement sécurité</div>
            <div>
              La commande bash d'installation sera exécutée sur la machine avec des privilèges élevés.
              Toute injection, substitution non maîtrisée, expansion shell ou commande destructive peut compromettre entièrement la VM.
              Tu es responsable du contenu exécuté, de sa provenance et de ses effets.
            </div>
          </Alert>

          <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 sm:inline-flex">
            {[
              ["catalog", "Recherche un service"],
              ["installed", "Service déjà installé"],
              ["install", "Service à installer"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCreateMode(mode as typeof createMode)}
                className={`rounded-xl px-4 py-2 text-left text-sm font-medium transition sm:text-center ${
                  createMode === mode
                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (canCreateService) void handleCreateService()
            }}
          >
            {createMode === "catalog" ? (
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {knownServices.map((service) => (
                  <div key={service.id}>
                    <KnownServiceCard service={service} onSelect={applyKnownService} />
                  </div>
                ))}
              </div>
            ) : null}

            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Nom affiché</span>
              <Input
                value={createDraft.label}
                onChange={(event) => setCreateDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder="Ollama"
                required
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Description</span>
              <Input
                value={createDraft.description ?? ""}
                onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Service LLM local"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Unité systemd</span>
              <Input
                value={createDraft.serviceUnit}
                onChange={(event) => setCreateDraft((current) => ({ ...current, serviceUnit: event.target.value }))}
                placeholder="ollama.service"
                required
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">URL web exposée</span>
              <Input
                value={createDraft.webUrl ?? ""}
                onChange={(event) => setCreateDraft((current) => ({ ...current, webUrl: event.target.value }))}
                placeholder="http://127.0.0.1:8080"
                type="url"
              />
              <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                Si le service expose une interface web, elle sera ouvrable depuis la liste des services dans une iframe.
              </span>
            </label>

            {createMode === "catalog" ? (
              <Alert tone="neutral" className="mb-3">
                Sélectionne un service connu ci-dessus pour préremplir le formulaire, puis complète ou ajuste les champs avant validation.
              </Alert>
            ) : null}

            {createMode === "installed" ? (
              <label className="mb-3 block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Chemin du service déjà installé</span>
                <Input
                  value={createDraft.servicePath ?? ""}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, servicePath: event.target.value }))}
                  placeholder="/etc/systemd/system/ollama.service"
                  required
                />
                <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                  Renseigne le chemin absolu du fichier `.service` déjà présent sur la machine.
                </span>
              </label>
            ) : createMode === "install" ? (
              <label className="mb-3 block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Commande bash d'installation</span>
                <Textarea
                  rows={6}
                  value={createDraft.installCommand ?? ""}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, installCommand: event.target.value }))}
                  placeholder={"curl -fsSL https://ollama.com/install.sh | sh\nsystemctl enable ollama\nsystemctl start ollama"}
                  required
                />
                <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                  Cette commande sera exécutée via `sudo -n /bin/bash -lc ...`. Vérifie chaque ligne avant exécution.
                </span>
              </label>
            ) : null}

            <label className="mb-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                checked={createDraft.startAfterInstall}
                onChange={(event) => setCreateDraft((current) => ({ ...current, startAfterInstall: event.target.checked }))}
              />
              <span>Démarrer le service après installation</span>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Progression</span>
                {creatingServiceId ? (
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Spinner />
                    <span>Exécution en cours</span>
                  </span>
                ) : null}
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {createProgressLogs.length > 0 ? (
                  createProgressLogs.map((log, index) => (
                    <LogLine key={`${log.timestamp}-${index}`} timestamp={log.timestamp} verbosity={log.verbosity} content={log.content} />
                  ))
                ) : (
                  <Alert tone="neutral">
                    Les logs d’installation et d’ajout apparaîtront ici.
                  </Alert>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowCreateModal(false)
              setCreateProgressLogs([])
            }}
            disabled={creatingServiceId !== null}
          >
            Annuler
          </Button>
          <Button variant="primary" onClick={() => void handleCreateService()} disabled={!canCreateService || creatingServiceId !== null}>
            {creatingServiceId ? "Ajout..." : "Ajouter"}
          </Button>
            </div>
          </form>
        </div>
      </div>
      ) : null}
    </>
  )
}
