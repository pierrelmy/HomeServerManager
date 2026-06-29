# Tester `SYSTEM_ADAPTER=local` dans une VM Ubuntu sur UTM

## Objectif

Ce guide decrit le workflow de test le plus simple pour ton cas :

- tu developpes sur ton Mac
- tu pushes sur la branche `dev`
- la VM Ubuntu fait un `git fetch` + `git reset --hard origin/dev`
- la VM rebuild backend + frontend
- la VM restart les services

Ce guide remplace l'ancien flux base sur `rsync`. Pour des tests repetes, le repo doit etre clone dans la VM et la VM ne doit pas porter de modifications Git locales.

L'IP utilisee dans les exemples est :

```text
192.168.64.6
```

## Ce que tu vas obtenir

A la fin, tu auras :

- une VM Ubuntu dans UTM
- un checkout Git dans `/srv/homeservermanager-dev`
- une branche locale `dev` suivie depuis `origin/dev`
- un backend `SYSTEM_ADAPTER=local` sur le port `3000`
- un frontend build puis servi en preview sur le port `4173`
- un script unique `update-hsm-dev.sh` pour mettre a jour la VM

## Prerequis

Sur ton Mac :

- le repo HomeServerManager
- un acces `git push origin dev`

Dans la VM :

- Ubuntu 24.04 LTS
- acces reseau depuis ton Mac
- `git`, `node`, `npm`, `docker`, `systemd`

## Architecture retenue

Dans ce guide :

- backend dans la VM : `http://192.168.64.6:3000`
- frontend dans la VM : `http://192.168.64.6:4173`
- navigateur sur ton Mac : `http://192.168.64.6:4173`

Ce choix evite les problemes de cookies et les melanges `localhost` / IP de VM.

## Etape 1 - Preparer Ubuntu

Installe les paquets de base :

```bash
sudo apt update
sudo apt install -y \
  curl \
  git \
  rsync \
  sudo \
  build-essential \
  iproute2 \
  util-linux
```

Installe Node.js 24 :

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Installe Docker :

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
docker --version
```

## Etape 2 - Creer l'utilisateur de service

```bash
sudo useradd --create-home --shell /bin/bash homelab
sudo usermod -aG docker homelab
id homelab
```

## Etape 3 - Preparer les repertoires

```bash
sudo mkdir -p /srv/homeservermanager-dev
sudo mkdir -p /var/lib/homeservermanager
sudo mkdir -p /etc/homeservermanager
sudo mkdir -p /usr/local/libexec/homeservermanager
sudo chown -R ubuntu:ubuntu /srv/homeservermanager-dev
sudo chown -R homelab:homelab /var/lib/homeservermanager
```

## Etape 4 - Cloner le repo dans la VM

Dans la VM :

```bash
cd /srv/homeservermanager-dev
git clone https://github.com/pierrelmy/HomeServerManager.git .
git fetch origin
git switch -c dev --track origin/dev
```

Verification :

```bash
git branch --show-current
```

Tu dois voir :

```text
dev
```

## Etape 5 - Installer les dependances une premiere fois

```bash
cd /srv/homeservermanager-dev/backend
npm ci --no-audit --no-fund

cd /srv/homeservermanager-dev/frontend
npm ci --no-audit --no-fund
```

## Etape 6 - Installer les scripts systeme

### 6.1 Scan reseau

```bash
sudo cp /srv/homeservermanager-dev/deploy/scripts/scan-network.mjs /usr/local/libexec/homeservermanager/scan-network
sudo chmod 0755 /usr/local/libexec/homeservermanager/scan-network
sudo chown root:root /usr/local/libexec/homeservermanager/scan-network
```

### 6.2 Script NAS de test

```bash
sudo tee /usr/local/libexec/homeservermanager/nas-status >/dev/null <<'EOF'
#!/usr/bin/env sh
printf '%s' '{"capacityUsed":"20 Go / 100 Go","healthSummary":"VM de test","backupSummary":"Non configure","temperatureSummary":"N/A","pools":[{"name":"vm-data","type":"ext4","used":20,"total":100,"temp":0,"health":"Healthy"}],"backups":[],"drives":[{"slot":"vda","model":"Virtual Disk","temp":0,"status":"Healthy"}]}'
EOF
sudo chmod 0755 /usr/local/libexec/homeservermanager/nas-status
sudo chown root:root /usr/local/libexec/homeservermanager/nas-status
```

## Etape 7 - Installer un service `systemd` testable

```bash
sudo tee /usr/local/bin/homelab-demo-service.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
while true; do
  sleep 60
done
EOF
sudo chmod 0755 /usr/local/bin/homelab-demo-service.sh
```

```bash
sudo tee /etc/systemd/system/homelab-demo.service >/dev/null <<'EOF'
[Unit]
Description=HomeServerManager demo service

[Service]
Type=simple
ExecStart=/usr/local/bin/homelab-demo-service.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homelab-demo.service
systemctl is-active homelab-demo.service
```

## Etape 8 - Configurer le backend

Cree le fichier `/srv/homeservermanager-dev/backend/.env` :

```dotenv
HOST=0.0.0.0
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-this-session-secret-for-vm-123456
CORS_ORIGINS=http://192.168.64.6:4173
LOG_LEVEL=debug
READ_AUTH_REQUIRED=false
METRICS_INTERVAL_MS=5000
METRICS_TOKEN=vm-metrics-token-123456
DATABASE_PATH=/var/lib/homeservermanager/homelab.db
ADMIN_EMAIL=admin@localhost.test
ADMIN_PASSWORD=development-password
ADMIN_DISPLAY_NAME=Homelab Admin
SYSTEM_ADAPTER=local
SYSTEM_SERVICE_MAP={"demo-service":"homelab-demo.service","docker-engine":"docker.service"}
NAS_SCRUB_COMMAND=["/usr/bin/true"]
NAS_STATUS_COMMAND=["/usr/local/libexec/homeservermanager/nas-status"]
TOOL_COMMANDS={"scan-reseau":["/usr/local/libexec/homeservermanager/scan-network"]}
```

## Etape 9 - Configurer le frontend

Cree le fichier `/srv/homeservermanager-dev/frontend/.env` :

```dotenv
VITE_API_BASE_URL=http://192.168.64.6:3000
VITE_WS_URL=ws://192.168.64.6:3000/live
```

Important :

- ces deux fichiers `.env` restent sur la VM
- ils ne doivent pas etre commits
- le frontend est build avec ces variables puis servi statiquement
- le checkout Git frontend et `node_modules` doivent rester possedes par `ubuntu`

## Etape 10 - Installer le `sudoers`

```bash
sudo cp /srv/homeservermanager-dev/deploy/homelab-sudoers /etc/sudoers.d/homeservermanager
sudo chmod 0440 /etc/sudoers.d/homeservermanager
```

Ajoute les droits pour le service de demo :

```bash
sudo tee -a /etc/sudoers.d/homeservermanager >/dev/null <<'EOF'
homelab ALL=(root) NOPASSWD: /usr/bin/systemctl start homelab-demo.service
homelab ALL=(root) NOPASSWD: /usr/bin/systemctl stop homelab-demo.service
homelab ALL=(root) NOPASSWD: /usr/bin/systemctl restart homelab-demo.service
EOF
sudo visudo -cf /etc/sudoers.d/homeservermanager
```

## Etape 11 - Installer les services systemd de dev

```bash
sudo cp /srv/homeservermanager-dev/deploy/homelab-backend-dev.service /etc/systemd/system/homeservermanager-backend-dev.service
sudo cp /srv/homeservermanager-dev/deploy/homelab-frontend-dev.service /etc/systemd/system/homeservermanager-frontend-dev.service
sudo systemctl daemon-reload
```

L'unite frontend dev fournie par le repo :

- tourne en utilisateur `ubuntu`
- autorise l'ecriture uniquement dans `frontend/node_modules/.vite-temp`
- evite ainsi les erreurs `EROFS` rencontrees avec `vite preview`

## Etape 12 - Installer le script de mise a jour

```bash
sudo cp /srv/homeservermanager-dev/deploy/update-hsm-dev.sh /usr/local/bin/update-hsm-dev.sh
sudo chmod 0755 /usr/local/bin/update-hsm-dev.sh
```

Le script fait :

- `git fetch origin`
- `git switch dev`
- `git reset --hard origin/dev`
- `npm ci` + `npm run build` backend en utilisateur `ubuntu`
- `npm ci` + `npm run build` frontend en utilisateur `ubuntu`
- resynchronise `scan-network` dans `/usr/local/libexec/homeservermanager/scan-network`
- restart backend + frontend
- verifie `/health`, `/ready` et `http://127.0.0.1:4173`
- affiche la revision Git deployee

## Etape 13 - Premier build + premier demarrage

```bash
cd /srv/homeservermanager-dev/backend
npm run build

cd /srv/homeservermanager-dev/frontend
npm run build

sudo systemctl enable --now homeservermanager-backend-dev
sudo systemctl enable --now homeservermanager-frontend-dev
sudo systemctl status homeservermanager-backend-dev --no-pager
sudo systemctl status homeservermanager-frontend-dev --no-pager
```

## Etape 14 - Verifier les prerequis a la main

```bash
sudo -u homelab docker ps
sudo -u homelab systemctl is-active docker.service
sudo -u homelab sudo -n systemctl restart homelab-demo.service
sudo -u homelab /usr/local/libexec/homeservermanager/nas-status
sudo -u homelab /usr/local/libexec/homeservermanager/scan-network
```

## Etape 15 - Verifier les endpoints

Dans la VM :

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
curl http://127.0.0.1:3000/session
curl http://127.0.0.1:4173
```

Depuis ton Mac :

```text
http://192.168.64.6:4173
```

Connexion recommandee :

- email : `admin@localhost.test`
- mot de passe : `development-password`

## Workflow quotidien

Sur le Mac :

```bash
git switch dev
git add .
git commit -m "ton changement"
git push origin dev
```

Sur la VM :

```bash
sudo bash /usr/local/bin/update-hsm-dev.sh
```

## Verification rapide que la VM tourne bien sur le bon code

Dans la VM :

```bash
cd /srv/homeservermanager-dev
git branch --show-current
git rev-parse HEAD
git rev-parse origin/dev
```

Les deux SHA doivent etre identiques apres `update-hsm-dev.sh`.

Pour verifier que la VM contient bien les correctifs recents :

```bash
rg "MemAvailable|collectDiskInfo|configureLocalTargets" \
  /srv/homeservermanager-dev/backend/src \
  /srv/homeservermanager-dev/backend/dist
```

## Diagnostic rapide

### Le script `update-hsm-dev.sh` echoue

Verifier :

```bash
cd /srv/homeservermanager-dev
git status
git branch --show-current
```

La VM doit rester propre :

- pas de modifications locales dans les fichiers versionnes
- pas de commits locaux sur la VM
- branche courante `dev`

### Le backend ne demarre pas

```bash
journalctl -u homeservermanager-backend-dev -n 200 --no-pager
```

### Le frontend ne demarre pas

```bash
journalctl -u homeservermanager-frontend-dev -n 200 --no-pager
```

### Le login marche mais rien ne se passe dans l'UI

Verifier les URLs :

- frontend : `http://192.168.64.6:4173`
- backend : `http://192.168.64.6:3000`

Et verifier les `.env` :

```bash
cat /srv/homeservermanager-dev/backend/.env
cat /srv/homeservermanager-dev/frontend/.env
```

### Les stats ou les disques semblent faux

Verifier d'abord que la VM tourne sur le dernier code :

```bash
cd /srv/homeservermanager-dev
git rev-parse HEAD
git rev-parse origin/dev
```

Puis comparer :

```bash
free -h
df -h
curl http://127.0.0.1:3000/overview
```

Le backend local recent :

- lit la RAM via `free -k`, donc la valeur affichee suit la colonne `used` de `free -h`
- lit les disques via `df`

## References

- [README racine](../README.md)
- [README backend](../backend/README.md)
- [Guide de deploiement](../deploy/README.md)
- [Runbook d'exploitation](./OPERATIONS.md)
