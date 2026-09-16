import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type CommonProps = {
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps & {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
};

type OutlineButtonProps = ButtonProps & {
  /** "onDark" (défaut) pour un fond sombre, "onLight" pour un fond clair/crème. */
  tone?: "onDark" | "onLight";
};

const isExternalOrAnchor = (href: string) => href.startsWith("#") || href.startsWith("/#");

/** CTA principal doré — le bouton le plus visible du site. */
export function GoldButton({ href, onClick, type = "button", children, className = "" }: ButtonProps) {
  const classes = `group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-or-clair to-or px-7 py-3.5 text-sm font-medium tracking-wide text-noir shadow-[0_8px_30px_-10px_rgba(198,161,91,0.65)] transition-all duration-300 hover:shadow-[0_12px_36px_-8px_rgba(198,161,91,0.8)] hover:-translate-y-0.5 active:translate-y-0 ${className}`;

  if (href) {
    if (isExternalOrAnchor(href)) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

/** Bouton discret, contour doré, pour les CTA secondaires. */
export function OutlineButton({
  href,
  onClick,
  type = "button",
  children,
  className = "",
  tone = "onDark",
}: OutlineButtonProps) {
  const toneClasses = tone === "onLight" ? "border-charbon/25 text-charbon" : "border-or/40 text-ivoire";
  const classes = `group inline-flex items-center gap-2.5 rounded-full border px-7 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 hover:border-or hover:bg-or/10 ${toneClasses} ${className}`;

  if (href) {
    if (isExternalOrAnchor(href)) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
