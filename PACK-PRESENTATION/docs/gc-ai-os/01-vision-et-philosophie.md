# 01 — Vision et philosophie

## Vision

Construire **GC AI OS**, le système d'exploitation d'agents IA de
Génération Capable. Sa mission immédiate n'est pas de vendre un produit
mais de **piloter Génération Capable elle-même** : développement produit,
marketing, vente, support, finance, contenu, recherche, conformité,
recrutement. L'objectif est de réduire au maximum les interventions
humaines répétitives, pour que les humains se concentrent sur la décision,
la stratégie et la relation.

Une fois GC AI OS suffisamment fiable en interne, il devient la fondation
de **GC AI Factory** : une plateforme permettant de créer, déployer et
superviser rapidement des employés IA spécialisés pour n'importe quel
métier, généralisable à des milliers d'organisations.

**Ordre des priorités — explicite et non négociable :**

1. Faire fonctionner GC AI OS pour Génération Capable, sur des cas réels.
2. Le durcir (fiabilité, sécurité, coût, observabilité) en conditions
   réelles.
3. Généraliser l'architecture pour qu'elle porte GC AI Factory.

Construire directement « l'usine à agents » avant d'avoir un système
interne qui tourne serait optimiser une abstraction sans avoir validé le
produit qu'elle est censée généraliser. Toute fonctionnalité proposée doit
d'abord répondre à un besoin réel de Génération Capable.

## Rôle : CTO de Génération Capable

Celui qui conçoit et fait évoluer GC AI OS agit comme le CTO de
l'entreprise, pas comme un exécutant de tickets. Concrètement, cela veut
dire :

- Remettre en question une demande si l'architecture proposée dégrade la
  maintenabilité à long terme, même si elle « marche » à court terme.
- Comparer les solutions quand plusieurs existent : avantages,
  inconvénients, puis une recommandation tranchée — jamais une liste
  d'options sans conclusion.
- Justifier chaque décision structurante (choix de stack, découpage en
  agents, modèle de permissions) par un raisonnement explicite, pas par
  habitude ou par défaut d'un framework.
- Refuser le raccourci qui hypothèque l'évolutivité : mieux vaut livrer
  moins mais proprement architecturé, que tout livrer avec de la dette
  cachée.

## Principes de conception non négociables

### 1. Modularité avant tout
Chaque agent, chaque connecteur, chaque module de mémoire doit pouvoir être
remplacé ou amélioré **indépendamment**, sans réécrire le reste du
système. Concrètement : interfaces stables entre les composants, pas de
dépendances circulaires, pas de logique métier dans la couche
d'orchestration.

### 2. Industrialisable dès le premier jour
Même le premier agent (ex. DevOps Agent) doit être écrit comme s'il allait
un jour tourner pour 1000 organisations différentes — pas comme un script
jetable pour Génération Capable uniquement. Cela ne veut pas dire
sur-ingénierer une v1 : cela veut dire ne pas coder en dur des hypothèses
qui ne survivront pas à la généralisation (noms d'entreprise, structure
d'équipe, etc.).

### 3. Zero Trust par défaut
Aucun agent n'a de confiance implicite. Chaque action, surtout les
actions critiques (déploiement, modification de schéma, envoi d'email,
action financière), passe par un contrôle de permission explicite et
laisse une trace d'audit. Voir [06-securite.md](./06-securite.md).

### 4. Mémoire comme actif de premier ordre
La mémoire n'est pas un cache technique, c'est la base de connaissance
vivante de l'entreprise. Elle doit survivre au remplacement de n'importe
quel agent ou modèle sous-jacent. Voir [04-memoire.md](./04-memoire.md).

### 5. Jamais coder sans plan
Avant toute fonctionnalité : Analyse → Architecture → Plan → Découpage →
Développement → Tests → Validation → Documentation. Ce cycle s'applique à
GC AI OS lui-même *et* devient plus tard un workflow que les agents
appliquent à leur propre travail (ex. Backend Agent planifiant une
migration avant de l'exécuter).

### 6. Qualité comme contrat, pas comme option
Clean Architecture, SOLID, DRY, KISS, TypeScript strict, tests
automatisés, documentation à jour. Un agent qui produit du code non testé
ou non documenté n'a pas terminé sa tâche — le workflow de validation doit
l'empêcher de la marquer comme terminée.

### 7. Extensibilité par convention, pas par exception
Ajouter un nouveau connecteur, un nouvel agent ou un nouveau workflow doit
suivre un patron reproductible documenté (voir
[05-connecteurs.md](./05-connecteurs.md) et
[03-agents.md](./03-agents.md)), pas nécessiter une intervention
architecturale ad hoc à chaque fois.

## Ce que GC AI OS n'est pas

- Ce n'est **pas** un chatbot unique avec beaucoup d'outils : c'est un
  système multi-agents avec un orchestrateur qui délègue.
- Ce n'est **pas** une automatisation « no-code » figée : les workflows
  sont versionnés, testables, et les agents peuvent en créer de nouveaux.
- Ce n'est **pas** un produit final pour l'instant : GC AI Factory viendra
  après, seulement quand l'OS interne aura fait ses preuves.
