import type { Motif as MotifName } from "@/lib/preview-engine/trades";

/**
 * Abstract, trade-flavoured line patterns. They are our own drawings — never
 * presented as a photo of the company's work — and give a page without
 * photos a finished, intentional look. Colour comes from `currentColor`.
 */

const PATTERNS: Record<MotifName, { size: number; path: string }> = {
  roof: { size: 48, path: "M0 36 L24 12 L48 36" },
  water: { size: 64, path: "M0 32 C16 20 32 44 48 32 S64 20 80 32" },
  spark: { size: 40, path: "M0 40 L40 0" },
  leaf: { size: 56, path: "M8 48 C8 20 36 8 48 8 C48 20 36 48 8 48 Z" },
  stone: { size: 60, path: "M0 0 H60 M0 30 H60 M30 0 V30 M0 30 V60 M60 30 V60" },
  grain: { size: 16, path: "M8 0 V16" },
  stroke: { size: 72, path: "M0 60 C24 48 48 24 72 12" },
  tile: { size: 40, path: "M0 0 H40 V40 H0 Z" },
  layers: { size: 24, path: "M0 12 H24" },
  air: { size: 80, path: "M40 40 m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0 M40 40 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0" },
  frame: { size: 64, path: "M8 8 H56 V56 H8 Z M20 20 H44 V44 H20 Z" },
};

export function Motif({ name, id, className }: { name: MotifName; id: string; className?: string }) {
  const pattern = PATTERNS[name] ?? PATTERNS.frame;
  const patternId = `gcp-motif-${id}`;
  return (
    <svg className={className} aria-hidden="true" focusable="false" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <pattern id={patternId} width={pattern.size} height={pattern.size} patternUnits="userSpaceOnUse">
          <path d={pattern.path} fill="none" stroke="currentColor" strokeWidth="1.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

/** A quiet "you are here" drawing for the area section — not a map, no invented zone. */
export function PlaceMark() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">
      {[92, 68, 44].map((r, i) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeOpacity={0.14 + i * 0.1} strokeWidth="1.25" />
      ))}
      <circle cx="100" cy="100" r="7" fill="currentColor" />
      <circle cx="100" cy="100" r="14" fill="currentColor" fillOpacity="0.16" />
    </svg>
  );
}
