import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/supabase";
import { mergeRows, summarizeRows, uploadsReady, type FileRow, type FilesSummary } from "./logic";
import { useUploads } from "./useUploads";
import type { AssetRow } from "@app/api";

export const draftQueryKey = (projectId: string | null | undefined) => ["draft", projectId] as const;

/**
 * Fichiers d'un brouillon : envois locaux (progression) + fichiers déjà sur le serveur (reprise sur un autre appareil).
 */
export function useDraftFiles(projectId: string | null | undefined, kinds?: readonly AssetRow["kind"][]) {
  const uploads = useUploads(projectId);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: draftQueryKey(projectId),
    queryFn: async () => (await api.projects.get(projectId as string)).assets,
    enabled: !!projectId,
    staleTime: 10_000,
  });
  const rows: FileRow[] = useMemo(() => {
    const all = mergeRows(uploads.items, q.data ?? []);
    return kinds ? all.filter((r) => kinds.includes(r.kind)) : all;
  }, [uploads.items, q.data, kinds]);
  const summary: FilesSummary = useMemo(() => summarizeRows(rows), [rows]);
  return {
    rows, summary, state: uploadsReady(rows), loading: q.isLoading,
    /** Fichiers du brouillon serveur (source de vérité, y compris ceux supprimés après la durée de conservation). */
    assets: q.data ?? [],
    uploads,
    refresh: () => qc.invalidateQueries({ queryKey: draftQueryKey(projectId) }),
  };
}
