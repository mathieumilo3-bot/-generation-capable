import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { greetingName } from "@app/domain";
import { Card, EmptyState, Notice, Skeleton, Text, colors, radii, spacing } from "@app/ui";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { useProfile } from "@/hooks/data";
import { Page } from "@/features/common/Page";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { href } from "@/features/common/nav";
import { useActiveJobsList, useDrafts, useUnreadCount, useWalletBalance } from "@/features/common/queries";
import { BalanceCard } from "@/features/home/BalanceCard";
import { CreateCta } from "@/features/home/CreateCta";
import { ActiveJobs } from "@/features/home/ActiveJobs";
import { RecentGrid } from "@/features/home/RecentGrid";
import { greetingText, recentProjects, unreadA11y, unreadBadgeLabel, RECENT_COUNT } from "@/features/home/logic";
import { formatRelativeDate, projectTitle, thumbnailPaths } from "@/features/projects/logic";
import { useThumbnailUrls } from "@/features/projects/useThumbnailUrls";
import { useExpiredProjects } from "@/features/projects/useExpiredProjects";

export default function HomeRoute() {
  return <RequireAuth><HomeScreen /></RequireAuth>;
}

function HomeScreen() {
  const router = useRouter();
  const uid = useUserId();
  const { maintenance } = useConfig();
  const profile = useProfile();
  const wallet = useWalletBalance();
  const jobs = useActiveJobsList();
  const unread = useUnreadCount();
  const drafts = useDrafts();
  const recent = useQuery({ queryKey: ["projects", "recent", uid], queryFn: () => api.projects.list({ limit: RECENT_COUNT }) });
  const [refreshing, setRefreshing] = useState(false);

  const recentList = useMemo(() => recentProjects(recent.data ?? []), [recent.data]);
  const expired = useExpiredProjects(recentList);
  const { urls, reset } = useThumbnailUrls(useMemo(() => thumbnailPaths(recentList, expired), [recentList, expired]));

  const refresh = async () => {
    setRefreshing(true);
    reset();
    await Promise.allSettled([wallet.refetch(), jobs.refetch(), unread.refetch(), drafts.refetch(), recent.refetch(), profile.refetch()]);
    setRefreshing(false);
  };

  const activeJobs = jobs.data ?? [];
  const draft = drafts.data?.[0];
  const unreadCount = unread.data ?? 0;
  const badge = unreadBadgeLabel(unreadCount);
  const isEmpty = !recent.isLoading && recentList.length === 0 && activeJobs.length === 0 && !draft;
  const name = greetingName(profile.data ?? {});

  return (
    <Page onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={styles.header}>
        <Text variant="largeTitle" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={2}>{greetingText(name)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={unreadA11y(unreadCount)} onPress={() => router.push(href("/notifications"))}
          style={({ pressed }) => [styles.bell, pressed && { backgroundColor: colors.border }]}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {badge ? <View style={styles.badge}><Text variant="caption" style={styles.badgeText} maxFontSizeMultiplier={1}>{badge}</Text></View> : null}
        </Pressable>
      </View>

      {maintenance.enabled ? <Notice tone="warning" icon="construct-outline" title="Maintenance en cours" body={maintenance.message} /> : null}

      <BalanceCard
        availableCents={wallet.data?.available_cents ?? null}
        loading={wallet.isLoading}
        failed={wallet.isError}
        onRetry={() => void wallet.refetch()}
        onAdd={() => router.push(href("/account/topup"))}
      />

      <CreateCta onPress={() => router.push(href("/create"))} />

      {draft ? (
        <Card tone="outline" onPress={() => router.push(href(`/create?projectId=${draft.id}`))} accessibilityLabel={`Reprendre le brouillon ${projectTitle(draft)}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Ionicons name="create-outline" size={24} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Reprendre le brouillon</Text>
              <Text variant="secondary" color="textSecondary" numberOfLines={1}>{projectTitle(draft)} · {formatRelativeDate(draft.created_at)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
          </View>
        </Card>
      ) : null}

      <ActiveJobs jobs={activeJobs} onOpen={(job) => router.push(href(`/processing/${job.id}`))} />

      {recent.isLoading ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="section" accessibilityRole="header">Récentes</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1 }}><Skeleton height={140} radius={radii.md} /></View>)}
          </View>
        </View>
      ) : recentList.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="section" accessibilityRole="header">Récentes</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Voir tous les projets" onPress={() => router.push(href("/projects"))}
              style={{ minHeight: 48, justifyContent: "center", paddingLeft: spacing.md }}>
              <Text variant="secondary" style={{ color: colors.accentPressed, fontWeight: "600" }}>Voir tous les projets</Text>
            </Pressable>
          </View>
          <RecentGrid projects={recentList} thumbs={urls} expired={expired} onOpen={(p) => router.push(href(`/project/${p.id}`))} />
        </View>
      ) : recent.isError ? (
        <Notice tone="error" icon="alert-circle-outline" title="Vos vidéos n'ont pas pu être chargées." body="Elles sont en sécurité. Tirez vers le bas pour réessayer." />
      ) : null}

      {isEmpty ? (
        <EmptyState icon="film-outline" title="Aucune vidéo pour le moment." body="Votre première vidéo prendra quelques minutes." actionLabel="Créer ma première vidéo" onAction={() => router.push(href("/create"))} />
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingTop: spacing.lg },
  bell: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginTop: 2 },
  badge: { position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.onAccent, fontSize: 11, lineHeight: 14, fontWeight: "700" },
});
