"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        La page n&apos;a pas pu être chargée. Réessayez ; si le problème persiste, contactez le support.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
