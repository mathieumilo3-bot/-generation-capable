import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SITE_NAME } from "@/lib/constants";
import { LEGAL_ENTITY, SUBPROCESSORS } from "@/lib/data/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et traitement des données de Génération Capable.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/politique-de-confidentialite" },
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * This page describes what the site actually does — the Capable Audit form is
 * the only place personal data is collected, and it is delivered by email
 * rather than stored in a database. It is written from the code, not from a
 * template, so it stays true as long as the code does.
 */
export default function PolitiqueConfidentialitePage() {
  const controller = LEGAL_ENTITY.denomination || SITE_NAME;
  const contact = LEGAL_ENTITY.email;

  return (
    <Section className="py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Confidentialité</Eyebrow>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Politique de confidentialité
        </h1>

        <div className="mt-12 flex flex-col gap-10 text-[15px] leading-relaxed text-[var(--color-muted)]">
          <Block title="Responsable du traitement">
            <p>
              Le responsable du traitement est {controller}. Les informations
              d&apos;identification complètes figurent dans les{" "}
              <a
                href="/mentions-legales"
                className="text-[var(--color-text)] underline-offset-4 hover:underline"
              >
                mentions légales
              </a>
              .
            </p>
          </Block>

          <Block title="Données collectées">
            <p>
              Le formulaire Capable Audit est le seul point de collecte de
              données personnelles du site. Il recueille uniquement ce que
              vous saisissez volontairement :
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>l&apos;adresse de votre site internet ;</li>
              <li>votre secteur d&apos;activité et votre objectif principal ;</li>
              <li>vos nom, entreprise, adresse email et, si vous le souhaitez, téléphone.</li>
            </ul>
            <p>
              Aucune donnée sensible au sens de l&apos;article 9 du RGPD
              n&apos;est demandée. Aucun profilage ni décision automatisée
              n&apos;est appliqué à votre demande : l&apos;analyse est réalisée
              par une personne.
            </p>
          </Block>

          <Block title="Finalité et base légale">
            <p>
              Ces données servent exclusivement à préparer le diagnostic que
              vous demandez et à vous recontacter à ce sujet. La base légale
              est l&apos;exécution de mesures précontractuelles prises à votre
              demande (article 6.1.b du RGPD). Elles ne sont ni vendues, ni
              louées, ni transmises à des fins publicitaires.
            </p>
          </Block>

          <Block title="Destinataires et sous-traitants">
            <p>
              Votre demande est transmise à l&apos;équipe de {SITE_NAME} par
              email. Le site ne tient aucune base de données de prospects : vos
              réponses n&apos;existent que sous la forme de ce message.
            </p>
            <ul className="flex flex-col gap-3">
              {SUBPROCESSORS.map((processor) => (
                <li
                  key={processor.nom}
                  className="rounded-xl border border-[var(--color-border)] px-5 py-4"
                >
                  <p className="text-sm font-medium text-[var(--color-text)]">{processor.nom}</p>
                  <p className="mt-1 text-sm">{processor.role}</p>
                  <p className="mt-1 text-xs">
                    Transfert hors UE : {processor.pays} —{" "}
                    <a
                      href={processor.site}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="underline-offset-4 hover:underline"
                    >
                      garanties contractuelles
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Durée de conservation">
            <p>
              Les demandes restées sans suite sont supprimées au plus tard
              trois ans après le dernier contact, conformément à la
              recommandation de la CNIL en matière de prospection. Les données
              liées à une relation commerciale engagée sont conservées pendant
              la durée de celle-ci, puis selon les obligations comptables
              applicables.
            </p>
          </Block>

          <Block title="Journaux techniques et anti-abus">
            <p>
              Pour empêcher l&apos;utilisation du formulaire comme relais
              d&apos;envoi d&apos;emails, votre adresse IP est traitée de
              manière transitoire en mémoire afin de limiter le nombre de
              soumissions par période. Elle n&apos;est ni enregistrée dans un
              fichier, ni conservée après expiration de cette fenêtre. Ce
              traitement repose sur l&apos;intérêt légitime à sécuriser le
              service.
            </p>
          </Block>

          <Block title="Cookies et mesure d'audience">
            <p>
              Le site utilise Google Tag Manager pour piloter les outils de
              mesure et, le cas échéant, de publicité. Avant votre choix, les
              stockages de mesure et de publicité sont refusés par défaut.
              Un bandeau vous permet d&apos;accepter ou de refuser ces
              technologies.
            </p>
            <p>
              Si vous acceptez, les catégories de stockage liées à
              l&apos;analyse et à la publicité peuvent être activées par les
              balises configurées dans Google Tag Manager. Si vous refusez,
              elles restent refusées. Votre choix est conservé localement sur
              votre appareil afin de ne pas vous redemander votre préférence
              à chaque visite.
            </p>
          </Block>

          <Block title="Vos droits">
            <p>
              Vous disposez d&apos;un droit d&apos;accès, de rectification,
              d&apos;effacement, de limitation, d&apos;opposition et de
              portabilité sur vos données.
              {contact ? (
                <>
                  {" "}
                  Pour les exercer, écrivez à{" "}
                  <a
                    href={`mailto:${contact}`}
                    className="text-[var(--color-text)] underline-offset-4 hover:underline"
                  >
                    {contact}
                  </a>
                  .
                </>
              ) : (
                <>
                  {" "}
                  Pour les exercer, répondez directement à l&apos;email de
                  confirmation reçu après l&apos;envoi de votre demande.
                </>
              )}{" "}
              Vous pouvez également introduire une réclamation auprès de la
              CNIL (
              <a
                href="https://www.cnil.fr"
                rel="noopener noreferrer"
                target="_blank"
                className="underline-offset-4 hover:underline"
              >
                cnil.fr
              </a>
              ).
            </p>
          </Block>
        </div>
      </div>
    </Section>
  );
}
