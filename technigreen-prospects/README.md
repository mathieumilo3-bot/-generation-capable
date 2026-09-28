# Base de prospects — Technigreen68 / Paysage d'Ambiance (terre amendée criblée en vrac)

**Date de constitution :** 28/09/2026
**Fichier de données :** [`PROSPECTS_TECHNIGREEN68.csv`](./PROSPECTS_TECHNIGREEN68.csv) (séparateur `;`, encodage UTF-8, 37 colonnes)

## ⚠️ À lire avant d'utiliser cette base

L'objectif initial était 500 contacts vérifiés (email direct + décideur nominatif). **Ce n'est pas ce que ce fichier contient**, et c'est volontaire : le brief lui-même interdit de fabriquer un contact ou une preuve. Deux limites techniques réelles empêchent d'atteindre 500 contacts *vérifiés* en une seule session :

1. **BOAMP, France Marchés, Marchés Online, TED, La Centrale des Marchés, Radar Marchés Publics sont inaccessibles en lecture directe** depuis cet environnement (proxy réseau qui bloque ces domaines). Toute la recherche a donc été faite via les résumés du moteur de recherche, qui lit réellement ces pages mais ne permet pas de les explorer en profondeur (ouvrir le DCE complet, le CCTP/BPU/DPGF en PDF, etc.).
2. **Aucun outil de cette session ne donne accès à un annuaire de décideurs nominatifs ou à un vérificateur d'emails** (pas de LinkedIn, pas d'outil de sourcing RH/commercial). Fabriquer un nom ou un email n'était pas une option.

**Résultat honnête : 25 lignes construites, chacune avec une source publique réelle et vérifiable**, plutôt que 500 lignes de remplissage. Conformément à la consigne « maximiser la valeur des 50 premiers plutôt que remplir vite à 500 », l'effort a porté sur la qualité et la traçabilité de chaque ligne, pas sur le volume.

**Champs manquants marqués honnêtement :** toute case indisponible porte la mention `NON RENSEIGNÉ — À RECHERCHER` plutôt qu'une valeur inventée. Aucun email individuel n'a été indiqué : aucun n'a pu être trouvé publiquement et vérifié dans le temps imparti.

## Résumé chiffré

| Indicateur | Valeur |
|---|---|
| Total prospects | 25 |
| A++ (besoin explicite avec document/preuve) | 10 |
| A+ (titulaire connu / très fortement probable) | 4 |
| A (gros consommateur structurel, sans signal chantier précis) | 11 |
| B | 0 (non utilisé — le socle A++/A+/A n'est pas épuisé) |
| Avec preuve documentaire datée (avis, DCE, avis d'attribution) | 14 |
| Avec volume en m³ explicitement chiffré | 1 (RD58A Vosges — 685 m³) |
| Avec décideur nominatif | 0 — non trouvé publiquement, non inventé |
| Avec email vérifié | 0 — idem |

## Top opportunités (à traiter en premier)

1. **Commune de Vitry-sur-Seine** — marché-cadre de fourniture directe terre/substrats/amendements 2027-2030, offres closes le 04/09/2026 : c'est la collectivité elle-même qui achète, pas un exécutant tiers.
2. **SANEF — nœud autoroutier A4/A35/A355, Contournement Ouest de Strasbourg (sites Fer à Cheval / Forlen)** — mesures compensatoires écologiques avec décapage/fourniture de terre végétale, à **~65 km de Wittelsheim** (le chantier le plus proche identifié).
3. **CD88 (Vosges) — RD58A Saulcy-sur-Meurthe/Mandray** — seul volume précisément chiffré trouvé : 685 m³ de terre végétale.
4. **CU Grand Paris Seine & Oise — extension tramway T13 (Poissy/Achères)** — besoin de terre végétale nommé explicitement dans l'avis BOAMP n° 26-9148.
5. **SPL Euralille — Parc de la Vallée / Parc Saint-Sauveur, Lille** — fourniture de terre végétale ET technosol nommée dans le marché.
6. **Terratek TP (Wittenheim, 68)** — entreprise de terrassement/VRD à ~3 km de Wittelsheim : la cible la plus facile logistiquement, à approcher en priorité même sans chantier précis identifié.

Le détail complet (preuve exacte, source, angle d'approche, question à poser) est dans le CSV, colonnes `Preuve_exacte_du_besoin` et `Angle_approche_personnalise`.

## Méthodologie appliquée

- Recherche par thème : avis de marché/attribution mentionnant explicitement « terre végétale », « terre amendée », « substrat », « mélange terre-pierre », « fourniture de terre végétale », déclinée par région et par type de maître d'ouvrage (communes, départements, SPL/SEM d'aménagement, concessionnaires d'autoroutes, opérateurs de tramway).
- Priorité donnée aux marchés **attribués ou dont le titulaire est identifiable**, conformément au brief (un titulaire connu est plus actionnable qu'un marché encore ouvert).
- Chaque ligne A++/A+ est reliée à une source consultée (URL dans `Source_principale`/`Deuxieme_source`).
- Les lignes A (grands groupes paysage/TP/VRD : idverde, Pinson Paysage, Eurovia, Colas, NGE, Eiffage, Spie Batignolles, SADE, Ramery, Est Paysages d'Alsace, Terratek TP) sont incluses **sans preuve de chantier précis**, ce qui est conforme à la définition du brief pour le niveau A (« gros consommateur structurel potentiel »), et clairement annoté comme tel dans la colonne `Nature_du_besoin`.
- Aucun email individuel n'a été indiqué ou déduit : la consigne interdit de fabriquer un email, et aucun outil de cette session ne permet de vérifier un pattern d'adresse nominative.

## Pour aller vers 500 prospects — ce qu'il reste à faire

Cette base est un **socle de démarrage**, pas le livrable final à 500 lignes. Pour compléter sérieusement, il faudrait, dans une ou plusieurs sessions dédiées :

1. **Accès direct à BOAMP, France Marchés, Marchés Online, PLACE, TED** (recherche par mot-clé + export), aujourd'hui bloqués par le proxy réseau de cet environnement — c'est le principal goulot d'étranglement.
2. **Un annuaire professionnel (type LinkedIn Sales Navigator, Kompass, Societe.com avec dirigeants) et un outil de vérification d'email**, pour transformer chaque ligne « entreprise identifiée » en ligne avec décideur nominatif + email vérifié.
3. **Répéter la même méthodologie région par région** (Bretagne, Normandie, Pays de la Loire, Centre-Val de Loire, Nouvelle-Aquitaine, Occitanie, PACA, Corse, Bourgogne-Franche-Comté n'ont pas encore été creusées en profondeur faute de résultats exploitables lors des premières passes).
4. **Ouvrir individuellement les CCTP/BPU/DPGF en PDF** des marchés déjà repérés pour en extraire les volumes m³ exacts (actuellement disponible pour 1 seule ligne sur 25).
5. Compléter les A avec des A+ (paysagistes régionaux ayant remporté des marchés précis, entreprises VRD sur lotissements) avant d'envisager les B.

Dites-moi si vous voulez que je poursuive sur une région précise, que j'approfondisse une des lignes A++ (ex. identifier le titulaire SANEF, ou vérifier l'attribution Vitry-sur-Seine), ou que je bascule sur un format tableur (xlsx) plus lisible que le CSV.
