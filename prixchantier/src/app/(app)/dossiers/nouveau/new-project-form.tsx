"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormError } from "@/components/form-bits";
import { FileUploader, type PickedFile } from "@/components/file-uploader";
import { createProject } from "@/actions/projects";
import { uploadAndAnalyze } from "@/lib/upload-client";

export function NewProjectForm() {
  const router = useRouter();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (!files.some((f) => f.kind === "dpgf")) {
      setError("Ajoutez au moins un DPGF (ou quantitatif) à analyser.");
      return;
    }
    let id = projectId;
    if (!id) {
      setProgress("Création du dossier…");
      const created = await createProject({
        name: String(form.get("name") ?? ""),
        reference: String(form.get("reference") ?? ""),
        client: String(form.get("client") ?? ""),
        responseDeadline: String(form.get("deadline") ?? ""),
      });
      if (!created.ok) {
        setProgress(null);
        setError(created.error);
        return;
      }
      id = created.data.id;
      // En cas d'échec d'envoi, un nouvel essai réutilise ce dossier.
      setProjectId(id);
    }
    const res = await uploadAndAnalyze(id, files, setProgress);
    if (!res.ok) {
      setProgress(null);
      setError(res.error);
      return;
    }
    router.push(`/dossiers/${id}`);
  }

  const busy = progress !== null;
  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardContent className="grid gap-5">
          <Field label="Nom du chantier" htmlFor="name">
            <Input id="name" name="name" required maxLength={200} placeholder="Résidence Les Tilleuls — 24 logements" disabled={busy || !!projectId} autoFocus />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Référence interne" htmlFor="reference" hint="Facultatif">
              <Input id="reference" name="reference" maxLength={100} disabled={busy || !!projectId} />
            </Field>
            <Field label="Client" htmlFor="client" hint="Facultatif">
              <Input id="client" name="client" maxLength={200} disabled={busy || !!projectId} />
            </Field>
          </div>
          <Field label="Date limite de réponse" htmlFor="deadline" hint="Facultatif — reprise dans les demandes de prix">
            <Input id="deadline" name="deadline" type="date" className="sm:w-52" disabled={busy || !!projectId} />
          </Field>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Documents</span>
            <FileUploader files={files} onChange={setFiles} onError={setError} disabled={busy} />
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto sm:justify-self-end">
            {busy ? <Loader2 className="animate-spin" /> : null}
            {progress ?? (projectId ? "Réessayer" : "Analyser le dossier")}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
