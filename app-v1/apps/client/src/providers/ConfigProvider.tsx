import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_PUBLIC_SETTINGS, isAppVersionSupported, type PublicSettings } from "@app/config";
import { FALLBACK_CAPABILITIES, paymentCapabilities, type EditingMethod, type EngineCapabilities, type PaymentUiCapabilities, type PricingRule } from "@app/domain";
import { api } from "@/lib/supabase";
import { appVersion, platform } from "@/lib/platform";
import { useAuth } from "./AuthProvider";

interface ConfigValue {
  settings: PublicSettings;
  /** Vrai une fois les réglages serveur lus (ou en échec : on garde alors les défauts sûrs). Évite d'agir sur des défauts trop tôt. */
  settingsLoaded: boolean;
  pricing: PricingRule[];
  capabilities: EngineCapabilities;
  methods: EditingMethod[];
  payments: PaymentUiCapabilities;
  maintenance: { enabled: boolean; message: string };
  versionSupported: boolean;
  /** Vrai tant que prix/capacités n'ont pas été chargés (les écrans affichent un squelette, jamais un prix inventé). */
  loadingCatalog: boolean;
  refetch(): void;
}

const Ctx = createContext<ConfigValue | null>(null);

/**
 * Réglages publics (lisibles sans connexion : maintenance, version min, URLs légales) puis catalogue
 * (prix, capacités du moteur, méthodes) une fois connecté. Le serveur reste l'autorité ; en cas
 * d'échec réseau on garde les défauts embarqués pour les réglages, et AUCUN prix par défaut.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const signedIn = state.status === "signedIn";
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => api.config.publicSettings(), staleTime: 5 * 60_000, retry: 2 });
  const pricingQ = useQuery({ queryKey: ["pricing"], queryFn: () => api.config.pricing(), enabled: signedIn, staleTime: 5 * 60_000 });
  const capsQ = useQuery({ queryKey: ["capabilities"], queryFn: () => api.config.capabilities(), enabled: signedIn, staleTime: 5 * 60_000 });
  const methodsQ = useQuery({ queryKey: ["methods"], queryFn: () => api.config.editingMethods(), enabled: signedIn, staleTime: 5 * 60_000 });

  const value = useMemo<ConfigValue>(() => {
    const settings = settingsQ.data ?? DEFAULT_PUBLIC_SETTINGS;
    return {
      settings,
      settingsLoaded: settingsQ.isSuccess || settingsQ.isError,
      pricing: pricingQ.data ?? [],
      capabilities: capsQ.data ?? FALLBACK_CAPABILITIES,
      methods: methodsQ.data ?? [],
      payments: paymentCapabilities(platform, settings),
      maintenance: { enabled: settings["maintenance.enabled"], message: settings["maintenance.message"] },
      versionSupported: isAppVersionSupported(settings, platform, appVersion),
      loadingCatalog: signedIn && (pricingQ.isLoading || capsQ.isLoading || methodsQ.isLoading),
      refetch: () => { void settingsQ.refetch(); void pricingQ.refetch(); void capsQ.refetch(); void methodsQ.refetch(); },
    };
  }, [settingsQ.data, pricingQ.data, capsQ.data, methodsQ.data, pricingQ.isLoading, capsQ.isLoading, methodsQ.isLoading, signedIn, settingsQ, pricingQ, capsQ, methodsQ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConfig(): ConfigValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConfig hors ConfigProvider");
  return v;
}
