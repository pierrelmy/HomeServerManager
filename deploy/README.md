# Déploiement production

## Préparation de l’hôte

1. Installer Node.js 24, Docker, Docker Compose, Caddy via la stack fournie, SQLite, `sudo` et les outils système utilisés.
   Installer aussi `curl`, `wget` et `rsync`, utilisés par le workflow de déploiement et ses smoke tests.
2. Créer l’utilisateur `homelab`, l’ajouter au groupe `docker` et créer `/opt/homeservermanager` ainsi que `/var/lib/homeservermanager`.
3. Copier `homelab-backend.service` dans `/etc/systemd/system/homeservermanager.service`.
4. Copier `homelab-sudoers` dans `/etc/sudoers.d/homeservermanager`, adapter l’allowlist et valider avec `visudo -cf`.
   Copier aussi les scripts requis depuis `deploy/scripts` vers `/usr/local/libexec/homeservermanager`, appartenant à root et non modifiables par l’utilisateur `homelab`.
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

Protéger `main` et rendre obligatoires les jobs `Backend`, `Frontend`, `Backend Docker image`, `Frontend Docker image` et CodeQL. Activer aussi Secret Scanning, Push Protection, les mises à jour de sécurité Dependabot et l’épinglage SHA des actions.

Un tag `vX.Y.Z` publie les images GHCR. Le workflow `Deploy production` reste manuel et demande la révision exacte à déployer.
Avant toute copie ou activation, ce workflow vérifie la présence des six secrets requis. Après activation, il exécute un smoke test sur le backend (`/health`, `/ready`) et sur le frontend (`/healthz` dans le conteneur Nginx).

## Premier démarrage

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homeservermanager
cd /opt/homeservermanager/deploy
DOMAIN=homelab.example.com docker compose -f compose.production.yaml up -d
```

Ajouter `--profile monitoring` pour démarrer Prometheus. Les règles fournies détectent l’indisponibilité de l’API et de l’adaptateur système ; raccorder ensuite Prometheus à votre Alertmanager existant pour les notifications.

## Backup SQLite

Le répertoire `deploy/` contient un service systemd oneshot et un timer pour automatiser la sauvegarde quotidienne de la base SQLite.

### Installation

```bash
# Copier les unités systemd
sudo cp deploy/backup-sqlite.service /etc/systemd/system/
sudo cp deploy/backup-sqlite.timer   /etc/systemd/system/

# Copier le script de backup et le rendre exécutable
sudo cp deploy/backup-sqlite.sh /opt/homeservermanager/deploy/backup-sqlite.sh
sudo chmod +x /opt/homeservermanager/deploy/backup-sqlite.sh
sudo chown homelab:homelab /opt/homeservermanager/deploy/backup-sqlite.sh

# Créer le répertoire de backups avec les bonnes permissions
sudo mkdir -p /var/backups/homeservermanager
sudo chown homelab:homelab /var/backups/homeservermanager
sudo chmod 0750 /var/backups/homeservermanager

# Activer et démarrer le timer
sudo systemctl daemon-reload
sudo systemctl enable --now backup-sqlite.timer
```

Le timer se déclenche chaque jour à 02h00 et conserve les 7 derniers backups (configurable via la variable `KEEP_LAST` dans le script).

### Vérification

```bash
# État du timer (prochaine exécution, dernière exécution)
systemctl status backup-sqlite.timer

# Lister les backups présents
ls -lh /var/backups/homeservermanager/

# Consulter les logs du dernier backup
journalctl -u backup-sqlite.service -n 50 --no-pager
```

### Déclenchement manuel

```bash
sudo systemctl start backup-sqlite.service
```
