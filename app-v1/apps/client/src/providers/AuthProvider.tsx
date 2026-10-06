import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { api, supabase } from "@/lib/supabase";
import { analytics } from "@/lib/analytics";

type AuthState =
  | { status: "loading"; session: null; user: null }
  | { status: "signedOut"; session: null; user: null }
  | { status: "signedIn"; session: Session; user: User };

interface AuthContextValue {
  state: AuthState;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", session: null, user: null });
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setState(data.session ? { status: "signedIn", session: data.session, user: data.session.user } : { status: "signedOut", session: null, user: null });
      if (data.session) { analytics.setUser(data.session.user.id); void api.account.touch(); }
    });
    const off = api.auth.onChange((event, session) => {
      if (!alive) return;
      if (session) {
        setState({ status: "signedIn", session, user: session.user });
        analytics.setUser(session.user.id);
        if (event === "SIGNED_IN") analytics.track("login_completed", { provider: session.user.app_metadata?.provider ?? "unknown" });
      } else {
        setState({ status: "signedOut", session: null, user: null });
        analytics.setUser(null);
        qc.clear(); // aucune donnée d'un compte ne survit à la déconnexion
      }
    });
    return () => { alive = false; off(); };
  }, [qc]);

  const value = useMemo<AuthContextValue>(() => ({ state, signOut: () => api.auth.signOut() }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth hors AuthProvider");
  return v;
}

/** Utilisateur connecté (à n'utiliser que dans des écrans protégés). */
export function useUserId(): string {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("useUserId : utilisateur non connecté");
  return state.user.id;
}
