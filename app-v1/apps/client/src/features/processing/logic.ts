import { describeJob, formatEuros, type JobStatus, type JobView } from "@app/domain";

/** Logique pure du suivi de création (testable sans React Native). */

export const JOB_POLL_MS = 4_000;

/** Intervalle de repli : on continue de sonder tant que le job est actif (Realtime peut être coupé). */
export function jobPollInterval(status: JobStatus | undefined): number | false {
  if (!status) return JOB_POLL_MS;
  const v = describeJob(status, 0);
  return v.isTerminal ? false : JOB_POLL_MS;
}

/** Valeur de la barre 0..1, ou null (état indéterminé honnête) tant que le moteur n'a rien mesuré. */
export function progressValue(view: JobView): number | null {
  return view.percent === null ? null : Math.max(0, Math.min(1, view.percent / 100));
}

export function percentLabel(view: JobView): string | null {
  return view.percent === null ? null : `${Math.round(view.percent)} %`;
}

export function reservedLabel(priceCents: number): string {
  return `${formatEuros(priceCents)} réservés`;
}

export function titleForJob(job: { kind: "create" | "revision" }, status: JobStatus): string {
  const v = describeJob(status, 0);
  if (v.tone === "success") return "Votre vidéo est prête";
  if (v.tone === "error") return job.kind === "revision" ? "La modification n'a pas pu être terminée" : "Le montage n'a pas pu être terminé";
  if (v.tone === "neutral") return "Création annulée";
  return job.kind === "revision" ? "Nous modifions votre vidéo" : "Nous créons votre vidéo";
}
