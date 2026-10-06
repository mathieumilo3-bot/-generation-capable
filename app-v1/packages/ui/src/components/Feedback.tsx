import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../tokens";
import { Text } from "./Text";
import { Button } from "./Button";

export type Tone = "progress" | "success" | "error" | "neutral" | "warning";

/** Pastille de statut. Toujours un libellé texte (jamais la couleur seule). */
export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const bg = tone === "success" ? colors.successTint : tone === "error" ? colors.accentTint : tone === "warning" ? colors.warningTint : tone === "progress" ? colors.surface : colors.surface;
  const fg = tone === "success" ? "#1E7B3A" : tone === "error" ? colors.accentPressed : tone === "warning" ? "#9A5B00" : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: fg, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/** Barre de progression RÉELLE (valeur 0..1) ; sans valeur : état indéterminé sobre (pas de faux pourcentage). */
export function ProgressBar({ value, label }: { value: number | null; label?: string }) {
  const anim = useRef(new Animated.Value(value ?? 0)).current;
  useEffect(() => {
    if (value === null) return;
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, value)), duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [value, anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={value === null ? undefined : { min: 0, max: 100, now: Math.round(value * 100) }} style={styles.track}>
      {value === null ? <IndeterminateFill /> : <Animated.View style={[styles.fill, { width }]} />}
    </View>
  );
}

function IndeterminateFill() {
  const x = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = React.useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduce); }, []);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [x, reduce]);
  const left = x.interpolate({ inputRange: [0, 1], outputRange: ["-30%", "100%"] });
  return <Animated.View style={[styles.fill, { width: reduce ? "40%" : "30%", left: reduce ? "0%" : left }]} />;
}

export interface StepItem { key: string; label: string; state: "done" | "active" | "todo" }

/** Étapes humaines du traitement : Préparation → Analyse → Création du montage → Finalisation → Contrôle qualité. */
export function StepList({ steps }: { steps: StepItem[] }) {
  return (
    <View style={{ gap: spacing.md }} accessibilityRole="list">
      {steps.map((s) => (
        <View key={s.key} style={styles.stepRow} accessible accessibilityLabel={`${s.label} : ${s.state === "done" ? "terminé" : s.state === "active" ? "en cours" : "à venir"}`}>
          <View style={[styles.dot, s.state === "done" && { backgroundColor: colors.success }, s.state === "active" && { backgroundColor: colors.accent }]}>
            {s.state === "done" ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <Text variant="body" color={s.state === "todo" ? "textSecondary" : "text"} style={s.state === "active" ? { fontWeight: "600" } : undefined}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Bandeau d'information : explique, rassure, propose une action. */
export function Notice({ tone = "neutral", title, body, actionLabel, onAction, icon }: {
  tone?: "neutral" | "success" | "warning" | "error"; title: string; body?: string | null; actionLabel?: string | null; onAction?: () => void; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const bg = tone === "success" ? colors.successTint : tone === "warning" ? colors.warningTint : tone === "error" ? colors.accentTint : colors.surface;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        {icon ? <Ionicons name={icon} size={22} color={tone === "error" ? colors.accentPressed : colors.textSecondary} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong">{title}</Text>
          {body ? <Text variant="secondary" color="textSecondary">{body}</Text> : null}
        </View>
      </View>
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" size="small" onPress={onAction} fullWidth={false} /> : null}
    </View>
  );
}

/** État vide : jamais un écran blanc (§42). */
export function EmptyState({ icon = "film-outline", title, body, actionLabel, onAction }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.textSecondary} /></View>
      <Text variant="section" align="center">{title}</Text>
      {body ? <Text variant="body" color="textSecondary" align="center">{body}</Text> : null}
      {actionLabel && onAction ? <View style={{ alignSelf: "stretch", marginTop: spacing.md }}><Button label={actionLabel} onPress={onAction} /></View> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = "100%", radius = 8 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [o]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, width, borderRadius: radius, backgroundColor: colors.surface, opacity: o }} />;
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  track: { height: 8, borderRadius: radii.pill, backgroundColor: colors.surface, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: radii.pill, backgroundColor: colors.accent },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  notice: { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.huge, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
