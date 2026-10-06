import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "@app/ui";

/**
 * Miniature d'un projet. Sans image (pas encore générée, URL expirée) : aplat neutre avec une icône,
 * jamais un cadre vide ni une image cassée. Décorative : le titre est porté par la carte.
 */
export function Thumbnail({ url, aspectRatio = 3 / 4, radius = radii.md, processing, style }: {
  url?: string | null; aspectRatio?: number; radius?: number; processing?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!url && !failed;
  return (
    <View style={[styles.box, { aspectRatio, borderRadius: radius }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {showImage ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} onError={() => setFailed(true)} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name={processing ? "hourglass-outline" : "film-outline"} size={28} color={colors.disabled} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", backgroundColor: colors.surface, overflow: "hidden" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
