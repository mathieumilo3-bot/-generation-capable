export interface EngineCapabilities {
  autonomous_creation: boolean;
  aspect_ratios: string[];
  max_duration_sec?: number;
  reference_mode: boolean;
  revisions: { enabled: boolean; commands: string[] };
  voice_instructions?: boolean;
}

export const FALLBACK_CAPABILITIES: EngineCapabilities = {
  autonomous_creation: false,
  aspect_ratios: ["9:16"],
  reference_mode: false,
  revisions: { enabled: false, commands: [] },
};

/** Valide/normalise la ligne serveur : en cas de doute on désactive (« ne jamais montrer une fonction non supportée », §51). */
export function normalizeCapabilities(raw: unknown): EngineCapabilities {
  if (!raw || typeof raw !== "object") return FALLBACK_CAPABILITIES;
  const r = raw as Record<string, unknown>;
  const rev = (r.revisions ?? {}) as Record<string, unknown>;
  return {
    autonomous_creation: r.autonomous_creation === true,
    aspect_ratios: Array.isArray(r.aspect_ratios) ? r.aspect_ratios.filter((x): x is string => typeof x === "string") : ["9:16"],
    max_duration_sec: typeof r.max_duration_sec === "number" ? r.max_duration_sec : undefined,
    reference_mode: r.reference_mode === true,
    revisions: {
      enabled: rev.enabled === true,
      commands: Array.isArray(rev.commands) ? rev.commands.filter((x): x is string => typeof x === "string") : [],
    },
    voice_instructions: r.voice_instructions === true,
  };
}

export type CreationMode = "edit_rushes" | "autonomous";

export function availableModes(caps: EngineCapabilities): CreationMode[] {
  return caps.autonomous_creation ? ["edit_rushes", "autonomous"] : ["edit_rushes"];
}

export interface EditingMethod {
  id: string;
  slug: string;
  name: string;
  description: string;
  advanced: boolean;
  recommended: boolean;
  sort_order: number;
  capabilities: { modes?: string[]; requires_references?: boolean; requires_instructions?: boolean };
  configuration: Record<string, unknown>;
}

/** Méthodes utilisables pour un mode, compte tenu des capacités du moteur. */
export function usableMethods(methods: readonly EditingMethod[], mode: CreationMode, caps: EngineCapabilities): EditingMethod[] {
  return methods
    .filter((m) => (m.capabilities.modes ?? []).includes(mode))
    .filter((m) => (m.capabilities.requires_references ? caps.reference_mode : true))
    .sort((a, b) => a.sort_order - b.sort_order);
}
