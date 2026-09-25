"use client";

import { useId, useState } from "react";
import type { SceneId } from "@/lib/demos/clos-et-cadre/projects";
import { Drawing } from "./Drawing";

/**
 * Before/after comparison. A native range input drives it, so it works with
 * a finger, a mouse, the keyboard (arrows, Home/End) and a screen reader —
 * no pointer-capture code to get wrong. The explanation underneath is part of
 * the component on purpose: a slider without "what was wrong, what we did,
 * what it became" is a gadget.
 */
export function BeforeAfter({
  scene,
  explanation,
  className = "",
}: {
  scene: SceneId;
  explanation?: { before: string; intervention: string; after: string };
  className?: string;
}) {
  const [position, setPosition] = useState(50);
  const uid = useId().replace(/:/g, "");

  return (
    <figure className={className}>
      <div className="relative overflow-hidden bg-[var(--cc-paper)] select-none lg:aspect-[1.85]">
        <Drawing scene={scene} state="before" uid={`${uid}b`} className="lg:h-full" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
          <Drawing scene={scene} state="after" uid={`${uid}a`} className="lg:h-full" />
        </div>

        <span className="cc-label pointer-events-none absolute left-3 top-3 bg-[var(--cc-bg)]/90 px-2.5 py-1.5 text-[11px] text-[var(--cc-ink)] sm:left-5 sm:top-5">
          Avant
        </span>
        <span className="cc-label pointer-events-none absolute right-3 top-3 bg-[var(--cc-ink)] px-2.5 py-1.5 text-[11px] text-[var(--cc-bg)] sm:right-5 sm:top-5">
          Après
        </span>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label="Comparer l'état existant et l'état livré"
          aria-valuetext={`${100 - position} % de l'état livré visible`}
          className="cc-compare-range absolute inset-0 z-10 h-full w-full touch-pan-y"
        />
        <div className="cc-compare-handle pointer-events-none absolute inset-y-0 z-0" style={{ left: `${position}%` }} aria-hidden="true">
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-[var(--cc-bg)]" />
          <div className="cc-compare-knob absolute top-1/2 -ml-6 -mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cc-bg)] text-[var(--cc-ink)] shadow-[0_2px_14px_rgba(0,0,0,0.18)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </div>
        </div>
      </div>

      {explanation && (
        <figcaption className="mt-6 grid gap-6 border-t border-[var(--cc-line)] pt-6 sm:grid-cols-3">
          {(
            [
              ["État initial", explanation.before],
              ["Intervention", explanation.intervention],
              ["Résultat", explanation.after],
            ] as const
          ).map(([title, text]) => (
            <div key={title}>
              <p className="cc-label text-[var(--cc-muted)]">{title}</p>
              <p className="mt-2 text-[15px] leading-relaxed">{text}</p>
            </div>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
