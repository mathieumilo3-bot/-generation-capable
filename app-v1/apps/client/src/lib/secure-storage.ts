import * as SecureStore from "expo-secure-store";

/**
 * Stockage de session (jetons Supabase) dans le Keychain iOS / Keystore Android.
 * SecureStore limite la taille d'une valeur (~2 Ko) : la session est découpée en morceaux.
 */
const CHUNK = 1800;
const countKey = (k: string) => `${k}.n`;
const partKey = (k: string, i: number) => `${k}.${i}`;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(partKey(key, i));
      if (p === null) return null; // état incomplet → session considérée absente
      parts.push(p);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    const old = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    const chunks = value.match(new RegExp(`.{1,${CHUNK}}`, "gs")) ?? [""];
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(partKey(key, i), chunks[i]!);
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    for (let i = chunks.length; i < old; i++) await SecureStore.deleteItemAsync(partKey(key, i));
  },
  async removeItem(key: string): Promise<void> {
    const n = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(partKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
