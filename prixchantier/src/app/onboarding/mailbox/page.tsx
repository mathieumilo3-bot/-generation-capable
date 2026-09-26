import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-bits";
import { MailboxConnect } from "@/components/mailbox-connect";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { googleConfigured, microsoftConfigured, testMailboxEnabled } from "@/lib/env";
import { mailErrorMessage } from "@/lib/mail/errors";

export const metadata = { title: "Boîte mail — PrixChantier" };

/** Étape 2 : connecter la boîte d'envoi, puis direction « Nouveau dossier ». */
export default async function OnboardingMailboxPage({ searchParams }: PageProps<"/onboarding/mailbox">) {
  await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: connections } = await supabase.from("mail_connections").select("id, provider, email, status, last_error");
  if (sp.mail === "connected" && connections?.some((c) => c.status === "active")) redirect("/dossiers/nouveau");
  const hasActive = connections?.some((c) => c.status === "active");

  return (
    <AuthShell
      title="Connectez votre boîte mail"
      subtitle="Étape 2 sur 2 — Vos consultations partent de votre adresse, et les réponses des fournisseurs sont suivies automatiquement. Aucun compte à créer pour eux."
      footer={
        <Link href="/dossiers/nouveau" className="hover:text-foreground">
          Passer cette étape
        </Link>
      }
    >
      <div className="grid gap-4">
        <FormError message={mailErrorMessage(typeof sp.mail_error === "string" ? sp.mail_error : null)} />
        <MailboxConnect
          connections={connections ?? []}
          googleEnabled={googleConfigured()}
          microsoftEnabled={microsoftConfigured()}
          testEnabled={testMailboxEnabled()}
          next="/onboarding/mailbox"
        />
        {hasActive ? (
          <Button asChild className="w-full">
            <Link href="/dossiers/nouveau">Créer mon premier dossier</Link>
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          PrixChantier n&apos;envoie jamais de consultation sans votre validation, et ne lit que les réponses liées à vos consultations.
        </p>
      </div>
    </AuthShell>
  );
}
