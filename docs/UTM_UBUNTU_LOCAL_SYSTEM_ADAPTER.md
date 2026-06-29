# Tester `SYSTEM_ADAPTER=local` dans une VM Ubuntu sur UTM

## Objectif

Ce document explique comment tester `SYSTEM_ADAPTER=local` dans une VM Ubuntu lancee avec UTM sur un Mac, sans dependre de ta machine hote.

Le but n'est pas de reproduire toute la production. Le but est de valider que :

- le backend demarre bien avec `SYSTEM_ADAPTER=local`
- les commandes systeme appelees par l'adaptateur fonctionnent
- les pages du frontend s'alimentent depuis le backend reel
- les actions admin (`systemctl`, Docker, tools, terminal) marchent dans une VM Linux preparee

## Ce que tu vas obtenir

A la fin, tu auras :

- une VM Ubuntu dans UTM
- un backend HomeServerManager qui tourne dedans
- `SYSTEM_ADAPTER=local` actif
- au moins un vrai service `systemd` testable
- Docker accessible au backend
- les scripts `nas-status` et `scan-network` installes
- un frontend local sur ton Mac qui pilote la VM Ubuntu

## Limites connues

Ce guide est fait pour une VM de test, pas pour la prod.

En particulier :

- le script NAS fourni suppose un environnement Linux et idealement ZFS
- si tu n'as pas ZFS dans la VM, on utilisera un script NAS de test compatible avec le contrat attendu
- Caddy, GHCR, le workflow GitHub de deploiement et Prometheus ne sont pas necessaires pour ce test

## Prerequis

Sur ton Mac :

- UTM installe
- une image Ubuntu Server ou Ubuntu Desktop recente
- le repo HomeServerManager disponible localement
- Node.js 24 sur ton Mac si tu veux lancer le frontend en local

Dans la VM cible :

- Ubuntu 24.04 LTS de preference

## Vue d'ensemble du setup

Architecture recommandee pour le test :

1. Le backend tourne dans la VM Ubuntu
2. Le frontend tourne sur ton Mac
3. Le backend de la VM est expose sur ton Mac via un tunnel SSH local
4. Le frontend parle donc a `127.0.0.1:3000`
5. Le backend pilote Docker et `systemd` a l'interieur de la VM

Pourquoi ce choix :

- l'auth du projet repose sur un cookie HTTP signe
- en developpement, ce cookie est emis avec `SameSite=Strict`
- si le frontend tourne sur `127.0.0.1:5173` mais que l'API est appelee sur l'IP de la VM, par exemple `192.168.64.6:3000`, le navigateur considerera que ce n'est pas le meme site
- resultat : le login peut reussir cote backend, mais la session ne sera pas renvoyee correctement et tu ne seras pas redirige

Conclusion :

- pour tester simplement depuis ton Mac, il faut presenter aussi le backend en `127.0.0.1`
- le moyen le plus simple est un tunnel SSH local

Dans ton cas, l'IP actuelle de la VM est :

```text
192.168.64.6
```

## Etape 1 - Creer la VM UTM

Dans UTM :

1. Creer une nouvelle VM Linux
2. Choisir Ubuntu
3. Allouer au moins :
   - 4 Go de RAM
   - 2 vCPU
   - 30 Go de disque
4. Activer le reseau en mode qui permet a ton Mac de joindre la VM

Le plus simple pour ce test est d'avoir une VM avec une IP joignable depuis macOS.

Une fois Ubuntu installe :

```bash
ip addr
```

Note l'IP de la VM, elle sera utilisee pour le SSH et le tunnel local. Exemple :

```text
192.168.64.6
```

## Etape 2 - Installer les prerequis Ubuntu

Connecte-toi a la VM puis installe les paquets de base :

```bash
sudo apt update
sudo apt install -y \
  curl \
  wget \
  rsync \
  sudo \
  git \
  build-essential \
  iproute2 \
  util-linux
```

Installer Node.js 24 :

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## Etape 3 - Installer Docker dans la VM

Installer Docker :

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
docker --version
sudo docker ps
```

## Etape 4 - Creer l'utilisateur de service

Le backend de production attend un utilisateur `homelab`.

```bash
sudo useradd --create-home --shell /bin/bash homelab
sudo usermod -aG docker homelab
id homelab
```

## Etape 5 - Preparer l'arborescence cible

```bash
sudo mkdir -p /opt/homeservermanager/backend
sudo mkdir -p /opt/homeservermanager/deploy
sudo mkdir -p /var/lib/homeservermanager
sudo mkdir -p /etc/homeservermanager
sudo mkdir -p /usr/local/libexec/homeservermanager
sudo chown -R homelab:homelab /opt/homeservermanager
sudo chown -R homelab:homelab /var/lib/homeservermanager
```

## Etape 6 - Copier le projet dans la VM

Depuis ton Mac, adapte le chemin local du repo puis copie le contenu utile dans la VM :

```bash
rsync -az \
  --delete \
  /Users/pierre/delivery/hub/home-server-2/backend/ \
  ubuntu@192.168.64.6:/tmp/homeservermanager-backend/

rsync -az \
  --delete \
  /Users/pierre/delivery/hub/home-server-2/deploy/ \
  ubuntu@192.168.64.6:/tmp/homeservermanager-deploy/
```

Dans la VM :

```bash
sudo rsync -az --delete /tmp/homeservermanager-backend/ /opt/homeservermanager/backend/
sudo rsync -az --delete /tmp/homeservermanager-deploy/ /opt/homeservermanager/deploy/
sudo chown -R homelab:homelab /opt/homeservermanager/backend
sudo chown -R homelab:homelab /opt/homeservermanager/deploy
```

## Etape 7 - Builder le backend dans la VM

Dans la VM :

```bash
cd /opt/homeservermanager/backend
sudo -u homelab npm ci --no-audit --no-fund
sudo -u homelab npm run build
sudo -u homelab npm ci --omit=dev --no-audit --no-fund
```

## Etape 8 - Installer le service systemd

```bash
sudo cp /opt/homeservermanager/deploy/homelab-backend.service /etc/systemd/system/homeservermanager.service
sudo systemctl daemon-reload
```

## Etape 9 - Installer le sudoers

Copier le fichier fourni :

```bash
sudo cp /opt/homeservermanager/deploy/homelab-sudoers /etc/sudoers.d/homeservermanager
sudo chmod 0440 /etc/sudoers.d/homeservermanager
sudo visudo -cf /etc/sudoers.d/homeservermanager
```

Important :

- ce fichier est un exemple
- il doit rester aligne avec `SYSTEM_SERVICE_MAP` et `NAS_SCRUB_COMMAND`

## Etape 10 - Installer les scripts systeme

### 10.1 Script scan reseau

Le script fourni peut etre installe tel quel :

```bash
sudo cp /opt/homeservermanager/deploy/scripts/scan-network.mjs /usr/local/libexec/homeservermanager/scan-network
sudo chmod 0755 /usr/local/libexec/homeservermanager/scan-network
sudo chown root:root /usr/local/libexec/homeservermanager/scan-network
```

### 10.2 Script NAS pour une VM de test

Le script NAS fourni suppose un environnement plus proche de la prod. Pour une VM Ubuntu de test, le plus simple est d'installer un script de remplacement compatible avec le contrat attendu.

Creer ce fichier dans la VM :

```bash
sudo tee /usr/local/libexec/homeservermanager/nas-status >/dev/null <<'EOF'
#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  capacityUsed: "20 Go / 100 Go",
  healthSummary: "VM de test",
  backupSummary: "Non configuré",
  temperatureSummary: "N/A",
  pools: [
    { name: "vm-data", type: "ext4", used: 20, total: 100, temp: 0, health: "Healthy" }
  ],
  backups: [],
  drives: [
    { slot: "vda", model: "Virtual Disk", temp: 0, status: "Healthy" }
  ],
}))
EOF
sudo chmod 0755 /usr/local/libexec/homeservermanager/nas-status
sudo chown root:root /usr/local/libexec/homeservermanager/nas-status
```

## Etape 11 - Installer un vrai service systemd testable

Pour valider `actOnService(...)`, il te faut au moins un service gerable. Le plus simple est de creer un faux service long-courant.

Creer un script :

```bash
sudo tee /usr/local/bin/homelab-demo-service.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
while true; do
  sleep 60
done
EOF
sudo chmod 0755 /usr/local/bin/homelab-demo-service.sh
```

Creer l'unite systemd :

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

Activer l'unite :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homelab-demo.service
systemctl is-active homelab-demo.service
```

## Etape 12 - Adapter la config backend pour la VM

Creer le fichier d'environnement :

```bash
sudo cp /opt/homeservermanager/deploy/backend.env.example /etc/homeservermanager/backend.env
sudo chmod 0600 /etc/homeservermanager/backend.env
```

Edite ensuite le fichier :

```bash
sudo nano /etc/homeservermanager/backend.env
```

Contenu recommande pour la VM de test :

```dotenv
HOST=0.0.0.0
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-this-session-secret-for-vm-123456
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
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

Notes :

- `NODE_ENV=development` est volontaire ici pour garder un comportement de test local souple
- `SYSTEM_ADAPTER=local` est bien actif
- `demo-service` te permet de tester `start/stop/restart` sans avoir Ollama ou Jenkins
- `NAS_SCRUB_COMMAND=["/usr/bin/true"]` evite d'exiger ZFS dans la VM

## Etape 13 - Etendre le sudoers pour le service de test

Le fichier fourni ne connait pas `homelab-demo.service`. Ajoute-le a la main :

```bash
sudo tee -a /etc/sudoers.d/homeservermanager >/dev/null <<'EOF'
homelab ALL=(root) NOPASSWD: /usr/bin/systemctl start homelab-demo.service
homelab ALL=(root) NOPASSWD: /usr/bin/systemctl stop homelab-demo.service
homelab ALL=(root) NOPASSWD: /usr/bin/systemctl restart homelab-demo.service
EOF
sudo visudo -cf /etc/sudoers.d/homeservermanager
```

## Etape 14 - Tester les prerequis a la main

Avant de lancer le backend, teste exactement ce que l'adaptateur appellera :

```bash
sudo -u homelab docker ps
sudo -u homelab systemctl is-active docker.service
sudo -u homelab sudo -n systemctl restart homelab-demo.service
sudo -u homelab /usr/local/libexec/homeservermanager/nas-status
sudo -u homelab /usr/local/libexec/homeservermanager/scan-network
```

Tous ces tests doivent fonctionner sans prompt interactif.

## Etape 15 - Demarrer le backend

```bash
sudo systemctl enable --now homeservermanager
sudo systemctl status homeservermanager
journalctl -u homeservermanager -n 100 --no-pager
```

Verifier les endpoints :

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
curl http://127.0.0.1:3000/session
```

## Etape 16 - Lancer le frontend sur ton Mac

### 16.1 Ouvrir un tunnel SSH entre ton Mac et la VM

Sur ton Mac :

```bash
ssh -L 3000:127.0.0.1:3000 ubuntu@192.168.64.6
```

Laisse cette session ouverte.

Ce tunnel signifie :

- `http://127.0.0.1:3000` sur ton Mac pointe vers `http://127.0.0.1:3000` dans la VM
- pour le navigateur, frontend et backend sont alors servis sur le meme host `127.0.0.1`
- la session cookie fonctionne correctement en local

Teste le tunnel depuis ton Mac :

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/session
```

### 16.2 Lancer le frontend sur ton Mac

Sur ton Mac, dans le repo :

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://127.0.0.1:3000 \
VITE_WS_URL=ws://127.0.0.1:3000/live \
npm run dev
```

Ouvre ensuite :

```text
http://127.0.0.1:5173
```

Connexion recommandee :

- email : `admin@localhost.test`
- mot de passe : `development-password`

## Etape 17 - Verifications dans l'UI

Une fois connecte :

1. Verifier que la page Account montre bien ton utilisateur backend
2. Aller dans Services
3. Verifier qu'un service `demo-service` apparait si tes seeds / donnees le referencent
4. Aller dans Terminal
5. Tester :
   - `uptime`
   - `docker ps`
   - `df -h`
   - `journalctl -p err -n 5`
6. Aller dans Tools
7. Lancer `scan-reseau`

## Variante - Lancer aussi le frontend dans la VM

Si tu preferes tester un setup entierement dans la VM, cette variante est souvent plus simple pour l'authentification.

Dans ce mode :

- backend dans la VM
- frontend dans la VM
- navigateur sur ton Mac
- frontend ouvert sur `http://192.168.64.6:5173`
- backend appele sur `http://192.168.64.6:3000`

Avantages :

- pas de tunnel SSH
- pas de confusion entre `127.0.0.1`, `localhost` et l'IP de la VM
- comportement plus proche d'un vrai deploiement reseau

### Variante A - Copier le frontend dans la VM

Depuis ton Mac :

```bash
rsync -az \
  --delete \
  /Users/pierre/delivery/hub/home-server-2/frontend/ \
  ubuntu@192.168.64.6:/tmp/homeservermanager-frontend/
```

Dans la VM :

```bash
sudo mkdir -p /opt/homeservermanager/frontend
sudo rsync -az --delete /tmp/homeservermanager-frontend/ /opt/homeservermanager/frontend/
sudo chown -R homelab:homelab /opt/homeservermanager/frontend
cd /opt/homeservermanager/frontend
sudo -u homelab npm ci --no-audit --no-fund
```

### Variante B - Adapter `CORS_ORIGINS`

Dans `/etc/homeservermanager/backend.env`, remplace `CORS_ORIGINS` par :

```dotenv
CORS_ORIGINS=http://192.168.64.6:5173
```

Puis redemarre le backend :

```bash
sudo systemctl restart homeservermanager
sudo systemctl status homeservermanager
```

### Variante C - Lancer le frontend dans la VM

Dans la VM :

```bash
cd /opt/homeservermanager/frontend
sudo -u homelab env \
  VITE_API_BASE_URL=http://192.168.64.6:3000 \
  VITE_WS_URL=ws://192.168.64.6:3000/live \
  npm run dev -- --host 0.0.0.0 --port 5173
```

### Variante D - Verifier localement dans la VM

Dans la VM :

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/session
curl http://127.0.0.1:5173
```

### Variante E - Ouvrir l'application depuis le Mac

Depuis ton Mac, ouvre :

```text
http://192.168.64.6:5173
```

Connexion recommandee :

- email : `admin@localhost.test`
- mot de passe : `development-password`

### Variante F - Regle de cohérence

Dans ce mode, il faut garder les deux URLs sur l'IP de la VM :

- frontend : `http://192.168.64.6:5173`
- backend : `http://192.168.64.6:3000`

Ne pas melanger :

- frontend sur l'IP de la VM
- backend sur `127.0.0.1`

ou l'inverse.

## Variante - Ne pas utiliser de tunnel SSH

Si tu ne veux pas de tunnel SSH, il faut alors executer aussi le frontend dans la VM ou servir frontend et backend derriere la meme origine HTTP(S).

Ce qu'il ne faut pas faire pour ce projet en dev HTTP classique :

- frontend sur `http://127.0.0.1:5173`
- backend sur `http://192.168.64.6:3000`

Dans ce cas, le login backend peut repondre `200`, mais la session ne sera pas exploitable correctement par le navigateur a cause de la politique de cookie.

## Etape 18 - Si `demo-service` n'apparait pas dans la page Services

Dans l'etat actuel du projet, les services affiches viennent des donnees persistees / seedees du backend. Si ton `SYSTEM_SERVICE_MAP` contient `demo-service` mais que l'UI ne l'affiche pas, c'est que les donnees backend ne referencent pas encore ce service.

Dans ce cas, tu as deux options :

1. Remplacer un service seed existant dans `SYSTEM_SERVICE_MAP`
   - par exemple mapper `jenkins` vers `homelab-demo.service`
2. Ou faire evoluer les seeds backend pour declarer explicitement `demo-service`

La solution la plus rapide pour un test est souvent :

```dotenv
SYSTEM_SERVICE_MAP={"jenkins":"homelab-demo.service","docker-engine":"docker.service"}
```

## Etape 19 - Diagnostic rapide en cas d'echec

### Le backend ne demarre pas

Verifier :

```bash
journalctl -u homeservermanager -n 200 --no-pager
```

Ca pointe generalement vers :

- une variable mal formee dans `backend.env`
- un script manquant
- un binaire absent
- un `sudoers` incomplet

### `/ready` retourne `503`

Ca signifie que l'adaptateur systeme n'est pas pret.

Verifier :

```bash
sudo -u homelab /usr/local/libexec/homeservermanager/nas-status
sudo -u homelab docker ps
systemctl is-active docker.service
```

### Le login marche mais pas les actions systeme

Verifier :

```bash
sudo -u homelab sudo -n systemctl restart homelab-demo.service
sudo -u homelab docker ps
```

Si l'une de ces commandes echoue, le probleme est sur la VM, pas dans le frontend.

### Le frontend affiche encore des donnees “mock”

Le frontend n'est pas forcement en mode mock. En revanche, le backend en mode `simulation` ou ses seeds SQLite peuvent ressembler visuellement aux mocks.

Pour ce guide :

- assure-toi que `SYSTEM_ADAPTER=local`
- verifie le backend avec :

```bash
grep SYSTEM_ADAPTER /etc/homeservermanager/backend.env
curl http://127.0.0.1:3000/session
```

## Etape 20 - Etendre ensuite vers un test plus realiste

Une fois ce setup valide, tu peux rendre la VM plus proche de la prod :

- installer Ollama et le mapper a `ollama.service`
- installer Jenkins et le mapper a `jenkins.service`
- remplacer le faux script NAS par un vrai script ZFS/SMART
- activer `READ_AUTH_REQUIRED=true`
- mettre `NODE_ENV=production`
- exposer ensuite Caddy + frontend conteneurise

## References

- [README racine](../README.md)
- [README backend](../backend/README.md)
- [Guide de deploiement](../deploy/README.md)
- [Runbook d'exploitation](./OPERATIONS.md)
