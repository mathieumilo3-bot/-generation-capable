import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { errorCodeOf, humanizeError } from "@app/domain";
import { api } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { isValidInviteToken } from "./logic";

const KEY = "pending_invite";

/** Mémorise le jeton d'une invitation ouverte avant connexion (lien profond → connexion → application). */
export async function savePendingInvite(token: string): Promise<void> {
  if (!isValidInviteToken(token)) return;
  try { await AsyncStorage.setItem(KEY, token); } catch { /* le lien d'invitation reste utilisable */ }
}

export async function readPendingInvite(): Promise<string | null> {
  try { const t = await AsyncStorage.getItem(KEY); return isValidInviteToken(t) ? t : null; } catch { return null; }
}

export async function clearPendingInvite(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* sans importance */ }
}

export type PendingInviteState =
  | { status: "idle" }
  | { status: "applying" }
  | { status: "applied"; creditedCents: number; replayed: boolean }
  | { status: "failed"; title: string; detail: string };

/**
 * À brancher une fois (ex. dans le layout des onglets) : dès que l'utilisateur est connecté et qu'une invitation est
 * en attente, elle est appliquée (`accept_invitation`) puis oubliée. Le résultat sert à afficher « {montant} ajoutés à
 * votre solde » (ou l'erreur humaine) ; `dismiss()` masque le message.
 */
export function usePendingInvite(): PendingInviteState & { dismiss(): void } {
  const { state } = useAuth();
  const qc = useQueryClient();
  const [result, setResult] = useState<PendingInviteState>({ status: "idle" });
  const running = useRef(false);
  const signedIn = state.status === "signedIn";
  const uid = state.status === "signedIn" ? state.user.id : null;

  useEffect(() => {
    if (!signedIn || running.current) return;
    let alive = true;
    void (async () => {
      const token = await readPendingInvite();
      if (!token || !alive || running.current) return;
      running.current = true;
      setResult({ status: "applying" });
      try {
        const res = await api.account.acceptInvitation(token);
        await clearPendingInvite();
        if (!alive) return;
        if (res.ok) {
          const ok = res as { credited_cents?: number; replayed?: boolean };
          setResult({ status: "applied", creditedCents: ok.credited_cents ?? 0, replayed: ok.replayed === true });
          void qc.invalidateQueries({ queryKey: ["wallet", uid] });
        } else {
          const h = humanizeError(res.code);
          setResult({ status: "failed", title: h.title, detail: h.detail });
        }
      } catch (e) {
        // Erreur réseau : on garde le jeton pour réessayer au prochain lancement.
        const h = humanizeError(errorCodeOf(e));
        if (alive) setResult({ status: "failed", title: h.title, detail: h.detail });
      } finally {
        running.current = false;
      }
    })();
    return () => { alive = false; };
  }, [signedIn, uid, qc]);

  const dismiss = useCallback(() => setResult({ status: "idle" }), []);
  return { ...result, dismiss };
}
