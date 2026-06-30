import { Alert, Button, Spinner } from "react-bootstrap"
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react"
import { Link, useParams } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { useHomelabLiveState, useHomelabServices } from "../live/useHomelabLive"

function resolveIframeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    if (typeof window !== "undefined" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) {
      url.hostname = window.location.hostname
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}

export default function ServiceWebView() {
  const { serviceId = "" } = useParams()
  const liveState = useHomelabLiveState()
  const services = useHomelabServices()
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeTimedOut, setIframeTimedOut] = useState(false)

  const service = services?.find((item) => item.id === serviceId) ?? null
  const iframeUrl = useMemo(() => service?.webUrl ? resolveIframeUrl(service.webUrl) : null, [service?.webUrl])

  useEffect(() => {
    setIframeLoaded(false)
    setIframeTimedOut(false)

    if (!iframeUrl) return

    const timer = window.setTimeout(() => {
      setIframeTimedOut(true)
    }, 4000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [iframeUrl])

  if (!liveState.ready || !services) {
    return <div className="p-3 p-lg-4">Chargement de l’interface du service...</div>
  }

  if (!service) {
    return (
      <div className="p-3 p-lg-4">
        <Alert variant="warning" className="mb-3">Service introuvable.</Alert>
        <Link to="/services" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
          <IconArrowLeft size={18} />
          <span>Retour aux services</span>
        </Link>
      </div>
    )
  }

  if (!iframeUrl) {
    return (
      <div className="p-3 p-lg-4">
        <Alert variant="warning" className="mb-3">
          Ce service n’a pas d’URL web configurée.
        </Alert>
        <Link to="/services" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
          <IconArrowLeft size={18} />
          <span>Retour aux services</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column h-100 w-100 p-3 gap-3">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <div className="text-secondary small mb-1">{service.unit}</div>
          <h1 className="mb-0">{service.label}</h1>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/services" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
            <IconArrowLeft size={18} />
            <span>Retour</span>
          </Link>
          <Button as="a" href={iframeUrl} target="_blank" rel="noreferrer" variant="primary" className="d-inline-flex align-items-center gap-2">
            <IconExternalLink size={18} />
            <span>Ouvrir dans un nouvel onglet</span>
          </Button>
        </div>
      </div>

      {iframeTimedOut && !iframeLoaded ? (
        <Alert variant="warning" className="mb-0">
          <div className="fw-semibold mb-1">Intégration iframe probablement refusée</div>
          <div>
            Ce service n’a pas chargé dans le délai attendu. C’est typiquement le cas quand il renvoie
            `X-Frame-Options` ou `frame-ancestors`.
          </div>
          <div className="mt-2">
            Ouvre plutôt l’interface dans un nouvel onglet.
          </div>
        </Alert>
      ) : (
        <Alert variant="light" className="mb-0">
          Si la page refuse l’affichage dans une iframe via `X-Frame-Options` ou `frame-ancestors`, utilise l’ouverture dans un nouvel onglet.
        </Alert>
      )}

      <div className="border rounded overflow-hidden bg-body position-relative" style={{ minHeight: "70vh" }}>
        {!iframeLoaded && !iframeTimedOut ? (
          <div
            className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center gap-2 bg-body"
            style={{ zIndex: 1 }}
          >
            <Spinner animation="border" />
            <span className="text-secondary">Chargement de l’interface…</span>
          </div>
        ) : null}
        <iframe
          key={iframeUrl}
          title={`Interface ${service.label}`}
          src={iframeUrl}
          onLoad={() => {
            setIframeLoaded(true)
            setIframeTimedOut(false)
          }}
          style={{ width: "100%", height: "100%", minHeight: "70vh", border: 0 }}
        />
      </div>
    </div>
  )
}
