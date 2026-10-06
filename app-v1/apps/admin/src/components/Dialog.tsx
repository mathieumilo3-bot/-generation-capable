import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Notice } from "./ui";
import { errorMessage } from "../lib/errors";

interface ActionDialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** Étape 1 (formulaire). Absent : la boîte s'ouvre directement sur la confirmation. */
  form?: ReactNode;
  /** Appelé avant de passer à la confirmation ; retourne false si le formulaire est invalide. */
  validate?: () => boolean;
  /** Étape 2 : récapitulatif explicite (montant en euros pour toute action financière). */
  summary: ReactNode;
  continueLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Lève une erreur en cas d'échec (affichée dans la boîte, sans la fermer). */
  onConfirm: () => Promise<void>;
  /** Appelé après succès (la boîte est alors démontée par le parent). */
  onDone: () => void;
}

/**
 * Boîte de dialogue native <dialog> (focus piégé, Échap, arrière-plan inerte).
 * Monter la boîte = l'ouvrir : état, clé d'idempotence et erreurs sont donc neufs à chaque ouverture.
 * Double clic impossible : verrou synchrone + bouton désactivé pendant l'appel.
 */
export function ActionDialog(props: ActionDialogProps) {
  const { title, description, onClose, form, validate, summary, continueLabel = "Continuer", confirmLabel, danger, onConfirm, onDone } = props;
  const ref = useRef<HTMLDialogElement | null>(null);
  const lock = useRef(false);
  const titleId = useId();
  const [step, setStep] = useState<"form" | "confirm">(form ? "form" : "confirm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
      previous?.focus();
    };
  }, []);

  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onDone();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : errorMessage(e));
      lock.current = false;
      setBusy(false);
    }
  };

  const next = () => {
    if (!validate || validate()) setStep("confirm");
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="dialog__panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "form") next();
          else void submit();
        }}
      >
        <h2 id={titleId} className="dialog__title">{title}</h2>
        {description ? <div className="dialog__desc">{description}</div> : null}
        <div className="dialog__body">
          {step === "form" ? form : (
            <div className="confirm" aria-live="polite">
              <p className="confirm__lead">Veuillez confirmer explicitement :</p>
              {summary}
            </div>
          )}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
        <div className="dialog__actions">
          <Button disabled={busy} onClick={onClose}>Annuler</Button>
          {step === "confirm" && form ? (
            <Button disabled={busy} onClick={() => { setError(null); setStep("form"); }}>Retour</Button>
          ) : null}
          {step === "form" ? (
            <Button variant={danger ? "danger" : "primary"} type="submit">{continueLabel}</Button>
          ) : (
            <Button variant={danger ? "danger" : "primary"} type="submit" busy={busy}>{confirmLabel}</Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
