// pages/Login.tsx
import { useState } from "react"
import { Form, Button, Card, Alert } from "react-bootstrap"
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
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <Card style={{ width: 360 }} className="p-4">
        <div className="text-center mb-4">
          <h1 className="h4 mb-1">Connexion</h1>
          <p className="text-secondary small mb-0">Accédez à votre espace</p>
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
            <Form.Control type="email" placeholder="vous@exemple.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label className="small fw-medium">Mot de passe</Form.Label>
            <Form.Control type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={submitting}>
            Se connecter
          </Button>
        </Form>

      </Card>
    </div>
  )
}
