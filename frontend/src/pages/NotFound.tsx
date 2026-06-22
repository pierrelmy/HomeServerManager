import { useNavigate } from "react-router-dom"
import { Alert, Button } from "react-bootstrap"

export default function NotFound()
{
    const navigate = useNavigate()

    return (
        <div className="d-flex flex-column justify-content-center align-items-center">
            <Alert variant="danger">
                <h1>404</h1>
                <p className="text-center fs-4">La page que vous recherchez est introuvable :/</p>
            </Alert>
            <Button
                className="row"
                onClick={() => navigate('/')}
            >
                Retourner à l'accueil
            </Button>
        </div>
    )
}