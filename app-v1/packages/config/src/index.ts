import { z } from "zod";

/**
 * Configuration centrale (§52). Deux sources :
 *  1. `DEFAULT_PUBLIC_SETTINGS` : valeurs de repli embarquées (app utilisable hors-ligne au démarrage).
 *  2. Table serveur `app_settings` (is_public = true) : fait foi dès qu'elle est chargée.
 * Aucune valeur métier (prix, minimums, URLs) ne doit être écrite ailleurs.
 */

export const PlatformSchema = z.enum(["ios", "android", "web"]);
export type Platform = z.infer<typeof PlatformSchema>;

const ProviderCaps = z.object({
  provider: z.enum(["stripe", "apple", "google"]),
  free_amount: z.boolean(),
  auto_reload: z.boolean(),
  saved_cards: z.boolean(),
});
export type ProviderCaps = z.infer<typeof ProviderCaps>;

export const PublicSettingsSchema = z.object({
  "product.name": z.string(),
  "product.support_email": z.string(),
  "urls.terms": z.string(),
  "urls.sales_terms": z.string(),
  "urls.legal_notice": z.string(),
  "urls.privacy": z.string(),
  "urls.support": z.string(),
  "urls.account_deletion": z.string(),
  "urls.manage_data": z.string(),
  "maintenance.enabled": z.boolean(),
  "maintenance.message": z.string(),
  "app.min_version": z.object({ ios: z.string(), android: z.string(), web: z.string() }),
  "wallet.currency": z.literal("EUR"),
  "wallet.min_topup_cents": z.number().int().positive(),
  "wallet.max_topup_cents": z.number().int().positive(),
  "wallet.topup_presets_cents": z.array(z.number().int().positive()),
  "wallet.low_balance_threshold_cents": z.number().int().nonnegative(),
  "payments.auto_reload_enabled": z.boolean(),
  "payments.auto_reload_caps_cents": z.array(z.number().int().positive()),
  "payments.auto_reload_thresholds_cents": z.array(z.number().int().nonnegative()),
  "payments.providers": z.object({ web: ProviderCaps, ios: ProviderCaps, android: ProviderCaps }),
  "payments.store_packs": z.object({
    ios: z.array(z.object({ product_id: z.string(), cents: z.number().int().positive() })),
    android: z.array(z.object({ product_id: z.string(), cents: z.number().int().positive() })),
  }),
  "upload.max_file_bytes": z.number().int().positive(),
  "upload.max_total_bytes": z.number().int().positive(),
  "upload.max_files": z.number().int().positive(),
  "upload.allowed_mime_types": z.array(z.string()),
  "features.voice_instructions": z.boolean(),
  "features.organizations": z.boolean(),
  "features.revisions": z.boolean(),
  "features.password_login": z.boolean(),
  "retention.raw_hours": z.number().int().positive(),
  "retention.renders_hours": z.number().int().positive(),
  "legal.terms_version": z.string(),
  "legal.ai_consent_version": z.string(),
  "legal.ai_providers": z.array(z.string()),
  "features.third_party_ai": z.boolean(),
});
export type PublicSettings = z.infer<typeof PublicSettingsSchema>;

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  "product.name": "Montage",
  "product.support_email": "support@example.com",
  "urls.terms": "https://example.com/conditions",
  "urls.sales_terms": "https://example.com/conditions-de-vente",
  "urls.legal_notice": "https://example.com/mentions-legales",
  "urls.privacy": "https://example.com/confidentialite",
  "urls.support": "https://example.com/aide",
  "urls.account_deletion": "https://example.com/supprimer-mon-compte",
  "urls.manage_data": "https://example.com/mes-donnees",
  "maintenance.enabled": false,
  "maintenance.message": "Maintenance en cours. Vos vidéos et votre solde sont en sécurité.",
  "app.min_version": { ios: "1.0.0", android: "1.0.0", web: "1.0.0" },
  "wallet.currency": "EUR",
  "wallet.min_topup_cents": 1000,
  "wallet.max_topup_cents": 100000,
  "wallet.topup_presets_cents": [1000, 2000, 2500, 5000, 10000, 25000],
  "wallet.low_balance_threshold_cents": 500,
  "payments.auto_reload_enabled": true,
  "payments.auto_reload_caps_cents": [10000, 25000, 50000],
  "payments.auto_reload_thresholds_cents": [500, 1000, 2000],
  "payments.providers": {
    web: { provider: "stripe", free_amount: true, auto_reload: true, saved_cards: true },
    ios: { provider: "apple", free_amount: false, auto_reload: false, saved_cards: false },
    android: { provider: "google", free_amount: false, auto_reload: false, saved_cards: false },
  },
  "payments.store_packs": {
    ios: [
      { product_id: "wallet_topup_10", cents: 1000 },
      { product_id: "wallet_topup_20", cents: 2000 },
      { product_id: "wallet_topup_50", cents: 5000 },
      { product_id: "wallet_topup_100", cents: 10000 },
    ],
    android: [
      { product_id: "wallet_topup_10", cents: 1000 },
      { product_id: "wallet_topup_20", cents: 2000 },
      { product_id: "wallet_topup_50", cents: 5000 },
      { product_id: "wallet_topup_100", cents: 10000 },
    ],
  },
  "upload.max_file_bytes": 2 * 1024 ** 3,
  "upload.max_total_bytes": 8 * 1024 ** 3,
  "upload.max_files": 20,
  "upload.allowed_mime_types": [
    "video/mp4", "video/quicktime", "video/x-m4v", "video/webm",
    "image/jpeg", "image/png", "image/webp", "image/heic",
    "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg", "audio/wav", "audio/webm",
  ],
  "features.voice_instructions": true,
  "features.organizations": false,
  // Modifications désactivées pour le moment ; conservation 24 h maximum ; connexion par mot de passe réservée au compte App Review.
  "features.revisions": false,
  "features.password_login": false,
  "retention.raw_hours": 24,
  "retention.renders_hours": 24,
  "legal.terms_version": "2026-10-06",
  "legal.ai_consent_version": "2026-10-06",
  "legal.ai_providers": ["Anthropic", "Deepgram", "Google"],
  "features.third_party_ai": true,
};

/**
 * Fusionne les lignes `app_settings` sur les défauts. Une clé invalide est
 * ignorée (on garde le défaut) — une mauvaise ligne ne doit jamais empêcher
 * l'app de démarrer. `issues` liste ce qui a été ignoré, pour les logs.
 */
export function parsePublicSettings(rows: ReadonlyArray<{ key: string; value: unknown }>): {
  settings: PublicSettings;
  issues: string[];
} {
  const merged: Record<string, unknown> = { ...DEFAULT_PUBLIC_SETTINGS };
  const issues: string[] = [];
  const shape = PublicSettingsSchema.shape as Record<string, z.ZodType>;
  for (const row of rows) {
    const schema = shape[row.key];
    if (!schema) continue; // clé serveur inconnue de cette version de l'app
    const parsed = schema.safeParse(row.value);
    if (parsed.success) merged[row.key] = parsed.data;
    else issues.push(`${row.key}: valeur invalide ignorée`);
  }
  return { settings: merged as PublicSettings, issues };
}

/** Compare deux versions « x.y.z ». Retourne <0, 0, >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isAppVersionSupported(settings: PublicSettings, platform: Platform, appVersion: string): boolean {
  return compareVersions(appVersion, settings["app.min_version"][platform]) >= 0;
}

/** Variables d'environnement publiques (préfixe EXPO_PUBLIC_ côté app) — aucune clé secrète ici. */
export const ClientEnvSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(10),
  appEnv: z.enum(["development", "staging", "production"]).default("development"),
  webBaseUrl: z.url().optional(),
  stripePublishableKey: z.string().optional(),
  sentryDsn: z.string().optional(),
});
export type ClientEnv = z.infer<typeof ClientEnvSchema>;

export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  const result = ClientEnvSchema.safeParse({
    supabaseUrl: raw.EXPO_PUBLIC_SUPABASE_URL ?? raw.VITE_SUPABASE_URL,
    supabasePublishableKey: raw.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? raw.VITE_SUPABASE_PUBLISHABLE_KEY,
    appEnv: raw.EXPO_PUBLIC_APP_ENV ?? raw.VITE_APP_ENV,
    webBaseUrl: raw.EXPO_PUBLIC_WEB_BASE_URL ?? raw.VITE_WEB_BASE_URL,
    stripePublishableKey: raw.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? raw.VITE_STRIPE_PUBLISHABLE_KEY,
    sentryDsn: raw.EXPO_PUBLIC_SENTRY_DSN ?? raw.VITE_SENTRY_DSN,
  });
  if (!result.success) {
    throw new Error(
      "Configuration d'environnement invalide — voir SETUP_REQUIRED.md : " +
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  return result.data;
}
