import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Input } from "@app/ui";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { FlowScreen } from "@/features/create/FlowScreen";
import { useCreateDraft } from "@/features/create/draft";
import { humanizeError, type HumanError } from "@app/domain";
import { href } from "@/lib/href";

const MIN = 10;

export default function IdeaRoute() {
  return <RequireAuth><IdeaScreen /></RequireAuth>;
}

function IdeaScreen() {
  const { projectId: param } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  const { draft, patch, reset, ensureProject, ready } = useCreateDraft(param);
  const fresh = useRef(false);
  useEffect(() => {
    if (fresh.current) return;
    fresh.current = true;
    if (!param) reset();
  }, [param, reset]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const ok = draft.idea.trim().length >= MIN;

  const next = async () => {
    if (busy || !ok) return;
    setBusy(true); setError(null);
    try {
      const id = await ensureProject("autonomous");
      router.push(href(`/create/autonomous/attachments?projectId=${id}`));
    } catch {
      setError(humanizeError("network_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowScreen title="Quelle est votre idée ?" subtitle="Décrivez la vidéo que vous imaginez. Quelques phrases suffisent." step={1} total={5}
      footer={<Button label="Continuer" disabled={!ok || !ready} loading={busy} onPress={() => void next()} />}>
      <Input
        label="Votre idée"
        placeholder="Ex. : une vidéo de 30 secondes pour présenter ma nouvelle gamme de bougies artisanales."
        value={draft.idea} onChangeText={(t) => patch({ idea: t.slice(0, 1500) })} multiline maxLength={1500}
        hint={ok ? undefined : `Encore ${Math.max(MIN - draft.idea.trim().length, 0)} caractères au minimum.`}
      />
      {error ? <HumanErrorNotice error={error} onRetry={() => void next()} /> : null}
    </FlowScreen>
  );
}
