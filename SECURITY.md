# Security policy

Signalez une vulnérabilité via une GitHub Security Advisory privée, sans ouvrir d’issue publique. Incluez les étapes de reproduction, l’impact estimé et une proposition de correction si disponible.

Les secrets ne doivent jamais être commités. Utiliser des variables d’environnement locales pour le développement, et l’environnement GitHub `production` pour le workflow de déploiement.

Les commandes système doivent rester dans les allowlists de l’adaptateur, de l’environnement et de `sudoers`. Toute nouvelle intégration système doit être ajoutée de façon explicite dans :

- la configuration backend
- les mappings du système
- `deploy/homelab-sudoers` (copié en production vers `/etc/sudoers.d/homeservermanager`)
- la documentation de déploiement

Note : le flux d’installation de services via `POST /services` utilise `sudo -n /bin/bash -lc ...`, ce qui donne un accès root étendu. Ce flux exige que le backend ne soit pas lancé avec `NoNewPrivileges=true` ni `ProtectSystem=strict` (incompatibles avec `sudo` et les gestionnaires de paquets). Peser soigneusement ce compromis avant de l’activer en production.

Les sauvegardes SQLite contiennent des données de session hashées et des entrées d’audit. Stocker les backups dans un coffre chiffré (les fichiers `/var/backups/homeservermanager/*.db` doivent rester en mode `0600`, propriété `homelab`).

Les secrets GitHub suivants sont critiques pour la production et doivent être traités comme des credentials serveur :

- `PRODUCTION_SSH_PRIVATE_KEY` — accès SSH complet au serveur de production
- `PRODUCTION_GHCR_TOKEN` — accès aux images Docker publiées
- `PRODUCTION_HOST`, `PRODUCTION_USER`, `PRODUCTION_SSH_KNOWN_HOSTS`, `PRODUCTION_GHCR_USERNAME` — informations de connexion

Restreindre l’environnement GitHub `production` aux branches protégées et imposer un reviewer avant tout déploiement.
