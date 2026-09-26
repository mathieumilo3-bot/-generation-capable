"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/form-bits";
import { deleteDraft, sendConsultationAction } from "@/actions/consultations";

type Draft = {
  id: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  includeExcel: boolean;
  autoFollowup: boolean;
  referenceCode: string;
  lineCount: number;
  supplier: { company_name: string; contact_name: string | null; email: string };
  attachments: string[];
};

export function DraftCard({ draft, fromEmail }: { draft: Draft; fromEmail: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [includeExcel, setIncludeExcel] = useState(draft.includeExcel);
  const [autoFollowup, setAutoFollowup] = useState(draft.autoFollowup);
  const [error, setError] = useState<string | null>(draft.error);

  const send = () =>
    start(async () => {
      setError(null);
      const res = await sendConsultationAction(draft.id, { subject, body, includeExcel, autoFollowup });
      if (!res.ok) setError(res.error);
      else {
        toast.success(`Consultation envoyée à ${draft.supplier.company_name}.`);
        router.refresh();
      }
    });

  return (
    <Card data-testid="draft-card">
      <CardContent className="grid gap-5">
        <div className="grid gap-1.5">
          <Label>Destinataire</Label>
          <div className="text-sm">
            <span className="font-medium">{draft.supplier.company_name}</span>
            <span className="text-muted-foreground">
              {" "}
              — {draft.supplier.contact_name ? `${draft.supplier.contact_name} ` : ""}&lt;{draft.supplier.email}&gt;
            </span>
            {draft.status === "erreur" ? (
              <Badge variant="danger" className="ml-2">
                Erreur
              </Badge>
            ) : null}
          </div>
          {fromEmail ? <div className="text-xs text-muted-foreground">Envoyé depuis {fromEmail}</div> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`subject-${draft.id}`}>Objet</Label>
          <Input id={`subject-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
          <p className="text-xs text-muted-foreground">La référence {draft.referenceCode} reste dans l&apos;objet : elle permet de rattacher la réponse.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`body-${draft.id}`}>Message</Label>
          <Textarea id={`body-${draft.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={14} maxLength={10000} className="font-[inherit] leading-relaxed" />
        </div>
        <div className="grid gap-2">
          <Label>Pièces jointes</Label>
          <ul className="grid gap-1.5 text-sm">
            {includeExcel ? (
              <li className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <a href={`/api/consultations/${draft.id}/excel`} className="hover:underline">
                  Demande de prix {draft.referenceCode}.xlsx
                </a>
                <span className="text-xs text-muted-foreground">
                  {draft.lineCount} ligne{draft.lineCount > 1 ? "s" : ""}
                </span>
              </li>
            ) : null}
            {draft.attachments.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" /> {a}
              </li>
            ))}
            {!includeExcel && !draft.attachments.length ? <li className="text-muted-foreground">Aucune</li> : null}
          </ul>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <Switch checked={includeExcel} onCheckedChange={setIncludeExcel} /> Fichier Excel à compléter
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={autoFollowup} onCheckedChange={setAutoFollowup} /> Relance automatique à 48 h
          </label>
        </div>
        <FormError message={error} />
      </CardContent>
      <CardFooter className="justify-between">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteDraft(draft.id);
              if (!res.ok) toast.error(res.error);
              router.refresh();
            })
          }
        >
          Supprimer
        </Button>
        <Button onClick={send} disabled={pending || !fromEmail}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Envoyer la consultation
        </Button>
      </CardFooter>
    </Card>
  );
}
