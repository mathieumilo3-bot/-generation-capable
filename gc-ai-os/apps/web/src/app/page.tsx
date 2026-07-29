/**
 * Point d'entrée du dashboard (voir docs/gc-ai-os/07-interface.md).
 * Squelette de phase 1 : liste statique des vues prévues, sans encore de
 * données réelles branchées sur Supabase. Chaque vue devient une route
 * (`/tasks`, `/agents`, `/memory`, ...) au fur et à mesure de la phase 1.
 */

const views = [
  { name: "Tâches", description: "Graphe de tâches et sous-tâches, statut, validations en attente" },
  { name: "Agents", description: "Statut des 19 agents, permissions courantes" },
  { name: "Mémoire", description: "Explorateur des couches de mémoire, recherche sémantique" },
  { name: "Workflows", description: "Workflows validés par agent, automatisations n8n/Make" },
  { name: "Outils", description: "État des connecteurs, quotas, dernière erreur" },
  { name: "Monitoring", description: "Santé du système, latence, taux d'échec, coût" },
  { name: "Logs", description: "Journal d'audit, filtrable par agent/capacité/décision" },
  { name: "Performances", description: "Taux de succès, temps de résolution, taux d'escalade" },
];

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>GC AI OS</h1>
      <p>
        Orchestrateur et agents IA spécialisés pilotant Génération Capable.
        Voir la documentation d&apos;architecture dans{" "}
        <code>docs/gc-ai-os/</code> du repository <code>-generation-capable</code>.
      </p>
      <h2>Vues prévues</h2>
      <ul>
        {views.map((view) => (
          <li key={view.name}>
            <strong>{view.name}</strong> — {view.description}
          </li>
        ))}
      </ul>
    </main>
  );
}
