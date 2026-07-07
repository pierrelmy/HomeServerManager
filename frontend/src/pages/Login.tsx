// pages/Login.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthSession } from "../hooks/useAuthSession"
import { Alert, Button, Input } from "../components/ui"

export default function Login()
{  
  const navigate = useNavigate()
  const { signIn } = useAuthSession()
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    setSubmitting(true)
    setLoginError(null)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "La connexion a échoué")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-card">
          <div className="mb-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Secure access</div>
            <h1 className="mb-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">Connexion</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Connecte-toi à la console d’administration de ton homelab.</p>
          </div>

          {loginError ? <Alert tone="danger" className="mb-4">{loginError}</Alert> : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleLogin()
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
              <Input type="email" placeholder="vous@exemple.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Mot de passe</span>
              <div className="flex gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="shrink-0"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </Button>
              </div>
            </label>

            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>

      <div className="login-hero">
        <div className="login-hero__panel">
          <div className="login-hero__eyebrow">HomeServerManager</div>
          <h2 className="login-hero__title">Une console d’administration unifiée pour ton infrastructure personnelle.</h2>
          <p className="login-hero__description">
            Surveille les services, pilote Docker, consulte le stockage, lance des outils système et garde une vue opérationnelle claire sur ta VM ou ton homelab.
          </p>
        </div>
      </div>
    </div>
  )
}
