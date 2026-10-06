# Pages publiques (statiques)

Hébergez ce dossier sur le domaine de l'app (ex. `https://app.example.com`) — Netlify, Cloudflare Pages ou tout hébergeur statique.

- `confidentialite.html`, `conditions.html`, `mes-donnees.html`, `supprimer-mon-compte.html` : URLs à renseigner dans App Store Connect, Play Console et dans `app_settings` (`urls.*`).
  **Ce sont des modèles factuels à faire valider par un juriste** (blocs jaunes `[À COMPLÉTER]`).
- `.well-known/apple-app-site-association` (sans extension, `Content-Type: application/json`) et `.well-known/assetlinks.json` : Universal Links / App Links.
  Remplacer `TEAMID`, le bundle id, le package et l'empreinte SHA-256 du certificat de signature (voir `SETUP_REQUIRED.md`).
- Quand l'app web Expo est exportée (`npm run build:web -w @app/client`), servez son `dist/` sur le même domaine ; ces fichiers statiques s'y superposent.
