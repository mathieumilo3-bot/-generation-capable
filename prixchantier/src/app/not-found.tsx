import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">Ce dossier n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Button asChild>
        <Link href="/">Retour aux dossiers</Link>
      </Button>
    </main>
  );
}
