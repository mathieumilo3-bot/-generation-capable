import { useEffect } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { describeHistoryRow, type HistoryItem } from "@app/domain";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";

/** Solde en direct : requête + invalidation par Realtime (le polling de repli couvre une coupure Realtime). */
export function useWallet() {
  const uid = useUserId();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wallet", uid], queryFn: () => api.wallet.balance(), refetchInterval: 60_000 });
  useEffect(() => api.wallet.subscribe(uid, () => void qc.invalidateQueries({ queryKey: ["wallet", uid] })), [uid, qc]);
  return q;
}

export function useWalletHistory(limit = 50): UseQueryResult<HistoryItem[]> {
  const uid = useUserId();
  return useQuery({ queryKey: ["wallet-history", uid, limit], queryFn: async () => (await api.wallet.history(limit)).map(describeHistoryRow) });
}

export function useProfile() {
  const uid = useUserId();
  return useQuery({ queryKey: ["profile", uid], queryFn: () => api.account.profile() });
}

/** Jobs actifs en direct (accueil, bandeau « En cours »). Realtime + polling de repli 8 s. */
export function useActiveJobs() {
  const uid = useUserId();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["active-jobs", uid], queryFn: () => api.projects.activeJobs(), refetchInterval: 8_000 });
  useEffect(() => api.jobs.subscribe(uid, () => {
    void qc.invalidateQueries({ queryKey: ["active-jobs", uid] });
    void qc.invalidateQueries({ queryKey: ["projects"] });
    void qc.invalidateQueries({ queryKey: ["project"] });
    void qc.invalidateQueries({ queryKey: ["wallet", uid] });
  }), [uid, qc]);
  return q;
}

export function useNotifications() {
  const uid = useUserId();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["notifications", uid], queryFn: () => api.notifications.list() });
  const unread = useQuery({ queryKey: ["notifications-unread", uid], queryFn: () => api.notifications.unreadCount(), refetchInterval: 60_000 });
  useEffect(() => api.notifications.subscribe(uid, () => {
    void qc.invalidateQueries({ queryKey: ["notifications", uid] });
    void qc.invalidateQueries({ queryKey: ["notifications-unread", uid] });
  }), [uid, qc]);
  return { list, unread };
}
