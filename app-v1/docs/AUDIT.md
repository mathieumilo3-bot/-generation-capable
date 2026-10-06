# Audit de l'existant (avant V1)

| Zone | Ce qui existe | Décision |
|---|---|---|
| `video-editor/` (pnpm + turbo, TS strict) | Moteur complet : pipeline 18 étapes (analyse, cuts, zooms, sous-titres, musique, rendu FFmpeg + Remotion), file de rendu SQLite avec claim atomique, concurrence adaptative, progression réelle, `cost_ledger` (µUSD), 3 presets de style (`preset_premium_clean`, `preset_dynamic_social`, `preset_aggressive_hype`), mode référence (`referenceVideoPaths`), 5 commandes d'édition (`shorter`, `faster`, `slower`, `more_zooms`, `less_zooms`) | **Conservé tel quel.** Non reconstruit. |
| `video-editor/apps/web` | UI Next.js de démo + routes `/api/projects*`. Auth = cookie `video-editor-user-id` forgeable (aucune vérification) | **Conservé** (outil interne). Jamais exposé aux clients. On y ajoute uniquement une couche d'adaptation `/api/engine/v1/*` protégée par jeton serveur-à-serveur. |
| Création autonome (idée → vidéo) | **N'existe pas** : `StubTtvProvider` ne génère rien | Option masquée via `engine_capabilities.autonomous_creation = false`. Les règles de prix existent mais l'app et le serveur refusent le mode tant que la capacité est fausse. |
| B-roll | Résolu en métadonnées, non inséré dans le rendu | Non promis à l'utilisateur. |
| Révisions | 5 commandes fermées, pas de texte libre | La passerelle mappe le texte libre vers ces commandes ; sinon échec propre + libération du montant. |
| Racine du dépôt (`index.html`, `netlify/`, `supabase/`, `admin-panel/`) | Plateforme « Génération Capable » (ambassadeurs/CRM/Stripe) sur le projet Supabase `fkhfahmzxsahrstxntjs`. Tables `profiles`, `payments`, `wallets`, `notifications`… | **Non touché.** Les noms collisionnent : la V1 vit dans `app-v1/` avec **son propre projet Supabase** (voir `SETUP_REQUIRED.md`). |
| `gc-ai-os/` | Orchestrateur d'agents internes GC | Hors périmètre. |

## À remplacer
- Auth cookie forgeable → Supabase Auth (Apple/Google/OTP e-mail) ; la passerelle moteur n'accepte que des jetons serveur.
- Queue SQLite pilotée par le web → reste le moteur de rendu, mais la **source de vérité métier** (jobs, wallet, versions) passe en Postgres ; un orchestrateur (`services/orchestrator`) synchronise.

## À connecter
App ⇄ Supabase (RPC atomiques, RLS) ⇄ orchestrateur ⇄ passerelle `/api/engine/v1` ⇄ moteur existant.
