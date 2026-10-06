import React from "react";
import { humanizeError, type ErrorContext, type HumanError } from "@app/domain";
import { Notice } from "@app/ui";

/** Erreur humaine (§43) : que s'est-il passé, mon argent est-il en sécurité, que faire. Jamais de message brut. */
export function ErrorNotice({ error, onAction, fallbackAction, tone = "error" }: {
  error: HumanError; onAction?: () => void; fallbackAction?: boolean; tone?: "error" | "warning";
}) {
  const body = [error.detail, error.money].filter(Boolean).join(" ");
  const actionable = error.action !== "none" && !!error.actionLabel && !!onAction;
  return (
    <Notice tone={tone} icon="alert-circle-outline" title={error.title} body={body}
      actionLabel={actionable ? error.actionLabel : fallbackAction && onAction ? "Réessayer" : null} onAction={onAction} />
  );
}

export function errorFromCode(code: string | undefined | null, ctx?: ErrorContext): HumanError {
  return humanizeError(code, ctx);
}

/** Code d'erreur d'une exception (ApiError.code) sans jamais exposer son message. */
export function codeOfThrown(err: unknown): string {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "unknown";
}
