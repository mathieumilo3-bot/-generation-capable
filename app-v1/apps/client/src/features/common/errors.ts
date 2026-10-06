import { ApiError } from "@app/api";
import { errorCodeOf } from "@app/domain";

interface HttpErrorLike { context?: { json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } } }

/**
 * Code d'erreur lisible. Les Edge Functions renvoient `{ ok:false, code }` dans le corps d'une réponse non-2xx :
 * supabase-js ne garde alors qu'un message générique, on relit donc le corps quand il est disponible.
 */
export async function resolveErrorCode(err: unknown): Promise<string> {
  const base = err instanceof ApiError ? err.code : errorCodeOf(err);
  if (base !== "unknown") return base;
  const cause = err instanceof ApiError ? err.cause : err;
  const ctx = (cause as HttpErrorLike | null | undefined)?.context;
  if (!ctx) return base;
  try {
    const body: unknown = ctx.clone ? await ctx.clone().json() : ctx.json ? await ctx.json() : null;
    const code = (body as { code?: unknown } | null)?.code;
    return typeof code === "string" && /^[a-z_]+$/.test(code) ? code : base;
  } catch {
    return base;
  }
}
