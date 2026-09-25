"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Rafraîchit la page tant qu'un traitement serveur est en cours (analyse, réponses). */
export function AutoRefresh({ active, intervalMs = 4000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
