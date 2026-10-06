import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/supabase";

const TTL_SEC = 3600;
const REFRESH_AFTER_MS = 50 * 60_000;

/**
 * URLs signées de miniatures, demandées EN LOT (une requête pour tout l'écran, jamais une par carte)
 * et seulement pour les chemins pas encore connus. Renouvelées avant expiration.
 */
export function useThumbnailUrls(paths: readonly string[]): { urls: Record<string, string>; reset: () => void } {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fetchedAt = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const key = paths.join("|");

  useEffect(() => {
    const now = Date.now();
    const missing = paths.filter((p) => {
      const at = fetchedAt.current.get(p);
      return (at === undefined || now - at > REFRESH_AFTER_MS) && !inflight.current.has(p);
    });
    if (missing.length === 0) return;
    missing.forEach((p) => inflight.current.add(p));
    let alive = true;
    api.projects.signedUrls("thumbnails", missing, TTL_SEC)
      .then((res) => {
        const at = Date.now();
        Object.keys(res).forEach((p) => fetchedAt.current.set(p, at));
        if (alive) setUrls((prev) => ({ ...prev, ...res }));
      })
      .catch(() => undefined) // les cartes affichent un aplat neutre ; on réessaiera au prochain rafraîchissement
      .finally(() => { missing.forEach((p) => inflight.current.delete(p)); });
    return () => { alive = false; };
    // `key` représente `paths` (tableau recréé à chaque rendu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reset = useCallback(() => { fetchedAt.current.clear(); }, []);
  return { urls, reset };
}
