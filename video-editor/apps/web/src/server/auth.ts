import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "video-editor-user-id";
const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 jours

/**
 * Récupère l'ID utilisateur actuel depuis la session.
 * Retourne null si pas authentifié.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

/**
 * Crée une nouvelle session utilisateur avec un ID unique.
 */
export async function createUserSession(): Promise<string> {
  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, userId, {
    maxAge: AUTH_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  return userId;
}

/**
 * Logout: supprime la session utilisateur.
 */
export async function deleteUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}
