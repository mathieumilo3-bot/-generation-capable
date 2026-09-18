import { Section } from "@/components/ui/Section";

const ITEMS = [
  ["01", "CLARTÉ", "Une offre comprise en quelques secondes."],
  ["02", "CONFIANCE", "Les bons éléments au bon moment."],
  ["03", "CONVERSION", "Un parcours pensé pour faire agir."],
  ["04", "SUIVI", "Chaque demande ne reste pas sans suite."],
];

export function ValueStrip() {
  return (
    <Section className="border-y border-[var(--color-border)] py-5">
      <div className="grid divide-y divide-[var(--color-border)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {ITEMS.map(([number, title, body]) => (
          <div key={number} className="flex items-center gap-4 px-0 py-4 sm:px-6 sm:py-2 first:sm:pl-0 last:sm:pr-0">
            <span className="font-display text-[10px] text-[var(--color-accent)]">{number}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
