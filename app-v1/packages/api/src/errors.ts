import { errorCodeOf } from "@app/domain";

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message?: string, override readonly cause?: unknown) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(errorCodeOf(err), err instanceof Error ? err.message : String(err), err);
}

/** Déballe `{data, error}` de supabase-js ; lève ApiError(code) en cas d'erreur. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw toApiError(res.error);
  return res.data as T;
}
