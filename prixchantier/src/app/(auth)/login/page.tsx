import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion — PrixChantier" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const linkError = sp.error === "lien";
  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à vos dossiers et consultations."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <LoginForm next={next} linkError={linkError} />
    </AuthShell>
  );
}
