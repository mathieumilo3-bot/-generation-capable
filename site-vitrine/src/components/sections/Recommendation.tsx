import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Sequence 4: show the work before selling it. The mock-up is an illustrative
 * reconstruction, not a real client's site — labelled as such on screen.
 */
const BEFORE = [
  "Sept prestations listées avant le moindre bénéfice client",
  "Coordonnées reléguées en pied de page",
  "Trois boutons concurrents dans le premier écran",
];

const AFTER = [
  "Une phrase qui nomme le problème du visiteur",
  "Une seule action, visible sans défiler",
  "La preuve du sérieux placée avant la demande de contact",
];

const CHANGES = [
  {
    title: "Clarifier l'offre",
    body: "Une proposition comprise en une lecture, pas après trois paragraphes.",
  },
  {
    title: "Réduire les frictions",
    body: "Chaque étape retirée du parcours est une opportunité conservée.",
  },
  {
    title: "Renforcer la confiance",
    body: "Ce qui rassure doit arriver avant ce qui engage.",
  },
  {
    title: "Construire un parcours vers l'action",
    body: "Le visiteur sait toujours quelle est l'étape suivante.",
  },
];

function Panel({
  label,
  tone,
  points,
}: {
  label: string;
  tone: "before" | "after";
  points: string[];
}) {
  const isAfter = tone === "after";
  return (
    <div className={`p-7 sm:p-8 ${isAfter ? "bg-[var(--color-accent-soft)]" : ""}`}>
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${
          isAfter ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
        }`}
      >
        {label}
      </p>

      {/* Schematic of the page, so the difference is visible before it is read. */}
      <div aria-hidden className="mt-6 flex flex-col gap-2">
        {isAfter ? (
          <>
            <div className="h-2.5 w-3/4 rounded-full bg-[var(--color-text)]/80" />
            <div className="h-1.5 w-1/2 rounded-full bg-[var(--color-muted)]/40" />
            <div className="mt-3 h-7 w-40 rounded-full bg-[var(--color-accent)]" />
          </>
        ) : (
          <>
            <div className="h-1.5 w-1/3 rounded-full bg-[var(--color-muted)]/30" />
            <div className="h-1.5 w-full rounded-full bg-[var(--color-muted)]/20" />
            <div className="h-1.5 w-5/6 rounded-full bg-[var(--color-muted)]/20" />
            <div className="h-1.5 w-2/3 rounded-full bg-[var(--color-muted)]/20" />
            <div className="mt-3 flex gap-2">
              <div className="h-5 w-20 rounded-full border border-[var(--color-border-strong)]" />
              <div className="h-5 w-20 rounded-full border border-[var(--color-border-strong)]" />
              <div className="h-5 w-20 rounded-full border border-[var(--color-border-strong)]" />
            </div>
          </>
        )}
      </div>

      <ul className="mt-7 flex flex-col gap-3 border-t border-[var(--color-border)] pt-6">
        {points.map((point) => (
          <li
            key={point}
            className={`text-sm leading-relaxed ${
              isAfter ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"
            }`}
          >
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Recommendation() {
  return (
    <Section className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Exemple de recommandation</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Votre proposition est
          <br />
          comprise trop tard.
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Reconstruction illustrative d&apos;une page d&apos;accueil — un
          exemple de ce que nous corrigeons, pas le site d&apos;un client.
        </p>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--color-border)]">
          <div className="grid divide-y divide-[var(--color-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
            <Panel label="Avant" tone="before" points={BEFORE} />
            <Panel label="Après" tone="after" points={AFTER} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.18}>
        <h3 className="font-display mt-16 text-xl font-semibold text-[var(--color-text)]">
          Ce que nous changerions
        </h3>
        <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {CHANGES.map((change, index) => (
            <li key={change.title} className="flex gap-5">
              <span className="font-display shrink-0 text-sm text-[var(--color-accent)]">
                0{index + 1}
              </span>
              <div>
                <p className="font-display text-base font-medium text-[var(--color-text)]">
                  {change.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                  {change.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}
