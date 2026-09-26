import { PageHeader } from "@/components/page";
import { requireSession } from "@/lib/session";
import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "Nouveau dossier — PrixChantier" };

export default async function NewProjectPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nouveau dossier"
        description="Importez le DPGF : nous en extrayons les lignes à chiffrer."
        back={{ href: "/", label: "Dossiers" }}
      />
      <NewProjectForm />
    </div>
  );
}
