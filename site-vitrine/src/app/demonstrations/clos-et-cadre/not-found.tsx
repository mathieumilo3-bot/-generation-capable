import { Arrow, Container, Cta } from "@/components/demos/clos-et-cadre/ui";
import { DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";

export default function ClosEtCadreNotFound() {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <p className="cc-label text-[var(--cc-accent)]">Page introuvable</p>
        <h1 className="cc-serif mt-4 max-w-2xl text-[40px] leading-tight sm:text-[52px]">Cette page n&apos;existe pas, ou plus.</h1>
        <p className="mt-5 max-w-xl text-[17px] text-[var(--cc-muted)]">Le chantier que vous cherchez a peut-être changé d&apos;adresse. Les réalisations sont toutes ici :</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Cta href={`${DEMO_BASE_PATH}/realisations`}>
            Voir les réalisations <Arrow />
          </Cta>
          <Cta href={DEMO_BASE_PATH} variant="secondary">
            Retour à l&apos;accueil
          </Cta>
        </div>
      </Container>
    </section>
  );
}
