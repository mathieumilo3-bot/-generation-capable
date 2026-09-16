import { stats, statsSection } from "../data/content";
import { useCountUp } from "../hooks/useCountUp";
import { Reveal } from "./Reveal";

function StatItem({ value, label }: { value: string; label: string }) {
  const { ref, display } = useCountUp<HTMLDivElement>(value);
  return (
    <div ref={ref} className="flex flex-col items-center gap-2 text-center">
      <span className="font-serif text-4xl text-or sm:text-5xl">{display}</span>
      <span className="text-xs tracking-[0.2em] text-ivoire/60">{label.toUpperCase()}</span>
    </div>
  );
}

export function Stats() {
  return (
    <section className="border-y border-or/10 bg-noir-soft py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="mb-12 text-center">
          <h2 className="font-serif text-2xl text-ivoire sm:text-3xl">{statsSection.title}</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-y-12 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
