import React from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { DurationStep } from "@/features/create/DurationStep";
import { href } from "@/lib/href";

export default function DurationRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  if (!projectId) return <Redirect href={href("/create/upload")} />;
  return (
    <RequireAuth>
      <DurationStep projectId={projectId ?? null} mode="edit_rushes" step={2} total={4}
        onContinue={() => router.push(href(`/create/style?projectId=${projectId}`))} />
    </RequireAuth>
  );
}
