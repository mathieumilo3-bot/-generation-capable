"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentPropsWithoutRef, MouseEvent } from "react";
import { track, type TrackingEvent } from "@/lib/tracking";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium tracking-tight transition-all duration-300 ease-[var(--ease-signature)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-text)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] active:scale-[0.98]",
  secondary:
    "border border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] active:scale-[0.98]",
  ghost:
    "text-[var(--color-muted)] hover:text-[var(--color-text)]",
};

type ButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: Variant;
  trackEvent?: TrackingEvent;
  trackPayload?: Record<string, string>;
};

export function Button({
  variant = "primary",
  className = "",
  trackEvent,
  trackPayload,
  onClick,
  ...props
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${className}`;
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (trackEvent) track(trackEvent, trackPayload);
    onClick?.(e);
  };

  // Native anchors handle hash navigation and external protocols reliably.
  // Next's router should only own internal application navigation.
  const href = typeof props.href === "string" ? props.href : "";
  const isNativeAnchor =
    href.includes("#") || /^(https?:|mailto:|tel:)/i.test(href);
  if (isNativeAnchor) {
    return (
      <a
        {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={classes}
        onClick={handleClick}
      />
    );
  }

  return <Link className={classes} onClick={handleClick} {...props} />;
}
