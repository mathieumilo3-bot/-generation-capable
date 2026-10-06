import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { canWrite, confirmOtp, fetchStaffRole, requestOtp, type StaffRole } from "../data/auth";
import { useBackend } from "./backend";

interface SessionUser { userId: string; email: string }

export type AuthState =
  | { status: "loading" }
  | { status: "signed_out"; denied: boolean }
  | { status: "error"; email: string }
  | { status: "ready"; userId: string; email: string; role: StaffRole };

interface AuthContextValue {
  state: AuthState;
  /** Envoie le code (ne révèle pas si l'adresse existe : voir la page de connexion). */
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryRole: () => void;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { client, db } = useBackend();
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);
  const [role, setRole] = useState<{ userId: string; role: StaffRole } | null>(null);
  const [denied, setDenied] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user;
      setSession(u ? { userId: u.id, email: u.email ?? "" } : null);
    });
    // Callback synchrone uniquement : aucun appel Supabase à l'intérieur (risque de blocage).
    const { data: sub } = client.auth.onAuthStateChange((_event, s) => {
      const u = s?.user;
      setSession(u ? { userId: u.id, email: u.email ?? "" } : null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const userId = session?.userId ?? null;
  useEffect(() => {
    if (!userId) {
      setRole(null);
      setRoleError(false);
      return;
    }
    let active = true;
    setRoleError(false);
    fetchStaffRole(db, userId).then(
      (r) => {
        if (!active) return;
        if (r === null) {
          // Connecté mais sans rôle staff : « Accès réservé » + déconnexion immédiate.
          setDenied(true);
          setRole(null);
          void client.auth.signOut();
        } else {
          setDenied(false);
          setRole({ userId, role: r });
        }
      },
      () => {
        if (active) setRoleError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [userId, db, client, attempt]);

  const sendCode = useCallback(async (email: string) => {
    setDenied(false);
    await requestOtp(client.auth, email);
  }, [client]);

  const verifyCode = useCallback(async (email: string, code: string) => {
    await confirmOtp(client.auth, email, code);
  }, [client]);

  const signOut = useCallback(async () => {
    await client.auth.signOut();
    setRole(null);
  }, [client]);

  const retryRole = useCallback(() => setAttempt((a) => a + 1), []);

  const state: AuthState = useMemo(() => {
    if (session === undefined) return { status: "loading" };
    if (session === null) return { status: "signed_out", denied };
    if (roleError) return { status: "error", email: session.email };
    if (role && role.userId === session.userId) return { status: "ready", userId: session.userId, email: session.email, role: role.role };
    return denied ? { status: "signed_out", denied: true } : { status: "loading" };
  }, [session, role, denied, roleError]);

  const value = useMemo(() => ({ state, sendCode, verifyCode, signOut, retryRole }), [state, sendCode, verifyCode, signOut, retryRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider manquant");
  return v;
}

/** Rôle de la session courante (uniquement sous <RequireStaff>). */
export function useStaff(): { userId: string; email: string; role: StaffRole; canWrite: boolean } {
  const { state } = useAuth();
  if (state.status !== "ready") throw new Error("Session staff requise");
  return { userId: state.userId, email: state.email, role: state.role, canWrite: canWrite(state.role) };
}
