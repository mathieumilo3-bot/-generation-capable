# Preview Engine V2 — quality gate

Le trafic public (publicité → `/audit`) ne bascule **pas** sur la V2 tant
qu'une seule ligne ci-dessous n'est pas verte. Un test rouge n'est jamais
« acceptable » : on corrige et on relance.

| Contrôle | Comment | Où |
|---|---|---|
| Build | `npm run build` | CI « Site vitrine — CI » |
| Lint | `npm run lint` (0 erreur) | CI |
| Unitaires | `npm test` — moteur V2 : garde anti-invention, extraction, couleurs, pipeline complet hors réseau, validation, jetons, rendu React | CI |
| E2E | `npm run test:e2e` — `e2e/preview-v2.spec.ts` : homonymes → ville → attente → e-mail → vitrine → Calendly/UTM → reprise par lien ; sans site ; 5 largeurs ; lien forgé | CI |
| 34+ previews réelles | workflow `preview-v2-burnin.yml` (39 cas, AATP/Trojani.P inclus) contre le deploy preview | Actions |
| Mobile | QA visuelle 375/390/430 px (débordement, images, sections vides, textes coupés) | Actions (artefact de captures) |
| E-mail | cas `email: true` du burn-in (adresse de test Resend) + E2E (outbox) | Actions / CI |
| Reprise | le burn-in rouvre chaque preview par son lien ; l'E2E ouvre le lien de l'e-mail | Actions / CI |
| CTA | E2E : bouton « Construire cette version avec GC » → Calendly avec utm_source/medium/campaign/content/term | CI |

## Mise en service (après validation explicite uniquement)

1. Variables Netlify du site `gc-agence` : `GC_PREVIEW_V2=internal` (défaut), `PREVIEW_SIGNING_SECRET` (secret dédié recommandé), `OPENAI_PREVIEW_MODEL` (optionnel).
2. Reprise serveur quand le visiteur ferme la page : `GC_PREVIEW_V2_WORKER=1` sur le cron `audit-ready-cron`.
3. Deuxième burn-in (modifier `ops/preview-v2-burnin.json`).
4. Petit pourcentage du trafic seulement après validation explicite — la bascule n'est **pas** câblée dans `/audit` à ce stade.

## Ce que la V2 ne fait pas encore

- Pas de répartition de trafic automatique vers `/audit/preview-v2` (volontaire).
- L'alerte interne « audit commencé » (`/api/audit/intent`) n'est pas envoyée par la V2 tant qu'elle est interne.
