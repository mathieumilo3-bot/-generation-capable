"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { updatePassword } from "@/app/(auth)/actions";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <AuthShell title="Nouveau mot de passe">
      <form action={action} className="grid gap-4">
        <Field label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <Field label="Confirmation" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <FormError message={state && !state.ok ? state.error : null} />
        <SubmitButton className="w-full" pendingLabel="Enregistrement…">
          Enregistrer
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
