import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { aiConsentKey } from "./logic";

const memory = new Set<string>();

/**
 * Consentement IA déjà donné pour cette version (mémoire + stockage local, clé `ai_consent:<version>`).
 * Le serveur reste l'autorité : s'il répond `ai_consent_required`, `forget()` réaffiche la case.
 */
export function useAiConsent(version: string): { ready: boolean; granted: boolean; remember: () => void; forget: () => void } {
  const [granted, setGranted] = useState(() => memory.has(version));
  const [ready, setReady] = useState(() => memory.has(version));

  useEffect(() => {
    let alive = true;
    if (memory.has(version)) { setGranted(true); setReady(true); return; }
    setReady(false);
    void AsyncStorage.getItem(aiConsentKey(version))
      .then((v) => { if (v === "1") memory.add(version); if (alive) setGranted(v === "1"); })
      .catch(() => { if (alive) setGranted(false); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [version]);

  const remember = useCallback(() => {
    memory.add(version);
    setGranted(true);
    void AsyncStorage.setItem(aiConsentKey(version), "1").catch(() => undefined);
  }, [version]);
  const forget = useCallback(() => {
    memory.delete(version);
    setGranted(false);
    void AsyncStorage.removeItem(aiConsentKey(version)).catch(() => undefined);
  }, [version]);

  return { ready, granted, remember, forget };
}
