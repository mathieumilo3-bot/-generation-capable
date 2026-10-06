import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { describeJob, formatBytes, formatDuration } from "@app/domain";
import type { AssetRow, JobRow, VersionRow } from "@app/api";
import { Badge, Button, Card, ProgressBar, Row, Section, StepList, Text, colors } from "@app/ui";
import { formatRelativeDate } from "@/features/projects/logic";
import { percentLabel, progressValue, titleForJob } from "@/features/processing/logic";
import { versionLabel, isPlayable } from "./logic";

/** Avancement affiché sur la page du projet quand une création est active. */
export function JobProgressCard({ job, onOpen }: { job: JobRow; onOpen: () => void }) {
  const view = describeJob(job.status, job.progress);
  const pct = percentLabel(view);
  return (
    <Card tone="surface">
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text variant="section" style={{ flex: 1 }}>{titleForJob(job, job.status)}</Text>
          {pct ? <Text variant="bodyStrong" color="textSecondary">{pct}</Text> : null}
        </View>
        <ProgressBar value={progressValue(view)} label="Avancement de la création" />
        <StepList steps={view.steps} />
        <Button label="Voir l'avancement" variant="secondary" onPress={onOpen} />
      </View>
    </Card>
  );
}

export function VersionList({ versions, selectedId, onSelect }: { versions: VersionRow[]; selectedId: string | null; onSelect: (v: VersionRow) => void }) {
  return (
    <Section title="Versions" footer="Chaque modification crée une nouvelle version : les précédentes restent disponibles.">
      {versions.map((v) => {
        const playable = isPlayable(v);
        const selected = v.id === selectedId;
        const sub = playable ? formatRelativeDate(v.ready_at ?? v.created_at) : v.status === "failed" ? "Non terminée" : "En cours de création";
        return (
          <Row key={v.id} title={versionLabel(v.version_number)} subtitle={sub}
            onPress={playable ? () => onSelect(v) : undefined} chevron={false}
            right={selected ? <Ionicons name="checkmark-circle" size={24} color={colors.accent} accessibilityLabel="Version affichée" />
              : !playable ? <Badge label={v.status === "failed" ? "Échec" : "En cours"} tone={v.status === "failed" ? "error" : "progress"} /> : undefined} />
        );
      })}
    </Section>
  );
}

const KIND_LABEL: Record<AssetRow["kind"], string> = { raw: "Vidéo", reference: "Référence", image: "Image", logo: "Logo", audio_note: "Message vocal" };

export function RushList({ assets }: { assets: AssetRow[] }) {
  const shown = assets.filter((a) => a.status === "uploaded");
  if (shown.length === 0) return null;
  return (
    <Section title="Vos fichiers">
      {shown.map((a) => (
        <Row key={a.id} title={a.filename}
          subtitle={[KIND_LABEL[a.kind], formatBytes(a.size_bytes), a.duration_sec ? formatDuration(a.duration_sec) : null].filter(Boolean).join(" · ")}
          leading={<Ionicons name={a.kind === "image" || a.kind === "logo" ? "image-outline" : a.kind === "audio_note" ? "mic-outline" : "videocam-outline"} size={22} color={colors.textSecondary} />} />
      ))}
    </Section>
  );
}
