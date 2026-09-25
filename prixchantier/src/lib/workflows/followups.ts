import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { PermanentJobError } from "@/lib/jobs/runner";
import { sendFollowup, SendError } from "./sending";

export async function sendScheduledFollowup(followupId: string) {
  const admin = adminClient();
  const { data: f } = await admin.from("scheduled_followups").select("*").eq("id", followupId).maybeSingle();
  if (!f || f.status !== "scheduled") return;
  if (new Date(f.due_at) > new Date()) return;
  try {
    const res = await sendFollowup(f.consultation_id, f.organization_id, { attempt: f.attempt, automatic: true });
    if (res.sent) {
      await admin
        .from("scheduled_followups")
        .update({ status: "sent", sent_at: new Date().toISOString(), email_message_id: res.emailMessageId })
        .eq("id", f.id);
    } else {
      // Garde-fou déclenché : la relance est annulée et la raison historisée.
      await admin.from("scheduled_followups").update({ status: "skipped", reason: res.reason }).eq("id", f.id);
    }
  } catch (err) {
    if (err instanceof SendError) throw new PermanentJobError(err.message);
    throw err;
  }
}

export async function markFollowupFailed(followupId: string, err: unknown) {
  const admin = adminClient();
  const message = err instanceof Error ? err.message : "Échec de la relance";
  const { data: f } = await admin
    .from("scheduled_followups")
    .update({ status: "failed", reason: message.slice(0, 300) })
    .eq("id", followupId)
    .select("organization_id, consultation_id, consultations(project_id, suppliers(company_name))")
    .maybeSingle();
  if (f) {
    await logActivity({
      organizationId: f.organization_id,
      projectId: f.consultations?.project_id,
      consultationId: f.consultation_id,
      type: "followup_failed",
      message: `La relance automatique de ${f.consultations?.suppliers?.company_name ?? "ce fournisseur"} a échoué : ${message}`,
    });
  }
}

/** Annule les relances à venir (réponse reçue, refus, annulation, relance désactivée). */
export async function cancelFollowups(consultationId: string, reason: string) {
  await adminClient()
    .from("scheduled_followups")
    .update({ status: "cancelled", reason })
    .eq("consultation_id", consultationId)
    .eq("status", "scheduled");
}
