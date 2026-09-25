/**
 * fetch avec réessais pour le client serveur Supabase.
 *
 * Principe repris de netlify/functions/_lib/supabase-admin.js (réessais sur
 * incident passager : coupure réseau, 429, 5xx) — mais limité ici aux
 * requêtes de LECTURE (GET/HEAD). Une écriture rejouée après une réponse
 * perdue pourrait créer un doublon (journal, offre…) : on ne la rejoue jamais
 * à l'aveugle ; c'est la file de tâches, idempotente, qui reprend le travail.
 */
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function resilientFetch(
  base: typeof fetch = fetch,
  { attempts = 3, baseDelayMs = 250 }: { attempts?: number; baseDelayMs?: number } = {},
): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" && method !== "HEAD") return base(input, init);
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await base(input, init);
        if (!RETRY_STATUSES.has(res.status) || attempt === attempts) return res;
      } catch (err) {
        if (init?.signal?.aborted) throw err;
        lastError = err;
        if (attempt === attempts) throw err;
      }
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)));
    }
    throw lastError;
  };
}
