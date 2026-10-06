import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { parsePageParam } from "../lib/pagination";

/** Filtres + page dans l'URL (liens partageables, retour navigateur). Tout changement de filtre remet la page à 1. */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const page = parsePageParam(params.get("page"));

  const setFilter = useCallback((patch: Partial<Record<K, string>>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (typeof v === "string" && v !== "") next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);

  const setPage = useCallback((p: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p > 0) next.set("page", String(p + 1));
      else next.delete("page");
      return next;
    });
  }, [setParams]);

  return { values, page, setFilter, setPage };
}
