# Déploiement production

## Préparation de l’hôte

1. Installer Node.js 24, Docker, Docker Compose, Caddy via la stack fournie, SQLite, `sudo` et les outils système utilisés.
2. Créer l’utilisateur `homelab`, l’ajouter au groupe `docker` et créer `/opt/homeservermanager` ainsi que `/var/lib/homeservermanager`.
   Créer aussi `/var/lib/homeservermanager/docker`, appartenant à `homelab:homelab`, pour servir de `DOCKER_CONFIG` au backend.
3. Copier `homelab-backend.service` dans `/etc/systemd/system/homeservermanager.service`.
4. Copier `homelab-sudoers` dans `/etc/sudoers.d/homeservermanager`, adapter l’allowlist et valider avec `visudo -cf`.
   Copier aussi les scripts requis depuis `deploy/scripts` vers `/usr/local/libexec/homeservermanager`, appartenant à root et non modifiables par l’utilisateur `homelab`.
   Le flux "ajouter un service" peut maintenant exécuter directement une commande bash d’installation via `sudo -n /bin/bash -lc ...`.
   Important : le service backend ne doit pas utiliser `NoNewPrivileges=true`, sinon `sudo` ne pourra pas exécuter les commandes allowlistées.
   Important : si vous gardez ce flux d’installation root, le backend ne peut pas non plus utiliser `ProtectSystem=strict`, sinon `apt`, `dpkg` et de nombreux installateurs échoueront en lecture seule.
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
- si `TOOL_COMMANDS` expose `update-hsm`, le frontend peut lancer cette mise à jour depuis l’onglet Tools avec suivi de progression

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
