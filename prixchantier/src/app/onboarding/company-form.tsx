"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { createCompany } from "./actions";

export function CompanyForm({ company, fullName }: { company: string; fullName: string }) {
  const [state, action] = useActionState(createCompany, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Nom de l'entreprise" htmlFor="company">
        <Input id="company" name="company" defaultValue={company} required maxLength={200} autoFocus />
      </Field>
      <Field label="Votre nom" htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={fullName} required maxLength={200} />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <SubmitButton className="w-full" pendingLabel="Création…">
        Continuer
      </SubmitButton>
    </form>
  );
}
