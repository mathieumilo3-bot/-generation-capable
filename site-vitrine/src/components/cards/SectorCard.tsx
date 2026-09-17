import Link from "next/link";
import type { Sector } from "@/lib/data/sectors";

export function SectorCard({ sector }: { sector: Sector }) {
  return (
    <Link
      href={`/secteurs/${sector.slug}`}
      className="group flex items-center justify-between border-b border-[var(--color-border)] py-6 transition-colors duration-300 hover:border-[var(--color-accent)]"
    >
      <div>
        <h3 className="font-display text-xl font-medium text-[var(--color-text)]">
          {sector.name}
        </h3>
        <p className="mt-1 max-w-md text-sm text-[var(--color-muted)]">
          {sector.problem}
        </p>
      </div>
      <span className="ml-6 shrink-0 text-[var(--color-muted)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-accent)]">
        →
      </span>
    </Link>
  );
}
