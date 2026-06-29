# Déploiement production

## Préparation de l’hôte

1. Installer Node.js 24, Docker, Docker Compose, Caddy via la stack fournie, SQLite, `sudo` et les outils système utilisés.
2. Créer l’utilisateur `homelab`, l’ajouter au groupe `docker` et créer `/opt/homeservermanager` ainsi que `/var/lib/homeservermanager`.
3. Copier `homelab-backend.service` dans `/etc/systemd/system/homeservermanager.service`.
4. Copier `homelab-sudoers` dans `/etc/sudoers.d/homeservermanager`, adapter l’allowlist et valider avec `visudo -cf`.
   Copier aussi les scripts requis depuis `deploy/scripts` vers `/usr/local/libexec/homeservermanager`, appartenant à root et non modifiables par l’utilisateur `homelab`.
   Le flux "ajouter un service" peut maintenant exécuter n’importe quel script d’installation absolu via `sudo -n /bin/bash <script>`.
   Important : le service backend ne doit pas utiliser `NoNewPrivileges=true`, sinon `sudo` ne pourra pas exécuter les commandes allowlistées.
5. Copier `backend.env.example` vers `/etc/homeservermanager/backend.env`, renseigner tous les secrets et appliquer le mode `0600`.
6. Configurer le DNS de `DOMAIN` vers l’hôte et autoriser les ports 80/443. Le port 3000 doit être limité au réseau Docker/hôte par le pare-feu.
7. Pour Prometheus, créer `deploy/secrets/metrics_token` avec exactement la valeur de `METRICS_TOKEN`, mode `0600`.

## GitHub

Créer un environnement `production`, le limiter aux branches protégées, imposer un reviewer et y ajouter les secrets :

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_SSH_KNOWN_HOSTS`
- `PRODUCTION_GHCR_USERNAME`
- `PRODUCTION_GHCR_TOKEN` avec accès en lecture au package

Protéger `main` et rendre obligatoires les jobs `Backend`, `Frontend`, `Backend Docker image`, `Frontend Docker image` et CodeQL. Activer aussi Secret Scanning, Push Protection et les mises à jour de sécurité Dependabot.

Un tag `vX.Y.Z` publie les images GHCR. Le workflow `Deploy production` reste manuel et demande la révision exacte à déployer.

## Premier démarrage

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homeservermanager
cd /opt/homeservermanager/deploy
DOMAIN=homelab.example.com docker compose -f compose.production.yaml up -d
```

Ajouter `--profile monitoring` pour démarrer Prometheus. Les règles fournies détectent l’indisponibilité de l’API et de l’adaptateur système ; raccorder ensuite Prometheus à votre Alertmanager existant pour les notifications.

## VM de test sur branche `dev`

Pour une VM Ubuntu de validation, utiliser plutôt le workflow Git dédié documenté dans [docs/UTM_UBUNTU_LOCAL_SYSTEM_ADAPTER.md](../docs/UTM_UBUNTU_LOCAL_SYSTEM_ADAPTER.md) :

- bootstrap initial / réparation idempotente : `sudo VM_IP=192.168.64.6 bash /srv/homeservermanager-dev/deploy/setup-utm-vm.sh`
- dépôt cloné dans `/srv/homeservermanager-dev`
- branche locale `dev` suivie depuis `origin/dev`
- backend servi via `homelab-backend-dev.service`
- frontend buildé puis servi via `homelab-frontend-dev.service`
- mises à jour via `sudo bash /usr/local/bin/update-hsm-dev.sh`
