import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { FAQJsonLd } from "@/components/schema/JsonLd";
import { AuditFunnel } from "./AuditFunnel";

export const metadata: Metadata = {
  title: "Audit site internet gratuit : SEO, visibilité & conversion",
  description:
    "Audit gratuit de votre site et de votre présence digitale : SEO, visibilité Google, crédibilité, conversion et parcours client. Diagnostic initial sans engagement.",
  alternates: { canonical: "/audit" },
};

const AXES = ["Visibilité", "Crédibilité", "Conversion", "Parcours"];

const FAQS = [
  {
    question: "L'audit est-il vraiment gratuit ?",
    answer:
      "Oui. Le diagnostic initial est gratuit et sans engagement. Il sert à identifier les principaux freins de visibilité, de crédibilité et de conversion avant de parler d'une éventuelle prestation.",
  },
  {
    question: "Que contient l'audit ?",
    answer:
      "Nous regardons le site, la visibilité Google, la clarté de l'offre, les éléments de confiance, les appels à l'action et le parcours qui mène vers un formulaire, un devis ou un rendez-vous.",
  },
  {
    question: "Quelle est la différence entre un audit SEO et un audit de site internet ?",
    answer:
      "Un audit SEO se concentre surtout sur la capacité du site à être compris et trouvé dans les moteurs de recherche. Un audit de site plus large ajoute la crédibilité, la conversion et le parcours commercial.",
  },
  {
    question: "Faut-il déjà avoir Google Search Console pour demander l'audit ?",
    answer:
      "Non. Les signaux publics du site peuvent déjà être analysés. Si des données Search Console sont ensuite disponibles, elles permettent d'affiner les priorités à partir des requêtes, impressions et pages réellement observées.",
  },
];

export default function AuditPage() {
  return (
    <>
      <FAQJsonLd items={FAQS} />
      <Section className="py-16 sm:py-24 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
        <div className="lg:sticky lg:top-28">
          <Eyebrow>Audit gratuit · Sans engagement</Eyebrow>
          <h1 className="font-display text-balance mt-5 text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
            Audit gratuit de votre site :
            <br />
            SEO, visibilité
            <br />
            <span className="gold-text">et conversion.</span>
          </h1>
          <p className="mt-7 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
            Nous regardons votre site, votre visibilité Google, la crédibilité de votre présence
            et le parcours qui transforme une visite en demande afin d&apos;identifier les priorités
            les plus évidentes.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
            Ce diagnostic n&apos;est pas un simple score automatique : il sert à remettre les problèmes
            dans le contexte de votre activité, de vos offres et de la prochaine action attendue du prospect.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-2 sm:max-w-sm">
            {AXES.map((axis, index) => (
              <div
                key={axis}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  0{index + 1}
                </span>
                <p className="mt-2 font-display text-sm font-medium">{axis}</p>
              </div>
            ))}
          </div>

          <p className="mt-7 text-xs text-[var(--color-muted)]">
            Gratuit · 4 axes · Sans engagement · Réponse personnalisée
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-10">
          <div className="mb-8 flex items-center justify-between border-b border-[var(--color-border)] pb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
                Diagnostic initial
              </p>
              <p className="mt-1 font-display text-sm font-medium">Votre entreprise</p>
            </div>
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              En ligne
            </span>
          </div>
          <AuditFunnel />
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
        <h2 className="font-display text-2xl font-semibold">Ce que vous recevez</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Freins prioritaires",
              body: "Les points qui bloquent le plus la visibilité, la confiance ou la conversion sont isolés avant les détails secondaires.",
            },
            {
              title: "Plan d’action",
              body: "Les recommandations sont classées pour distinguer ce qui peut être corrigé rapidement de ce qui demande un travail plus long.",
            },
            {
              title: "Lecture commerciale",
              body: "Nous regardons aussi si le visiteur comprend l’offre, trouve les preuves utiles et sait clairement quoi faire ensuite.",
            },
            {
              title: "Prochaine étape claire",
              body: "L’audit doit vous permettre de savoir quoi corriger en premier, que vous exécutiez ensuite le plan seul ou avec un prestataire.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h3 className="font-display text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl border-t border-[var(--color-border)] pt-10 sm:mt-20">
        <h2 className="font-display text-2xl font-semibold">Questions sur l&apos;audit gratuit</h2>
        <div className="mt-6 space-y-6">
          {FAQS.map((item) => (
            <div key={item.question}>
              <h3 className="font-display text-base font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
      </Section>
    </>
  );
}
