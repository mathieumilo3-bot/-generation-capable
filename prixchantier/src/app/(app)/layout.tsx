import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: connections } = await supabase.from("mail_connections").select("id, provider, email, status");
  const active = connections?.find((c) => c.status === "active");
  const expired = connections?.find((c) => c.status === "expired");

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={session.email} organizationName={session.organizationName} />
      {expired ? (
        <div className="border-b border-warning/30 bg-warning-soft">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <span>
              {expired.provider === "microsoft" ? "Votre connexion Microsoft a expiré." : "Votre connexion Gmail a expiré."} Reconnectez votre boîte mail
              pour continuer à envoyer et suivre vos consultations.
            </span>
            <Link href="/parametres" className="ml-auto shrink-0 font-medium underline-offset-4 hover:underline">
              Reconnecter
            </Link>
          </div>
        </div>
      ) : !active ? (
        <div className="border-b bg-info-soft">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
            <Mail className="size-4 shrink-0 text-info" />
            <span>Connectez votre boîte mail pour envoyer vos consultations depuis votre adresse.</span>
            <Link href="/parametres" className="ml-auto shrink-0 font-medium underline-offset-4 hover:underline">
              Connecter
            </Link>
          </div>
        </div>
      ) : null}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
