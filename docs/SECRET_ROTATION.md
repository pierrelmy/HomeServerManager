# Rotation des secrets — HomeServerManager

Ce runbook décrit la procédure à suivre pour chaque secret de production.
Toutes les modifications de `/etc/homeservermanager/backend.env` doivent être effectuées en tant que `root` ; le fichier doit rester en mode `0600`.

---

## SESSION_SECRET

### Impact

`SESSION_SECRET` signe les cookies de session.  
Changer cette valeur **invalide immédiatement toutes les sessions actives** : chaque utilisateur connecté est déconnecté et doit se ré-authentifier.

### Quand le faire

- Suspicion de compromission du secret actuel.
- Politique interne de rotation périodique (recommandé : tous les 90 jours).
- Après une fuite de `/etc/homeservermanager/backend.env`.

### Procédure

```bash
# 1. Générer un nouveau secret (au moins 32 octets en hexadécimal)
NEW_SECRET=$(openssl rand -hex 32)

# 2. Mettre à jour le fichier d'environnement
sudo sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${NEW_SECRET}|" \
  /etc/homeservermanager/backend.env

# 3. Vérifier la modification
sudo grep SESSION_SECRET /etc/homeservermanager/backend.env

# 4. Redémarrer le backend (invalide toutes les sessions en cours)
sudo systemctl restart homeservermanager

# 5. Contrôler le démarrage
sudo systemctl status homeservermanager
sudo journalctl -u homeservermanager -n 50 --no-pager
```

---

## ADMIN_PASSWORD

### Cas 1 — Développement / `syncAdminOnBoot=true`

En développement, le backend resynchronise le compte administrateur au démarrage à partir des variables d'environnement.
Un simple changement dans le fichier d'env suivi d'un redémarrage suffit.

```bash
# 1. Générer un nouveau mot de passe
NEW_PASS=$(openssl rand -hex 24)

# 2. Mettre à jour le fichier d'environnement
sudo sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${NEW_PASS}|" \
  /etc/homeservermanager/backend.env

# 3. Redémarrer — le mot de passe est appliqué automatiquement au boot
sudo systemctl restart homeservermanager

# 4. Vérifier le démarrage
sudo systemctl status homeservermanager
```

Conserver le nouveau mot de passe dans votre gestionnaire de secrets avant de supprimer la valeur de votre terminal.

### Cas 2 — Production / `syncAdminOnBoot=false`

En production, le backend ne réécrit pas le compte admin au démarrage.
La rotation passe obligatoirement par l'interface applicative.

```
1. Se connecter à l'interface HomeServerManager avec les identifiants actuels.
2. Accéder à Paramètres → Compte → Changer le mot de passe.
3. Saisir l'ancien mot de passe, puis le nouveau (généré avec openssl rand -hex 24).
4. Valider — le changement est immédiat, aucun redémarrage requis.
5. Mettre à jour ADMIN_PASSWORD dans /etc/homeservermanager/backend.env
   pour cohérence et restauration future :

   sudo sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=<nouveau_mot_de_passe>|" \
     /etc/homeservermanager/backend.env
```

> Note : si l'accès à l'interface est perdu (mot de passe oublié), basculer temporairement `syncAdminOnBoot=true` dans le code ou la configuration, redémarrer, puis remettre à `false` après la rotation.

---

## METRICS_TOKEN

### Impact

`METRICS_TOKEN` protège le endpoint `/metrics` (Prometheus).  
Changer ce token **interrompt la collecte Prometheus** jusqu'à ce que la configuration Prometheus soit mise à jour avec la nouvelle valeur.

### Procédure

```bash
# 1. Générer un nouveau token
NEW_TOKEN=$(openssl rand -hex 32)

# 2. Mettre à jour le backend
sudo sed -i "s|^METRICS_TOKEN=.*|METRICS_TOKEN=${NEW_TOKEN}|" \
  /etc/homeservermanager/backend.env

# 3. Mettre à jour la configuration Prometheus
#    Éditer le fichier de secret utilisé par Prometheus :
sudo sh -c "printf '%s' \"${NEW_TOKEN}\" > /opt/homeservermanager/deploy/secrets/metrics_token"
sudo chmod 0600 /opt/homeservermanager/deploy/secrets/metrics_token

# 4. Redémarrer le backend en premier
sudo systemctl restart homeservermanager

# 5. Redémarrer (ou recharger) Prometheus pour qu'il lise le nouveau token
#    (adapter selon votre installation Prometheus)
docker compose -f /opt/homeservermanager/deploy/compose.production.yaml \
  --profile monitoring restart prometheus
# ou, si Prometheus est géré par systemd :
# sudo systemctl reload prometheus

# 6. Vérifier que Prometheus scrape de nouveau correctement
#    (attendre le prochain cycle de scrape, en général 15-30 s)
sudo journalctl -u homeservermanager -n 20 --no-pager
```

> Si Prometheus n'est pas rechargé, les alertes "API indisponible" se déclencheront faussement pendant la fenêtre entre les deux redémarrages. Planifier la rotation en dehors des heures de pointe.

---

## Vérification post-rotation

Après toute rotation de secret, valider l'état du service avec les commandes suivantes.

### Healthchecks HTTP

```bash
# Remplacer DOMAIN par votre domaine de production
DOMAIN=homelab.example.com

# Endpoint de santé basique
curl -sf "https://${DOMAIN}/health" | jq .

# Endpoint de disponibilité (dépendances)
curl -sf "https://${DOMAIN}/ready" | jq .
```

Les deux doivent retourner HTTP 200. Tout autre code indique un problème de démarrage ou de configuration.

### Logs systemd

```bash
# Dernières 100 lignes depuis le redémarrage
sudo journalctl -u homeservermanager -n 100 --no-pager

# Suivi en temps réel
sudo journalctl -u homeservermanager -f
```

Rechercher les mots-clés `ERROR`, `FATAL` ou toute stacktrace qui indiquerait un secret mal formé ou un échec d'initialisation.

### État systemd

```bash
sudo systemctl status homeservermanager
```

Le service doit afficher `active (running)`. Un état `failed` ou `activating` (bloqué) signale un problème.
