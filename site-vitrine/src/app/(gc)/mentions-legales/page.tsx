import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { HOST, isLegalEntityComplete, legalRows } from "@/lib/data/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Informations légales relatives à Génération Capable.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/mentions-legales" },
};

/**
 * The identity comes from src/lib/data/legal.ts. Until it is filled, the page
 * says so plainly rather than displaying a placeholder that reads as real.
 */
export default function MentionsLegalesPage() {
  const rows = legalRows();
  const complete = isLegalEntityComplete();

  return (
    <Section className="py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Informations légales</Eyebrow>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Mentions légales
        </h1>

        <div className="mt-12 flex flex-col gap-10 text-[15px] leading-relaxed text-[var(--color-muted)]">
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
              Éditeur du site
            </h2>
            {rows.length > 0 ? (
              <dl className="mt-5 flex flex-col divide-y divide-[var(--color-border)]">
                {rows.map((row) => (
                  <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-6">
                    <dt className="text-sm text-[var(--color-muted)]">{row.label}</dt>
                    <dd className="text-[15px] text-[var(--color-text)]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-5">
                Les informations d&apos;identification de l&apos;entité
                exploitant {SITE_NAME} n&apos;ont pas encore été publiées sur
                cette page.
              </p>
            )}
            {!complete && (
              <p className="mt-5 rounded-xl border border-[var(--color-border)] px-5 py-4 text-sm">
                Cette page sera complétée avec l&apos;intégralité des mentions
                exigées par l&apos;article 6-III de la LCEN avant toute
                campagne publicitaire. Pour toute demande d&apos;information
                d&apos;ici là, utilisez le formulaire Capable Audit.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
              Hébergeur
            </h2>
            <p className="mt-5">
              {HOST.nom}
              {HOST.adresse ? `, ${HOST.adresse}` : ""} —{" "}
              <a
                href={HOST.site}
                className="text-[var(--color-text)] underline-offset-4 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                {HOST.site.replace("https://", "")}
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
              Propriété intellectuelle
            </h2>
            <p className="mt-5">
              L&apos;ensemble des contenus présents sur {SITE_URL.replace("https://", "")} —
              textes, visuels, méthodologie, identité de marque — est protégé
              par le droit d&apos;auteur. Toute reproduction ou représentation,
              totale ou partielle, sans autorisation écrite préalable est
              interdite.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
              Contenus illustratifs
            </h2>
            <p className="mt-5">
              Les diagnostics, scores, reconstructions de pages et cas
              d&apos;usage présentés sur ce site sont des démonstrations du
              format de restitution. Ils ne décrivent aucune mission réalisée
              pour un client et ne constituent ni une mesure de votre site, ni
              une promesse de résultat.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
              Données personnelles
            </h2>
            <p className="mt-5">
              Le traitement des données transmises via le formulaire Capable
              Audit est décrit dans la{" "}
              <a
                href="/politique-de-confidentialite"
                className="text-[var(--color-text)] underline-offset-4 hover:underline"
              >
                politique de confidentialité
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </Section>
  );
}
