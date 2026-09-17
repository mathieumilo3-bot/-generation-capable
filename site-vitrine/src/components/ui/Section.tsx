import type { ReactNode } from "react";

export function Section({
  children,
  className = "",
  id,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "default" | "raised" | "black";
}) {
  const toneClass =
    tone === "raised"
      ? "bg-[var(--color-surface)]"
      : tone === "black"
        ? "bg-black"
        : "bg-[var(--color-bg)]";

  return (
    <section id={id} className={`relative ${toneClass} ${className}`}>
      <div className="mx-auto w-full max-w-[var(--container-max)] px-6 sm:px-8 lg:px-10">
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
      {children}
    </p>
  );
}
