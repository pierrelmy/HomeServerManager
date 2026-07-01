import { useNavigate } from "react-router-dom"
import { Button, PageShell, Surface } from "../components/ui"

export default function NotFound()
{
    const navigate = useNavigate()

    return (
        <PageShell>
            <Surface className="mx-auto max-w-xl">
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">404</div>
                    <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Page introuvable</h1>
                    <p className="text-slate-600 dark:text-slate-300">La route demandée n’existe pas ou n’est plus disponible.</p>
                    <Button onClick={() => navigate('/')}>
                        Retourner à l'accueil
                    </Button>
                </div>
            </Surface>
        </PageShell>
    )
}
