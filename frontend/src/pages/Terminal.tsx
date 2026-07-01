import { useState } from "react"
import { IconTerminal2, IconPlayerPlay, IconRefresh } from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabTerminal } from "../live/useHomelabLive"
import { Button, Input, PageHeader, PageShell, SectionTitle, StatusBadge, Surface } from "../components/ui"

export default function TerminalPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const terminal = useHomelabTerminal()
  const [command, setCommand] = useState("")
  const activeSession = terminal?.sessions.find((session) => session.id === terminal.activeSessionId) ?? terminal?.sessions[0]

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
        description="Console connectée au backend pour exécuter les commandes autorisées et lire leur sortie."
        actions={(
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">
              <IconTerminal2 size={14} />
              {activeSession.status === "connected" ? "Session active" : activeSession.status}
            </StatusBadge>
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => void liveManager.refreshAll()}>
              <IconRefresh size={18} />
              Synchroniser
            </Button>
          </div>
        )}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div>
          <Surface className="h-full">
            <SectionTitle title="Console" subtitle="Sortie temps réel de la session active." />
            <div className="terminal-surface">
              {activeSession.lines.map((line, index) => (
                <div key={`${line.command}-${index}`} className="mb-3">
                  <div className="text-emerald-400">
                    {activeSession.prompt} {line.command}
                  </div>
                  {line.output.map((row) => (
                    <div key={`${line.command}-${row}`} className={line.status === "warning" ? "text-amber-300" : "text-slate-200"}>
                      {row}
                    </div>
                  ))}
                </div>
              ))}
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
                placeholder="Tape une commande, par exemple `docker ps` ou `df -h`"
              />
              <Button type="submit" className="flex items-center gap-2">
                <IconPlayerPlay size={18} />
                Exécuter
              </Button>
            </form>
          </Surface>
        </div>

        <div>
          <Surface className="h-full">
            <SectionTitle title="Raccourcis" subtitle="Préremplit une commande dans le champ." />
            <div className="grid gap-2">
              {activeSession.quickCommands.map((quick) => (
                <Button key={quick} variant="secondary" onClick={() => setCommand(quick)}>
                  {quick}
                </Button>
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  )
}
