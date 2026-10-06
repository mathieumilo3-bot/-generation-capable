import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { describeJob, formatEuros, humanizeError, type HumanError } from "@app/domain";
import { Button, Card, EmptyState, Notice, ProgressBar, Screen, Skeleton, StepList, Text, colors, haptics, spacing } from "@app/ui";
import { api } from "@/lib/supabase";
import { analytics } from "@/lib/analytics";
import { useUserId } from "@/providers/AuthProvider";
import { BackButton } from "@/features/common/BackButton";
import { ConfirmSheet } from "@/features/common/ConfirmSheet";
import { ErrorNotice, codeOfThrown, errorFromCode } from "@/features/common/ErrorView";
import { RequireAuth } from "@/features/common/RequireAuth";
import { href } from "@/features/common/nav";
import { ReportSheet } from "@/features/processing/ReportSheet";
import { jobPollInterval, percentLabel, progressValue, titleForJob } from "@/features/processing/logic";
import { dismissPushOffer, requestPushPermission, shouldOfferPush } from "@/lib/push";

const AUTO_OPEN_DELAY_MS = 900;

export default function ProcessingRoute() {
  return <RequireAuth><ProcessingScreen /></RequireAuth>;
}

function ProcessingScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const id = typeof jobId === "string" ? jobId : "";
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();

  // Realtime met ce cache à jour (useLiveSync) ; le polling prend le relais si le temps réel est coupé.
  const jobQ = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.jobs.get(id),
    enabled: !!id,
    refetchInterval: (query) => jobPollInterval(query.state.data?.status),
  });
  const job = jobQ.data;
  const projectQ = useQuery({ queryKey: ["project", job?.project_id], queryFn: () => api.projects.get(job?.project_id ?? ""), enabled: !!job?.project_id });

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<HumanError | null>(null);
  const [report, setReport] = useState(false);
  const [offerPush, setOfferPush] = useState(false);
  const handledStatus = useRef<string | null>(null);

  const view = job ? describeJob(job.status, job.progress) : null;
  const projectTitle = projectQ.data?.project.title?.trim() || "Votre vidéo";

  // Proposer les notifications APRÈS le lancement de la première vidéo (jamais au démarrage).
  useEffect(() => {
    let alive = true;
    void shouldOfferPush().then((v) => { if (alive) setOfferPush(v); });
    return () => { alive = false; };
  }, []);

  // Fin de création : retour haptique, mesure, puis bascule automatique vers le résultat.
  useEffect(() => {
    if (!job || handledStatus.current === job.status) return;
    if (job.status === "completed") {
      handledStatus.current = job.status;
      haptics.success();
      analytics.track("job_completed", { kind: job.kind, project_id: job.project_id });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["project", job.project_id] });
      void qc.invalidateQueries({ queryKey: ["active-jobs", uid] });
      const t = setTimeout(() => router.replace(href(`/project/${job.project_id}`)), AUTO_OPEN_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (job.status === "failed") {
      handledStatus.current = job.status;
      haptics.error();
      analytics.track("job_failed", { kind: job.kind, project_id: job.project_id, code: job.error_code ?? "unknown" });
      void qc.invalidateQueries({ queryKey: ["wallet", uid] });
      void qc.invalidateQueries({ queryKey: ["active-jobs", uid] });
    }
    if (job.status === "cancelled") {
      handledStatus.current = job.status;
      void qc.invalidateQueries({ queryKey: ["wallet", uid] });
      void qc.invalidateQueries({ queryKey: ["active-jobs", uid] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    }
  }, [job, qc, router, uid]);

  const cancel = async () => {
    if (!job || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await api.jobs.cancel(job.id);
      if (!res.ok) setCancelError(humanizeError(res.code));
      await jobQ.refetch();
      setConfirmCancel(false);
    } catch (e) {
      setCancelError(errorFromCode(codeOfThrown(e)));
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  const top = (
    <View style={{ paddingTop: spacing.sm }}>
      <BackButton fallback="/(tabs)" icon="close" label="Fermer" />
    </View>
  );

  if (!id || jobQ.isError) {
    return (
      <Screen>
        {top}
        {jobQ.isError ? <ErrorNotice error={errorFromCode(codeOfThrown(jobQ.error))} onAction={() => void jobQ.refetch()} fallbackAction /> : null}
        <EmptyState icon="film-outline" title="Cette création est introuvable." body="Vos vidéos et votre solde sont en sécurité." actionLabel="Voir mes vidéos" onAction={() => router.replace(href("/projects"))} />
      </Screen>
    );
  }
  if (!job || !view) {
    return <Screen>{top}<Skeleton height={34} width="70%" /><Skeleton height={8} /><Skeleton height={120} radius={20} /></Screen>;
  }

  const title = titleForJob(job, job.status);
  const active = !view.isTerminal;
  const pct = percentLabel(view);

  return (
    <Screen>
      {top}
      <View style={{ gap: spacing.sm }}>
        <Text variant="largeTitle" accessibilityRole="header" accessibilityLiveRegion="polite">{title}</Text>
        <Text variant="body" color="textSecondary">{projectTitle}</Text>
      </View>

      {active ? (
        <>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text variant="bodyStrong">{view.headline}</Text>
              {pct ? <Text variant="bodyStrong" color="textSecondary">{pct}</Text> : null}
            </View>
            <ProgressBar value={progressValue(view)} label="Avancement de la création" />
          </View>
          <Card tone="surface"><StepList steps={view.steps} /></Card>
          <Text variant="body" color="textSecondary">Vous pouvez quitter cet écran : nous vous prévenons quand c'est prêt.</Text>
          <Text variant="secondary" color="textSecondary">{formatEuros(job.price_cents)} réservés. Ils ne sont débités que si votre vidéo est prête ; sinon, ils sont automatiquement libérés.</Text>

          {offerPush ? (
            <Card tone="outline">
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                  <Ionicons name="notifications-outline" size={26} color={colors.textSecondary} />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>Être prévenu quand c'est prêt</Text>
                </View>
                <Text variant="secondary" color="textSecondary">Une seule notification, dès que votre vidéo est disponible.</Text>
                <Button label="Activer les notifications" variant="secondary" onPress={() => { setOfferPush(false); void requestPushPermission(); }} />
                <Button label="Plus tard" variant="ghost" onPress={() => { setOfferPush(false); void dismissPushOffer(); }} />
              </View>
            </Card>
          ) : null}

          {cancelError ? <ErrorNotice error={cancelError} /> : null}
          {job.cancel_requested ? (
            <Notice tone="neutral" icon="hourglass-outline" title="Annulation en cours." body="Le montant réservé sera libéré dans un instant." />
          ) : (
            <Button label="Annuler la création" variant="ghost" onPress={() => { setCancelError(null); setConfirmCancel(true); }} />
          )}
        </>
      ) : job.status === "completed" ? (
        <View style={{ gap: spacing.lg }}>
          <Notice tone="success" icon="checkmark-circle-outline" title="Votre vidéo est prête." body="Nous vous l'ouvrons dans un instant." />
          <Button label="Voir ma vidéo" onPress={() => router.replace(href(`/project/${job.project_id}`))} />
        </View>
      ) : job.status === "failed" ? (
        <View style={{ gap: spacing.lg }}>
          <Notice tone="error" icon="alert-circle-outline" title={title} body={`${humanizeError(job.error_code).detail} Aucun montant n'a été prélevé.`} />
          <Button label="Signaler un problème" variant="secondary" onPress={() => setReport(true)} />
          <Button label="Retour à l'accueil" variant="ghost" onPress={() => router.replace(href("/(tabs)"))} />
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Notice tone="neutral" icon="close-circle-outline" title="Création annulée." body="Le montant réservé est libéré : votre solde est inchangé." />
          <Button label="Retour à l'accueil" onPress={() => router.replace(href("/(tabs)"))} />
        </View>
      )}

      <ConfirmSheet visible={confirmCancel} title="Annuler la création ?" body="Le montant réservé est libéré et votre solde reste inchangé. Vos fichiers sont conservés."
        confirmLabel="Annuler la création" cancelLabel="Continuer la création" destructive loading={cancelling}
        onConfirm={() => void cancel()} onCancel={() => setConfirmCancel(false)} />
      <ReportSheet visible={report} onClose={() => setReport(false)} projectId={job.project_id} jobId={job.id} versionId={job.version_id} />
    </Screen>
  );
}
