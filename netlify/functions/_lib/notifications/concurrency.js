// netlify/functions/_lib/notifications/concurrency.js
//
// Traite un tableau avec un nombre limité d'opérations en vol simultanément
// — évite de lancer des milliers de requêtes Supabase/Push en parallèle
// (ce qui saturerait les connexions et ferait échouer le run) tout en
// restant nettement plus rapide qu'un traitement strictement séquentiel.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = { error: e };
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

module.exports = { mapWithConcurrency };
