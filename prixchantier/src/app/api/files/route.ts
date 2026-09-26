import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Téléchargement d'un fichier via une URL signée de 60 secondes.
 * La signature est demandée avec la session de l'utilisateur : la RLS du
 * stockage refuse tout fichier hors de son organisation.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const name = request.nextUrl.searchParams.get("name") ?? undefined;
  if (!path || path.includes("..") || path.split("/").length !== 4) {
    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { data, error } = await supabase.storage.from("files").createSignedUrl(path, 60, { download: name ?? true });
  if (error || !data) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
