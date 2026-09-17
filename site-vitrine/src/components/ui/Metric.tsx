export function Metric({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
      <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
      {label}
    </div>
  );
}
