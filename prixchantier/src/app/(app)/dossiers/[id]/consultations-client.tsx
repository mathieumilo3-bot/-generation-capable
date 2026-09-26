"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/form-bits";
import {
  cancelConsultation,
  checkMailNow,
  followupNow,
  prepareOfferUpload,
  registerOfferUpload,
  setAutoFollowup,
} from "@/actions/consultations";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ACCEPT_ATTRIBUTE } from "@/lib/files";
import { AWAITING } from "@/lib/labels";

export function CheckMailButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await checkMailNow(projectId);
          if (!res.ok) toast.error(res.error);
          else toast.success("Relève de la boîte mail lancée.");
          setTimeout(() => router.refresh(), 3000);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Vérifier les réponses
    </Button>
  );
}

export function ConsultationActions({
  id,
  projectId,
  status,
  autoFollowup,
  supplierName,
  closed,
}: {
  id: string;
  projectId: string;
  status: string;
  autoFollowup: boolean;
  supplierName: string;
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else toast.success(success);
      router.refresh();
    });
  const awaiting = AWAITING.has(status);

  if (status === "a_envoyer" || status === "erreur") {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/dossiers/${projectId}/consultations/envoi`}>Valider</Link>
      </Button>
    );
  }
  if (closed || status === "annulee") return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions pour ${supplierName}`} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {awaiting ? <DropdownMenuItem onSelect={() => run(() => followupNow(id), `Relance envoyée à ${supplierName}.`)}>Relancer maintenant</DropdownMenuItem> : null}
          {awaiting ? (
            <DropdownMenuItem onSelect={() => run(() => setAutoFollowup(id, !autoFollowup), autoFollowup ? "Relance automatique désactivée." : "Relance automatique activée.")}>
              {autoFollowup ? "Désactiver la relance automatique" : "Activer la relance automatique"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>Importer une offre reçue autrement</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => run(() => cancelConsultation(id), "Consultation annulée.")}>
            Annuler la consultation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportOfferDialog consultationId={id} supplierName={supplierName} open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}

function ImportOfferDialog({ consultationId, supplierName, open, onClose }: { consultationId: string; supplierName: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const prepared = await prepareOfferUpload(consultationId, { name: file.name, size: file.size });
    if (!prepared.ok) {
      setBusy(false);
      setError(prepared.error);
      return;
    }
    const { error: upErr } = await createBrowserSupabase().storage.from("files").uploadToSignedUrl(prepared.data.path, prepared.data.token, file);
    if (upErr) {
      setBusy(false);
      setError("Envoi du fichier impossible. Réessayez.");
      return;
    }
    const res = await registerOfferUpload(consultationId, { path: prepared.data.path, name: file.name });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      toast.success("Offre importée : analyse en cours.");
      setFile(null);
      onClose();
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer l&apos;offre de {supplierName}</DialogTitle>
          <DialogDescription>Devis reçu par courrier, remis en main propre ou transféré : PDF, Excel ou CSV.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
          <Upload /> {file ? file.name : "Choisir le fichier"}
        </Button>
        <input ref={input} type="file" accept={ACCEPT_ATTRIBUTE} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={upload} disabled={!file || busy}>
            {busy ? <Loader2 className="animate-spin" /> : null} Importer et analyser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
