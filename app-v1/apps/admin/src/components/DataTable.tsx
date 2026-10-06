import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "right";
  className?: string;
}

interface DataTableProps<T> {
  caption: string;
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Si fourni : la ligne est cliquable (souris) ; garder un lien dans une cellule pour le clavier. */
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyText?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({ caption, columns, rows, rowKey, onRowClick, emptyTitle = "Aucun résultat", emptyText, rowClassName }: DataTableProps<T>) {
  if (rows.length === 0) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "right" ? "right" : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={[onRowClick ? "is-clickable" : "", rowClassName?.(row) ?? ""].filter(Boolean).join(" ") || undefined}
              onClick={onRowClick ? (e) => {
                // Ne pas détourner les clics sur les liens/boutons de la ligne.
                if ((e.target as HTMLElement).closest("a,button,summary,details,input,select,textarea")) return;
                onRowClick(row);
              } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={[c.align === "right" ? "right num" : "", c.className ?? ""].filter(Boolean).join(" ") || undefined}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, hasNext, onPage, loading }: { page: number; hasNext: boolean; onPage: (p: number) => void; loading?: boolean }) {
  if (page === 0 && !hasNext) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button small disabled={page === 0 || loading} onClick={() => onPage(page - 1)}>← Précédent</Button>
      <span className="pagination__page" aria-current="page">Page {page + 1}</span>
      <Button small disabled={!hasNext || loading} onClick={() => onPage(page + 1)}>Suivant →</Button>
    </nav>
  );
}

export function IdLink({ to, id, label }: { to: string; id: string | null; label?: string }) {
  if (!id) return <span className="muted">—</span>;
  return <Link to={to} className="mono" title={id}>{label ?? id.slice(0, 8)}</Link>;
}
