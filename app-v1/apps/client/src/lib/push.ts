import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./supabase";
import { routeForNotificationData } from "@/features/notifications/logic";
import { href } from "@/features/common/nav";

/**
 * Notifications push (natif uniquement ; le web les ignore proprement).
 * La permission n'est JAMAIS demandée au démarrage : après la première vidéo lancée (écran de suivi)
 * ou depuis les réglages, via `requestPushPermission()`.
 */
export const pushSupported = Platform.OS !== "web";
export type PushPermission = "granted" | "denied" | "undetermined" | "unsupported";

const DISMISSED_KEY = "push_prompt_dismissed";
const CHANNEL_ID = "default";

if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Vidéos et solde",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#FF3B30",
  });
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return "unsupported";
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? "granted" : p.canAskAgain === false ? "denied" : p.status === "denied" ? "denied" : "undetermined";
  } catch { return "unsupported"; }
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

let registeredThisSession = false;

/** Enregistre le jeton Expo auprès du serveur. Silencieux si impossible (simulateur, projet EAS absent). */
export async function registerPushToken(): Promise<boolean> {
  if (!pushSupported || !Device.isDevice) return false;
  const projectId = easProjectId();
  if (!projectId) return false;
  try {
    await ensureAndroidChannel();
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.notifications.registerPushToken(token.data);
    registeredThisSession = true;
    return true;
  } catch (e) {
    console.warn("[push] enregistrement impossible", (e as { code?: string } | null)?.code ?? "unknown");
    return false;
  }
}

/** À appeler au bon moment (après un geste de l'utilisateur). Retourne l'état final de la permission. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return "unsupported";
  try {
    await ensureAndroidChannel();
    const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    if (res.granted) { await registerPushToken(); return "granted"; }
    return res.canAskAgain === false ? "denied" : "undetermined";
  } catch { return "unsupported"; }
}

/** Vrai si on peut proposer d'activer les notifications (jamais demandé, pas refusé en douceur). */
export async function shouldOfferPush(): Promise<boolean> {
  if ((await getPushPermission()) !== "undetermined") return false;
  try { return (await AsyncStorage.getItem(DISMISSED_KEY)) !== "1"; } catch { return true; }
}

export async function dismissPushOffer(): Promise<void> {
  try { await AsyncStorage.setItem(DISMISSED_KEY, "1"); } catch { /* sans conséquence */ }
}

/**
 * Monté dans les onglets : ré-enregistre le jeton si la permission est déjà accordée
 * (il peut changer) et ouvre la bonne page quand on touche une notification.
 */
export function usePushRegistration(): void {
  const router = useRouter();
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!pushSupported) return;
    let alive = true;
    void (async () => {
      if (!registeredThisSession && (await getPushPermission()) === "granted" && alive) await registerPushToken();
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!pushSupported) return;
    const open = (r: Notifications.NotificationResponse) => {
      const route = routeForNotificationData(r.notification.request.content.data as Record<string, unknown> | undefined);
      if (route) router.push(href(route));
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => { open(r); void Notifications.clearLastNotificationResponseAsync(); });
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      void Notifications.getLastNotificationResponseAsync().then((r) => {
        if (r) { open(r); void Notifications.clearLastNotificationResponseAsync(); }
      }).catch(() => undefined);
    }
    return () => sub.remove();
  }, [router]);
}
