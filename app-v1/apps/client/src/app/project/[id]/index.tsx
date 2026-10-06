import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, Notice, Screen, Skeleton, Text, colors, haptics, radii } from "@app/ui";
import { api } from "@/lib/supabase";
import { analytics } from "@/lib/analytics";
import { useConfig } from "@/providers/ConfigProvider";
import { VideoPlayer } from "@/components/VideoPlayer";
import { BackButton } from "@/features/common/BackButton";
import { ErrorNotice, codeOfThrown, errorFromCode } from "@/features/common/ErrorView";
import { RequireAuth } from "@/features/common/RequireAuth";
import { href } from "@/features/common/nav";
import { useNow } from "@/features/common/hooks";
import { projectTitle } from "@/features/projects/logic";
import { downloadVideo, shareVideo } from "@/features/result/actions";
import { ProjectMenu } from "@/features/result/ProjectMenu";
import { JobProgressCard, RushList, VersionList } from "@/features/result/Panels";
import { ExpiryBanner } from "@/features/result/ExpiryBanner";
import { canOfferRevision, revisionsEnabled, showVersionList } from "@/features/result/flags";
import { activeJobOf, downloadFileName, failedJobOf, playerAspect, resolveVersion, versionLabel } from "@/features/result/logic";
import { EXPIRED_TITLE, expiredBody, expiryBannerText, retentionHours, versionAvailability } from "@/features/retention/logic";

type Flash = { tone: "success" | "error"; text: string } | null;

export default function ProjectRoute() {
  return <RequireAuth><ProjectScreen /></RequireAuth>;
}

function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" ? id : "";
  const router = useRouter();
  const { capabilities, settings } = useConfig();
  const now = useNow();
  const { width, height } = useWindowDimensions();

  const q = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => (query.state.data && activeJobOf(query.state.data.jobs) ? 6_000 : false),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const played = useRef(new Set<string>());

  const show = useCallback((m: Flash) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(m);
    if (m) flashTimer.current = setTimeout(() => setFlash(null), 6_000);
  }, []);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const data = q.data;
  // Version affichée : lisible d'abord ; sinon, s'il n'en reste qu'une supprimée (conservation limitée), l'état « n'est plus disponible ».
  const resolved = useMemo(() => (data ? resolveVersion(data.project, data.versions, selectedId, now) : null), [data, selectedId, now]);
  const version = resolved?.version ?? null;
  const expired = resolved?.expired ?? false;

  // Aucune URL signée pour une vidéo supprimée.
  const renderPath = expired ? null : version?.render_path ?? null;
  const urlQ = useQuery({
    queryKey: ["render-url", version?.id, renderPath],
    enabled: !!renderPath,
    staleTime: 50 * 60_000,
    queryFn: () => api.projects.signedUrl("renders", renderPath ?? "", { expiresIn: 3600 }),
  });

  const run = async (kind: "download" | "share", fn: () => Promise<{ message: string; kind: string }>) => {
    if (busy) return;
    setBusy(kind);
    show(null);
    try {
      const r = await fn();
      if (r.kind !== "cancelled") { haptics.success(); show({ tone: "success", text: r.message }); }
    } catch (e) {
      haptics.error();
      const h = errorFromCode(codeOfThrown(e));
      show({ tone: "error", text: `${h.title} ${h.detail}` });
    } finally {
      setBusy(null);
    }
  };

  const header = (project: { title: string } | null, versionNumber: number | null, menu: React.ReactNode) => (
    <View style={styles.top}>
      <BackButton fallback="/projects" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="section" numberOfLines={1} accessibilityRole="header" align="center">{project ? projectTitle(project) : ""}</Text>
        {versionNumber ? <Text variant="caption" color="textSecondary" align="center">{versionLabel(versionNumber)}</Text> : null}
      </View>
      <View style={{ width: 48, alignItems: "flex-end" }}>{menu}</View>
    </View>
  );

  if (!projectId || q.isError) {
    return (
      <Screen>
        {header(null, null, null)}
        {q.isError ? <ErrorNotice error={errorFromCode(codeOfThrown(q.error))} onAction={() => void q.refetch()} fallbackAction /> : null}
        <EmptyState icon="film-outline" title="Cette vidéo est introuvable." body="Elle a peut-être été supprimée. Vos autres vidéos sont en sécurité." actionLabel="Voir mes vidéos" onAction={() => router.replace(href("/projects"))} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        {header(null, null, null)}
        <Skeleton height={380} radius={radii.xl} />
        <Skeleton height={56} radius={radii.lg} />
      </Screen>
    );
  }

  const { project, versions, assets, jobs } = data;
  const activeJob = activeJobOf(jobs);
  const failedJob = failedJobOf(jobs, versions);
  const aspect = playerAspect(version);
  const available = Math.min(width, 560) - 40;
  const playerWidth = Math.max(160, Math.min(available, height * 0.6 * aspect));
  const revisionsOn = revisionsEnabled(settings);
  const canRevise = canOfferRevision({ settingEnabled: revisionsOn, engineEnabled: capabilities.revisions.enabled, hasPlayableVersion: !!version && !expired, hasActiveJob: !!activeJob });
  const availability = version && !expired ? versionAvailability(version, now) : null;
  const expiring = availability === "expiring";
  const fileName = downloadFileName(project.title, version?.version_number ?? 1);

  return (
    <Screen>
      {header(project, revisionsOn && versions.length > 0 && version ? version.version_number : null, <ProjectMenu project={project} versionId={version?.id} onMessage={show} />)}

      {version && !expired ? (
        <View style={{ alignItems: "center" }}>
          <VideoPlayer key={version.id} uri={urlQ.data ?? null} aspectRatio={aspect} width={playerWidth}
            onRetry={() => void urlQ.refetch()}
            onPlay={() => { if (!played.current.has(version.id)) { played.current.add(version.id); analytics.track("video_played", { project_id: project.id, version_id: version.id }); } }} />
        </View>
      ) : activeJob ? (
        <JobProgressCard job={activeJob} onOpen={() => router.push(href(`/processing/${activeJob.id}`))} />
      ) : expired ? (
        <EmptyState icon="time-outline" title={EXPIRED_TITLE} body={expiredBody(retentionHours(settings).renders)}
          actionLabel="Créer une nouvelle vidéo" onAction={() => router.push(href("/create"))} />
      ) : failedJob ? (
        <Notice tone="error" icon="alert-circle-outline" title={errorFromCode(failedJob.error_code).title}
          body="Aucun montant n'a été prélevé. Vous pouvez relancer une création ou nous signaler le problème." actionLabel="Créer une vidéo" onAction={() => router.push(href("/create"))} />
      ) : (
        <EmptyState icon="film-outline" title="Cette vidéo n'est pas encore disponible." body="Dès qu'elle sera prête, elle apparaîtra ici." />
      )}

      {version && !expired && activeJob ? (
        <Notice tone="neutral" icon="hourglass-outline" title="Une nouvelle version est en cours de création." body="Vous serez prévenu dès qu'elle sera prête."
          actionLabel="Voir l'avancement" onAction={() => router.push(href(`/processing/${activeJob.id}`))} />
      ) : null}

      {renderPath && version?.expires_at ? <ExpiryBanner text={expiryBannerText(version.expires_at, now)} warning={expiring} /> : null}

      {flash ? <Notice tone={flash.tone === "success" ? "success" : "error"} icon={flash.tone === "success" ? "checkmark-circle-outline" : "alert-circle-outline"} title={flash.text} /> : null}

      {version && renderPath ? (
        <View style={{ gap: 12 }}>
          <Button label="Télécharger" loading={busy === "download"} disabled={busy === "share"}
            icon={<Ionicons name="arrow-down-circle-outline" size={24} color={colors.onAccent} />}
            onPress={() => { analytics.track("video_downloaded", { project_id: project.id, version_id: version.id }); void run("download", () => downloadVideo(renderPath, fileName)); }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Button label="Partager" variant={expiring ? "ghost" : "secondary"} loading={busy === "share"} disabled={busy === "download"}
                icon={<Ionicons name="share-outline" size={22} color={colors.text} />}
                onPress={() => void run("share", () => shareVideo(renderPath, fileName, projectTitle(project)))} />
            </View>
            {canRevise ? (
              <View style={{ flex: 1 }}>
                <Button label="Modifier" variant="secondary" icon={<Ionicons name="create-outline" size={22} color={colors.text} />}
                  onPress={() => router.push(href(`/project/${project.id}/revise?versionId=${version.id}`))} />
              </View>
            ) : null}
          </View>
          {canRevise ? <Text variant="caption" color="textSecondary" align="center">Une modification crée une nouvelle version. La version actuelle reste disponible.</Text> : null}
        </View>
      ) : null}

      {showVersionList(revisionsOn, versions.length) ? <VersionList versions={versions} selectedId={version?.id ?? null} onSelect={(v) => { haptics.tap(); setSelectedId(v.id); show(null); }} /> : null}
      <RushList assets={assets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
});
