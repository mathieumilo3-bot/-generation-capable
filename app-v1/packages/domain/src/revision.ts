/**
 * Modifications (§23). Le moteur actuel n'accepte qu'un menu FERMÉ de commandes
 * (voir engine_capabilities.revisions.commands). Ce mapper transforme un texte
 * libre en commandes supportées ET dit honnêtement ce qui ne peut pas être
 * appliqué — avant que l'utilisateur ne paie.
 */
export type RevisionCommand = "shorter" | "faster" | "slower" | "more_zooms" | "less_zooms";

export const REVISION_COMMAND_LABEL: Record<RevisionCommand, string> = {
  shorter: "Plus court", faster: "Plus rapide", slower: "Plus lent", more_zooms: "Plus de zooms", less_zooms: "Moins de zooms",
};

const RULES: { cmd: RevisionCommand; re: RegExp }[] = [
  { cmd: "less_zooms", re: /(moins de zoom|sans zoom|retire[rz]? (les )?zoom|enl[eè]ve[rz]? (les )?zoom|less zoom|fewer zoom)/i },
  { cmd: "more_zooms", re: /(plus de zoom|davantage de zoom|zoome|more zoom|ajoute[rz]? (des )?zoom)/i },
  { cmd: "shorter", re: /(raccourci|plus court|r[ée]duis|trop long|coupe (l'|la |le |les )?(intro|fin|d[ée]but)|shorter|trim|condense)/i },
  { cmd: "faster", re: /(plus rapide|acc[ée]l[eè]re|plus dynamique|rythme (plus )?(rapide|soutenu)|plus nerveux|faster|speed up)/i },
  { cmd: "slower", re: /(plus lent|ralenti|plus pos[ée]|plus calme|moins rapide|slower|slow down)/i },
];

export interface RevisionPlan {
  commands: RevisionCommand[];
  /** Vrai si le texte contient des demandes que le moteur ne sait pas (encore) faire. */
  hasUnsupportedParts: boolean;
}

export function planRevision(text: string, supported: readonly string[]): RevisionPlan {
  const commands: RevisionCommand[] = [];
  let remaining = text;
  for (const { cmd, re } of RULES) {
    if (re.test(remaining) && supported.includes(cmd) && !commands.includes(cmd)) {
      commands.push(cmd);
    }
    remaining = remaining.replace(re, " ");
  }
  // Conflits : on ne garde pas deux commandes contradictoires.
  const drop = (a: RevisionCommand, b: RevisionCommand) => {
    if (commands.includes(a) && commands.includes(b)) { commands.splice(commands.indexOf(b), 1); }
  };
  drop("faster", "slower"); drop("more_zooms", "less_zooms");
  // Reste significatif = mots d'au moins 4 lettres hors mots vides courants.
  const stop = new Set(["avec", "pour", "dans", "mais", "plus", "moins", "vers", "cette", "votre", "vidéo", "video", "intro", "very", "the", "and", "please", "svp"]);
  const leftovers = remaining.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ]{4,}/g)?.filter((w) => !stop.has(w)) ?? [];
  return { commands, hasUnsupportedParts: commands.length === 0 || leftovers.length >= 2 };
}
