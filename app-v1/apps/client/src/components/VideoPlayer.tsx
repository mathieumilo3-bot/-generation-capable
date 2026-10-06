import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { Button, Text, radii, spacing } from "@app/ui";

/**
 * Lecteur de la vidéo finale. L'URL signée est fournie par l'écran (jamais de fichier public).
 * Contrôles natifs (lecture, plein écran, volume) : rien à réinventer, accessibles par défaut.
 */
export function VideoPlayer({ uri, aspectRatio = 9 / 16, width, onPlay, onRetry }: {
  uri: string | null; aspectRatio?: number; width?: number; onPlay?: () => void; onRetry?: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const statusSub = player.addListener("statusChange", ({ status }) => { setFailed(status === "error"); });
    const playSub = player.addListener("playingChange", ({ isPlaying }) => { if (isPlaying) onPlay?.(); });
    return () => { statusSub.remove(); playSub.remove(); };
  }, [player, onPlay]);

  return (
    <View style={[styles.frame, { aspectRatio }, width ? { width } : null]}>
      {uri ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain"
          accessibilityLabel="Lecteur de votre vidéo" />
      ) : (
        <View style={styles.center}><Ionicons name="film-outline" size={36} color="#8E8E93" /></View>
      )}
      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.errorLayer]}>
          <Text variant="bodyStrong" style={{ color: "#fff" }} align="center">La lecture n'a pas pu démarrer.</Text>
          <Text variant="secondary" style={{ color: "#D1D1D6" }} align="center">Votre vidéo est en sécurité.</Text>
          {onRetry ? <Button label="Réessayer" variant="secondary" size="small" fullWidth={false} style={{ alignSelf: "center" }} onPress={onRetry} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", alignSelf: "center", backgroundColor: "#000", borderRadius: radii.xl, overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  errorLayer: { backgroundColor: "rgba(0,0,0,0.7)" },
});
