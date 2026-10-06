import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { isOpenableUrl } from "./logic";

/** Ouvre un document juridique : navigateur intégré sur mobile, nouvel onglet sur le web. Échec silencieux. */
export async function openLink(url: string | null | undefined): Promise<void> {
  if (!isOpenableUrl(url)) return;
  try {
    await WebBrowser.openBrowserAsync(url.trim());
  } catch {
    try { await Linking.openURL(url.trim()); } catch { /* rien d'autre à faire */ }
  }
}
