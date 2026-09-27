import { Building2, CheckCircle2, MailCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    supabase.from("consultations").select("supplier_id,status,sent_at,responded_at").order("created_at", { ascending: false }),
  ]);

  const usage = new Map<string, { consulted: number; answered: number; lastContact: string | null; lastStatus: string | null }>();
  for (const c of stats ?? []) {
    const u = usage.get(c.supplier_id) ?? { consulted: 0, answered: 0, lastContact: null, lastStatus: null };
    if (c.status !== "a_envoyer" && c.status !== "annulee") u.consulted++;
    if (["repondu", "reponse_partielle", "refus"].includes(c.status)) u.answered++;
    if (!u.lastContact && c.sent_at) {
      u.lastContact = c.sent_at;
      u.lastStatus = c.status;
    }
    usage.set(c.supplier_id, u);
  }

  const rows = (suppliers ?? []).map((s) => ({ ...s, usage: usage.get(s.id) ?? { consulted: 0, answered: 0, lastContact: null, lastStatus: null } }));
  const contacted = rows.filter((s) => s.usage.consulted > 0).length;
  const answered = rows.filter((s) => s.usage.answered > 0).length;
  const totalConsultations = rows.reduce((n, s) => n + s.usage.consulted, 0);

  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description="Votre carnet et l’historique réel des fournisseurs déjà contactés."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" /> Carnet</div><div className="text-2xl font-semibold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="size-3.5" /> Déjà contactés</div><div className="text-2xl font-semibold">{contacted}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MailCheck className="size-3.5" /> Consultations</div><div className="text-2xl font-semibold">{totalConsultations}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" /> Ont répondu</div><div className="text-2xl font-semibold">{answered}</div></CardContent></Card>
      </div>

      <SuppliersManager suppliers={rows} />
    </>
  );
}
