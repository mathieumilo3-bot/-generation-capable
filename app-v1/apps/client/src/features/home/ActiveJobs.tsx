import React from "react";
import { View } from "react-native";
import { describeJob } from "@app/domain";
import type { JobRow } from "@app/api";
import { Card, ProgressBar, Text } from "@app/ui";
import { activeJobTitle } from "./logic";
import { percentLabel, progressValue } from "@/features/processing/logic";

/** « En cours » : seulement s'il y a des créations actives. Titre, « Création en cours », pourcentage réel. */
export function ActiveJobs({ jobs, onOpen }: { jobs: (JobRow & { project_title?: string })[]; onOpen: (job: JobRow) => void }) {
  if (jobs.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text variant="section" accessibilityRole="header">En cours</Text>
      {jobs.map((job) => {
        const view = describeJob(job.status, job.progress);
        const pct = percentLabel(view);
        const label = job.kind === "revision" ? "Modification en cours" : "Création en cours";
        return (
          <Card key={job.id} tone="outline" onPress={() => onOpen(job)} accessibilityLabel={`${activeJobTitle(job)}, ${label}${pct ? `, ${pct}` : ""}`}>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{activeJobTitle(job)}</Text>
                {pct ? <Text variant="secondary" color="textSecondary">{pct}</Text> : null}
              </View>
              <ProgressBar value={progressValue(view)} label={label} />
              <Text variant="secondary" color="textSecondary">{label}</Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
