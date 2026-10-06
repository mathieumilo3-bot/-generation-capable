import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { JobRow } from "@app/api";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";

/**
 * Temps réel de l'app connectée : jobs et notifications, ouverts une seule fois (monté dans les onglets).
 * Chaque événement met le cache à jour ; le polling des requêtes sert de repli si Realtime est coupé.
 */
export function useLiveSync(): void {
  const uid = useUserId();
  const qc = useQueryClient();
  useEffect(() => {
    const offs: (() => void)[] = [];
    try {
      offs.push(api.jobs.subscribe(uid, (job: JobRow) => {
        qc.setQueryData(["job", job.id], job);
        void qc.invalidateQueries({ queryKey: ["active-jobs", uid] });
        void qc.invalidateQueries({ queryKey: ["projects"] });
        void qc.invalidateQueries({ queryKey: ["project", job.project_id] });
        void qc.invalidateQueries({ queryKey: ["wallet", uid] });
      }));
    } catch { /* Realtime indisponible : le polling prend le relais */ }
    try {
      offs.push(api.notifications.subscribe(uid, () => {
        void qc.invalidateQueries({ queryKey: ["notifications", uid] });
        void qc.invalidateQueries({ queryKey: ["notifications-unread", uid] });
      }));
    } catch { /* idem */ }
    return () => { for (const off of offs) { try { off(); } catch { /* déjà fermé */ } } };
  }, [uid, qc]);
}
