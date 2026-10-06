import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Button, Notice, Screen, Skeleton, Text } from "@app/ui";
import { useAuth } from "@/providers/AuthProvider";
import { href } from "@/features/common/nav";
import { completeAuthFromUrl, finalizeOAuthSession } from "@/features/auth/oauth";
import { authErrorKind, describeAuthError, hasCallbackPayload, parseAuthCallbackUrl } from "@/features/auth/logic";

/**
 * Retour d'authentification (OAuth Google/Apple, liens e-mail) : PKCE `?code=` ou jetons dans la query/le fragment.
 * Web : lit `window.location` ; natif : l'URL reçue par le lien profond.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { state } = useAuth();
  const linkingUrl = Linking.useLinkingURL();
  const started = useRef(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  useEffect(() => {
    if (started.current) return;
    const url = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : linkingUrl;
    if (!url) return;
    started.current = true;
    if (!hasCallbackPayload(parseAuthCallbackUrl(url))) { setError({ title: "Ce lien n'est plus valide.", detail: "Reprenez la connexion depuis le début." }); return; }
    completeAuthFromUrl(url)
      .then(async (session) => { await finalizeOAuthSession(session); })
      .catch((e: unknown) => {
        if (authErrorKind(e) === "cancelled") { router.replace(href("/sign-in")); return; }
        setError(describeAuthError(e));
      });
  }, [linkingUrl, router]);

  if (state.status === "signedIn") return <Redirect href={href("/(tabs)")} />;

  return (
    <Screen scroll={false}>
      <View style={{ gap: 20, paddingTop: 80 }}>
        {error ? (
          <>
            <Text variant="title" accessibilityRole="header">Connexion impossible</Text>
            <Notice tone="error" icon="alert-circle-outline" title={error.title} body={error.detail} />
            <Button label="Revenir à la connexion" onPress={() => router.replace(href("/sign-in"))} />
          </>
        ) : (
          <View style={{ gap: 14 }} accessibilityRole="progressbar" accessibilityLabel="Connexion en cours">
            <Text variant="title">Connexion en cours…</Text>
            <Skeleton height={16} width="70%" />
            <Skeleton height={16} width="50%" />
          </View>
        )}
      </View>
    </Screen>
  );
}
