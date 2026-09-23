import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SITE_NAME } from "@/lib/constants";
import { LEGAL_ENTITY, SUBPROCESSORS } from "@/lib/data/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et traitement des données de GC.",
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
 * This page describes what the site actually does. Audit submissions are
 * delivered by email and stored in the contact system only to manage the
 * commercial follow-up and, when consent allows it, measurement of ad quality.
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
              Le parcours Capable Audit recueille le nom de l&apos;entreprise
              que vous demandez d&apos;analyser. Les informations publiques
              nécessaires au diagnostic (site officiel, activité, ville,
              annuaires et présence publique) sont ensuite recherchées.
            </p>
            <p>
              Si vous choisissez d&apos;être prévenu lorsque le diagnostic est
              prêt, vous fournissez volontairement votre adresse email.
              Un numéro de téléphone peut être ajouté uniquement dans le cadre
              de l&apos;option facultative de communications GC.
            </p>
            <p>
              Aucune donnée sensible au sens de l&apos;article 9 du RGPD
              n&apos;est demandée. Les identifiants publicitaires liés à la
              visite (par exemple GCLID, GBRAID ou WBRAID) peuvent également
              être conservés lorsqu&apos;ils existent afin de mesurer l&apos;origine
              d&apos;une demande. Aucun profilage automatisé ne décide de
              l&apos;acceptation ou du refus d&apos;un prospect.
            </p>
          </Block>

          <Block title="Finalité et base légale">
            <p>
              Ces données servent à préparer le diagnostic demandé, à vous
              recontacter et à suivre l&apos;avancement commercial de la demande.
              La base légale de ce suivi est l&apos;exécution de mesures
              précontractuelles prises à votre demande (article 6.1.b du RGPD).
              Lorsque vous lancez un diagnostic, le nom d&apos;entreprise
              saisi et les informations publiques retrouvées à son sujet peuvent
              être transmis à l&apos;équipe GC afin d&apos;exécuter le diagnostic,
              d&apos;identifier l&apos;entreprise concernée et de suivre les demandes
              d&apos;audit.
            </p>
            <p>
              Si vous demandez à être prévenu lorsque l&apos;analyse est prête,
              l&apos;email fourni est utilisé pour cette notification et pour
              vous permettre de rouvrir votre diagnostic. Ce traitement est lié
              au service expressément demandé. L&apos;inscription aux conseils,
              offres ou autres communications commerciales GC repose sur un
              consentement séparé, facultatif et non pré-coché.
            </p>
            <p>
              L&apos;acceptation des cookies de mesure ou de publicité ne vaut
              pas consentement à recevoir des emails ou SMS commerciaux.
              L&apos;attribution publicitaire (campagne, identifiant de clic)
              n&apos;est associée à la demande que si vous avez accepté les
              finalités de mesure dans le bandeau. Ces données ne sont ni
              vendues ni louées.
            </p>
          </Block>

          <Block title="Destinataires et sous-traitants">
            <p>
              Votre demande est transmise à l&apos;équipe de {SITE_NAME} par
              email et peut être enregistrée dans le système de contacts utilisé
              pour suivre les étapes lead, lead qualifié, rendez-vous et client.
              Les données sont limitées aux informations nécessaires au suivi
              commercial et à la mesure d&apos;acquisition.
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
              Les coordonnées collectées uniquement pour vous notifier de la
              disponibilité d&apos;un diagnostic sont conservées pour une durée
              maximale de 90 jours, sauf relation commerciale engagée. Lorsque
              vous avez explicitement accepté les communications commerciales,
              les données de prospection peuvent être conservées jusqu&apos;à
              trois ans après le dernier contact, sous réserve de vos droits
              d&apos;opposition et de retrait du consentement.
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
              Le site utilise une balise Google Ads et peut également utiliser
              Google Tag Manager pour piloter les outils de mesure et, le cas
              échéant, de publicité. Avant votre choix, les stockages de mesure
              et de publicité sont refusés par défaut. Un bandeau vous permet
              d&apos;accepter ou de refuser ces technologies.
            </p>
            <p>
              Si vous acceptez, les catégories de stockage liées à
              l&apos;analyse et à la publicité peuvent être activées par les
              balises Google configurées pour le site. Ce choix permet la
              mesure d&apos;acquisition mais ne permet pas au site de découvrir
              automatiquement votre adresse email ou votre numéro de téléphone.
              Ces coordonnées ne sont connues de GC que si vous les fournissez
              vous-même. Le consentement marketing reste distinct du choix
              relatif aux cookies. Votre choix de cookies est conservé
              localement sur votre appareil.
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
