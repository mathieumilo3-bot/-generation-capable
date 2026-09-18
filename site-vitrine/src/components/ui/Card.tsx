import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[0_12px_50px_rgba(0,0,0,0.12)] transition-all duration-500 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] hover:shadow-[0_20px_70px_rgba(0,0,0,0.2)] ${className}`}
    >
      {children}
    </div>
  );
}
