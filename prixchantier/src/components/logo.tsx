export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className ?? ""}`}>
      <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
        PC
      </span>
      PrixChantier
    </span>
  );
}
