import { REVISION_COMMAND_LABEL, suggestTopup, type RevisionCommand, type RevisionPlan } from "@app/domain";

/** Logique pure de l'écran « Modifier » (testable sans React Native). */

const ORDER: RevisionCommand[] = ["shorter", "faster", "slower", "more_zooms", "less_zooms"];

/** Suggestions rapides = commandes du menu fermé EFFECTIVEMENT prises en charge par le moteur. */
export function quickCommands(supported: readonly string[]): RevisionCommand[] {
  return ORDER.filter((c) => supported.includes(c));
}

/** Texte envoyé : la demande libre + les suggestions cochées (sans doublon). */
export function composeInstructions(text: string, selected: readonly RevisionCommand[]): string {
  const base = text.trim();
  const extra = selected.map((c) => REVISION_COMMAND_LABEL[c]).filter((l) => !base.toLowerCase().includes(l.toLowerCase()));
  return [base, ...extra].filter((s) => s.length > 0).join(". ");
}

export type PlanStatus = "empty" | "ok" | "partial" | "unsupported";

export interface PlanView {
  status: PlanStatus;
  /** Libellés de ce qui sera appliqué. */
  applied: string[];
  message: string | null;
}

/** Aperçu honnête (§23) : ce qui sera appliqué, ce qui ne le sera pas. */
export function describePlan(instructions: string, plan: RevisionPlan): PlanView {
  if (instructions.trim().length === 0) return { status: "empty", applied: [], message: null };
  const applied = plan.commands.map((c) => REVISION_COMMAND_LABEL[c]);
  if (plan.commands.length === 0) {
    return { status: "unsupported", applied, message: "Nous ne pouvons pas encore appliquer cette demande. Choisissez l'une des modifications proposées." };
  }
  if (plan.hasUnsupportedParts) {
    return { status: "partial", applied, message: "Une partie de votre demande ne peut pas être réalisée pour le moment : elle sera ignorée." };
  }
  return { status: "ok", applied, message: null };
}

export function canSubmitPlan(view: PlanView): boolean {
  return view.status === "ok" || view.status === "partial";
}

/** Lien vers la recharge (écran du wallet) avec retour automatique vers l'écran courant. */
export function topupHref(shortfallCents: number, minTopupCents: number, presetsCents: readonly number[], returnTo: string): string {
  const amount = suggestTopup(shortfallCents, minTopupCents, presetsCents);
  return `/account/topup?amount=${amount}&returnTo=${encodeURIComponent(returnTo)}`;
}
