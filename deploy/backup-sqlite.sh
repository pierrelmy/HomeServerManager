#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# HomeServerManager — SQLite backup script
# ---------------------------------------------------------------------------
# Variables configurables (surchargeables via l'environnement ou argument)
DATABASE_PATH="${DATABASE_PATH:-/var/lib/homeservermanager/homelab.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/homeservermanager}"
KEEP_LAST="${KEEP_LAST:-7}"

# Accepte un chemin de base de données en premier argument (prioritaire sur la var d'env)
if [[ $# -ge 1 ]]; then
  DATABASE_PATH="$1"
fi

# ---------------------------------------------------------------------------
# Fonctions utilitaires
# ---------------------------------------------------------------------------
log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  log "ERREUR : $*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Vérifications préalables
# ---------------------------------------------------------------------------
log "Démarrage de la sauvegarde SQLite"
log "  Source   : ${DATABASE_PATH}"
log "  Cible    : ${BACKUP_DIR}"
log "  Rotation : conservation des ${KEEP_LAST} derniers backups"

[[ -f "${DATABASE_PATH}" ]] || die "Fichier de base de données introuvable : ${DATABASE_PATH}"

# ---------------------------------------------------------------------------
# Création du répertoire de backups si nécessaire
# ---------------------------------------------------------------------------
if [[ ! -d "${BACKUP_DIR}" ]]; then
  log "Création du répertoire de backups : ${BACKUP_DIR}"
  mkdir -p "${BACKUP_DIR}"
fi

# ---------------------------------------------------------------------------
# Copie atomique
# ---------------------------------------------------------------------------
BACKUP_NAME="homelab-$(date +%Y%m%d-%H%M%S).db"
BACKUP_DEST="${BACKUP_DIR}/${BACKUP_NAME}"

if command -v sqlite3 &>/dev/null; then
  log "sqlite3 disponible — utilisation de la commande .backup (snapshot cohérent)"
  sqlite3 "${DATABASE_PATH}" ".backup '${BACKUP_DEST}'" \
    || die "La commande sqlite3 .backup a échoué"
else
  log "sqlite3 non disponible — utilisation de cp + mv atomique"
  BACKUP_TMP="${BACKUP_DEST}.tmp"
  cp "${DATABASE_PATH}" "${BACKUP_TMP}" \
    || die "La copie temporaire a échoué"
  mv "${BACKUP_TMP}" "${BACKUP_DEST}" \
    || die "Le déplacement atomique a échoué"
fi

log "Backup créé : ${BACKUP_DEST}"

# ---------------------------------------------------------------------------
# Rotation : suppression des backups excédentaires (les plus anciens)
# ---------------------------------------------------------------------------
# Liste les fichiers holab-*.db triés du plus récent au plus ancien,
# supprime ceux au-delà des KEEP_LAST derniers.
mapfile -t ALL_BACKUPS < <(
  find "${BACKUP_DIR}" -maxdepth 1 -name 'homelab-*.db' -type f \
    | sort --reverse
)

TOTAL=${#ALL_BACKUPS[@]}
log "Backups existants : ${TOTAL} (limite : ${KEEP_LAST})"

if (( TOTAL > KEEP_LAST )); then
  TO_DELETE=("${ALL_BACKUPS[@]:${KEEP_LAST}}")
  for OLD in "${TO_DELETE[@]}"; do
    log "Suppression de l'ancien backup : ${OLD}"
    rm -f "${OLD}" || log "Avertissement : impossible de supprimer ${OLD}"
  done
  log "Rotation terminée — ${#TO_DELETE[@]} fichier(s) supprimé(s)"
else
  log "Rotation non nécessaire (${TOTAL} <= ${KEEP_LAST})"
fi

log "Sauvegarde terminée avec succès"
exit 0
