#!/usr/bin/env bash
set -euo pipefail

ROOT=${ROOT:-/srv/homeservermanager-dev}
REPO_URL=${REPO_URL:-https://github.com/pierrelmy/HomeServerManager.git}
BRANCH=${BRANCH:-dev}
VM_USER=${VM_USER:-ubuntu}
SERVICE_USER=${SERVICE_USER:-homelab}
VM_IP=${VM_IP:-}

trap 'rc=$?; echo "ERROR: setup failed at line $LINENO while running: $BASH_COMMAND" >&2; exit "$rc"' ERR

log() { printf '%s\n' "==> $*"; }
warn() { printf '%s\n' "WARNING: $*" >&2; }
die() { printf '%s\n' "ERROR: $*" >&2; exit 1; }

need_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    die "Ce script doit être exécuté en root. Lance-le avec: sudo bash $0"
  fi
}

pkg_installed() {
  dpkg -s "$1" >/dev/null 2>&1
}

ensure_packages() {
  local -a packages=(
    ca-certificates
    build-essential
    curl
    git
    iproute2
    sudo
    util-linux
  )

  local missing=()
  local pkg
  for pkg in "${packages[@]}"; do
    if ! pkg_installed "$pkg"; then
      missing+=("$pkg")
    fi
  done

  if ((${#missing[@]})); then
    log "Installation des paquets de base: ${missing[*]}"
    apt-get update
    apt-get install -y "${missing[@]}"
  else
    log "Paquets de base déjà présents"
  fi
}

node_major_version() {
  if command -v node >/dev/null 2>&1; then
    node -p 'process.versions.node.split(".")[0]'
  else
    echo 0
  fi
}

ensure_node_24() {
  local current
  current=$(node_major_version)
  if [[ "$current" =~ ^[0-9]+$ ]] && (( current >= 24 )); then
    log "Node.js >= 24 déjà installé"
    return
  fi

  log "Installation de Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && systemctl is-active --quiet docker 2>/dev/null; then
    log "Docker déjà installé et actif"
    return
  fi

  log "Installation ou activation de Docker"
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker
}

ensure_user() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    log "Utilisateur $SERVICE_USER déjà présent"
  else
    log "Création de l'utilisateur $SERVICE_USER"
    useradd --create-home --shell /bin/bash "$SERVICE_USER"
  fi

  if getent group docker >/dev/null 2>&1; then
    if id -nG "$SERVICE_USER" | tr ' ' '\n' | grep -qx docker; then
      log "L'utilisateur $SERVICE_USER est déjà membre du groupe docker"
    else
      log "Ajout de $SERVICE_USER au groupe docker"
      usermod -aG docker "$SERVICE_USER"
    fi
  else
    warn "Le groupe docker est absent; Docker n'est peut-être pas encore installé"
  fi
}

ensure_directories() {
  install -d -o "$VM_USER" -g "$VM_USER" "$ROOT"
  install -d -o "$SERVICE_USER" -g "$SERVICE_USER" /var/lib/homeservermanager
  install -d -o root -g root /etc/homeservermanager
  install -d -o root -g root /usr/local/libexec/homeservermanager
  install -d -o root -g root /usr/local/libexec/homeservermanager/installers
  install -d -o "$VM_USER" -g "$VM_USER" "$ROOT/.setup-state"
}

detect_vm_ip() {
  if [[ -n "$VM_IP" ]]; then
    printf '%s\n' "$VM_IP"
    return
  fi

  local candidate
  candidate=$(hostname -I 2>/dev/null | awk '{
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^192\.168\./ || $i ~ /^10\./ || $i ~ /^172\./) {
        print $i
        exit
      }
    }
  }')

  if [[ -n "$candidate" ]]; then
    printf '%s\n' "$candidate"
    return
  fi

  die "Impossible de détecter l'IP de la VM. Relance avec: VM_IP=192.168.x.x sudo bash $0"
}

run_as_vm_user() {
  local cmd="$1"
  sudo -H -u "$VM_USER" bash -lc "$cmd"
}

ensure_repo() {
  if [[ -e "$ROOT" && ! -d "$ROOT/.git" ]]; then
    if find "$ROOT" -mindepth 1 -maxdepth 1 | read -r _; then
      die "Le répertoire $ROOT existe déjà mais ne contient pas de dépôt Git. Déplace ou vide ce répertoire avant de relancer."
    fi
  fi

  if [[ ! -d "$ROOT/.git" ]]; then
    log "Clonage du dépôt dans $ROOT"
    install -d -o "$VM_USER" -g "$VM_USER" "$ROOT"
    run_as_vm_user "git clone '$REPO_URL' '$ROOT'"
  fi

  log "Synchronisation Git sur la branche $BRANCH"
  run_as_vm_user "cd '$ROOT' && git fetch origin"

  local current_branch current_head remote_head remote_url
  current_branch=$(run_as_vm_user "cd '$ROOT' && git branch --show-current")
  remote_head=$(run_as_vm_user "cd '$ROOT' && git rev-parse origin/$BRANCH")
  current_head=$(run_as_vm_user "cd '$ROOT' && git rev-parse HEAD")
  remote_url=$(run_as_vm_user "cd '$ROOT' && git remote get-url origin")

  if [[ "$remote_url" != "$REPO_URL" ]]; then
    die "Le remote origin pointe vers $remote_url au lieu de $REPO_URL"
  fi

  if [[ "$current_branch" != "$BRANCH" ]]; then
    log "Bascule sur la branche $BRANCH"
    run_as_vm_user "cd '$ROOT' && git switch '$BRANCH' --track origin/'$BRANCH' 2>/dev/null || git switch '$BRANCH'"
  fi

  if [[ "$current_head" != "$remote_head" ]]; then
    log "Mise à niveau du checkout local sur origin/$BRANCH"
    run_as_vm_user "cd '$ROOT' && git reset --hard 'origin/$BRANCH'"
  else
    log "Le checkout est déjà aligné sur origin/$BRANCH"
  fi
}

sha_for_file() {
  sha256sum "$1" | awk '{print $1}'
}

state_matches() {
  local file="$1"
  local expected="$2"
  [[ -f "$file" ]] && [[ "$(cat "$file")" == "$expected" ]]
}

write_state() {
  local file="$1"
  local value="$2"
  printf '%s\n' "$value" > "$file"
  chown "$VM_USER:$VM_USER" "$file"
}

ensure_npm_dependencies() {
  local project_dir="$1"
  local name="$2"
  local lock_file="$project_dir/package-lock.json"
  local stamp_file="$ROOT/.setup-state/${name}.npm.lock.sha256"
  local lock_hash

  if [[ ! -f "$lock_file" ]]; then
    die "Fichier manquant: $lock_file"
  fi

  lock_hash=$(sha_for_file "$lock_file")
  if [[ -d "$project_dir/node_modules" ]] && state_matches "$stamp_file" "$lock_hash"; then
    log "Dépendances npm déjà à jour pour $name"
    return
  fi

  log "Installation npm pour $name"
  run_as_vm_user "cd '$project_dir' && npm ci --no-audit --no-fund"
  write_state "$stamp_file" "$lock_hash"
}

ensure_build() {
  local project_dir="$1"
  local name="$2"
  local build_output="$3"
  local stamp_file="$ROOT/.setup-state/${name}.build.sha256"
  local build_hash
  local lock_file="$project_dir/package-lock.json"

  build_hash="$(git -C "$project_dir" rev-parse HEAD):$(sha_for_file "$lock_file")"

  if [[ -e "$build_output" ]] && state_matches "$stamp_file" "$build_hash"; then
    log "Build déjà à jour pour $name"
    return
  fi

  log "Build de $name"
  run_as_vm_user "cd '$project_dir' && npm run build"
  write_state "$stamp_file" "$build_hash"
}

install_if_changed() {
  local src="$1"
  local dst="$2"
  local mode="$3"
  local owner="$4"
  local group="$5"

  if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
    log "$(basename "$dst") déjà à jour"
    return
  fi

  log "Installation de $(basename "$dst")"
  install -D -m "$mode" -o "$owner" -g "$group" "$src" "$dst"
}

ensure_scan_network() {
  install_if_changed \
    "$ROOT/deploy/scripts/scan-network.mjs" \
    /usr/local/libexec/homeservermanager/scan-network \
    0755 root root
}

ensure_nas_status() {
  local tmp
  tmp=$(mktemp)
  cat >"$tmp" <<'EOF'
#!/usr/bin/env sh
printf '%s' '{"capacityUsed":"20 Go / 100 Go","healthSummary":"VM de test","backupSummary":"Non configure","temperatureSummary":"N/A","pools":[{"name":"vm-data","type":"ext4","used":20,"total":100,"temp":0,"health":"Healthy"}],"backups":[],"drives":[{"slot":"vda","model":"Virtual Disk","temp":0,"status":"Healthy"}]}'
EOF
  install_if_changed "$tmp" /usr/local/libexec/homeservermanager/nas-status 0755 root root
  rm -f "$tmp"
}

ensure_demo_service() {
  local tmp_service tmp_script
  tmp_service=$(mktemp)
  tmp_script=$(mktemp)

  cat >"$tmp_script" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
while true; do
  sleep 60
done
EOF

  cat >"$tmp_service" <<'EOF'
[Unit]
Description=HomeServerManager demo service

[Service]
Type=simple
ExecStart=/usr/local/bin/homelab-demo-service.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF

  install_if_changed "$tmp_script" /usr/local/bin/homelab-demo-service.sh 0755 root root
  install_if_changed "$tmp_service" /etc/systemd/system/homelab-demo.service 0644 root root

  rm -f "$tmp_script" "$tmp_service"
}

ensure_backend_env() {
  local vm_ip="$1"
  local backend_env="$ROOT/backend/.env"
  if [[ -f "$backend_env" ]]; then
    log "Le backend .env existe déjà; aucun écrasement"
    return
  fi

  log "Création de backend/.env"
  cat >"$backend_env" <<EOF
HOST=0.0.0.0
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-this-session-secret-for-vm-123456
CORS_ORIGINS=http://$vm_ip:4173
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
EOF
  chown "$VM_USER:$VM_USER" "$backend_env"
}

ensure_frontend_env() {
  local vm_ip="$1"
  local frontend_env="$ROOT/frontend/.env"
  if [[ -f "$frontend_env" ]]; then
    log "Le frontend .env existe déjà; aucun écrasement"
    return
  fi

  log "Création de frontend/.env"
  cat >"$frontend_env" <<EOF
VITE_API_BASE_URL=http://$vm_ip:3000
VITE_WS_URL=ws://$vm_ip:3000/live
EOF
  chown "$VM_USER:$VM_USER" "$frontend_env"
}

ensure_sudoers() {
  local dst=/etc/sudoers.d/homeservermanager
  install_if_changed "$ROOT/deploy/homelab-sudoers" "$dst" 0440 root root
  visudo -cf "$dst" >/dev/null
}

ensure_systemd_units() {
  install_if_changed "$ROOT/deploy/homelab-backend-dev.service" /etc/systemd/system/homeservermanager-backend-dev.service 0644 root root
  install_if_changed "$ROOT/deploy/homelab-frontend-dev.service" /etc/systemd/system/homeservermanager-frontend-dev.service 0644 root root
  systemctl daemon-reload
}

ensure_service_enabled_started() {
  local unit="$1"
  if systemctl is-enabled --quiet "$unit" 2>/dev/null; then
    log "$unit déjà activé"
  else
    log "Activation de $unit"
    systemctl enable "$unit"
  fi

  if systemctl is-active --quiet "$unit" 2>/dev/null; then
    log "$unit déjà démarré"
  else
    log "Démarrage de $unit"
    systemctl start "$unit"
  fi
}

ensure_vm_setup() {
  local vm_ip
  vm_ip=$(detect_vm_ip)

  ensure_packages
  ensure_node_24
  ensure_docker
  ensure_user
  ensure_directories
  ensure_repo
  ensure_scan_network
  ensure_nas_status
  ensure_demo_service
  ensure_backend_env "$vm_ip"
  ensure_frontend_env "$vm_ip"
  ensure_sudoers
  ensure_systemd_units
  ensure_npm_dependencies "$ROOT/backend" backend
  ensure_npm_dependencies "$ROOT/frontend" frontend
  ensure_build "$ROOT/backend" backend "$ROOT/backend/dist/server.js"
  ensure_build "$ROOT/frontend" frontend "$ROOT/frontend/dist/index.html"

  log "Démarrage / redémarrage des services"
  ensure_service_enabled_started homeservermanager-backend-dev.service
  ensure_service_enabled_started homeservermanager-frontend-dev.service

  log "Vérifications de santé"
  curl --fail --silent http://127.0.0.1:3000/health >/dev/null
  curl --fail --silent http://127.0.0.1:3000/ready >/dev/null
  curl --fail --silent http://127.0.0.1:4173 >/dev/null

  log "Bootstrap terminé"
  printf '%s\n' "VM prête: frontend http://$vm_ip:4173 | backend http://$vm_ip:3000"
  printf '%s\n' "Mise à jour quotidienne: sudo bash /usr/local/bin/update-hsm-dev.sh"
}

main() {
  need_root
  ensure_vm_setup
}

main "$@"
