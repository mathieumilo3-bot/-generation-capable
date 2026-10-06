#!/usr/bin/env node
/**
 * Crée (ou met à jour) le compte de démonstration pour App Review / Play Review :
 *   - utilisateur e-mail confirmé AVEC mot de passe (le reviewer ne peut pas recevoir de code par e-mail) ;
 *   - solde offert (idempotent) pour pouvoir lancer une vidéo ;
 *   - consentements déjà donnés (conditions + IA) pour un parcours sans blocage.
 * Usage :
 *   SUPABASE_URL=… SB_SECRET_KEY=… node scripts/create-review-account.mjs [email] [crédit_en_centimes]
 * Affiche l'e-mail et le mot de passe à coller dans App Store Connect (« Informations de connexion »).
 * ENSUITE : activer le réglage `features.password_login` (back-office → Réglages) pendant la review, puis le REMETTRE à false.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.SUPABASE_URL, key = process.env.SB_SECRET_KEY;
if (!url || !key) { console.error("SUPABASE_URL et SB_SECRET_KEY (clé secrète) sont requis."); process.exit(1); }
const email = (process.argv[2] ?? process.env.REVIEW_EMAIL ?? "review@example.com").toLowerCase();
const credit = Number(process.argv[3] ?? 2000);
const password = process.env.REVIEW_PASSWORD ?? randomBytes(15).toString("base64url");

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(`${fn}: ${error.message}`); return data; };

let userId;
const { data: created, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { given_name: "Reviewer" } });
if (error) {
  if (!/already|exists|registered/i.test(error.message)) throw error;
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) throw new Error("Utilisateur existant introuvable");
  await sb.auth.admin.updateUserById(userId, { password, email_confirm: true });
} else userId = created.user.id;

const { data: wallet } = await sb.from("wallets").select("id").eq("user_id", userId).single();
await rpc("svc_grant_credit", { p_wallet_id: wallet.id, p_amount_cents: credit, p_reason: "Compte de test App Review", p_idempotency_key: `review-${userId}` });
const { data: settings } = await sb.from("app_settings").select("key,value").in("key", ["legal.terms_version", "legal.ai_consent_version"]);
const v = Object.fromEntries(settings.map((s) => [s.key, s.value]));
await sb.from("profiles").update({ terms_version: v["legal.terms_version"], terms_accepted_at: new Date().toISOString(), ai_consent_version: v["legal.ai_consent_version"], ai_consent_at: new Date().toISOString() }).eq("id", userId);

console.log("✓ Compte de test prêt\n  E-mail      :", email, "\n  Mot de passe:", password, `\n  Solde offert: ${(credit / 100).toFixed(2)} €\n\nÀ FAIRE : activer features.password_login pendant la review, puis le remettre à false.`);
