"use client";

import { useState, type ReactNode } from "react";
import type { ServiceId } from "@/lib/demos/clos-et-cadre/services";

/**
 * Filters the server-rendered project cards by type. Cards arrive as
 * children keyed by service, so the list stays fully rendered (and
 * crawlable) without JavaScript; the filter only hides what doesn't match.
 */
export function ProjectFilters({
  options,
  items,
}: {
  options: { id: ServiceId; label: string; count: number }[];
  items: { service: ServiceId; key: string; node: ReactNode }[];
}) {
  const [active, setActive] = useState<ServiceId | "all">("all");
  const visible = items.filter((item) => active === "all" || item.service === active);

  const chip = (id: ServiceId | "all", label: string, count: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={active === id}
      onClick={() => setActive(id)}
      className={`min-h-11 border px-4 text-[14.5px] transition-colors ${
        active === id ? "border-[var(--cc-ink)] bg-[var(--cc-ink)] text-[var(--cc-bg)]" : "border-[var(--cc-line-strong)] hover:border-[var(--cc-ink)]"
      }`}
    >
      {label} <span className="ml-1 tabular-nums opacity-60">{count}</span>
    </button>
  );

  return (
    <>
      <div role="group" aria-label="Filtrer les réalisations par type de projet" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chip("all", "Tous les projets", items.length)}
        {options.map((option) => chip(option.id, option.label, option.count))}
      </div>
      <p aria-live="polite" className="sr-only">
        {visible.length} réalisation{visible.length > 1 ? "s" : ""} affichée{visible.length > 1 ? "s" : ""}
      </p>
      <div className="mt-12 grid gap-x-8 gap-y-14 md:grid-cols-2">
        {visible.map((item) => (
          <div key={item.key}>{item.node}</div>
        ))}
      </div>
    </>
  );
}
