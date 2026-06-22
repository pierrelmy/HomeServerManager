import { useState } from "react"
import { Badge, Button, Card, Form } from "react-bootstrap"
import { IconTerminal2, IconPlayerPlay, IconRefresh } from "@tabler/icons-react"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabTerminal } from "../live/useHomelabLive"

export default function TerminalPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const terminal = useHomelabTerminal()
  const [command, setCommand] = useState("")
  const activeSession = terminal?.sessions.find((session) => session.id === terminal.activeSessionId) ?? terminal?.sessions[0]

  const handleRun = () => {
    const trimmed = command.trim()
    if (!trimmed) {
      return
    }

    liveManager.executeTerminalCommand(trimmed)
    setCommand("")
  }

  if (!liveState.ready || !terminal || !activeSession) {
    return <div className="p-3 p-lg-4">Chargement du terminal...</div>
  }

  return (
    <div className="d-flex flex-column gap-4 p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <p className="text-uppercase text-secondary small mb-1">Shell</p>
          <h1 className="mb-0">Terminal</h1>
          <p className="text-secondary mb-0">Console locale simulée pour tester des commandes et lire un historique de sortie.</p>
        </div>

        <div className="d-flex gap-2">
          <Badge bg="dark" className="d-flex align-items-center gap-2 px-3 py-2">
            <IconTerminal2 size={16} />
            {activeSession.status === "connected" ? "Session active" : activeSession.status}
          </Badge>
          <Button variant="outline-secondary" className="d-flex align-items-center gap-2" onClick={() => void liveManager.refreshAll()}>
            <IconRefresh size={18} />
            Synchroniser
          </Button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <Card className="h-100">
            <Card.Body className="d-flex flex-column gap-3">
              <div className="rounded bg-dark text-light p-3" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                {activeSession.lines.map((line, index) => (
                  <div key={`${line.command}-${index}`} className="mb-3">
                    <div className="text-success">
                      {activeSession.prompt} {line.command}
                    </div>
                    {line.output.map((row) => (
                      <div key={`${line.command}-${row}`} className={line.status === "warning" ? "text-warning" : "text-light"}>
                        {row}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <Form
                className="d-flex flex-column flex-md-row gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleRun()
                }}
              >
                <Form.Control
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Tape une commande, par exemple `docker ps` ou `df -h`"
                />
                <Button type="submit" className="d-flex align-items-center gap-2">
                  <IconPlayerPlay size={18} />
                  Exécuter
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-xl-4">
          <Card className="h-100">
            <Card.Body>
              <h2 className="h5 mb-3">Raccourcis</h2>
              <div className="d-grid gap-2">
                {activeSession.quickCommands.map((quick) => (
                  <Button key={quick} variant="outline-secondary" onClick={() => setCommand(quick)}>
                    {quick}
                  </Button>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  )
}
