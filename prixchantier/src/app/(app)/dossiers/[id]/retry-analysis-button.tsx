"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startAnalysis } from "@/actions/projects";

export function RetryAnalysisButton({ projectId, variant = "default" }: { projectId: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size={variant === "default" ? "lg" : "sm"}
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startAnalysis(projectId);
          if (!res.ok) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCw />} {variant === "default" ? "Réessayer l'analyse" : "Analyser"}
    </Button>
  );
}
