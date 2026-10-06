import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Haptique discrète (§2) : confirmation, paiement réussi, vidéo prête, erreur importante. Jamais décorative. */
let enabled = true;
export const setHapticsEnabled = (v: boolean) => { enabled = v; };
const run = (fn: () => Promise<void>) => { if (enabled && Platform.OS !== "web") void fn().catch(() => undefined); };

export const haptics = {
  tap: () => run(() => Haptics.selectionAsync()),
  confirm: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
