import AsyncStorage from "@react-native-async-storage/async-storage";
import { PENDING_TOPUP_KEY, parsePendingTopup, type PendingTopup } from "./logic";

/** Mémorise la destination de retour avant une redirection vers la page de paiement hébergée. */
export async function savePendingTopup(p: PendingTopup): Promise<void> {
  try { await AsyncStorage.setItem(PENDING_TOPUP_KEY, JSON.stringify(p)); } catch { /* le retour manuel reste possible */ }
}

export async function readPendingTopup(): Promise<PendingTopup | null> {
  try { return parsePendingTopup(await AsyncStorage.getItem(PENDING_TOPUP_KEY)); } catch { return null; }
}

export async function clearPendingTopup(): Promise<void> {
  try { await AsyncStorage.removeItem(PENDING_TOPUP_KEY); } catch { /* sans importance */ }
}
