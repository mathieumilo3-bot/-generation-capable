import React from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { DurationStep } from "@/features/create/DurationStep";
import { href } from "@/lib/href";

export default function AutonomousDurationRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  if (!projectId) return <Redirect href={href("/create/autonomous/idea")} />;
  return (
    <RequireAuth>
      <DurationStep projectId={projectId} mode="autonomous" step={4} total={5}
        onContinue={() => router.push(href(`/create/autonomous/summary?projectId=${projectId}`))} />
    </RequireAuth>
  );
}
