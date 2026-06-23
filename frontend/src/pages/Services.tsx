import {
  IconRefresh,
  IconPlayerStop,
  IconPlayerPlay,
  IconAlertHexagon,
  type IconProps,
  IconLogs,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { Alert, Button, Offcanvas } from "react-bootstrap"
import type { LogVerbosity, ServiceRecord, ServiceStatus } from "../domain/homelab"
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
        <span className="text-secondary">{service.location}</span>
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
          <Button variant="outline-secondary" onClick={() => void liveManager.refreshAll()}>
            <IconRefresh />
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
                onOpenLogs={setDisplayedLogsServiceId}
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
    </>
  )
}
