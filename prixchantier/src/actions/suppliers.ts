"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ActionError, requireActionSession, runAction, type ActionResult } from "@/lib/session";
import { readCsv } from "@/lib/parsing/spreadsheet";
import { cellText, normalizeText } from "@/lib/parsing/normalize";

const supplierSchema = z.object({
  companyName: z.string().trim().min(1, "Le nom de la société est obligatoire.").max(200),
  contactName: z.string().trim().max(200).transform((v) => v || null).nullable().optional(),
  email: z.email("Adresse e-mail invalide.").max(254).transform((v) => v.trim().toLowerCase()),
  phone: z.string().trim().max(50).transform((v) => v || null).nullable().optional(),
  categories: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  notes: z.string().trim().max(2000).transform((v) => v || null).nullable().optional(),
});

export type SupplierInput = z.input<typeof supplierSchema>;

function toRow(d: z.output<typeof supplierSchema>) {
  return {
    company_name: d.companyName,
    contact_name: d.contactName ?? null,
    email: d.email,
    phone: d.phone ?? null,
    categories: d.categories,
    notes: d.notes ?? null,
  };
}

export async function saveSupplier(id: string | null, input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireActionSession();
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const supabase = await createClient();
    const query = id
      ? supabase.from("suppliers").update(toRow(parsed.data)).eq("id", z.uuid().parse(id)).select("id").single()
      : supabase.from("suppliers").insert(toRow(parsed.data)).select("id").single();
    const { data, error } = await query;
    if (error?.code === "23505") throw new ActionError("Un fournisseur existe déjà avec cette adresse e-mail.");
    if (error || !data) throw new ActionError("Enregistrement impossible.");
    revalidatePath("/fournisseurs");
    return { id: data.id };
  });
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const supabase = await createClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", z.uuid().parse(id));
    if (error) throw new ActionError("Ce fournisseur a déjà été consulté : il ne peut pas être supprimé.");
    revalidatePath("/fournisseurs");
  });
}

const HEADER_ALIASES: Record<string, "companyName" | "contactName" | "email" | "phone" | "categories" | "notes"> = {
  societe: "companyName",
  "nom societe": "companyName",
  entreprise: "companyName",
  fournisseur: "companyName",
  raison: "companyName",
  "raison sociale": "companyName",
  nom: "companyName",
  commercial: "contactName",
  contact: "contactName",
  interlocuteur: "contactName",
  email: "email",
  "e mail": "email",
  mail: "email",
  courriel: "email",
  "adresse mail": "email",
  telephone: "phone",
  tel: "phone",
  portable: "phone",
  categories: "categories",
  categorie: "categories",
  familles: "categories",
  famille: "categories",
  notes: "notes",
  commentaire: "notes",
  remarques: "notes",
};

/** Import CSV : colonnes reconnues par leur intitulé, lignes invalides signalées une à une. */
export async function importSuppliersCsv(form: FormData): Promise<ActionResult<{ imported: number; skipped: string[] }>> {
  return runAction(async () => {
    await requireActionSession();
    const file = form.get("file");
    if (!(file instanceof File) || !/\.csv$/i.test(file.name)) throw new ActionError("Choisissez un fichier CSV.");
    if (file.size > 1024 * 1024) throw new ActionError("Fichier trop volumineux (1 Mo maximum).");
    const sheet = readCsv(Buffer.from(await file.arrayBuffer()));
    const [header, ...rows] = sheet.rows;
    if (!header) throw new ActionError("Fichier vide.");
    const columns = header.map((h) => HEADER_ALIASES[normalizeText(h).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim()] ?? null);
    if (!columns.includes("email") || !columns.includes("companyName")) {
      throw new ActionError("Colonnes « Société » et « E-mail » introuvables dans la première ligne du fichier.");
    }
    const supabase = await createClient();
    const skipped: string[] = [];
    let imported = 0;
    for (let i = 0; i < rows.length && i < 2000; i++) {
      const row = rows[i];
      if (row.every((c) => c === null)) continue;
      const rec: Record<string, string> = {};
      columns.forEach((col, j) => {
        if (col) rec[col] = cellText(row[j]);
      });
      const parsed = supplierSchema.safeParse({
        companyName: rec.companyName ?? "",
        contactName: rec.contactName ?? "",
        email: rec.email ?? "",
        phone: rec.phone ?? "",
        categories: (rec.categories ?? "").split(/[,;|]/).map((c) => c.trim()).filter(Boolean),
        notes: rec.notes ?? "",
      });
      if (!parsed.success) {
        skipped.push(`Ligne ${i + 2} : ${parsed.error.issues[0].message}`);
        continue;
      }
      const { error } = await supabase.from("suppliers").insert(toRow(parsed.data));
      if (error?.code === "23505") skipped.push(`Ligne ${i + 2} : ${parsed.data.email} existe déjà.`);
      else if (error) skipped.push(`Ligne ${i + 2} : enregistrement impossible.`);
      else imported++;
    }
    revalidatePath("/fournisseurs");
    return { imported, skipped };
  });
}
