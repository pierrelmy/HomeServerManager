// pages/Login.tsx
import { useState } from "react"
import { Form, Button, Card, Alert, InputGroup } from "react-bootstrap"
import { useNavigate } from "react-router-dom"
import { useAuthSession } from "../hooks/useAuthSession"

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
        <Card className="login-card p-4 p-lg-5">
          <div className="mb-4">
            <div className="page-eyebrow mb-3">Secure access</div>
            <h1 className="h3 mb-2">Connexion</h1>
            <p className="text-secondary small mb-0">Connecte-toi à la console d’administration de ton homelab.</p>
          </div>

          {loginError ? <Alert variant="danger">{loginError}</Alert> : null}

          <Form
            onSubmit={(e) => {
              e.preventDefault()
              void handleLogin()
            }}
          >
            <Form.Group className="mb-3" controlId="email">
              <Form.Label className="small fw-medium">Email</Form.Label>
              <Form.Control className="surface-input" type="email" placeholder="vous@exemple.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
            </Form.Group>

            <Form.Group className="mb-4" controlId="password">
              <Form.Label className="small fw-medium">Mot de passe</Form.Label>
              <InputGroup>
                <Form.Control
                  className="surface-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </Button>
              </InputGroup>
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100" disabled={submitting}>
              {submitting ? "Connexion..." : "Se connecter"}
            </Button>
          </Form>
        </Card>
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
