import type { AdminDb } from "./db";
import { asRecord, str } from "../lib/decode";

export type StaffRole = "support" | "admin";

/** Surface minimale de supabase.auth utilisée par la connexion. */
export interface OtpAuthApi {
  signInWithOtp(args: { email: string; options: { shouldCreateUser: boolean } }): Promise<{ error: unknown }>;
  verifyOtp(args: { email: string; token: string; type: "email" }): Promise<{ error: unknown }>;
  signOut(): Promise<{ error: unknown }>;
}

/** Envoie le code à 6 chiffres. `shouldCreateUser:false` : seuls les comptes existants peuvent se connecter. */
export async function requestOtp(auth: OtpAuthApi, email: string): Promise<void> {
  const { error } = await auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function confirmOtp(auth: OtpAuthApi, email: string, code: string): Promise<void> {
  const { error } = await auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
  if (error) throw error;
}

export function decodeStaffRole(row: unknown): StaffRole | null {
  const role = str(asRecord(row).role);
  return role === "admin" || role === "support" ? role : null;
}

/**
 * Rôle de l'utilisateur courant (RLS : chacun ne lit que sa propre ligne de staff_roles).
 * Ce n'est qu'un reflet pour l'interface : l'autorisation réelle est vérifiée par chaque RPC.
 */
export async function fetchStaffRole(db: AdminDb, userId: string): Promise<StaffRole | null> {
  const res = await db.select({ table: "staff_roles", columns: "user_id,role", eq: { user_id: userId }, limit: 1 });
  return decodeStaffRole(res.rows[0]);
}

export function canWrite(role: StaffRole | null): boolean {
  return role === "admin";
}
