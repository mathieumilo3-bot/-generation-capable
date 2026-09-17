import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
      {children}
    </span>
  );
}
