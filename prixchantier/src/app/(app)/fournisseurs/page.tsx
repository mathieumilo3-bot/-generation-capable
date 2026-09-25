import { PageHeader } from "@/components/page";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { SuppliersManager } from "./suppliers-manager";

export const metadata = { title: "Fournisseurs — PrixChantier" };

export default async function SuppliersPage() {
  await requireSession();
  const supabase = await createClient();
  const [{ data: suppliers }, { data: stats }] = await Promise.all([
    supabase.from("suppliers").select("*").order("company_name"),
    supabase.from("consultations").select("supplier_id, status"),
  ]);
  const usage = new Map<string, { consulted: number; answered: number }>();
  for (const c of stats ?? []) {
    const u = usage.get(c.supplier_id) ?? { consulted: 0, answered: 0 };
    if (c.status !== "a_envoyer" && c.status !== "annulee") u.consulted++;
    if (["repondu", "reponse_partielle"].includes(c.status)) u.answered++;
    usage.set(c.supplier_id, u);
  }
  return (
    <>
      <PageHeader title="Fournisseurs" description="Votre carnet, réutilisé d'un dossier à l'autre." />
      <SuppliersManager suppliers={(suppliers ?? []).map((s) => ({ ...s, usage: usage.get(s.id) ?? { consulted: 0, answered: 0 } }))} />
    </>
  );
}
