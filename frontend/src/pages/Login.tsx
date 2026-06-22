// pages/Login.tsx
import { useState } from "react"
import { Form, Button, Card, Alert } from "react-bootstrap"
import { IconBrandGoogle, IconBrandGithub } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"
import { useAuthSession } from "../hooks/useAuthSession"

export default function Login()
{  
  const navigate = useNavigate()
  const { signIn } = useAuthSession()
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const handleLogin = async (provider: "google" | "github" | "password") => {
    setSubmitting(true)
    setLoginError(null)
    try {
      await signIn(provider)
      navigate('/')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "La connexion a échoué")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <Card style={{ width: 360 }} className="p-4">
        <div className="text-center mb-4">
          <h1 className="h4 mb-1">Connexion</h1>
          <p className="text-secondary small mb-0">Accédez à votre espace</p>
        </div>

        <div className="d-grid gap-2 mb-4">
          <Button
            variant="outline-dark"
            className="d-flex align-items-center justify-content-center gap-2"
            disabled={submitting}
            onClick={() => void handleLogin("google")}
          >
            <IconBrandGoogle size={18} stroke={1.75} />
            Continuer avec Google
          </Button>
          <Button
            variant="dark"
            className="d-flex align-items-center justify-content-center gap-2"
            disabled={submitting}
            onClick={() => void handleLogin("github")}
          >
            <IconBrandGithub size={18} stroke={1.75} />
            Continuer avec GitHub
          </Button>
        </div>

        <div className="d-flex align-items-center gap-2 mb-4">
          <hr className="flex-grow-1 my-0" />
          <span className="small text-secondary">ou</span>
          <hr className="flex-grow-1 my-0" />
        </div>

        {loginError ? <Alert variant="danger">{loginError}</Alert> : null}

        <Form
          onSubmit={(e) => {
            e.preventDefault()
            void handleLogin("password")
          }}
        >
          <Form.Group className="mb-3" controlId="email">
            <Form.Label className="small fw-medium">Email</Form.Label>
            <Form.Control type="email" placeholder="vous@exemple.com" required />
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label className="small fw-medium">Mot de passe</Form.Label>
            <Form.Control type="password" placeholder="••••••••" required />
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={submitting}>
            Se connecter
          </Button>
        </Form>

          <p className="text-center small text-secondary mt-4 mb-0">
          Pas de compte ? <span className="text-decoration-underline">Créer un compte</span>
        </p>
      </Card>
    </div>
  )
}
