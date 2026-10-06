import React from "react";
import { useRouter } from "expo-router";
import { Notice } from "@app/ui";
import type { ErrorAction, HumanError } from "@app/domain";
import { href } from "@/lib/href";

/**
 * Erreur humaine (§43) : ce qui s'est passé, l'état de l'argent, l'action possible.
 * `onRetry` couvre « Réessayer », « Reprendre l'envoi » et « Continuer » ; les autres actions naviguent.
 */
export function HumanErrorNotice({ error, onRetry, onAction }: { error: HumanError; onRetry?: () => void; onAction?: (a: ErrorAction) => boolean | void }) {
  const router = useRouter();
  const act = () => {
    if (onAction?.(error.action) === true) return;
    switch (error.action) {
      case "retry": case "resume_upload": onRetry?.(); break;
      case "topup": router.push(href("/account/topup")); break;
      case "contact_support": router.push(href("/account/help")); break;
      case "go_home": router.replace(href("/(tabs)")); break;
      case "sign_in": router.replace(href("/sign-in")); break;
      default: break;
    }
  };
  const actionable = error.actionLabel !== null && error.action !== "none"
    && !((error.action === "retry" || error.action === "resume_upload") && !onRetry && !onAction);
  return (
    <Notice
      tone="error"
      icon="alert-circle-outline"
      title={error.title}
      body={[error.detail, error.money].filter(Boolean).join(" ")}
      actionLabel={actionable ? error.actionLabel : null}
      onAction={actionable ? act : undefined}
    />
  );
}
