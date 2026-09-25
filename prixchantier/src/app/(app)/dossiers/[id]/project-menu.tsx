"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/form-bits";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/misc";
import { deleteProject, setProjectClosed, updateProject } from "@/actions/projects";

type Values = { name: string; reference: string | null; client: string | null; responseDeadline: string | null };

export function ProjectMenu({ projectId, closed, values }: { projectId: string; closed: boolean; values: Values }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleClosed = () =>
    start(async () => {
      const res = await setProjectClosed(projectId, !closed);
      if (!res.ok) toast.error(res.error);
      else toast.success(closed ? "Dossier rouvert." : "Dossier marqué terminé.");
      router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Autres actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>Modifier le dossier</DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleClosed} disabled={pending}>
            {closed ? "Rouvrir le dossier" : "Marquer comme terminé"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteOpen(true)}>
            Supprimer le dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le dossier</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const res = await updateProject(projectId, {
                  name: String(f.get("name")),
                  reference: String(f.get("reference")),
                  client: String(f.get("client")),
                  responseDeadline: String(f.get("deadline")),
                });
                if (!res.ok) setError(res.error);
                else {
                  setEditOpen(false);
                  router.refresh();
                }
              });
            }}
          >
            <Field label="Nom du chantier" htmlFor="p-name">
              <Input id="p-name" name="name" defaultValue={values.name} required maxLength={200} />
            </Field>
            <Field label="Référence interne" htmlFor="p-ref">
              <Input id="p-ref" name="reference" defaultValue={values.reference ?? ""} maxLength={100} />
            </Field>
            <Field label="Client" htmlFor="p-client">
              <Input id="p-client" name="client" defaultValue={values.client ?? ""} maxLength={200} />
            </Field>
            <Field label="Date limite de réponse" htmlFor="p-deadline">
              <Input id="p-deadline" name="deadline" type="date" defaultValue={values.responseDeadline ?? ""} />
            </Field>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce dossier ?</DialogTitle>
            <DialogDescription>
              Les documents, lignes, consultations, réponses et offres de ce dossier seront définitivement supprimés. Les e-mails déjà envoyés
              restent dans votre boîte mail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteProject(projectId);
                  if (!res.ok) toast.error(res.error);
                  else router.push("/");
                })
              }
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
