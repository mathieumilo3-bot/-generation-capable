import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { createApi } from "@app/api";
import { env } from "./env";
import { appVersion, platform } from "./platform";
import { secureStorage } from "./secure-storage";

/**
 * Client Supabase côté app : UNIQUEMENT la clé publishable (jamais service_role / secret).
 * Session persistante sécurisée, refresh automatique (suspendu quand l'app est en arrière-plan).
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: secureStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    flowType: "pkce",
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (s) => {
    if (s === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

export const api = createApi(supabase, { platform, appVersion });
