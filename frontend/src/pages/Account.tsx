import { useState } from "react"
import { IconKey, IconUserCircle } from "@tabler/icons-react"
import { useHomelabAccount, useHomelabLiveManager, useHomelabLiveState } from "../live/useHomelabLive"
import { useAuthSession } from "../hooks/useAuthSession"
import { useNavigate } from "react-router-dom"
import { Alert, Button, EmptyState, Input, PageHeader, PageShell, SectionTitle, StatusBadge, Surface } from "../components/ui"

export default function AccountPage() {
  const liveState = useHomelabLiveState()
  const account = useHomelabAccount()
  const liveManager = useHomelabLiveManager()
  const { signOut } = useAuthSession()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const changePassword = async () => {
    setSavingPassword(true)
    setPasswordMessage(null)
    try {
      await liveManager.changePassword(currentPassword, nextPassword)
      setCurrentPassword("")
      setNextPassword("")
      setPasswordMessage({ type: "success", text: "Mot de passe mis à jour. Les autres sessions ont été révoquées." })
    } catch (error) {
      setPasswordMessage({ type: "danger", text: error instanceof Error ? error.message : "La mise à jour a échoué" })
    } finally {
      setSavingPassword(false)
    }
  }

  if (!liveState.ready || !account) {
    return <div className="p-3 p-lg-4">Chargement du compte...</div>
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Identity & access"
        title="Account"
        description="Compte utilisateur, méthodes d’authentification et sessions actives."
        actions={<Button variant="danger" onClick={() => void signOut().then(() => navigate("/login"))}>Se déconnecter</Button>}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <Surface className="h-100">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <IconUserCircle size={40} />
              </div>
              <div>
                <h2 className="mb-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">{account.name}</h2>
                <div className="text-slate-500 dark:text-slate-400">{account.role}</div>
                <StatusBadge tone="success">{account.status}</StatusBadge>
              </div>
            </div>

            <div className="data-card mb-3">
              <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Email</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">{account.email}</div>
            </div>

            <div className="data-card mb-3">
              <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">Méthodes reliées</div>
              <div className="flex flex-col gap-2">
                {account.providers.length === 0 ? (
                  <EmptyState title="Aucune méthode supplémentaire reliée." />
                ) : account.providers.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <IconKey size={18} />
                      {provider.name}
                    </span>
                    <StatusBadge tone={provider.connected ? "success" : "neutral"}>{provider.connected ? "Connecté" : "Déconnecté"}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void changePassword() }} className="data-card space-y-3">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Changer le mot de passe</div>
              {passwordMessage ? <Alert tone={passwordMessage.type}>{passwordMessage.text}</Alert> : null}
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Mot de passe actuel</span>
                <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Nouveau mot de passe</span>
                <Input type="password" autoComplete="new-password" minLength={12} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
              </label>
              <Button type="submit" disabled={savingPassword}>Mettre à jour</Button>
            </form>
          </Surface>
        </div>

        <div>
          <Surface className="h-100">
            <SectionTitle title="Clés et sessions" subtitle="Accès SSH et sessions actives remontées par le backend." />
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <IconKey size={18} />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Clés SSH</span>
                </div>
                <div className="flex flex-col gap-2">
                  {account.sshKeys.length === 0 ? (
                    <div className="data-card text-slate-500 dark:text-slate-400">Aucune clé SSH enregistrée.</div>
                  ) : account.sshKeys.map((key) => (
                    <div key={key.name} className="data-card flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{key.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{key.fingerprint}</div>
                      </div>
                      <StatusBadge tone="success">{key.status}</StatusBadge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Sessions actives</div>
                <div className="flex flex-col gap-2">
                  {account.sessions.length === 0 ? (
                    <div className="data-card text-slate-500 dark:text-slate-400">Aucune session active listée.</div>
                  ) : account.sessions.map((session) => (
                    <div key={session.device} className="data-card flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{session.device}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{session.lastSeen}</div>
                      </div>
                      <StatusBadge tone={session.status === "Active" ? "success" : "neutral"}>{session.status}</StatusBadge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  )
}
