import { useNavigate } from "react-router-dom"
import { Button } from "react-bootstrap"
import { PageShell, Surface } from "../components/ui"

export default function NotFound()
{
    const navigate = useNavigate()

    return (
        <PageShell>
            <Surface className="mx-auto" >
                <div className="d-flex flex-column justify-content-center align-items-center text-center gap-3 py-4">
                    <div className="page-eyebrow">404</div>
                    <h1 className="mb-0">Page introuvable</h1>
                    <p className="text-secondary mb-0">La route demandée n’existe pas ou n’est plus disponible.</p>
                    <Button onClick={() => navigate('/')}>
                        Retourner à l'accueil
                    </Button>
                </div>
            </Surface>
        </PageShell>
    )
}
