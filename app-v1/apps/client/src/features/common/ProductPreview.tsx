import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, colors, radii } from "@app/ui";
import { useReduceMotion } from "./hooks";

/**
 * Aperçu du produit dessiné en composants (aucune image externe) : une vidéo verticale terminée,
 * ses sous-titres, et les deux promesses clés (prête / prix annoncé avant de valider).
 */
export function ProductPreview() {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { t.setValue(1); return; }
    Animated.timing(t, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [reduce, t]);
  const style = { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };

  return (
    <Animated.View style={[styles.stage, style]} accessible accessibilityRole="image"
      accessibilityLabel="Aperçu : une vidéo verticale montée, prête à être téléchargée">
      <View style={styles.phone}>
        <View style={styles.scene}>
          <View style={styles.sun} />
          <View style={styles.hillBack} />
          <View style={styles.hillFront} />
        </View>
        <View style={styles.playWrap}>
          <View style={styles.play}><Ionicons name="play" size={26} color={colors.text} style={{ marginLeft: 3 }} /></View>
        </View>
        <View style={styles.caption}><Text variant="secondary" style={{ color: "#fff", fontWeight: "600" }} maxFontSizeMultiplier={1.1}>Voilà le résultat.</Text></View>
        <View style={styles.timeline}>
          <View style={[styles.clip, { flex: 3 }]} /><View style={[styles.clip, { flex: 2 }]} /><View style={[styles.clip, { flex: 4 }]} /><View style={[styles.clip, { flex: 2 }]} />
        </View>
      </View>

      <View style={[styles.float, styles.floatTop]}>
        <View style={styles.check}><Ionicons name="checkmark" size={14} color="#fff" /></View>
        <Text variant="caption" style={{ fontWeight: "600" }} maxFontSizeMultiplier={1.1}>Votre vidéo est prête</Text>
      </View>
      <View style={[styles.float, styles.floatBottom]}>
        <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
        <Text variant="caption" style={{ fontWeight: "600" }} maxFontSizeMultiplier={1.1}>Prix annoncé avant de valider</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: "center", width: 280, height: 380, alignItems: "center", justifyContent: "center" },
  phone: { width: 200, height: 356, borderRadius: 32, backgroundColor: colors.text, padding: 8, overflow: "hidden" },
  scene: { flex: 1, borderRadius: 26, backgroundColor: "#2C2C2E", overflow: "hidden" },
  sun: { position: "absolute", top: 42, right: 36, width: 44, height: 44, borderRadius: 22, backgroundColor: "#F2F2F7" },
  hillBack: { position: "absolute", bottom: -60, left: -40, width: 240, height: 190, borderRadius: 120, backgroundColor: "#48484A" },
  hillFront: { position: "absolute", bottom: -90, right: -60, width: 250, height: 190, borderRadius: 125, backgroundColor: "#636366" },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  play: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  caption: { position: "absolute", left: 24, right: 24, bottom: 56, borderRadius: radii.sm, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 6, alignItems: "center" },
  timeline: { position: "absolute", left: 20, right: 20, bottom: 24, height: 14, flexDirection: "row", gap: 3 },
  clip: { borderRadius: 4, backgroundColor: "rgba(255,255,255,0.35)" },
  float: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  floatTop: { top: 36, right: -4 },
  floatBottom: { bottom: 4, left: -8 },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
});
