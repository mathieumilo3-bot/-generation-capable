import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";

/** Point d'entrée : connecté → accueil ; sinon → présentation (écran de bienvenue). */
export default function Index() {
  const { state } = useAuth();
  if (state.status === "loading") return null;
  return <Redirect href={state.status === "signedIn" ? "/(tabs)" : "/welcome"} />;
}
