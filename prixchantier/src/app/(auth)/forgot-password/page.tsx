"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form-bits";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Recevez un lien pour choisir un nouveau mot de passe."
      footer={
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {state?.ok ? (
        <FormSuccess message="Si un compte existe pour cette adresse, un e-mail vient d'être envoyé." />
      ) : (
        <form action={action} className="grid gap-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <FormError message={state && !state.ok ? state.error : null} />
          <SubmitButton className="w-full" pendingLabel="Envoi…">
            Envoyer le lien
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
