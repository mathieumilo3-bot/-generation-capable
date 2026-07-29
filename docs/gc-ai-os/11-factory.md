# 11 — GC AI Factory : les agents qui créent des agents

## La chaîne

```
Brief métier
   ↓  Agent Designer   → propose un blueprint
   ↓  Agent Builder    → valide contre le schéma (rejet explicite)
   ↓  Agent Trainer    → injecte les règles non négociables
   ↓  Agent Evaluator  → confronte à des scénarios, dont un test de refus
   ↓  Agent Publisher  → enregistre l'agent, chargé au prochain démarrage
```

## La décision d'architecture qui compte

**Le Builder ne génère pas de code.** Il produit un manifeste déclaratif
validé par schéma.

| Approche | Avantages | Inconvénients | Retenu ? |
|---|---|---|---|
| **Génération de fichiers TypeScript** | Agents arbitrairement puissants, logique sur mesure | Code jamais relu, exécuté avec les privilèges du serveur ; invalidable automatiquement ; impossible à diffuser à des clients externes sans exposer une exécution de code arbitraire | Non |
| **Manifestes déclaratifs** (retenu) | Validable par schéma, versionnable, diffable, révocable, sûr même si le brief vient d'un tiers | Un agent fabriqué ne peut pas faire ce que le runtime ne sait pas déjà faire | **Oui** |

Le compromis est assumé et il est le bon : un agent fabriqué se
différencie par son **domaine, son mandat, ses compétences, ses
garde-fous et ses directives**, pas par du code inédit. Tout ce qu'il
peut exécuter passe par les connecteurs existants, sous RBAC.

C'est ce qui rend GC AI Factory diffusable à des milliers
d'organisations : un client peut fabriquer ses employés IA sans qu'aucune
ligne de code non relue ne s'exécute sur la plateforme.

## Le test de refus

L'Evaluator vérifie qu'un agent candidat **refuse** une action critique.
Un agent qui accepte ce qu'il devrait refuser est plus dangereux qu'un
agent médiocre : sa publication est bloquée quel que soit son score sur
le reste.

Un candidat recalé est enregistré avec le statut `candidate` — il existe,
il est inspectable, mais il n'est pas chargé au démarrage.

## Cycle de vie

- `candidate` — fabriqué, évaluation non passée. Inactif.
- `published` — évaluation passée. Chargé au démarrage comme n'importe
  quel agent du catalogue, avec sa permission `converse` accordée.
- `revoked` — désactivé. Son domaine redevient disponible.

L'activation au **prochain démarrage** (et non à chaud) est volontaire :
injecter un agent dans un registre déjà servi rendrait l'état du système
dépendant de l'ordre des requêtes.

## Unicité du domaine

Un agent fabriqué ne peut pas prendre un domaine déjà occupé — ni ceux du
catalogue fondateur, ni celui d'un autre agent publié. L'Orchestrateur
remonte une ambiguïté de routage en erreur (voir 02) : autoriser deux
agents sur un même domaine casserait le chat pour ce domaine.

## Ce qui reste à faire

- Le Trainer se limite aux règles de base ; l'attachement d'une mémoire
  métier de départ (documents, exemples) est un chantier phase 2.
- L'Evaluator juge le manifeste, pas des réponses réelles de l'agent
  candidat. Le faire converser sur des scénarios réels et noter ses
  réponses est l'évolution naturelle, une fois une clé modèle en place.
