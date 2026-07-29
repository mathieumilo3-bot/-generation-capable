# 15 — GC Human Brain

## Objet

Direction humaine : connaître chaque ambassadeur, vendeur et directeur,
détecter ceux qui décrochent, et adapter la communication à leurs
préférences.

C'est l'une des meilleures idées du projet — un ambassadeur silencieux
deux semaines ne revient presque jamais, et personne n'a le temps de
surveiller cela manuellement à l'échelle. C'est aussi la partie la plus
sensible, parce qu'elle traite des **données personnelles de personnes
réelles**.

## Deux règles inscrites dans le modèle de données

Ces règles sont plus faciles à tenir dans le schéma que dans les
intentions, donc elles y sont.

### 1. Aucun profilage psychologique

On enregistre des **faits observables** :

| Enregistré (observable) | Refusé (inféré) |
|---|---|
| Répond surtout le soir | « Personne du soir, peu disponible » |
| A répondu à des messages courts | « Impatient » |
| 9 jours sans activité | « Démotivé », « en perte d'engagement » |
| A généré 840 € | « Vendeur moyen » |

Un jugement de personnalité stocké sur une personne réelle est une
donnée sensible au sens du RGPD, contestable par l'intéressé, et
durablement injuste si le modèle se trompe. Une préférence observée se
corrige toute seule dès que le comportement change.

### 2. Aucune usurpation d'identité

Sur le **GC Personality Engine** : reproduire un style de communication
est légitime, se faire passer pour une personne ne l'est pas — y compris
avec de bonnes intentions.

L'implémentation retenue : les messages sont signés **« L'équipe
Génération Capable »**, jamais présentés comme écrits personnellement par
un dirigeant. Le style (longueur, ton, registre) s'adapte ; l'émetteur
reste l'entreprise.

La différence n'est pas cosmétique : un ambassadeur qui découvre qu'un
message « personnel » de son dirigeant était automatique perd confiance
dans tout le reste. Le style adapté fonctionne ; l'identité empruntée est
un risque disproportionné pour un gain nul.

## Consentement

`consentsToPersonalisation` conditionne toute relance individuelle. Sans
consentement, la personne existe dans le système, ses agrégats comptent,
mais **aucun message personnalisé n'est proposé** — le système le dit
explicitement et suggère une relance générique par un responsable.

Le droit à l'effacement (RGPD art. 17) est une suppression définitive en
base, pas un marquage `deleted`.

## Détection

L'inactivité est le seul signal utilisé en phase 1 : c'est le seul
réellement observable aujourd'hui, et le plus prédictif.

| Jours sans activité | Niveau |
|---|---|
| ≥ 3 | `watch` — à surveiller |
| ≥ 7 | `reach_out` — relance proposée |
| ≥ 14 | `escalate` — remonter à un responsable |

Le revenu déjà généré est mentionné dans la raison : un ambassadeur qui a
produit 2 100 € et décroche représente une perte mesurable, pas une ligne
dans une liste.

**Sans activité mesurée (`null`), aucune conclusion n'est tirée.** Le
système ne confond pas « cette personne décroche » avec « je n'ai pas de
données sur cette personne ».

## Ce qui n'est pas fait

- Les relances sont **proposées, jamais envoyées automatiquement**.
  L'envoi passera par les mêmes règles de validation que toute action
  sortante (voir 06-securite.md).
- Aucun connecteur n'alimente encore l'activité réelle : les profils sont
  saisis manuellement via `POST /api/people` en attendant Supabase.
- Le coaching personnalisé (au-delà de la relance) reste à construire, et
  devra rester aligné avec le standard du GC Cognitive Engine existant :
  une seule action prioritaire, jamais dix conseils.
