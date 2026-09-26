import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultationExcel } from "@/lib/workflows/sending";

/** Aperçu du fichier Excel joint à la consultation (exactement celui qui sera envoyé). */
export async function GET(_: NextRequest, ctx: RouteContext<"/api/consultations/[id]/excel">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalide" }, { status: 400 });
  const supabase = await createClient();
  const { data: c } = await supabase.from("consultations").select("id, organization_id").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const { buffer, filename } = await consultationExcel(c.id, c.organization_id);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
