import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Créer un compte — PrixChantier" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Consultez vos fournisseurs et comparez leurs prix sans ressaisie."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
