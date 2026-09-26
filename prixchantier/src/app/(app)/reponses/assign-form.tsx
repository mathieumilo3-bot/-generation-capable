"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { assignResponse } from "@/actions/consultations";

export function AssignForm({ responseId, options }: { responseId: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(options[0]?.id ?? "");
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <NativeSelect value={value} onChange={(e) => setValue(e.target.value)} aria-label="Consultation">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <Button
        disabled={pending || !value}
        onClick={() =>
          start(async () => {
            const res = await assignResponse(responseId, value);
            if (!res.ok) toast.error(res.error);
            else toast.success("Réponse rattachée : analyse en cours.");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Rattacher
      </Button>
    </div>
  );
}
