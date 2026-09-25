import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { isToFill, type ToFill } from "@/lib/demos/clos-et-cadre/company";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>{children}</div>;
}

type CtaVariant = "primary" | "secondary" | "light";

const ctaBase =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-[2px] px-6 text-[15px] font-medium transition-colors duration-300 ease-[var(--cc-ease)]";

const ctaVariants: Record<CtaVariant, string> = {
  primary: "bg-[var(--cc-ink)] text-[var(--cc-bg)] hover:bg-[var(--cc-accent)]",
  secondary: "border border-[var(--cc-line-strong)] text-[var(--cc-ink)] hover:border-[var(--cc-ink)]",
  light: "bg-[var(--cc-on-dark)] text-[var(--cc-ink)] hover:bg-white",
};

export function Cta({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: CtaVariant }) {
  return (
    <Link className={`${ctaBase} ${ctaVariants[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 10h14M12 5l5 5-5 5" />
    </svg>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`cc-label text-[var(--cc-accent)] ${className}`}>{children}</p>;
}

/**
 * An information the real company must supply. Rendered visibly, so nobody
 * — prospect, reviewer or GC — can mistake an empty slot for a real fact.
 */
export function Slot({ value, className = "" }: { value: ToFill | string; className?: string }) {
  if (!isToFill(value)) return <>{value}</>;
  return (
    <span
      className={`cc-slot inline-flex items-center gap-2 rounded-[2px] border border-dashed border-[var(--cc-accent)]/50 px-2 py-0.5 align-baseline text-[0.85em] text-[var(--cc-accent)] ${className}`}
      title="Information à fournir par l'entreprise — jamais inventée"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-current" />
      <span>
        <span className="sr-only">À compléter : </span>
        {value.toFill}
      </span>
    </span>
  );
}

/** A block-level proof placeholder: the frame of a proof, waiting for the real one. */
export function SlotBlock({ title, need, children, className = "" }: { title: string; need: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`cc-slot border border-dashed border-[var(--cc-accent)]/45 p-5 ${className}`}>
      <p className="cc-label text-[var(--cc-accent)]">À compléter — {title}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--cc-muted)]">{need}</p>
      {children}
    </div>
  );
}

/**
 * Génération Capable's strategic annotation. Hidden by default (the demo must
 * read as the client's own site), revealed by the ribbon toggle.
 */
export function StrategyNote({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <aside className={`cc-note border-l-2 border-[#e5b94a] bg-[#0b0b0b] px-5 py-4 text-[14px] leading-relaxed text-[#e9e6df] ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e5b94a]">GC · {title}</p>
      <div className="mt-2 text-[#c9c5bc]">{children}</div>
    </aside>
  );
}

export function SectionHeading({
  kicker,
  title,
  intro,
  className = "",
  as: Tag = "h2",
}: {
  kicker?: string;
  title: ReactNode;
  intro?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={`max-w-3xl ${className}`}>
      {kicker && <Kicker>{kicker}</Kicker>}
      <Tag className={`cc-serif text-balance ${kicker ? "mt-4" : ""} text-[34px] leading-[1.08] sm:text-[44px] lg:text-[52px]`}>{title}</Tag>
      {intro && <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[var(--cc-muted)]">{intro}</p>}
    </div>
  );
}
