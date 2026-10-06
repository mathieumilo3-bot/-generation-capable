/**
 * Les RPC admin ne renvoient pas de total : on demande `size + 1` lignes pour savoir
 * s'il existe une page suivante, sans second appel.
 */
export const PAGE_SIZE = 25;

export interface PageRequest { limit: number; offset: number; size: number; page: number }

export function pageRequest(page: number, size: number = PAGE_SIZE): PageRequest {
  const p = Number.isInteger(page) && page >= 0 ? page : 0;
  return { limit: size + 1, offset: p * size, size, page: p };
}

export interface Page<T> { rows: T[]; hasNext: boolean; page: number }

export function toPage<T>(rows: T[], req: PageRequest): Page<T> {
  return { rows: rows.slice(0, req.size), hasNext: rows.length > req.size, page: req.page };
}

export function parsePageParam(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n - 1 : 0;
}
