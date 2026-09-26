"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ActionError, getAuthUser, runAction, type ActionResult } from "@/lib/session";

const schema = z.object({
  company: z.string().trim().min(1, "Nom de l'entreprise requis.").max(200),
  fullName: z.string().trim().min(1, "Votre nom est requis.").max(200),
});

export async function createCompany(_: unknown, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await getAuthUser();
    if (!user) throw new ActionError("Votre session a expiré. Reconnectez-vous.");
    const parsed = schema.safeParse({ company: form.get("company"), fullName: form.get("fullName") });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_organization", { p_name: parsed.data.company, p_full_name: parsed.data.fullName });
    if (error && !error.message.includes("already_member")) throw new ActionError("Impossible de créer l'entreprise. Réessayez.");
  });
  if (!result.ok) return result;
  redirect("/onboarding/mailbox");
}
