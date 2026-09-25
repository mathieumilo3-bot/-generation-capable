"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { connectTestMailbox, disconnectMailbox } from "@/actions/mailbox";

export type MailboxRow = { id: string; provider: string; email: string; status: string; last_error: string | null };

const PROVIDER_LABEL: Record<string, string> = { google: "Gmail", microsoft: "Microsoft 365", test: "Boîte de test" };

export function MailboxConnect({
  connections,
  googleEnabled,
  microsoftEnabled,
  testEnabled,
  next,
}: {
  connections: MailboxRow[];
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  testEnabled: boolean;
  next: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const connectTest = () =>
    start(async () => {
      const res = await connectTestMailbox();
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });

  const disconnect = (id: string) =>
    start(async () => {
      const res = await disconnectMailbox(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Boîte mail déconnectée.");
        router.refresh();
      }
    });

  return (
    <div className="grid gap-4">
      {connections.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          {c.status === "active" ? <CheckCircle2 className="size-5 text-success" /> : <AlertTriangle className="size-5 text-warning" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{c.email}</div>
            <div className="text-xs text-muted-foreground">
              {PROVIDER_LABEL[c.provider] ?? c.provider}
              {c.status !== "active" ? " — connexion expirée, reconnectez la boîte" : ""}
            </div>
          </div>
          {c.status !== "active" ? <Badge variant="warning">Expirée</Badge> : null}
          <div className="ml-auto flex gap-2">
            {c.status !== "active" && c.provider !== "test" ? (
              <Button asChild size="sm">
                <a href={`/api/mail/${c.provider}/start?next=${encodeURIComponent(next)}`}>Reconnecter</a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" disabled={pending} onClick={() => disconnect(c.id)}>
              Déconnecter
            </Button>
          </div>
        </div>
      ))}

      {!connections.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {googleEnabled ? (
            <Button asChild variant="outline" size="lg" className="h-14 justify-start">
              <a href={`/api/mail/google/start?next=${encodeURIComponent(next)}`}>
                <GoogleMark /> Connecter Gmail
              </a>
            </Button>
          ) : null}
          {microsoftEnabled ? (
            <Button asChild variant="outline" size="lg" className="h-14 justify-start">
              <a href={`/api/mail/microsoft/start?next=${encodeURIComponent(next)}`}>
                <MicrosoftMark /> Connecter Microsoft 365
              </a>
            </Button>
          ) : null}
          {testEnabled ? (
            <Button variant="outline" size="lg" className="h-14 justify-start" disabled={pending} onClick={connectTest}>
              {pending ? <Loader2 className="animate-spin" /> : null} Boîte de test (environnement de test)
            </Button>
          ) : null}
          {!googleEnabled && !microsoftEnabled && !testEnabled ? (
            <p className="text-sm text-destructive">
              Aucune messagerie n&apos;est configurée sur ce serveur (identifiants OAuth Google / Microsoft manquants).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}
