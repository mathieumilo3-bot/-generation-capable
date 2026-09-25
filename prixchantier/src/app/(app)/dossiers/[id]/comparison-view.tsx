"use client";

import { useState } from "react";
import { AlertTriangle, Download, Info, Lightbulb, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConsultationStatusBadge } from "@/components/page";
import type { Cell, Comparison, SupplierSummary } from "@/lib/comparison/compute";
import { euros, euros2, quantity } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "missing" | "differences" | "lowest" | "toVerify";

const FILTERS: [Filter, string][] = [
  ["all", "Toutes les lignes"],
  ["missing", "Lignes manquantes"],
  ["differences", "Différences"],
  ["lowest", "Prix les plus bas"],
  ["toVerify", "Correspondances à vérifier"],
];

const ALERT_LABEL: Record<string, string> = {
  qty_diff: "Quantité différente",
  unit_diff: "Unité différente",
  alternative: "Variante / produit alternatif",
  low_confidence: "Lecture incertaine",
  computed_total: "Total calculé (PU × quantité)",
};

export function ComparisonView({ projectId, comparison }: { projectId: string; comparison: Comparison }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { lines, suppliers, cells, insights } = comparison;
  const withOffer = suppliers.filter((s) => s.hasOffer);
  const counts: Record<Filter, number> = {
    all: lines.length,
    missing: comparison.filters.missing.length,
    differences: comparison.filters.differences.length,
    lowest: comparison.filters.comparable.length,
    toVerify: comparison.filters.toVerify.length,
  };
  const ids =
    filter === "all"
      ? null
      : new Set(filter === "lowest" ? comparison.filters.comparable : comparison.filters[filter as "missing" | "differences" | "toVerify"]);
  const visible = ids ? lines.filter((l) => ids.has(l.id)) : lines;
  const cheapest = withOffer.filter((s) => s.total !== null).sort((a, b) => a.total! - b.total!)[0];

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {suppliers.map((s) => (
          <SupplierCard key={s.consultationId} s={s} lowest={s.consultationId === cheapest?.consultationId && withOffer.length > 1} />
        ))}
      </div>

      {insights.length ? (
        <div className="grid gap-2 rounded-xl border bg-background p-5">
          {insights.map((text) => (
            <p key={text} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
              <span data-testid="insight">{text}</span>
            </p>
          ))}
          {comparison.bestPriceTotal !== null && withOffer.length > 1 ? (
            <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              En retenant le meilleur prix ligne à ligne, le total serait de {euros(comparison.bestPriceTotal)} (hors frais annexes).
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([key, label]) => (
            <Button key={key} size="sm" variant={filter === key ? "secondary" : "ghost"} onClick={() => setFilter(key)} className={cn(filter === key && "font-medium")}>
              {label} <span className="text-muted-foreground tabular">{counts[key]}</span>
            </Button>
          ))}
        </div>
        <Button asChild>
          <a href={`/api/projects/${projectId}/export`}>
            <Download /> Exporter le comparatif
          </a>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 z-10 min-w-72 bg-background px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ligne</th>
              <th className="px-3 py-3 text-right text-xs font-medium whitespace-nowrap text-muted-foreground">Quantité</th>
              {suppliers.map((s) => (
                <th key={s.consultationId} className="min-w-44 border-l px-3 py-3 text-right text-xs font-medium text-muted-foreground">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30" data-testid="comparison-row">
                <td className="sticky left-0 z-10 bg-background px-4 py-2.5 align-top">
                  <div className="flex gap-2">
                    {l.code ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{l.code}</span> : null}
                    <span>{l.designation}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right align-top whitespace-nowrap tabular text-muted-foreground">
                  {quantity(l.quantity)} {l.unit ?? ""}
                </td>
                {suppliers.map((s) => (
                  <td key={s.consultationId} className="border-l px-3 py-2.5 text-right align-top">
                    <CellView cell={cells[l.id][s.consultationId]} highlightBest={filter === "lowest" || withOffer.length > 1} />
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={2 + suppliers.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Aucune ligne pour ce filtre.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-medium">
              <td className="sticky left-0 z-10 bg-muted px-4 py-3">Total de l&apos;offre HT</td>
              <td />
              {suppliers.map((s) => (
                <td key={s.consultationId} className="border-l px-3 py-3 text-right tabular">
                  {s.total !== null ? euros(s.total) : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SupplierCard({ s, lowest }: { s: SupplierSummary; lowest: boolean }) {
  const danger = s.alerts.filter((a) => a.level === "danger");
  const warnings = s.alerts.filter((a) => a.level !== "danger");
  return (
    <div className={cn("grid content-start gap-3 rounded-xl border bg-background p-4", lowest && "border-success/50")} data-testid="supplier-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{s.name}</div>
          <div className="mt-0.5">
            <ConsultationStatusBadge status={s.status} />
          </div>
        </div>
        {lowest ? <Badge variant="success">Total le plus bas</Badge> : null}
      </div>
      {s.hasOffer ? (
        <>
          <div>
            <div className="text-2xl font-semibold tracking-tight tabular" data-testid="supplier-total">
              {euros(s.total)}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.totalSource === "stated" ? "total annoncé HT" : "somme des lignes HT"} · {s.pricedCount}/{s.requestedCount} lignes chiffrées
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", s.coverage === 1 ? "bg-success" : "bg-warning")} style={{ width: `${Math.round(s.coverage * 100)}%` }} />
          </div>
          {s.offer?.validityDate || s.offer?.deliveryDelay ? (
            <div className="grid gap-0.5 text-xs text-muted-foreground">
              {s.offer.deliveryDelay ? <span>Délai : {s.offer.deliveryDelay}</span> : null}
              {s.offer.validityDate ? <span>Validité : {new Date(`${s.offer.validityDate}T12:00:00Z`).toLocaleDateString("fr-FR")}</span> : null}
            </div>
          ) : null}
          {danger.length || warnings.length ? (
            <ul className="grid gap-1 text-xs">
              {danger.map((a) => (
                <li key={a.code} className="flex items-start gap-1.5 text-destructive">
                  <XCircle className="mt-px size-3.5 shrink-0" /> {a.message}
                </li>
              ))}
              {warnings.map((a) => (
                <li key={a.code} className={cn("flex items-start gap-1.5", a.level === "warning" ? "text-warning" : "text-muted-foreground")}>
                  {a.level === "warning" ? <AlertTriangle className="mt-px size-3.5 shrink-0" /> : <Info className="mt-px size-3.5 shrink-0" />} {a.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-success">Toutes les lignes demandées sont chiffrées.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{s.status === "refus" ? "A décliné la consultation." : "En attente de l'offre."}</p>
      )}
    </div>
  );
}

function CellView({ cell, highlightBest }: { cell: Cell; highlightBest: boolean }) {
  switch (cell.kind) {
    case "not_requested":
      return <span className="text-xs text-muted-foreground/60">non demandé</span>;
    case "awaiting":
      return <span className="text-xs text-muted-foreground">en attente</span>;
    case "refused":
      return <span className="text-xs text-muted-foreground">refus</span>;
    case "missing":
      return (
        <Badge variant="danger" data-testid="cell-missing">
          Absente
        </Badge>
      );
    case "unpriced":
      return (
        <span className="grid justify-items-end gap-1">
          <Badge variant="warning">Sans prix</Badge>
          {cell.note ? <span className="text-xs text-muted-foreground">{cell.note}</span> : null}
        </span>
      );
    case "priced":
      return (
        <div
          className={cn("grid justify-items-end gap-0.5 rounded-md px-1.5 py-1", highlightBest && cell.isBest && "bg-success-soft")}
          title={cell.supplierDesignation ?? undefined}
        >
          <span className="font-medium tabular">{euros2(cell.total)}</span>
          <span className="text-xs text-muted-foreground tabular">{cell.unitPrice !== null ? `${euros2(cell.unitPrice)} / u` : "PU non indiqué"}</span>
          {cell.verify ? <Badge variant="warning">À vérifier</Badge> : null}
          {cell.alerts
            .filter((a) => a !== "computed_total")
            .map((a) => (
              <span key={a} className="flex items-center gap-1 text-xs text-warning" title={a === "alternative" ? (cell.alternativeNote ?? undefined) : undefined}>
                <AlertTriangle className="size-3" /> {ALERT_LABEL[a]}
                {a === "qty_diff" && cell.quantity !== null ? ` (${quantity(cell.quantity)})` : ""}
                {a === "unit_diff" && cell.unit ? ` (${cell.unit})` : ""}
              </span>
            ))}
        </div>
      );
  }
}
