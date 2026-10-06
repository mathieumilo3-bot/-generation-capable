import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { REVISION_COMMAND_LABEL, formatEuros, humanizeError, newIdempotencyKey, planRevision, revisionRule, type HumanError, type RevisionCommand } from "@app/domain";
import { Button, Card, Chip, EmptyState, Input, Notice, Screen, Skeleton, Text, colors, haptics, spacing } from "@app/ui";
import { api } from "@/lib/supabase";
import { analytics } from "@/lib/analytics";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { BackButton } from "@/features/common/BackButton";
import { ErrorNotice, codeOfThrown, errorFromCode } from "@/features/common/ErrorView";
import { RequireAuth } from "@/features/common/RequireAuth";
import { href } from "@/features/common/nav";
import { pickInitialVersion } from "@/features/result/logic";
import { canSubmitPlan, composeInstructions, describePlan, quickCommands, topupHref } from "@/features/result/revision";

export default function ReviseRoute() {
  return <RequireAuth><ReviseScreen /></RequireAuth>;
}

function ReviseScreen() {
  const { id, versionId } = useLocalSearchParams<{ id: string; versionId?: string }>();
  const projectId = typeof id === "string" ? id : "";
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();
  const { capabilities, pricing, settings, maintenance, loadingCatalog } = useConfig();

  // Une clé par ouverture de l'écran : double appui ou nouvel essai = une seule modification facturée.
  const [idempotencyKey] = useState(() => newIdempotencyKey("rev"));
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<RevisionCommand[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    analytics.track("revision_started", { project_id: projectId });
  }, [projectId]);

  const projectQ = useQuery({ queryKey: ["project", projectId], queryFn: () => api.projects.get(projectId), enabled: !!projectId });
  const parent = useMemo(() => {
    const d = projectQ.data;
    if (!d) return null;
    return d.versions.find((v) => v.id === versionId && v.status === "ready" && v.render_path) ?? pickInitialVersion(d.project, d.versions);
  }, [projectQ.data, versionId]);

  const ruleId = revisionRule(pricing)?.id ?? null;
  const quoteQ = useQuery({
    queryKey: ["quote", "revision", projectId, ruleId],
    enabled: !!projectId && !loadingCatalog,
    gcTime: 0,
    queryFn: () => api.jobs.quote(projectId, ruleId, "revision"),
  });

  const quick = quickCommands(capabilities.revisions.commands);
  const instructions = composeInstructions(text, selected);
  const plan = useMemo(() => describePlan(instructions, planRevision(instructions, capabilities.revisions.commands)), [instructions, capabilities.revisions.commands]);

  const quote = quoteQ.data && quoteQ.data.ok ? quoteQ.data : null;
  const quoteError = quoteQ.data && !quoteQ.data.ok ? humanizeError(quoteQ.data.code) : quoteQ.isError ? errorFromCode(codeOfThrown(quoteQ.error)) : null;
  const returnTo = `/project/${projectId}/revise${parent ? `?versionId=${parent.id}` : ""}`;
  const canSubmit = !!quote && quote.can_afford && !!parent && canSubmitPlan(plan) && !maintenance.enabled && !submitting;

  const toggle = (c: RevisionCommand) => {
    haptics.tap();
    setSelected((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  };

  const submit = async () => {
    if (!canSubmit || !parent) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.jobs.submitRevision({ projectId, parentVersionId: parent.id, instructions, idempotencyKey });
      if (res.ok) {
        analytics.track("job_submitted", { kind: "revision", project_id: projectId, job_id: res.job_id, price_cents: res.price_cents });
        haptics.success();
        void qc.invalidateQueries({ queryKey: ["wallet", uid] });
        void qc.invalidateQueries({ queryKey: ["active-jobs", uid] });
        void qc.invalidateQueries({ queryKey: ["project", projectId] });
        router.replace(href(`/processing/${res.job_id}`));
        return;
      }
      haptics.error();
      const shortfall = typeof res.shortfall_cents === "number" ? res.shortfall_cents : undefined;
      setError(humanizeError(res.code, { shortfallCents: shortfall }));
      void quoteQ.refetch();
    } catch (e) {
      haptics.error();
      setError(errorFromCode(codeOfThrown(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const top = (
    <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
      <BackButton fallback={`/project/${projectId}`} icon="close" label="Fermer" />
      <Text variant="largeTitle" accessibilityRole="header">Que voulez-vous modifier ?</Text>
    </View>
  );

  if (projectQ.isLoading || loadingCatalog) {
    return <Screen>{top}<Skeleton height={140} radius={20} /><Skeleton height={120} radius={20} /></Screen>;
  }
  if (projectQ.isError || !parent) {
    return (
      <Screen>
        {top}
        <EmptyState icon="film-outline" title="Cette vidéo n'est pas encore modifiable." body="Attendez qu'elle soit prête, puis réessayez." actionLabel="Retour" onAction={() => router.back()} />
      </Screen>
    );
  }
  if (!capabilities.revisions.enabled || quick.length === 0) {
    return (
      <Screen>
        {top}
        <EmptyState icon="construct-outline" title="Les modifications ne sont pas disponibles pour le moment." body="Votre vidéo reste téléchargeable. Réessayez plus tard." actionLabel="Retour" onAction={() => router.back()} />
      </Screen>
    );
  }

  const footer = (
    <View style={{ gap: 8 }}>
      <Button label={quote ? `Créer la nouvelle version · ${formatEuros(quote.price_cents)}` : "Créer la nouvelle version"} loading={submitting} disabled={!canSubmit} onPress={() => void submit()} />
      <Text variant="caption" color="textSecondary" align="center">La version actuelle est conservée. En cas d'échec, le montant réservé est automatiquement libéré.</Text>
    </View>
  );

  return (
    <Screen footer={footer}>
      {top}

      {maintenance.enabled ? <Notice tone="warning" icon="construct-outline" title="Maintenance en cours" body={maintenance.message} /> : null}

      <Input
        value={text}
        onChangeText={(t) => { setText(t); if (error) setError(null); }}
        multiline
        placeholder="Ex. : Raccourcis l'intro et ajoute plus de zooms"
        accessibilityLabel="Que voulez-vous modifier ?"
        maxLength={500}
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="secondary" color="textSecondary">Suggestions rapides</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {quick.map((c) => <Chip key={c} label={REVISION_COMMAND_LABEL[c]} selected={selected.includes(c)} onPress={() => toggle(c)} />)}
        </View>
      </View>

      {plan.status !== "empty" ? (
        <Card tone="surface">
          <View style={{ gap: spacing.sm }}>
            {plan.applied.length > 0 ? (
              <>
                <Text variant="bodyStrong">Ce qui sera appliqué</Text>
                {plan.applied.map((l) => (
                  <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text variant="body">{l}</Text>
                  </View>
                ))}
              </>
            ) : null}
            {plan.message ? <Notice tone="warning" icon="information-circle-outline" title={plan.message} /> : null}
          </View>
        </Card>
      ) : null}

      <Card tone="outline">
        {quoteQ.isLoading || (!quote && !quoteError) ? (
          <View style={{ gap: spacing.sm }}><Skeleton height={22} width="60%" /><Skeleton height={22} width="80%" /></View>
        ) : quote ? (
          <View style={{ gap: spacing.sm }}>
            <PriceLine label="Prix de cette modification" value={formatEuros(quote.price_cents)} strong />
            <PriceLine label="Solde actuel" value={formatEuros(quote.available_cents)} />
            {quote.can_afford ? <PriceLine label="Après la modification" value={formatEuros(quote.after_cents)} /> : null}
          </View>
        ) : quoteError ? (
          <ErrorNotice error={quoteError} onAction={() => void quoteQ.refetch()} fallbackAction />
        ) : null}
      </Card>

      {quote && !quote.can_afford ? (
        <Notice tone="warning" icon="wallet-outline" title={`Il manque ${formatEuros(quote.shortfall_cents)} pour cette modification.`}
          body="Ajoutez de l'argent : vous reviendrez directement ici, sans rien recommencer."
          actionLabel="Ajouter" onAction={() => router.push(href(topupHref(quote.shortfall_cents, settings["wallet.min_topup_cents"], settings["wallet.topup_presets_cents"], returnTo)))} />
      ) : null}

      {error ? (
        <ErrorNotice error={error} onAction={error.action === "topup" && quote ? () => router.push(href(topupHref(quote.shortfall_cents, settings["wallet.min_topup_cents"], settings["wallet.topup_presets_cents"], returnTo))) : error.action === "retry" ? () => void submit() : undefined} />
      ) : null}
    </Screen>
  );
}

function PriceLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <Text variant={strong ? "bodyStrong" : "body"} color={strong ? "text" : "textSecondary"} style={{ flex: 1 }}>{label}</Text>
      <Text variant={strong ? "bodyStrong" : "body"}>{value}</Text>
    </View>
  );
}
