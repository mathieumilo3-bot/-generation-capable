import { stats } from "../data/content";
import { useCountUp } from "../hooks/useCountUp";

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
    <section className="border-y border-or/10 bg-noir-soft py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-12 px-6 lg:grid-cols-4 lg:px-10">
        {stats.map((stat) => (
          <StatItem key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}
