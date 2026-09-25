import type { Metadata } from "next";
import { ProjectForm } from "@/components/demos/clos-et-cadre/ProjectForm";
import { Container, Kicker, StrategyNote } from "@/components/demos/clos-et-cadre/ui";
import { COMPANY, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { STEPS } from "@/lib/demos/clos-et-cadre/method";

export const metadata: Metadata = {
  title: "Décrire votre projet",
  description: "Décrivez votre projet d'extension, de surélévation ou de rénovation en quatre minutes. Le conducteur de travaux de votre secteur vous rappelle sous deux jours ouvrés.",
  alternates: { canonical: `${DEMO_BASE_PATH}/projet` },
};

export default async function ProjetPage({ searchParams }: PageProps<"/demonstrations/clos-et-cadre/projet">) {
  const { type } = await searchParams;
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <section className="pb-20 pt-10 sm:pb-28 sm:pt-14">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
          <div className="min-w-0">
            <Kicker>Votre projet</Kicker>
            <h1 className="cc-serif text-balance mt-4 text-[38px] leading-[1.05] sm:text-[50px]">Parlons de votre projet.</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--cc-muted)]">
              Quatre étapes courtes. Plus vous nous en dites, plus le premier appel sera utile : nous vous rappellerons avec un premier avis,
              pas avec un questionnaire.
            </p>
            <div className="mt-12">
              <ProjectForm key={initialType ?? "vide"} initialType={initialType} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-[var(--cc-line)] p-6 sm:p-7">
              <p className="cc-label text-[var(--cc-muted)]">Après votre demande</p>
              <ol className="mt-5 space-y-5">
                {STEPS.slice(0, 3).map((step) => (
                  <li key={step.number} className="grid grid-cols-[36px_1fr] gap-3">
                    <span className="cc-serif text-[22px] leading-none text-[var(--cc-accent)]">{step.number}</span>
                    <div>
                      <p className="font-medium">
                        {step.title} <span className="font-normal text-[var(--cc-muted)]">· {step.duration}</span>
                      </p>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--cc-muted)]">{step.youGet}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-7 border-t border-[var(--cc-line)] pt-5">
                <p className="text-[15px] text-[var(--cc-muted)]">Vous préférez en parler directement ?</p>
                <a href={COMPANY.phoneHref} className="cc-serif mt-1 block text-[26px] tabular-nums hover:text-[var(--cc-accent)]">
                  {COMPANY.phoneDisplay}
                </a>
                <p className="mt-1 text-[14px] text-[var(--cc-muted)]">{COMPANY.hours}</p>
              </div>
            </div>
            <StrategyNote title="Un pré-diagnostic, pas un formulaire de contact" className="mt-6">
              Nom-email-message produit des demandes que l&apos;entreprise doit requalifier au téléphone. Ici, chaque réponse sert une
              décision : la commune vérifie la zone et le PLU, les surfaces annoncent l&apos;autorisation probable, l&apos;enveloppe filtre les
              projets sous le seuil, les photos préparent la visite. À l&apos;envoi, l&apos;entreprise reçoit une fiche priorisée — faites
              le test jusqu&apos;au bout.
            </StrategyNote>
          </aside>
        </div>
      </Container>
    </section>
  );
}
