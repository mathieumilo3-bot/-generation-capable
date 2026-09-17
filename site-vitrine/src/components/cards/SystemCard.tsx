import { Card } from "@/components/ui/Card";
import type { System } from "@/lib/data/systems";

export function SystemCard({ system }: { system: System }) {
  return (
    <Card className="flex h-full flex-col justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
          {system.code}
        </p>
        <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          {system.name}
        </h3>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
          {system.headline}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          {system.description}
        </p>
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-6">
        {system.capabilities.map((capability) => (
          <li key={capability} className="text-xs text-[var(--color-muted)]">
            {capability}
          </li>
        ))}
      </ul>
    </Card>
  );
}
