import { useContext, useMemo } from "react";
import type { PaymentProvider } from "@app/payments";
import { PaymentProviderContext } from "@/providers/PaymentProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { buildPaymentProvider } from "./provider";

/**
 * Fournisseur de recharge pour les écrans wallet. Utilise celui d'AppProviders s'il est monté, sinon en
 * construit un localement (les fournisseurs sont sans état : l'état StoreKit/Play vit dans l'adaptateur natif).
 */
export function useTopupProvider(): PaymentProvider | null {
  const shared = useContext(PaymentProviderContext);
  const { settings } = useConfig();
  const local = useMemo(() => (shared === undefined ? buildPaymentProvider(settings) : null), [shared, settings]);
  return shared === undefined ? local : shared;
}
