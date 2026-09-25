"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form-bits";
import { signup } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState(signup, null);
  if (state?.ok && state.data.confirmEmail) {
    return (
      <FormSuccess message="Compte créé. Cliquez sur le lien reçu par e-mail pour l'activer, puis connectez-vous." />
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <Field label="Entreprise" htmlFor="company">
        <Input id="company" name="company" autoComplete="organization" required autoFocus maxLength={200} />
      </Field>
      <Field label="Votre nom" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required maxLength={200} />
      </Field>
      <Field label="E-mail professionnel" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Mot de passe" htmlFor="password" hint="10 caractères minimum.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <SubmitButton className="w-full" pendingLabel="Création…">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}
