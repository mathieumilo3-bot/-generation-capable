import React, { createContext, useContext, useMemo } from "react";
import type { PaymentProvider } from "@app/payments";
import { useConfig } from "./ConfigProvider";
import { buildPaymentProvider } from "@/features/wallet/provider";

export const PaymentProviderContext = createContext<PaymentProvider | null | undefined>(undefined);

/**
 * Expose le PaymentProvider du build (Stripe / Apple / Google selon la matrice serveur).
 * À monter dans AppProviders, À L'INTÉRIEUR de <ConfigProvider> :
 *   <ConfigProvider><PaymentProviderRoot>{children}</PaymentProviderRoot></ConfigProvider>
 */
export function PaymentProviderRoot({ children }: { children: React.ReactNode }) {
  const { settings } = useConfig();
  const provider = useMemo(() => buildPaymentProvider(settings), [settings]);
  return <PaymentProviderContext.Provider value={provider}>{children}</PaymentProviderContext.Provider>;
}

/** `undefined` = non monté (les écrans wallet se rabattent alors sur `useTopupProvider`). */
export function usePaymentProvider(): PaymentProvider | null {
  const v = useContext(PaymentProviderContext);
  if (v === undefined) throw new Error("usePaymentProvider hors PaymentProviderRoot");
  return v;
}
