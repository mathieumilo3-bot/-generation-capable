"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/form-bits";
import { deleteAccount, updateNames } from "@/actions/settings";

export function NamesForm({ organizationName, fullName, email }: { organizationName: string; fullName: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateNames({ organizationName: String(f.get("org")), fullName: String(f.get("name")) });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Enregistré.");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Entreprise" htmlFor="org">
        <Input id="org" name="org" defaultValue={organizationName} required maxLength={200} />
      </Field>
      <Field label="Votre nom" htmlFor="name" hint={`Connecté avec ${email}`}>
        <Input id="name" name="name" defaultValue={fullName} maxLength={200} />
      </Field>
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Enregistrer
      </Button>
    </form>
  );
}

export function DeleteAccount() {
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <Field label="Saisissez SUPPRIMER pour confirmer" htmlFor="confirm-delete">
        <Input id="confirm-delete" value={value} onChange={(e) => setValue(e.target.value)} className="sm:w-64" autoComplete="off" />
      </Field>
      <FormError message={error} />
      <Button
        variant="destructive"
        className="justify-self-start"
        disabled={pending || value.trim().toUpperCase() !== "SUPPRIMER"}
        onClick={() =>
          start(async () => {
            const res = await deleteAccount(value);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Supprimer définitivement mon compte
      </Button>
    </div>
  );
}
