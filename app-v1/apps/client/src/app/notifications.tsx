import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import type { NotificationRow } from "@app/api";
import { Button, EmptyState, Screen, Skeleton, Text, colors, radii, spacing } from "@app/ui";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { BackButton } from "@/features/common/BackButton";
import { ErrorNotice, codeOfThrown, errorFromCode } from "@/features/common/ErrorView";
import { href } from "@/features/common/nav";
import { useNotificationList } from "@/features/common/queries";
import { formatNotificationTime, routeForNotificationData } from "@/features/notifications/logic";

const ICON: Record<NotificationRow["kind"], keyof typeof Ionicons.glyphMap> = {
  video_ready: "checkmark-circle-outline", revision_ready: "checkmark-circle-outline", job_failed: "alert-circle-outline",
  low_balance: "wallet-outline", topup_done: "wallet-outline", payment_failed: "card-outline", info: "information-circle-outline",
};

export default function NotificationsRoute() {
  return <RequireAuth><NotificationsScreen /></RequireAuth>;
}

function NotificationsScreen() {
  const router = useRouter();
  const uid = useUserId();
  const qc = useQueryClient();
  const list = useNotificationList();
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read_at);

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.notifications.markRead(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", uid] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread", uid] });
    },
  });

  const open = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate([n.id]);
    const route = routeForNotificationData(n.data);
    if (route) router.push(href(route));
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        <View style={styles.top}>
          <BackButton fallback="/(tabs)" />
          {unread.length > 0 ? (
            <Button label="Tout marquer comme lu" variant="ghost" size="small" fullWidth={false} loading={markRead.isPending} onPress={() => markRead.mutate(undefined)} />
          ) : null}
        </View>
        <Text variant="largeTitle" accessibilityRole="header">Notifications</Text>

        {list.isLoading ? (
          <View style={{ gap: spacing.md }}><Skeleton height={72} radius={radii.lg} /><Skeleton height={72} radius={radii.lg} /><Skeleton height={72} radius={radii.lg} /></View>
        ) : list.isError ? (
          <ErrorNotice error={errorFromCode(codeOfThrown(list.error))} onAction={() => void list.refetch()} fallbackAction />
        ) : items.length === 0 ? (
          <EmptyState icon="notifications-outline" title="Aucune notification." body="Nous vous prévenons ici dès qu'une vidéo est prête." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {items.map((n) => (
              <Pressable key={n.id} accessibilityRole="button" onPress={() => open(n)}
                accessibilityLabel={`${n.title}. ${n.body}. ${formatNotificationTime(n.created_at)}${n.read_at ? "" : ". Non lue"}`}
                style={({ pressed }) => [styles.row, !n.read_at && styles.rowUnread, pressed && { opacity: 0.85 }]}>
                <Ionicons name={ICON[n.kind] ?? "information-circle-outline"} size={24} color={n.kind === "job_failed" || n.kind === "payment_failed" ? colors.accentPressed : colors.textSecondary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{n.title}</Text>
                  {n.body ? <Text variant="secondary" color="textSecondary">{n.body}</Text> : null}
                  <Text variant="caption" color="textSecondary">{formatNotificationTime(n.created_at)}</Text>
                </View>
                {!n.read_at ? <View style={styles.dot} accessibilityElementsHidden /> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, minHeight: 64, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface },
  rowUnread: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 },
});
