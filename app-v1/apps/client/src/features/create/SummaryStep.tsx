import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Notice, ProgressBar, Row, Section, Skeleton, Text, haptics, radii, spacing } from "@app/ui";
import {
  errorCodeOf, formatEuros, humanizeError, newIdempotencyKey, suggestTopup, topupChoices, usableMethods,
  type CreationMode, type HumanError,
} from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { useWallet } from "@/hooks/data";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { api } from "@/lib/supabase";
import { uploadManager } from "@/lib/uploads";
import { platform } from "@/lib/platform";
import { href } from "@/lib/href";
import { ConsentCheckbox } from "@/features/legal/ConsentCheckbox";
import { LegalLink } from "@/features/legal/LegalLink";
import { useAiConsent } from "@/features/legal/useAiConsent";
import { AI_CONSENT_HELP, SALES_TERMS_LABEL, WAIVER_TEXT, aiConsentLabel, canCreateWithConsent, needsAiConsent } from "@/features/legal/logic";
import { retentionHours, summaryRetentionLine } from "@/features/retention/logic";
import { FlowScreen } from "./FlowScreen";
import { useCreateDraft } from "./draft";
import { useDraftFiles } from "./useDraftFiles";
import { aspectLabel, composeBrief, creationTypeLabel, pickAutonomousMethod, summaryLabel } from "./logic";

export interface SummaryRoutes {
  /** Route de ce récapitulatif avec ses paramètres (destination du retour après recharge). */
  self: string;
  noProject: string;
  pickDuration: string;
  pickStyle?: string;
  manageFiles: string;
}

/**
 * Récapitulatif (§17) : « Tout est prêt. » Les montants viennent de `quote_video_job` (serveur).
 * Une clé d'idempotence par intention, bouton désactivé pendant l'envoi, solde insuffisant → recharge puis retour ici.
 */
export function SummaryStep({ projectId, mode, step, total, routes }: { projectId: string | null; mode: CreationMode; step: number; total: number; routes: SummaryRoutes }) {
  if (!projectId) return <Redirect href={href(routes.noProject)} />;
  return <RequireAuth><SummaryScreen projectId={projectId} mode={mode} step={step} total={total} routes={routes} /></RequireAuth>;
}

function SummaryScreen({ projectId, mode, step, total, routes }: { projectId: string; mode: CreationMode; step: number; total: number; routes: SummaryRoutes }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { settings, methods, capabilities, loadingCatalog } = useConfig();
  const { draft, patch, ready, forget } = useCreateDraft(projectId);
  const wallet = useWallet();
  const files = useDraftFiles(projectId);
  // Consentement explicite à l'analyse par des services d'IA tiers (réglage serveur ; la case n'est jamais cochée d'office).
  const aiOn = settings["features.third_party_ai"];
  const aiVersion = settings["legal.ai_consent_version"];
  const aiConsent = useAiConsent(aiVersion);
  const consentNeeded = needsAiConsent({ enabled: aiOn, granted: aiConsent.ready && aiConsent.granted });
  const [consentChecked, setConsentChecked] = useState(false);

  const usable = usableMethods(methods, mode, capabilities);
  const method = mode === "autonomous" ? pickAutonomousMethod(usable) : usable.find((m) => m.id === draft.methodId);
  const instructions = useMemo(() => {
    if (mode === "autonomous") return composeBrief({ idea: draft.idea, objective: draft.objective, objectiveDetail: draft.objectiveDetail, urls: draft.urls });
    return method?.capabilities.requires_instructions ? draft.instructions.trim() : null;
  }, [mode, draft.idea, draft.objective, draft.objectiveDetail, draft.urls, draft.instructions, method]);

  // Clé d'idempotence : créée à l'ouverture de l'écran, réutilisée pour tout retry / double appui.
  useEffect(() => {
    if (ready && !draft.idempotencyKey) patch({ idempotencyKey: newIdempotencyKey("job") });
  }, [ready, draft.idempotencyKey, patch]);

  const ruleId = draft.pricingRuleId;
  const quoteQ = useQuery({
    queryKey: ["quote", projectId, ruleId],
    queryFn: () => api.jobs.quote(projectId, ruleId),
    enabled: ready && !!ruleId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const refetchQuote = quoteQ.refetch;
  useFocusEffect(useCallback(() => { void refetchQuote(); void wallet.refetch(); }, [refetchQuote, wallet.refetch]));
  // Retour d'un paiement : le solde a changé → on relit le devis.
  const available = wallet.data?.available_cents;
  const lastAvailable = useRef(available);
  useEffect(() => {
    if (available !== undefined && lastAvailable.current !== undefined && available !== lastAvailable.current) void refetchQuote();
    lastAvailable.current = available;
  }, [available, refetchQuote]);

  const quote = quoteQ.data && quoteQ.data.ok ? quoteQ.data : null;
  const quoteError: HumanError | null = quoteQ.error ? humanizeError(errorCodeOf(quoteQ.error))
    : quoteQ.data && !quoteQ.data.ok ? humanizeError(quoteQ.data.code) : null;

  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (quote && tracked.current !== quote.pricing_rule_id) {
      tracked.current = quote.pricing_rule_id;
      analytics.track("pricing_viewed", { mode, price_cents: quote.price_cents, can_afford: quote.can_afford, shortfall_cents: quote.shortfall_cents });
    }
  }, [quote, mode]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<HumanError | null>(null);
  const inFlight = useRef(false);

  const fileRows = mode === "autonomous" ? files.rows.filter((r) => r.kind === "image" || r.kind === "logo") : files.rows.filter((r) => r.kind === "raw");
  const state = files.state;
  const maintenance = settings["maintenance.enabled"];
  const noFiles = mode === "edit_rushes" && files.rows.filter((r) => r.kind === "raw").length === 0 && !files.loading;
  const aspect = capabilities.aspect_ratios.includes("9:16") ? "9:16" : (capabilities.aspect_ratios[0] ?? "9:16");

  const topupChoicesCents = topupChoices(platform, settings);
  const suggested = quote && !quote.can_afford ? suggestTopup(quote.shortfall_cents, settings["wallet.min_topup_cents"], topupChoicesCents) : null;
  const goTopup = (amount: number | null) => {
    const q = [amount ? `amount=${amount}` : null, `returnTo=${encodeURIComponent(routes.self)}`, `projectId=${projectId}`].filter(Boolean).join("&");
    router.push(href(`/account/topup?${q}`));
  };

  const submit = async () => {
    if (inFlight.current || !quote || !ruleId || !method || !draft.idempotencyKey) return;
    if (!canCreateWithConsent(true, { needsConsent: consentNeeded, checked: consentChecked })) return;
    inFlight.current = true; setSubmitting(true); setSubmitError(null);
    try {
      // Consentement enregistré AVANT la soumission ; en cas d'échec (réseau…), rien n'est soumis.
      if (consentNeeded) {
        const accepted = await api.account.acceptAiProcessing(aiVersion);
        if (!accepted.ok) {
          haptics.error();
          setSubmitError(humanizeError(accepted.code));
          inFlight.current = false; setSubmitting(false);
          return;
        }
        aiConsent.remember();
      }
      const res = await api.jobs.submit({ projectId, pricingRuleId: ruleId, editingMethodId: method.id, aspectRatio: aspect, instructions, idempotencyKey: draft.idempotencyKey });
      if (res.ok) {
        analytics.track("job_submitted", { mode, price_cents: res.price_cents, method: method.slug, replayed: res.replayed === true });
        haptics.success();
        uploadManager.clearProject(projectId);
        void forget(projectId);
        void qc.invalidateQueries({ queryKey: ["wallet"] });
        void qc.invalidateQueries({ queryKey: ["projects"] });
        void qc.invalidateQueries({ queryKey: ["active-jobs"] });
        router.replace(href(`/processing/${res.job_id}`));
        return; // on laisse le bouton désactivé pendant la navigation
      }
      if (res.code === "insufficient_funds") { void refetchQuote(); void wallet.refetch(); }
      else if (res.code === "ai_consent_required") {
        // Version des conditions changée côté serveur : on redemande l'autorisation.
        haptics.error();
        aiConsent.forget(); setConsentChecked(false);
        setSubmitError(humanizeError(res.code));
      } else { haptics.error(); setSubmitError(humanizeError(res.code, { shortfallCents: Number(res.shortfall_cents) || undefined })); }
    } catch (e) {
      haptics.error();
      setSubmitError(humanizeError(errorCodeOf(e)));
    }
    inFlight.current = false; setSubmitting(false);
  };

  // Étapes manquantes (lien direct, brouillon repris) : on renvoie à l'étape concernée.
  if (ready && !ruleId) return <Redirect href={href(`${routes.pickDuration}`)} />;
  if (ready && mode === "edit_rushes" && !draft.methodId && routes.pickStyle) return <Redirect href={href(routes.pickStyle)} />;

  const blockedReason = maintenance ? "maintenance" : noFiles ? "no_files" : null;
  const filesOk = mode === "autonomous" ? state === "ready" || state === "empty" : state === "ready";
  const canSubmit = canCreateWithConsent(!!quote && quote.can_afford && filesOk, { needsConsent: consentNeeded, checked: consentChecked });
  const consentBlocking = consentNeeded && aiConsent.ready && !consentChecked && !!quote && quote.can_afford;
  const renders = retentionHours(settings).renders;
  const label = quote ? `Créer ma vidéo · ${formatEuros(quote.price_cents)}` : "Créer ma vidéo";

  return (
    <FlowScreen
      title="Tout est prêt." step={step} total={total}
      footer={
        <View style={{ gap: spacing.sm }}>
          {suggested !== null && quote ? (
            <>
              <Button label={`Ajouter ${formatEuros(suggested, { compact: true })}`} onPress={() => goTopup(suggested)} />
              <Button label="Autre montant" variant="secondary" onPress={() => goTopup(null)} />
            </>
          ) : (
            <>
              {consentBlocking ? <Text variant="caption" color="textSecondary" align="center">{AI_CONSENT_HELP}</Text> : null}
              <Text variant="caption" color="textSecondary" align="center">
                {WAIVER_TEXT}{" "}<LegalLink url={settings["urls.sales_terms"]} label={SALES_TERMS_LABEL} variant="caption" />
              </Text>
              <Button label={label} loading={submitting} disabled={!canSubmit || blockedReason !== null || !draft.idempotencyKey || !method} onPress={() => void submit()} />
            </>
          )}
          <Text variant="caption" color="textSecondary" align="center">En cas d'échec définitif du rendu, le montant réservé est automatiquement libéré.</Text>
          <Text variant="caption" color="textSecondary" align="center">{summaryRetentionLine(renders)}</Text>
        </View>
      }
    >
      {maintenance ? <Notice tone="warning" icon="construct-outline" title={settings["maintenance.message"]} body="La création reprendra dès la fin de la maintenance. Votre brouillon est conservé." /> : null}
      {noFiles ? <Notice tone="warning" icon="videocam-outline" title="Ajoutez au moins une vidéo." body="Nous en avons besoin pour réaliser le montage." actionLabel="Ajouter des vidéos" onAction={() => router.push(href(routes.manageFiles))} /> : null}
      {ready && mode === "autonomous" && !method && !loadingCatalog ? (
        <HumanErrorNotice error={humanizeError("mode_unsupported")} />
      ) : null}

      {quoteQ.isLoading || !ready ? (
        <View style={{ gap: spacing.md }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} radius={radii.lg} />)}</View>
      ) : quoteError ? (
        <HumanErrorNotice error={quoteError} onRetry={() => void refetchQuote()} />
      ) : quote ? (
        <Section>
          <Row title="Vidéo" value={quote.label} />
          <Row title="Type" value={creationTypeLabel(mode)} />
          {method ? <Row title="Style" value={method.name} /> : null}
          <Row title="Format" value={aspectLabel(aspect)} />
          {fileRows.length > 0 ? <Row title="Fichiers" value={String(fileRows.length)} /> : null}
          <Row title="Prix" value={formatEuros(quote.price_cents)} />
          <Row title="Solde actuel" value={formatEuros(quote.available_cents)} />
          {quote.can_afford ? <Row title="Après création" value={formatEuros(quote.after_cents)} /> : null}
        </Section>
      ) : null}

      {quote && consentNeeded && aiConsent.ready ? (
        <ConsentCheckbox checked={consentChecked} onChange={setConsentChecked}
          label={aiConsentLabel(settings["legal.ai_providers"])} moreUrl={settings["urls.privacy"]} />
      ) : null}

      {quote && !quote.can_afford ? (
        <Notice tone="warning" icon="wallet-outline"
          title={humanizeError("insufficient_funds", { shortfallCents: quote.shortfall_cents }).title}
          body="Ajoutez de l'argent : vous reviendrez directement à ce récapitulatif. Aucun montant n'a été prélevé." />
      ) : null}

      {state === "pending" ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="secondary" color="textSecondary" accessibilityLiveRegion="polite">
            {summaryLabel(files.summary)}. Votre vidéo pourra être lancée dès que l'envoi sera terminé.
          </Text>
          <ProgressBar value={files.summary.fraction} label="Progression de l'envoi" />
        </View>
      ) : null}
      {state === "failed" ? (
        <HumanErrorNotice error={humanizeError("upload_interrupted")} onRetry={() => {
          for (const i of files.uploads.items) if (i.status === "failed" || i.status === "paused") files.uploads.retry(i.localId);
        }} />
      ) : null}
      {submitError ? <HumanErrorNotice error={submitError} onRetry={() => void submit()} /> : null}
    </FlowScreen>
  );
}
