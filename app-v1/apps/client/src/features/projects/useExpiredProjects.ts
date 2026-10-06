import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProjectRow } from "@app/api";
import { supabase } from "@/lib/supabase";
import { expiredProjectIds } from "./logic";

type Probe = Pick<ProjectRow, "id" | "status" | "current_version_id">;
interface VersionProbe { id: string; status: string; expires_at: string | null }

/**
 * Projets dont la vidéo a été supprimée (conservation limitée). UNE requête légère pour toute la grille
 * (état et date d'expiration des versions courantes seulement). En attendant la réponse, ou en cas d'échec,
 * aucun projet n'est marqué : la carte garde son aplat neutre si la miniature manque.
 */
export function useExpiredProjects(projects: readonly Probe[]): ReadonlySet<string> {
  const ids = useMemo(
    () => Array.from(new Set(projects.flatMap((p) => (p.status === "ready" && p.current_version_id ? [p.current_version_id] : [])))).sort(),
    [projects],
  );
  const q = useQuery({
    queryKey: ["version-expiry", ids.join("|")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<VersionProbe[]> => {
      const { data, error } = await supabase.from("project_versions").select("id,status,expires_at").in("id", ids);
      if (error) throw error;
      return (data ?? []) as VersionProbe[];
    },
  });
  return useMemo(() => expiredProjectIds(projects, q.data ?? []), [projects, q.data]);
}
