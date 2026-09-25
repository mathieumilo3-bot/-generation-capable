"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { retryResponse, setOfferLineMatch } from "@/actions/consultations";

export function RetryResponseButton({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await retryResponse(responseId);
          if (!res.ok) toast.error(res.error);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCw />} Réessayer l&apos;analyse
    </Button>
  );
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "outline" }> = {
  matched: { label: "Correspondance sûre", tone: "success" },
  user_confirmed: { label: "Confirmée", tone: "success" },
  to_verify: { label: "Correspondance à vérifier", tone: "warning" },
  unmatched: { label: "Non rattachée", tone: "neutral" },
  user_rejected: { label: "Écartée", tone: "outline" },
};

export function OfferLineMatch({
  offerLineId,
  status,
  projectLineId,
  options,
}: {
  offerLineId: string;
  status: string;
  projectLineId: string | null;
  options: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (lineId: string | null, confirm: boolean) =>
    start(async () => {
      const res = await setOfferLineMatch(offerLineId, { projectLineId: lineId, confirm });
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  const s = STATUS[status] ?? STATUS.unmatched;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5">
        <Badge variant={s.tone}>{s.label}</Badge>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {status === "to_verify" ? (
          <>
            <Button size="icon" variant="ghost" className="size-7" aria-label="Confirmer la correspondance" onClick={() => set(projectLineId, true)} disabled={pending}>
              <Check />
            </Button>
            <Button size="icon" variant="ghost" className="size-7" aria-label="Écarter la correspondance" onClick={() => set(null, false)} disabled={pending}>
              <X />
            </Button>
          </>
        ) : null}
      </div>
      <NativeSelect
        aria-label="Ligne du dossier correspondante"
        className="h-8 max-w-80 text-xs"
        value={projectLineId ?? ""}
        disabled={pending}
        onChange={(e) => set(e.target.value || null, true)}
      >
        <option value="">— Aucune ligne du dossier —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label.length > 70 ? `${o.label.slice(0, 70)}…` : o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
