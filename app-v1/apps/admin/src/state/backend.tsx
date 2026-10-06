import { createContext, useContext, type ReactNode } from "react";
import type { Backend } from "../data/client";
import type { AdminEnv } from "../env";

interface BackendContextValue extends Backend {
  env: AdminEnv;
}

const Ctx = createContext<BackendContextValue | null>(null);

export function BackendProvider({ value, children }: { value: BackendContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBackend(): BackendContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("BackendProvider manquant");
  return v;
}
