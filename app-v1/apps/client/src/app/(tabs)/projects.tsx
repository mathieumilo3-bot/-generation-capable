import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProjectRow } from "@app/api";
import { Button, Chip, EmptyState, Input, Skeleton, Text, colors, radii, spacing } from "@app/ui";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";
import { ProjectCard } from "@/components/ProjectCard";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { ErrorNotice, codeOfThrown, errorFromCode } from "@/features/common/ErrorView";
import { useDebounced } from "@/features/common/hooks";
import { href } from "@/features/common/nav";
import { PAGE_SIZE, PROJECT_FILTERS, SEARCH_DEBOUNCE_MS, columnsForWidth, nextCursor, padGrid, thumbnailPaths, type ProjectFilter } from "@/features/projects/logic";
import { useThumbnailUrls } from "@/features/projects/useThumbnailUrls";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_WIDTH = 720;

export default function ProjectsRoute() {
  return <RequireAuth><ProjectsScreen /></RequireAuth>;
}

function ProjectsScreen() {
  const router = useRouter();
  const uid = useUserId();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(Math.min(width, MAX_WIDTH));
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), SEARCH_DEBOUNCE_MS);

  const q = useInfiniteQuery({
    queryKey: ["projects", "list", uid, filter, search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.projects.list({ filter, search, limit: PAGE_SIZE, before: pageParam }),
    getNextPageParam: (last) => nextCursor(last),
  });

  const items = useMemo(() => q.data?.pages.flat() ?? [], [q.data]);
  const { urls, reset } = useThumbnailUrls(useMemo(() => thumbnailPaths(items), [items]));
  const data = useMemo(() => padGrid(items, columns), [items, columns]);

  const refresh = useCallback(() => { reset(); void q.refetch(); }, [q, reset]);
  const open = useCallback((p: ProjectRow) => router.push(href(`/project/${p.id}`)), [router]);

  const header = (
    <View style={styles.header}>
      <Text variant="largeTitle" accessibilityRole="header">Mes vidéos</Text>
      <Input
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Rechercher une vidéo"
        accessibilityLabel="Rechercher une vidéo"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        inputMode="search"
      />
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }} accessibilityRole="tablist">
        {PROJECT_FILTERS.map((f) => <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </View>
    </View>
  );

  const empty = q.isLoading ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
      {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: `${100 / columns - 4}%` }}><Skeleton height={190} radius={radii.md} /></View>)}
    </View>
  ) : q.isError ? (
    <ErrorNotice error={errorFromCode(codeOfThrown(q.error))} onAction={() => void q.refetch()} fallbackAction />
  ) : search ? (
    <EmptyState icon="search-outline" title="Aucun résultat." body="Essayez un autre mot." />
  ) : filter === "active" ? (
    <EmptyState icon="hourglass-outline" title="Aucune vidéo en cours." body="Vos créations en cours apparaissent ici." />
  ) : filter === "done" ? (
    <EmptyState icon="checkmark-circle-outline" title="Aucune vidéo terminée." body="Vos vidéos prêtes apparaissent ici." />
  ) : (
    <EmptyState icon="film-outline" title="Aucune vidéo pour le moment." actionLabel="Créer ma première vidéo" onAction={() => router.push(href("/create"))} />
  );

  const footer = q.isFetchingNextPage ? (
    <View style={{ paddingVertical: spacing.xl }}><ActivityIndicator color={colors.accent} accessibilityLabel="Chargement" /></View>
  ) : q.isFetchNextPageError ? (
    <View style={{ paddingVertical: spacing.lg }}><Button label="Afficher plus de vidéos" variant="secondary" onPress={() => void q.fetchNextPage()} /></View>
  ) : null;

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === "web" ? spacing.lg : insets.top }]}>
      <FlatList
        key={columns}
        data={data}
        numColumns={columns}
        keyExtractor={(p, i) => p?.id ?? `s${i}`}
        renderItem={({ item }) => item ? (
          <View style={styles.cell}>
            <ProjectCard project={item} thumbnailUrl={item.thumbnail_path ? urls[item.thumbnail_path] : null} onPress={() => open(item)} />
          </View>
        ) : <View style={styles.cell} />}
        columnWrapperStyle={{ gap: spacing.md }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={[styles.content, { maxWidth: MAX_WIDTH, paddingBottom: spacing.huge }]}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage(); }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", alignSelf: "center", paddingHorizontal: spacing.xl },
  header: { gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  cell: { flex: 1, marginBottom: spacing.xl },
});
