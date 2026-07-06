import { useState } from "react"
import { IconAlertTriangle, IconPlayerPlay, IconRefresh, IconTerminal2 } from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabTerminal } from "../live/useHomelabLive"
import { Alert, Button, Input, PageHeader, PageShell, SectionTitle, StatusBadge, Surface } from "../components/ui"

export default function TerminalPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const terminal = useHomelabTerminal()
  const [command, setCommand] = useState("")
  const activeSession = terminal?.sessions.find((session) => session.id === terminal.activeSessionId) ?? terminal?.sessions[0]
  const lineCount = activeSession?.lines.length ?? 0
  const lastLine = activeSession?.lines.at(-1) ?? null

  const handleRun = () => {
    const trimmed = command.trim()
    if (!trimmed) return
    liveManager.executeTerminalCommand(trimmed)
    setCommand("")
  }

  if (!liveState.ready || !terminal || !activeSession) {
    return <div className="p-3 p-lg-4">Chargement du terminal...</div>
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Shell access"
        title="Terminal"
        description="Console connectée au backend pour exécuter des commandes shell et lire leur sortie en quasi temps réel."
        actions={(
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">
              <IconTerminal2 size={14} />
              {activeSession.status === "connected" ? "Session active" : activeSession.status}
            </StatusBadge>
            <StatusBadge tone="warning">
              Mode sensible
            </StatusBadge>
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => void liveManager.refreshAll()}>
              <IconRefresh size={18} />
              Synchroniser
            </Button>
          </div>
        )}
      />

      <Alert tone="warning" className="flex items-start gap-3">
        <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Exécution shell libre</div>
          <div className="mt-1">
            Toutes les commandes saisies sont envoyées au backend. Une commande destructive, bloquante ou malformée peut impacter directement la machine.
          </div>
        </div>
      </Alert>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div>
          <Surface className="h-full">
            <SectionTitle
              title="Console"
              subtitle="Historique de la session active et sortie des dernières commandes."
              trailing={(
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="neutral">{lineCount} commandes</StatusBadge>
                  {lastLine ? <StatusBadge tone={lastLine.status === "error" ? "danger" : lastLine.status === "warning" ? "warning" : "success"}>Dernier statut: {lastLine.status}</StatusBadge> : null}
                </div>
              )}
            />
            <div className="terminal-surface">
              {activeSession.lines.length > 0 ? activeSession.lines.map((line, index) => (
                <div key={`${line.command}-${index}`} className="terminal-entry">
                  <div className="terminal-entry__meta">
                    <span className="terminal-entry__time">{line.timestamp}</span>
                    <span className={`terminal-entry__status terminal-entry__status--${line.status}`}>{line.status}</span>
                  </div>
                  <div className="terminal-entry__command">
                    <span className="text-emerald-400">{activeSession.prompt}</span> {line.command}
                  </div>
                  {line.output.length > 0 ? (
                    line.output.map((row) => (
                      <div
                        key={`${line.command}-${row}`}
                        className={
                          line.status === "error"
                            ? "text-rose-300"
                            : line.status === "warning"
                              ? "text-amber-300"
                              : "text-slate-200"
                        }
                      >
                        {row}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">Commande exécutée sans sortie.</div>
                  )}
                </div>
              )) : (
                <div className="terminal-empty-state">
                  <div className="font-medium text-slate-100">Aucune commande exécutée</div>
                  <div className="mt-2 text-sm text-slate-400">Saisis une commande shell ou utilise un raccourci à droite pour démarrer.</div>
                </div>
              )}
            </div>

            <form
              className="mt-3 flex flex-col gap-2 md:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                handleRun()
              }}
            >
              <Input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Exemples: docker ps -a, journalctl -u docker -n 50 --no-pager, systemctl status nginx"
                className="font-mono"
              />
              <Button type="submit" className="flex items-center gap-2">
                <IconPlayerPlay size={18} />
                Exécuter
              </Button>
            </form>
          </Surface>
        </div>
      </div>
    </PageShell>
  )
}
