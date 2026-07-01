import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react"
import { Link, useParams } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { useHomelabLiveState, useHomelabServices } from "../live/useHomelabLive"
import { Alert, Button, PageHeader, PageShell, Spinner, Surface } from "../components/ui"

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
        <Alert tone="warning" className="mb-3">Service introuvable.</Alert>
        <Link to="/services" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <IconArrowLeft size={18} />
          <span>Retour aux services</span>
        </Link>
      </div>
    )
  }

  if (!iframeUrl) {
    return (
      <div className="p-3 p-lg-4">
        <Alert tone="warning" className="mb-3">
          Ce service n’a pas d’URL web configurée.
        </Alert>
        <Link to="/services" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <IconArrowLeft size={18} />
          <span>Retour aux services</span>
        </Link>
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={service.unit}
        title={service.label}
        description="Tentative d’ouverture intégrée de l’interface web du service. Si le service refuse l’embed, ouvre-le dans un nouvel onglet."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Link to="/services" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <IconArrowLeft size={18} />
              <span>Retour</span>
            </Link>
            <a href={iframeUrl} target="_blank" rel="noreferrer">
              <Button variant="primary" className="inline-flex items-center gap-2">
              <IconExternalLink size={18} />
              <span>Ouvrir dans un nouvel onglet</span>
              </Button>
            </a>
          </div>
        )}
      />

      {iframeTimedOut && !iframeLoaded ? (
        <Alert tone="warning">
          <div className="mb-1 font-semibold">Intégration iframe probablement refusée</div>
          <div>
            Ce service n’a pas chargé dans le délai attendu. C’est typiquement le cas quand il renvoie
            `X-Frame-Options` ou `frame-ancestors`.
          </div>
          <div className="mt-2">
            Ouvre plutôt l’interface dans un nouvel onglet.
          </div>
        </Alert>
      ) : (
        <Alert tone="neutral">
          Si la page refuse l’affichage dans une iframe via `X-Frame-Options` ou `frame-ancestors`, utilise l’ouverture dans un nouvel onglet.
        </Alert>
      )}

      <Surface>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" style={{ minHeight: "70vh" }}>
        {!iframeLoaded && !iframeTimedOut ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-950"
          >
            <Spinner className="h-5 w-5" />
            <span className="text-slate-500 dark:text-slate-400">Chargement de l’interface…</span>
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
      </Surface>
    </PageShell>
  )
}
