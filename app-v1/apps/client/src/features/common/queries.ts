import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";

/**
 * Lectures « passives » : mêmes clés de cache que `hooks/data.ts` mais SANS abonnement Realtime.
 * Les abonnements (jobs, notifications) sont ouverts UNE seule fois par `useLiveSync` (onglets) :
 * deux canaux de même nom se parasitent (supabase-js renvoie le canal existant).
 */
export function useWalletBalance() {
  const uid = useUserId();
  return useQuery({ queryKey: ["wallet", uid], queryFn: () => api.wallet.balance(), refetchInterval: 60_000 });
}

export function useActiveJobsList() {
  const uid = useUserId();
  return useQuery({ queryKey: ["active-jobs", uid], queryFn: () => api.projects.activeJobs(), refetchInterval: 8_000 });
}

export function useUnreadCount() {
  const uid = useUserId();
  return useQuery({ queryKey: ["notifications-unread", uid], queryFn: () => api.notifications.unreadCount(), refetchInterval: 60_000 });
}

export function useNotificationList() {
  const uid = useUserId();
  return useQuery({ queryKey: ["notifications", uid], queryFn: () => api.notifications.list() });
}

export function useDrafts() {
  const uid = useUserId();
  return useQuery({ queryKey: ["drafts", uid], queryFn: () => api.projects.drafts() });
}
