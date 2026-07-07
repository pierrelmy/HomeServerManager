# Runbook d’exploitation

## Contrôles

- API : `GET /health`
- Readiness SQLite : `GET /ready`
- Métriques Prometheus : `GET /metrics` avec `Authorization: Bearer $METRICS_TOKEN`
- Logs : `journalctl -u homeservermanager`
- Proxy : `docker compose -f deploy/compose.production.yaml logs caddy`
- Frontend : `docker compose -f deploy/compose.production.yaml exec -T frontend wget -qO- http://localhost:8080/healthz`

Le workflow GitHub `Deploy production` exécute déjà un smoke test backend (`/health`, `/ready`) et frontend (`/healthz`) après activation. En cas d’échec, considérer le déploiement comme non validé même si `systemd` est actif.

## Sauvegarde

Un timer systemd automatise la sauvegarde quotidienne à 02h00 (voir `deploy/backup-sqlite.timer`). Il conserve les 7 derniers backups dans `/var/backups/homeservermanager/`.

```bash
# Vérifier l’état du timer
systemctl status backup-sqlite.timer

# Consulter les logs du dernier backup
journalctl -u backup-sqlite.service -n 20 --no-pager

# Déclencher manuellement
sudo systemctl start backup-sqlite.service
```

Pour un backup ad hoc, copier directement `/var/lib/homeservermanager/homelab.db` après avoir arrêté brièvement le service (ou en mode `SYSTEM_ADAPTER=simulation` où SQLite n’est pas soumis à des écritures concurrentes). Sauvegarder aussi `/etc/homeservermanager/backend.env` dans un coffre chiffré. Tester une restauration au moins une fois par trimestre.

## Restauration

1. Arrêter `homeservermanager`.
2. Restaurer la base et vérifier son propriétaire et son mode.
3. Démarrer le service et vérifier `/ready`.
4. Contrôler les sessions, paramètres et dernières entrées d’audit.

## Rollback

Relancer `Deploy production` avec un tag ou commit précédemment validé. Les migrations SQLite actuelles sont additives. Sauvegarder la base avant toute future migration destructive. Vérifier à nouveau les smoke tests après rollback.

## Incident

1. Couper l’accès externe dans Caddy si une compromission est suspectée.
2. Révoquer les secrets GitHub et remplacer `SESSION_SECRET`, `ADMIN_PASSWORD` et `METRICS_TOKEN`.
3. Supprimer les sessions dans SQLite.
4. Examiner le journal d’audit et les logs systemd.
5. Restaurer une version et une sauvegarde connues.
