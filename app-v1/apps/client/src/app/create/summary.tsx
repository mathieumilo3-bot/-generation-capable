import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SummaryStep } from "@/features/create/SummaryStep";

export default function SummaryRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const id = projectId ?? null;
  return (
    <SummaryStep projectId={id} mode="edit_rushes" step={4} total={4}
      routes={{
        self: `/create/summary?projectId=${id}`, noProject: "/create/upload", pickDuration: `/create/duration?projectId=${id}`,
        pickStyle: `/create/style?projectId=${id}`, manageFiles: `/create/upload?projectId=${id}`,
      }} />
  );
}
