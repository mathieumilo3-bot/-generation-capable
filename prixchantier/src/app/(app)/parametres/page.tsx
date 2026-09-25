import { PageHeader } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/form-bits";
import { MailboxConnect } from "@/components/mailbox-connect";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { googleConfigured, microsoftConfigured, testMailboxEnabled } from "@/lib/env";
import { mailErrorMessage } from "@/lib/mail/errors";
import { DeleteAccount, NamesForm } from "./settings-client";

export const metadata = { title: "Paramètres — PrixChantier" };

export default async function SettingsPage({ searchParams }: PageProps<"/parametres">) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: connections } = await supabase.from("mail_connections").select("id, provider, email, status, last_error").order("created_at");

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title="Paramètres" />
      <Card>
        <CardHeader>
          <CardTitle>Boîte mail d&apos;envoi</CardTitle>
          <CardDescription>
            Les consultations partent de cette adresse et seules les réponses liées à vos consultations sont lues. Les jetons d&apos;accès sont
            chiffrés et ne quittent jamais le serveur.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sp.mail === "connected" ? <FormSuccess message="Boîte mail connectée." /> : null}
          <FormError message={mailErrorMessage(typeof sp.mail_error === "string" ? sp.mail_error : null)} />
          <MailboxConnect
            connections={connections ?? []}
            googleEnabled={googleConfigured()}
            microsoftEnabled={microsoftConfigured()}
            testEnabled={testMailboxEnabled()}
            next="/parametres"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Entreprise et profil</CardTitle>
        </CardHeader>
        <CardContent>
          <NamesForm organizationName={session.organizationName} fullName={session.fullName ?? ""} email={session.email} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Supprimer mon compte</CardTitle>
          <CardDescription>
            Si vous êtes le dernier utilisateur de l&apos;entreprise, tous ses dossiers, fournisseurs, documents et offres sont définitivement
            supprimés, et l&apos;accès à votre boîte mail est révoqué.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
    </div>
  );
}
