import { useState } from "react"
import { Badge, Button, Card, Form, Alert } from "react-bootstrap"
import { IconDeviceFloppy, IconSettings } from "@tabler/icons-react"
import type { SettingsState } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabSettings } from "../live/useHomelabLive"

export default function SettingsPage() {
  const liveManager = useHomelabLiveManager()
  const liveState = useHomelabLiveState()
  const settings = useHomelabSettings()
  const [draftSettings, setDraftSettings] = useState<SettingsState | null>(null)
  const [saveMessage, setSaveMessage] = useState<string>("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const currentSettings = draftSettings ?? settings

  if (!liveState.ready || !currentSettings) {
    return <div className="p-3 p-lg-4">Chargement des paramètres...</div>
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage("")
    setSaveError(null)
    try {
      const next = await liveManager.updateSettings(currentSettings)
      setDraftSettings(next)
      setSaveMessage("Paramètres enregistrés.")
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "L’enregistrement a échoué")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="d-flex flex-column gap-4 p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div>
          <p className="text-uppercase text-secondary small mb-1">Préférences</p>
          <h1 className="mb-0">Settings</h1>
          <p className="text-secondary mb-0">Réglages visuels et comportementaux du tableau de bord.</p>
        </div>

        <Button className="d-flex align-items-center gap-2" disabled={saving} onClick={() => void handleSave()}>
          <IconDeviceFloppy size={18} />
          Enregistrer
        </Button>
      </div>

      {saveMessage ? <Alert variant="success" className="mb-0">{saveMessage}</Alert> : null}
      {saveError ? <Alert variant="danger" className="mb-0">{saveError}</Alert> : null}

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Card>
            <Card.Body className="d-flex flex-column gap-4">
              <div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <IconSettings size={18} />
                  <h2 className="h5 mb-0">Interface</h2>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <Form.Group>
                      <Form.Label>Thème</Form.Label>
                      <Form.Select value={currentSettings.theme} onChange={(event) => setDraftSettings({ ...currentSettings, theme: event.target.value as SettingsState["theme"] })}>
                        <option value="system">Système</option>
                        <option value="light">Clair</option>
                        <option value="dark">Sombre</option>
                      </Form.Select>
                    </Form.Group>
                  </div>

                  <div className="col-12 col-md-6">
                    <Form.Group>
                      <Form.Label>Dense UI: {currentSettings.density}%</Form.Label>
                      <Form.Range value={currentSettings.density} onChange={(event) => setDraftSettings({ ...currentSettings, density: Number(event.target.value) })} />
                    </Form.Group>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="h5 mb-3">Notifications</h2>
                <div className="d-flex flex-column gap-3">
                  <Form.Check
                    type="switch"
                    id="alerts-enabled"
                    label="Alertes système"
                    checked={currentSettings.alertsEnabled}
                    onChange={(event) => setDraftSettings({ ...currentSettings, alertsEnabled: event.target.checked })}
                  />
                  <Form.Check
                    type="switch"
                    id="compact-sidebar"
                    label="Sidebar compacte"
                    checked={currentSettings.compactSidebar}
                    onChange={(event) => setDraftSettings({ ...currentSettings, compactSidebar: event.target.checked })}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card className="h-100">
            <Card.Body className="d-flex flex-column gap-3">
              <h2 className="h5 mb-0">État courant</h2>
              <div className="d-flex flex-wrap gap-2">
                  <Badge bg="light" text="dark">
                  Theme: {currentSettings.theme}
                  </Badge>
                  <Badge bg="light" text="dark">
                  Density: {currentSettings.density}%
                  </Badge>
                <Badge bg={currentSettings.alertsEnabled ? "success" : "secondary"}>
                  Alerts {currentSettings.alertsEnabled ? "on" : "off"}
                </Badge>
                <Badge bg={currentSettings.compactSidebar ? "success" : "secondary"}>
                  Sidebar {currentSettings.compactSidebar ? "compact" : "wide"}
                </Badge>
              </div>

              <div className="border rounded p-3">
                <div className="fw-semibold mb-2">Notes</div>
                <ul className="text-secondary mb-0">
                  <li>Les changements restent locaux tant qu’aucun backend n’est branché.</li>
                  <li>Les réglages peuvent plus tard être persistés par utilisateur.</li>
                  <li>Le slider sert surtout à simuler un paramètre de densité globale.</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  )
}
