import { useQuery } from "@tanstack/react-query";
import { describeHistoryRow, type HistoryItem, type HistoryRow } from "@app/domain";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";

export interface HistoryEntry { raw: HistoryRow; item: HistoryItem }

/** Historique du wallet (lignes brutes + libellés humains). La clé commence par ["wallet", uid] : un crédit la rafraîchit. */
export function useHistoryEntries(limit: number) {
  const uid = useUserId();
  return useQuery({
    queryKey: ["wallet", uid, "history", limit],
    queryFn: async (): Promise<HistoryEntry[]> => (await api.wallet.history(limit)).map((raw) => ({ raw, item: describeHistoryRow(raw) })),
    staleTime: 15_000,
  });
}
