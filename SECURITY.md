# Security policy

Signalez une vulnérabilité via une GitHub Security Advisory privée, sans ouvrir d’issue publique. Incluez les étapes de reproduction, l’impact estimé et une proposition de correction si disponible.

Les secrets ne doivent jamais être commités. Utiliser des variables d’environnement locales pour le développement, et l’environnement GitHub `production` pour le workflow de déploiement.

Les commandes système doivent rester dans les allowlists de l’adaptateur, de l’environnement et de `sudoers`. Toute nouvelle intégration système doit être ajoutée de façon explicite dans :

- la configuration backend
- les mappings du système
- `deploy/homelab-sudoers`
- la documentation de déploiement
