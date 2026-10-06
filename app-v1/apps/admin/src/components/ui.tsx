import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Tone } from "../lib/status";
import { errorMessage } from "../lib/errors";
import { prettyJson } from "../lib/format";
import type { AsyncResult } from "../hooks/useAsync";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  small?: boolean;
  busy?: boolean;
}

export function Button({ variant = "secondary", small, busy, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  const cls = ["btn", `btn--${variant}`, small ? "btn--sm" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button {...rest} type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy ? <span className="spinner spinner--inline" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Notice({ tone = "info", title, children, onDismiss }: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div className="notice__body">
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="notice__close" onClick={onDismiss} aria-label="Fermer le message">×</button>
      ) : null}
    </div>
  );
}

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__text">{children}</p> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p className="error-state__title">Impossible de charger ces données</p>
      <p className="error-state__text">{errorMessage(error)}</p>
      {onRetry ? <Button onClick={onRetry}>Réessayer</Button> : null}
    </div>
  );
}

/** Affiche chargement / erreur / contenu pour un `useAsync`. */
export function Loadable<T>({ result, children }: { result: AsyncResult<T>; children: (data: T) => ReactNode }) {
  if (result.error && result.data === null) return <ErrorState error={result.error} onRetry={result.reload} />;
  if (result.data === null) return <Spinner />;
  return (
    <div aria-busy={result.loading || undefined} className={result.loading ? "is-refreshing" : undefined}>
      {result.error ? <Notice tone="error" title="Actualisation impossible">{errorMessage(result.error)}</Notice> : null}
      {children(result.data)}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section className={`card ${className ?? ""}`} aria-labelledby={title ? id : undefined}>
      {title || actions ? (
        <div className="card__head">
          {title ? <h2 id={id} className="card__title">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "success" | "danger" }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className={`stat__value${tone ? ` stat__value--${tone}` : ""}`}>{value}</div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  );
}

export function KeyValue({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="kv">
      {items.map((it) => (
        <div key={it.label} className="kv__row">
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const t = tabs[next];
    if (t) {
      onChange(t.id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className={`tab${value === t.id ? " tab--active" : ""}`}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>{children}</div>;
}

export function JsonView({ value, summary = "Détails JSON" }: { value: unknown; summary?: string }) {
  const empty = value === null || value === undefined || (typeof value === "object" && Object.keys(value as object).length === 0);
  if (empty) return <span className="muted">—</span>;
  return (
    <details className="json">
      <summary>{summary}</summary>
      <pre>{prettyJson(value)}</pre>
    </details>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = "Copier", small }: { text: string; label?: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <Button
      small={small}
      onClick={async () => setState((await copyText(text)) ? "ok" : "fail")}
      aria-live="polite"
    >
      {state === "ok" ? "Copié" : state === "fail" ? "Copie impossible" : label}
    </Button>
  );
}

export function ReadOnlyHint({ role }: { role: string }) {
  return (
    <p className="muted small" role="note">
      Rôle « {role} » : consultation uniquement. Les actions d'écriture sont réservées au rôle administrateur.
    </p>
  );
}
