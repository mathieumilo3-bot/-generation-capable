import { useEffect } from "react";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { termsKey } from "@/features/legal/logic";

/** Déjà enregistrées pendant cette session (utilisateur + version) : un seul appel, même si l'écran se remonte. */
const done = new Set<string>();

/**
 * Enregistre (preuve horodatée et versionnée côté serveur) l'acceptation des conditions courantes après la connexion.
 * Best effort : jamais bloquant, erreurs ignorées (on réessaiera à la prochaine ouverture).
 */
export function useAcceptTerms(): void {
  const uid = useUserId();
  const { settings, settingsLoaded } = useConfig();
  const version = settings["legal.terms_version"];
  useEffect(() => {
    // Attendre les réglages serveur : la version par défaut embarquée pourrait être obsolète.
    if (!settingsLoaded) return;
    const key = termsKey(uid, version);
    if (!key || done.has(key)) return;
    done.add(key);
    void api.account.acceptTerms(version).catch(() => { done.delete(key); });
  }, [uid, version, settingsLoaded]);
}
