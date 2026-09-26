"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { login } from "../actions";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormError
        message={
          state && !state.ok ? state.error : linkError ? "Ce lien est expiré ou invalide. Recommencez." : null
        }
      />
      <SubmitButton className="w-full" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
      <Link href="/forgot-password" className="text-center text-sm text-muted-foreground hover:text-foreground">
        Mot de passe oublié ?
      </Link>
    </form>
  );
}
