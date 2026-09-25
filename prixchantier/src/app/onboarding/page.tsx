import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getAuthUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "./company-form";

export const metadata = { title: "Votre entreprise — PrixChantier" };

/** Étape 1 : créer l'entreprise (utile si l'e-mail a été confirmé avant). */
export default async function OnboardingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/onboarding/mailbox");
  const meta = user.user_metadata as { company?: string; full_name?: string };
  return (
    <AuthShell title="Votre entreprise" subtitle="Étape 1 sur 2">
      <CompanyForm company={meta.company ?? ""} fullName={meta.full_name ?? ""} />
    </AuthShell>
  );
}
