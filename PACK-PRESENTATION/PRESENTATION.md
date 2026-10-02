# Génération Capable — Pack de présentation

Contenu : tous les sites/interfaces créés, avec leur page d'entrée (index).

| # | Site | Index / entrée | Rôle |
|---|------|----------------|------|
| 1 | **Site principal « Génération Capable »** (le meilleur : plateforme complète, ~475 Ko) | `1-site-principal/index.html` | Plateforme membres/vendeurs : CRM, commandes, wallet, marketplace, missions, classement, centre d'aide, contrats/conformité, notifications push, paiement Stripe, PWA installable |
| 2 | **Bibliothèque** | `2-bibliotheque/bibliotheque.html` | Centre d'entraînement des ambassadeurs : mission, offre, FAQ, objections, playbooks, check-lists, plan d'action |
| 3 | **GC Ambassadors OS** | `3-ambassadors-os/ambassadors.html` | Espace ambassadeurs : liens de parrainage, gains, suivi |
| 4 | **Administration** | `4-admin-panel/index.html` | Panneau admin : ambassadeurs, conformité, contrats, infos légales |
| 5 | **Monteur vidéo IA** (Next.js) | `5-monteur-video-ia/interfaces/app/page.tsx` (accueil : upload rushs + brief + style) et `projects/[id]/page.tsx` (suivi + résultat) | Rushs bruts + brief en langage naturel → vidéo courte prête à publier (sous-titres synchronisés, directeur créatif IA, habillage FFmpeg/Remotion) |
| 6 | **GC AI OS** (Next.js) | `6-gc-ai-os/interfaces/app/page.tsx` + `components/` (executive-dashboard, chat-console, goal-console, agents-view) | Orchestrateur de 19 agents IA, tableau de bord « Direction », objectifs → missions → dossier téléchargeable |

## Comment montrer
- Sites 1–4 : fichiers HTML statiques → double-clic sur l'index (ou glisser sur Netlify Drop). Les appels back-end (Supabase, Stripe, fonctions Netlify) ne répondent pas hors déploiement : l'interface s'affiche, les données réelles non.
- Sites 5–6 : applications Next.js ; seules les interfaces (code) sont ici. Pour les lancer : dépôt complet, `pnpm install && pnpm dev` dans `video-editor/` ou `gc-ai-os/`.
- `docs/` : documentation d'architecture (vision, agents, sécurité, roadmap, notifications, conformité).
- Honnêteté : sans clés API, 5 et 6 tournent en mode démo/repli déterministe, annoncé comme tel dans l'app.
