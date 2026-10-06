import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface BaseProps { label: string; hint?: ReactNode; error?: string | undefined }

function describedBy(id: string, hint: ReactNode, error: string | undefined): string | undefined {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ");
  return ids || undefined;
}

export function TextField({ label, hint, error, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label htmlFor={id} className="field__label">{label}</label>
      <input id={id} {...rest} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} />
      {hint ? <div id={`${id}-hint`} className="field__hint">{hint}</div> : null}
      {error ? <div id={`${id}-err`} className="field__error" role="alert">{error}</div> : null}
    </div>
  );
}

export function TextArea({ label, hint, error, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label htmlFor={id} className="field__label">{label}</label>
      <textarea id={id} {...rest} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} />
      {hint ? <div id={`${id}-hint`} className="field__hint">{hint}</div> : null}
      {error ? <div id={`${id}-err`} className="field__error" role="alert">{error}</div> : null}
    </div>
  );
}

export function SelectField({ label, hint, error, children, ...rest }: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label htmlFor={id} className="field__label">{label}</label>
      <select id={id} {...rest} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)}>{children}</select>
      {hint ? <div id={`${id}-hint`} className="field__hint">{hint}</div> : null}
      {error ? <div id={`${id}-err`} className="field__error" role="alert">{error}</div> : null}
    </div>
  );
}

/** Champ « Motif » partagé par toutes les actions sensibles (≥ 5 caractères, journalisé dans l'audit). */
export function ReasonField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | undefined }) {
  return (
    <TextArea
      label="Motif (obligatoire)"
      hint="Au moins 5 caractères. Enregistré dans le journal d'audit."
      rows={3}
      maxLength={500}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      required
    />
  );
}
