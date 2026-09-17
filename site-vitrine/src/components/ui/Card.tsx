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
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors duration-300 hover:border-[var(--color-border-strong)] ${className}`}
    >
      {children}
    </div>
  );
}
