# Déploiement production

## Préparation de l’hôte

1. Installer Node.js 24, Docker, Docker Compose, Caddy via la stack fournie, SQLite, `sudo` et les outils système utilisés.
2. Créer l’utilisateur `homelab`, l’ajouter au groupe `docker` et créer `/opt/homeservermanager` ainsi que `/var/lib/homeservermanager`.
3. Copier `homelab-backend.service` dans `/etc/systemd/system/homeservermanager.service`.
4. Copier `homelab-sudoers` dans `/etc/sudoers.d/homeservermanager`, adapter l’allowlist et valider avec `visudo -cf`.
   Copier aussi les scripts requis depuis `deploy/scripts` vers `/usr/local/libexec/homeservermanager`, appartenant à root et non modifiables par l’utilisateur `homelab`.
5. Copier `backend.env.example` vers `/etc/homeservermanager/backend.env`, renseigner tous les secrets et appliquer le mode `0600`.
6. Configurer le DNS de `DOMAIN` vers l’hôte et autoriser les ports 80/443. Le port 3000 doit être limité au réseau Docker/hôte par le pare-feu.
7. Pour Prometheus, créer `deploy/secrets/metrics_token` avec exactement la valeur de `METRICS_TOKEN`, mode `0600`.

## GitHub

Créer un environnement `production`, le limiter aux branches protégées et y ajouter les secrets :

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_SSH_KNOWN_HOSTS`
- `PRODUCTION_GHCR_USERNAME`
- `PRODUCTION_GHCR_TOKEN` avec accès en lecture au package

Ajouter un reviewer obligatoire si le plan GitHub du dépôt le permet. Sur un dépôt privé sans cette fonctionnalité, conserver le workflow de déploiement en déclenchement manuel et la restriction aux branches protégées.

Protéger `main` et rendre obligatoires les jobs `Backend`, `Frontend`, `Backend Docker image`, `Frontend Docker image` et CodeQL. Le dépôt privé n’ayant pas GitHub Code Security activé, CodeQL conserve son rapport SARIF comme artefact du workflow pendant 30 jours.

Un tag `vX.Y.Z` publie les images GHCR. Le workflow `Deploy production` reste manuel et demande la révision exacte à déployer.

## Premier démarrage

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homeservermanager
cd /opt/homeservermanager/deploy
DOMAIN=homelab.example.com docker compose -f compose.production.yaml up -d
```

Ajouter `--profile monitoring` pour démarrer Prometheus. Les règles fournies détectent l’indisponibilité de l’API et de l’adaptateur système ; raccorder ensuite Prometheus à votre Alertmanager existant pour les notifications.
