import AsyncStorage from "@react-native-async-storage/async-storage";
import { consoleSink, createAnalytics, type AnalyticsSink } from "@app/analytics";
import { env } from "./env";
import { appVersion, platform } from "./platform";

let anonId = "anon";
void AsyncStorage.getItem("anon_id").then(async (v) => {
  if (v) { anonId = v; return; }
  anonId = `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem("anon_id", anonId);
}).catch(() => undefined);

// Aucun tiers requis : en dev on journalise. Brancher un sink (PostHog, Amplitude…) = ajouter ici, rien d'autre.
const sinks: AnalyticsSink[] = env.appEnv === "production" ? [] : [consoleSink];

export const analytics = createAnalytics({
  sinks,
  platform,
  appVersion,
  get anonId() { return anonId; },
});
