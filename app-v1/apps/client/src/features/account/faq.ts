import { formatEuros } from "@app/domain";
import { RETENTION_QUESTION, retentionAnswer, type RetentionHours } from "../retention/logic";

export interface FaqItem { id: string; question: string; answer: string }

/**
 * Contenu d'aide : uniquement des faits vrais pour la V1. Les prix viennent des règles chargées
 * (jamais écrits en dur) ; sans règles, la réponse reste générale.
 */
export function buildFaq(o: {
  minPriceCents: number | null; maxPriceCents: number | null; supportEmail: string;
  /** Durée de conservation (réglages serveur). */
  retention: RetentionHours;
  /** Les modifications de vidéo ne sont mentionnées que si le réglage serveur les active. */
  revisionsEnabled?: boolean;
}): FaqItem[] {
  const priceRange = o.minPriceCents !== null && o.maxPriceCents !== null
    ? ` Aujourd'hui, un montage coûte de ${formatEuros(o.minPriceCents)} à ${formatEuros(o.maxPriceCents)} selon la durée choisie.`
    : "";
  const items: FaqItem[] = [
    {
      id: "duration", question: "Combien de temps faut-il pour obtenir ma vidéo ?",
      answer: "Cela dépend de la longueur de vos vidéos et du nombre de demandes en cours. Vous suivez l'avancement en direct, étape par étape, et vous pouvez fermer l'application : nous vous prévenons dès que votre vidéo est prête.",
    },
    {
      id: "price", question: "Combien ça coûte ?",
      answer: `Le prix dépend de la durée de la vidéo finale. Il est toujours affiché avant de lancer la création, et vous payez ce montant, pas un euro de plus.${priceRange}`,
    },
    {
      id: "failure", question: "Que se passe-t-il si la création échoue ?",
      answer: "Au lancement, le montant est réservé sur votre solde, pas encore encaissé. Si le rendu échoue de façon définitive, le montant réservé est automatiquement libéré et vous le retrouvez dans votre solde. Vous le voyez dans votre historique.",
    },
    {
      id: "data", question: "Que deviennent mes fichiers et mes données ?",
      answer: "Vos fichiers sont stockés dans un espace privé, accessible uniquement depuis votre compte. Les liens de lecture et de téléchargement sont temporaires. Les échanges sont protégés par HTTPS et vos données sont séparées de celles des autres clients. Vous pouvez supprimer un projet ou votre compte à tout moment.",
    },
    {
      id: "retention", question: RETENTION_QUESTION,
      answer: retentionAnswer(o.retention),
    },
    {
      id: "topup", question: "Comment ajouter de l'argent ?",
      answer: "Depuis Compte, puis Paiements, ou directement au moment de créer une vidéo si votre solde ne suffit pas : vous revenez ensuite au récapitulatif sans rien recommencer.",
    },
    {
      id: "contact", question: "Je n'ai pas ma réponse.",
      answer: `Utilisez « Signaler un problème » ci-dessous, ou écrivez-nous à ${o.supportEmail}.`,
    },
  ];
  if (o.revisionsEnabled === true) {
    const at = items.findIndex((i) => i.id === "data");
    items.splice(at, 0, {
      id: "revisions", question: "Puis-je modifier ma vidéo ?",
      answer: "Oui. Depuis votre vidéo terminée, choisissez « Modifier » : vous indiquez ce que vous voulez (par exemple plus court, plus rapide, plus ou moins de zooms). Le prix de la modification est affiché avant de valider. Elle crée une nouvelle version : la précédente est conservée.",
    });
  }
  return items;
}
