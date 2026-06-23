# Runbook d’exploitation

## Contrôles

- API : `GET /health`
- Readiness SQLite : `GET /ready`
- Métriques Prometheus : `GET /metrics` avec `Authorization: Bearer $METRICS_TOKEN`
- Logs : `journalctl -u homeservermanager`
- Proxy : `docker compose -f deploy/compose.production.yaml logs caddy`

## Sauvegarde

Arrêter brièvement le service ou utiliser l’API SQLite de sauvegarde, puis copier `/var/lib/homeservermanager/homelab.db`. Sauvegarder aussi `/etc/homeservermanager/backend.env` dans un coffre chiffré. Tester une restauration au moins une fois par trimestre.

## Restauration

1. Arrêter `homeservermanager`.
2. Restaurer la base et vérifier son propriétaire et son mode.
3. Démarrer le service et vérifier `/ready`.
4. Contrôler les sessions, paramètres et dernières entrées d’audit.

## Rollback

Relancer `Deploy production` avec un tag ou commit précédemment validé. Les migrations SQLite actuelles sont additives. Sauvegarder la base avant toute future migration destructive.

## Incident

1. Couper l’accès externe dans Caddy si une compromission est suspectée.
2. Révoquer les secrets GitHub et remplacer `SESSION_SECRET`, `ADMIN_PASSWORD` et `METRICS_TOKEN`.
3. Supprimer les sessions dans SQLite.
4. Examiner le journal d’audit et les logs systemd.
5. Restaurer une version et une sauvegarde connues.
