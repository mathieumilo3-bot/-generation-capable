"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/misc";
import { FileUploader, type PickedFile } from "@/components/file-uploader";
import { FormError } from "@/components/form-bits";
import { deleteDocument, setDocumentKind } from "@/actions/projects";
import { uploadAndAnalyze } from "@/lib/upload-client";

export function DocumentActions({ documentId, kind, status }: { documentId: string; kind: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else if (success) toast.success(success);
      router.refresh();
    });
  const editable = status !== "processed" && status !== "processing";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Actions du document" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {editable && kind !== "dpgf" ? (
          <DropdownMenuItem onSelect={() => run(() => setDocumentKind(documentId, "dpgf"), "Document marqué comme DPGF : lancez l'analyse.")}>
            C&apos;est un DPGF à analyser
          </DropdownMenuItem>
        ) : null}
        {editable && kind === "dpgf" ? (
          <DropdownMenuItem onSelect={() => run(() => setDocumentKind(documentId, "other"))}>Ne pas analyser (document de référence)</DropdownMenuItem>
        ) : null}
        {editable ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem className="text-destructive" onSelect={() => run(() => deleteDocument(documentId), "Document supprimé.")}>
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddDocuments({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  if (!files.length) {
    return <FileUploader files={files} onChange={setFiles} onError={setError} />;
  }
  return (
    <div className="grid gap-3">
      <FileUploader files={files} onChange={setFiles} onError={setError} disabled={progress !== null} />
      <FormError message={error} />
      <Button
        className="justify-self-end"
        disabled={progress !== null}
        onClick={async () => {
          setError(null);
          const res = await uploadAndAnalyze(projectId, files, setProgress);
          setProgress(null);
          if (!res.ok) setError(res.error);
          else {
            setFiles([]);
            router.refresh();
          }
        }}
      >
        {progress ? <Loader2 className="animate-spin" /> : null}
        {progress ?? (files.some((f) => f.kind === "dpgf") ? "Ajouter et analyser" : "Ajouter")}
      </Button>
    </div>
  );
}
