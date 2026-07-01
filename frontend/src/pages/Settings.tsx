import { useState } from "react"
import { IconDeviceFloppy } from "@tabler/icons-react"
import type { SettingsState } from "../domain/homelab"
import { useHomelabLiveManager, useHomelabLiveState, useHomelabSettings } from "../live/useHomelabLive"
import { Alert, Button, Field, PageHeader, PageShell, SectionTitle, Select, StatTile, StatusBadge, Surface, Toggle } from "../components/ui"

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
          <Button className="flex items-center gap-2" disabled={saving} onClick={() => void handleSave()}>
            <IconDeviceFloppy size={18} />
            Enregistrer
          </Button>
        }
      />

      {saveMessage ? <Alert tone="success">{saveMessage}</Alert> : null}
      {saveError ? <Alert tone="danger">{saveError}</Alert> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div><StatTile label="Thème" value={currentSettings.theme} tone="primary" /></div>
        <div><StatTile label="Densité" value={`${currentSettings.density}%`} /></div>
        <div><StatTile label="Alertes" value={currentSettings.alertsEnabled ? "On" : "Off"} tone={currentSettings.alertsEnabled ? "success" : "neutral"} /></div>
        <div><StatTile label="Sidebar" value={currentSettings.compactSidebar ? "Compacte" : "Large"} /></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <Surface>
            <SectionTitle title="Interface" subtitle="Réglages d’affichage et d’ergonomie." />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Field label="Thème">
                  <Select value={currentSettings.theme} onChange={(event) => setDraftSettings({ ...currentSettings, theme: event.target.value as SettingsState["theme"] })}>
                    <option value="system">Système</option>
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                  </Select>
                </Field>
              </div>

              <div>
                <Field label={`Densité UI : ${currentSettings.density}%`}>
                  <input
                    type="range"
                    min={80}
                    max={110}
                    value={currentSettings.density}
                    onChange={(event) => setDraftSettings({ ...currentSettings, density: Number(event.target.value) })}
                    className="w-full accent-sky-600"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6">
              <SectionTitle title="Comportement" subtitle="Préférences applicatives pour ta session." />
              <div className="flex flex-col gap-3">
                <Toggle label="Alertes système" checked={currentSettings.alertsEnabled} onChange={(checked) => setDraftSettings({ ...currentSettings, alertsEnabled: checked })} />
                <Toggle label="Sidebar compacte" checked={currentSettings.compactSidebar} onChange={(checked) => setDraftSettings({ ...currentSettings, compactSidebar: checked })} />
              </div>
            </div>
          </Surface>
        </div>

        <div>
          <Surface className="h-100">
            <SectionTitle title="État courant" subtitle="Résumé des paramètres actifs." />
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge>{currentSettings.theme}</StatusBadge>
              <StatusBadge>{currentSettings.density}%</StatusBadge>
              <StatusBadge tone={currentSettings.alertsEnabled ? "success" : "neutral"}>Alerts {currentSettings.alertsEnabled ? "on" : "off"}</StatusBadge>
              <StatusBadge tone={currentSettings.compactSidebar ? "success" : "neutral"}>Sidebar {currentSettings.compactSidebar ? "compact" : "wide"}</StatusBadge>
            </div>

            <div className="data-card">
              <div className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Notes</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
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
