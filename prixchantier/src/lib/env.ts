import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement serveur, validées au premier accès.
 * Aucune de ces valeurs n'est exposée au navigateur (pas de préfixe NEXT_PUBLIC_
 * hormis l'URL Supabase et la clé publishable, publiques par conception).
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  APP_URL: z.url(),
  CRON_SECRET: z.string().min(24),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "doit être 32 octets encodés en base64"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT: z.string().default("common"),
  // Boîte mail de test (tests bout-en-bout). Refusée en production.
  ENABLE_TEST_MAILBOX: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuration serveur invalide — ${fields}`);
  }
  if (parsed.data.ENABLE_TEST_MAILBOX === "1" && process.env.NODE_ENV === "production" && !process.env.E2E) {
    throw new Error("ENABLE_TEST_MAILBOX est interdit en production.");
  }
  cached = parsed.data;
  return cached;
}

export function googleConfigured() {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

export function microsoftConfigured() {
  const e = env();
  return Boolean(e.MICROSOFT_CLIENT_ID && e.MICROSOFT_CLIENT_SECRET);
}

export function testMailboxEnabled() {
  return env().ENABLE_TEST_MAILBOX === "1";
}
