import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SummaryStep } from "@/features/create/SummaryStep";

export default function AutonomousSummaryRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const id = projectId ?? null;
  return (
    <SummaryStep projectId={id} mode="autonomous" step={5} total={5}
      routes={{
        self: `/create/autonomous/summary?projectId=${id}`, noProject: "/create/autonomous/idea",
        pickDuration: `/create/autonomous/duration?projectId=${id}`, manageFiles: `/create/autonomous/attachments?projectId=${id}`,
      }} />
  );
}
