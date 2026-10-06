import { layoutBars, layoutSegments, type BarDatum, type Segment } from "../lib/charts";

export interface BarItem extends BarDatum { display: string; tone?: "accent" | "success" | "warning" | "muted" }

/** Barres horizontales (SVG) : largeur relative au maximum, valeur exacte en texte. Aucune donnée inventée. */
export function BarList({ items, ariaLabel }: { items: readonly BarItem[]; ariaLabel: string }) {
  const laid = layoutBars(items);
  return (
    <ul className="bars" aria-label={ariaLabel}>
      {laid.map((b) => (
        <li key={b.key} className="bars__row">
          <span className="bars__label">{b.label}</span>
          <svg className="bars__svg" viewBox="0 0 100 8" preserveAspectRatio="none" role="presentation" aria-hidden="true">
            <rect x="0" y="0" width="100" height="8" rx="2" className="bars__track" />
            {b.pct > 0 ? <rect x="0" y="0" width={b.pct} height="8" rx="2" className={`bars__fill bars__fill--${b.tone ?? "accent"}`} /> : null}
          </svg>
          <span className="bars__value num">{b.display}</span>
        </li>
      ))}
    </ul>
  );
}

export interface SegmentItem extends Segment { tone: "success" | "danger" | "info" }

/** Barre empilée (SVG) + légende textuelle chiffrée. */
export function StackedBar({ items, ariaLabel, emptyLabel }: { items: readonly SegmentItem[]; ariaLabel: string; emptyLabel: string }) {
  const laid = layoutSegments(items);
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return <p className="muted">{emptyLabel}</p>;
  return (
    <div>
      <svg className="stacked" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        {laid.map((s, i) => {
          const tone = items[i]?.tone ?? "info";
          return s.pct > 0 ? <rect key={s.key} x={s.offset} y="0" width={s.pct} height="10" className={`stacked__seg stacked__seg--${tone}`} /> : null;
        })}
      </svg>
      <ul className="legend">
        {items.map((s) => (
          <li key={s.key}>
            <span className={`legend__dot legend__dot--${s.tone}`} aria-hidden="true" />
            {s.label} <strong className="num">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
