/**
 * Commandes fermées de l'édition conversationnelle V1 (§15 du brief).
 * Chaque commande correspond à une transformation déterministe du
 * blueprint — pas de langage naturel ouvert dans le MVP.
 */
export const CONVERSATIONAL_COMMANDS = [
  "faster",
  "slower",
  "shorter",
  "more_broll",
  "less_broll",
  "different_hook",
  "more_zooms",
  "less_zooms",
  "change_music",
  "more_dynamic_captions",
] as const;
export type ConversationalCommand = (typeof CONVERSATIONAL_COMMANDS)[number];

export const CONVERSATIONAL_COMMAND_LABEL_FR: Record<ConversationalCommand, string> = {
  faster: "Plus rapide",
  slower: "Plus lent",
  shorter: "Plus court",
  more_broll: "Plus de B-roll",
  less_broll: "Moins de B-roll",
  different_hook: "Autre hook",
  more_zooms: "Plus de zooms",
  less_zooms: "Moins de zooms",
  change_music: "Changer la musique",
  more_dynamic_captions: "Sous-titres plus dynamiques",
};

export type FeedbackEventType =
  | "accept"
  | "download"
  | "conversational_command"
  | "reject_hook"
  | "remove_zoom"
  | "custom_note";

export interface FeedbackEvent {
  id: string;
  projectId: string;
  renderId: string | null;
  type: FeedbackEventType;
  command: ConversationalCommand | null;
  note: string | null;
  createdAt: string;
}
