import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { AuditScore } from "@/components/ui/AuditScore";
import { Button } from "@/components/ui/Button";

const DEMO_SCORES = [
  { label: "Visibilité", score: 78 },
  { label: "Crédibilité", score: 71 },
  { label: "Conversion", score: 43 },
  { label: "Parcours", score: 52 },
];

export function AuditDemo() {
  return (
    <Section id="audit-demo" className="py-24 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
        <div>
          <Reveal>
            <Eyebrow>Capable Audit</Eyebrow>
            <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Avant de construire, <span className="text-[var(--color-muted)]">nous regardons.</span></h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">Le diagnostic met en évidence les points qui peuvent freiner une prise de contact : visibilité, crédibilité, conversion et parcours.</p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"><Button href="/audit" variant="primary">Analyser mon entreprise →</Button><span className="text-xs text-[var(--color-muted)]">Sans engagement</span></div>
          </Reveal>
        </div>
        <Reveal delay={0.12}>
          <div className="rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.24)] sm:p-9">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">EXEMPLE D'INTERFACE</p><p className="mt-1 font-display text-sm font-medium">Diagnostic de présence digitale</p></div><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">4 axes</span></div>
            <div className="mt-8 flex flex-col gap-6">{DEMO_SCORES.map((item,index)=><AuditScore key={item.label} label={item.label} score={item.score} delay={index*0.08}/>)}</div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[var(--color-border)] p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-muted)]">FRICTION</p><p className="mt-2 text-sm font-medium">Ce qui bloque</p></div><div className="rounded-xl border border-[var(--color-border)] p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-muted)]">PRIORITÉ</p><p className="mt-2 text-sm font-medium">Ce qui compte d'abord</p></div><div className="rounded-xl border border-[var(--color-border)] p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-muted)]">ACTION</p><p className="mt-2 text-sm font-medium">Ce qu'il faut faire</p></div></div>
            <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">Les scores ci-dessus sont une illustration du format, pas le diagnostic d'une entreprise réelle.</p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
