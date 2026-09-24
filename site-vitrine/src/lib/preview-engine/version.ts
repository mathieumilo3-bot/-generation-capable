/** Bumped when the pipeline's behaviour changes. Stored on every preview. */
export const PREVIEW_ENGINE_VERSION = "preview-2.0.0";
/** Bumped when the truth bundle changes shape or meaning: invalidates cached company data. */
export const PREVIEW_DATA_VERSION = "data-2";
/** Bumped when the blueprint/renderer contract changes: cached data is reused, only the blueprint is rebuilt. */
export const PREVIEW_BLUEPRINT_VERSION = "bp-1";

export type PreviewMode = "off" | "internal" | "on";

/**
 * Feature flag. "internal" (default): the V2 routes work but nothing public
 * links to them. "off": every V2 route answers 404. "on" is reserved for the
 * explicit, validated switch of a share of the ad traffic.
 */
export function previewMode(): PreviewMode {
  const raw = (process.env.GC_PREVIEW_V2 ?? "internal").trim().toLowerCase();
  return raw === "off" || raw === "on" ? raw : "internal";
}
