"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { autoLaunchConsultations } from "@/actions/consultations";

export function AutoLaunchButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await autoLaunchConsultations(projectId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const names = res.data.supplierNames.join(", ");
          const skipped = res.data.skippedLines ? ` · ${res.data.skippedLines} ligne(s) peu fiable(s) ignorée(s)` : "";
          const failed = res.data.failed.length ? ` · échec: ${res.data.failed.join(", ")}` : "";
          toast.success(`${res.data.sent} consultation(s) envoyée(s) automatiquement à ${names}${skipped}${failed}`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Bot />}
      {pending ? "Pilote automatique…" : "Lancer en automatique"}
    </Button>
  );
}
