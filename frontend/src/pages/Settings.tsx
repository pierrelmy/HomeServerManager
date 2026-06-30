import { useState } from "react"
import { Button, Form, Alert } from "react-bootstrap"
import { IconDeviceFloppy } from "@tabler/icons-react"
import type { SettingsState } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabSettings } from "../live/useHomelabLive"
import { PageHeader, PageShell, SectionTitle, StatTile, StatusBadge, Surface } from "../components/ui"

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
    <PageShell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Réglages visuels et comportementaux du tableau de bord."
        actions={
          <Button className="d-flex align-items-center gap-2" disabled={saving} onClick={() => void handleSave()}>
            <IconDeviceFloppy size={18} />
            Enregistrer
          </Button>
        }
      />

      {saveMessage ? <Alert variant="success" className="mb-0">{saveMessage}</Alert> : null}
      {saveError ? <Alert variant="danger" className="mb-0">{saveError}</Alert> : null}

      <div className="row g-3">
        <div className="col-12 col-md-3"><StatTile label="Thème" value={currentSettings.theme} tone="primary" /></div>
        <div className="col-12 col-md-3"><StatTile label="Densité" value={`${currentSettings.density}%`} /></div>
        <div className="col-12 col-md-3"><StatTile label="Alertes" value={currentSettings.alertsEnabled ? "On" : "Off"} tone={currentSettings.alertsEnabled ? "success" : "neutral"} /></div>
        <div className="col-12 col-md-3"><StatTile label="Sidebar" value={currentSettings.compactSidebar ? "Compacte" : "Large"} /></div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Surface>
            <SectionTitle title="Interface" subtitle="Réglages d’affichage et d’ergonomie." />

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
                  <Form.Label>Densité UI : {currentSettings.density}%</Form.Label>
                  <Form.Range value={currentSettings.density} onChange={(event) => setDraftSettings({ ...currentSettings, density: Number(event.target.value) })} />
                </Form.Group>
              </div>
            </div>

            <div className="mt-4">
              <SectionTitle title="Comportement" subtitle="Préférences applicatives pour ta session." />
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
          </Surface>
        </div>

        <div className="col-12 col-xl-5">
          <Surface className="h-100">
            <SectionTitle title="État courant" subtitle="Résumé des paramètres actifs." />
            <div className="d-flex flex-wrap gap-2 mb-4">
              <StatusBadge>{currentSettings.theme}</StatusBadge>
              <StatusBadge>{currentSettings.density}%</StatusBadge>
              <StatusBadge tone={currentSettings.alertsEnabled ? "success" : "neutral"}>Alerts {currentSettings.alertsEnabled ? "on" : "off"}</StatusBadge>
              <StatusBadge tone={currentSettings.compactSidebar ? "success" : "neutral"}>Sidebar {currentSettings.compactSidebar ? "compact" : "wide"}</StatusBadge>
            </div>

            <div className="data-card">
              <div className="fw-semibold mb-2">Notes</div>
              <ul className="text-secondary mb-0">
                <li>Les changements sont enregistrés par le backend puis renvoyés au frontend.</li>
                <li>Les réglages sont partagés avec la session connectée sur cette instance.</li>
                <li>Le slider de densité reste un réglage de présentation du dashboard.</li>
              </ul>
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  )
}
