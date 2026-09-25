import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export async function logActivity(entry: {
  organizationId: string;
  projectId?: string | null;
  consultationId?: string | null;
  type: string;
  message: string;
}) {
  const { error } = await adminClient().from("activity_logs").insert({
    organization_id: entry.organizationId,
    project_id: entry.projectId ?? null,
    consultation_id: entry.consultationId ?? null,
    type: entry.type,
    message: entry.message,
  });
  if (error) console.error("[activity] échec d'écriture:", error.message);
}
