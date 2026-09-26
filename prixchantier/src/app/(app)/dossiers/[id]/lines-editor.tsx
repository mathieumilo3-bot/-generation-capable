"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/misc";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/form-bits";
import { addLine, deleteLine, setLinesSupplierRequired, updateLine, validateLines } from "@/actions/projects";
import { CATEGORIES } from "@/lib/labels";
import { quantity } from "@/lib/format";
import { cn } from "@/lib/utils";

export type EditorLine = {
  id: string;
  lot: string | null;
  code: string | null;
  designation: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  supplier_required: boolean;
  subcontractor_required: boolean;
  confidence: number | null;
  user_validated: boolean;
  user_modified: boolean;
  original: { designation?: string; quantity?: string | number | null; unit?: string | null; code?: string | null; flags?: string[]; manual?: boolean };
  source_document: string | null;
  source_sheet: string | null;
  source_row: number | null;
  source_page: number | null;
};

type Filter = "all" | "verify" | "consult" | "excluded";

export function needsReview(l: EditorLine) {
  return !l.user_validated && ((l.confidence !== null && l.confidence < 0.7) || (l.original.flags?.length ?? 0) > 0);
}

function sourceLabel(l: EditorLine) {
  if (l.original.manual) return "Saisie manuelle";
  const parts = [l.source_document, l.source_sheet ? `onglet ${l.source_sheet}` : null, l.source_row ? `ligne ${l.source_row}` : null, l.source_page ? `page ${l.source_page}` : null];
  return parts.filter(Boolean).join(" · ");
}

export function LinesEditor({ projectId, lines, usedIds, closed }: { projectId: string; lines: EditorLine[]; usedIds: string[]; closed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<EditorLine | "new" | null>(null);
  const used = useMemo(() => new Set(usedIds), [usedIds]);

  const counts = {
    all: lines.length,
    verify: lines.filter(needsReview).length,
    consult: lines.filter((l) => l.supplier_required).length,
    excluded: lines.filter((l) => !l.supplier_required).length,
  };
  const unvalidated = lines.filter((l) => !l.user_validated).length;
  const visible = lines.filter((l) =>
    filter === "verify" ? needsReview(l) : filter === "consult" ? l.supplier_required : filter === "excluded" ? !l.supplier_required : true,
  );

  const toggle = (ids: string[], value: boolean) =>
    start(async () => {
      const res = await setLinesSupplierRequired(projectId, ids, value);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  const validate = () =>
    start(async () => {
      const res = await validateLines(projectId);
      if (!res.ok) toast.error(res.error);
      else toast.success("Lignes validées.");
      router.refresh();
    });

  if (!lines.length) {
    return (
      <>
        <Button onClick={() => setEditing("new")} disabled={closed}>
          <Plus /> Ajouter une ligne
        </Button>
        <LineDialog projectId={projectId} line={editing} onClose={() => setEditing(null)} />
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {lines.length} ligne{lines.length > 1 ? "s" : ""} détectée{lines.length > 1 ? "s" : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            {counts.consult} à consulter · {counts.excluded} hors consultation
            {counts.verify ? ` · ${counts.verify} à vérifier` : ""}
          </p>
        </div>
        {!closed ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing("new")}>
              <Plus /> Ajouter une ligne
            </Button>
            {unvalidated ? (
              <Button onClick={validate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Check />} Valider les lignes
              </Button>
            ) : (
              <Badge variant="success" className="h-9 px-3">
                <Check /> Lignes validées
              </Badge>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Toutes"],
            ["verify", "À vérifier"],
            ["consult", "À consulter"],
            ["excluded", "Hors consultation"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? "secondary" : "ghost"} onClick={() => setFilter(key)} className={cn(filter === key && "font-medium")}>
            {label} <span className="text-muted-foreground tabular">{counts[key]}</span>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label="Consulter toutes les lignes affichées"
                  disabled={closed || pending}
                  checked={visible.every((l) => l.supplier_required) ? true : visible.some((l) => l.supplier_required) ? "indeterminate" : false}
                  onCheckedChange={(v) => toggle(visible.map((l) => l.id), v === true)}
                />
              </TableHead>
              <TableHead className="w-28">Référence</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead className="w-24 text-right">Qté</TableHead>
              <TableHead className="w-20">Unité</TableHead>
              <TableHead className="hidden w-48 lg:table-cell">Famille</TableHead>
              <TableHead className="w-20 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((l, index) => {
              const header = index === 0 || visible[index - 1].lot !== l.lot ? l.lot : undefined;
              return (
                <Fragment key={l.id}>
                  {header !== undefined && header !== null ? (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={7} className="pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {header}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow className={cn(!l.supplier_required && "text-muted-foreground")} data-testid="line-row">
                    <TableCell className="pl-4">
                      <Checkbox
                        aria-label={`Consulter : ${l.designation}`}
                        checked={l.supplier_required}
                        disabled={closed || pending}
                        onCheckedChange={(v) => toggle([l.id], v === true)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{l.designation}</span>
                        {needsReview(l) ? <Badge variant="warning">À vérifier</Badge> : null}
                        {l.user_modified ? <Badge variant="info">Modifiée</Badge> : null}
                        {l.subcontractor_required ? <Badge variant="neutral">Sous-traitance</Badge> : null}
                      </div>
                      {l.description ? <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{l.description}</div> : null}
                    </TableCell>
                    <TableCell className="text-right tabular">{quantity(l.quantity)}</TableCell>
                    <TableCell>{l.unit ?? "—"}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{l.category ?? "—"}</TableCell>
                    <TableCell className="pr-4">
                      {!closed ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Modifier ${l.designation}`} onClick={() => setEditing(l)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Supprimer ${l.designation}`}
                            disabled={pending || used.has(l.id)}
                            title={used.has(l.id) ? "Ligne déjà envoyée en consultation" : undefined}
                            onClick={() =>
                              start(async () => {
                                const res = await deleteLine(l.id);
                                if (!res.ok) toast.error(res.error);
                                router.refresh();
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <LineDialog projectId={projectId} line={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function LineDialog({ projectId, line, onClose }: { projectId: string; line: EditorLine | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const l = line && line !== "new" ? line : null;
  const originalDiffers =
    l && !l.original.manual && (l.original.designation !== l.designation || String(l.original.quantity ?? "") !== String(l.quantity ?? ""));

  return (
    <Dialog open={line !== null} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{l ? "Modifier la ligne" : "Ajouter une ligne"}</DialogTitle>
          {l ? <DialogDescription>Source : {sourceLabel(l)}</DialogDescription> : null}
        </DialogHeader>
        {line !== null ? (
          <form
            key={l?.id ?? "new"}
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const f = new FormData(e.currentTarget);
              const q = String(f.get("quantity") ?? "").replace(/\s/g, "").replace(",", ".");
              const qty = q === "" ? null : Number(q);
              if (qty !== null && !Number.isFinite(qty)) {
                setError("Quantité invalide.");
                return;
              }
              const payload = {
                lot: String(f.get("lot") ?? ""),
                code: String(f.get("code") ?? ""),
                designation: String(f.get("designation") ?? ""),
                quantity: qty,
                unit: String(f.get("unit") ?? ""),
                category: String(f.get("category") ?? ""),
                supplierRequired: f.get("supplier") === "on",
              };
              start(async () => {
                const res = l ? await updateLine(l.id, payload) : await addLine(projectId, payload);
                if (!res.ok) setError(res.error);
                else {
                  onClose();
                  router.refresh();
                }
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <Field label="Référence" htmlFor="l-code">
                <Input id="l-code" name="code" defaultValue={l?.code ?? ""} maxLength={100} />
              </Field>
              <Field label="Lot / chapitre" htmlFor="l-lot">
                <Input id="l-lot" name="lot" defaultValue={l?.lot ?? ""} maxLength={300} />
              </Field>
            </div>
            <Field label="Désignation" htmlFor="l-designation">
              <Input id="l-designation" name="designation" defaultValue={l?.designation ?? ""} required maxLength={2000} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quantité" htmlFor="l-quantity">
                <Input id="l-quantity" name="quantity" inputMode="decimal" defaultValue={l?.quantity ?? ""} />
              </Field>
              <Field label="Unité" htmlFor="l-unit">
                <Input id="l-unit" name="unit" defaultValue={l?.unit ?? ""} maxLength={30} />
              </Field>
              <Field label="Famille" htmlFor="l-category">
                <NativeSelect id="l-category" name="category" defaultValue={l?.category ?? ""}>
                  <option value="">—</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="supplier" defaultChecked={l?.supplier_required ?? true} className="size-4 accent-[var(--primary)]" />
              À consulter auprès des fournisseurs
            </label>
            {originalDiffers ? (
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Valeur d&apos;origine du document : « {l.original.designation} » — {String(l.original.quantity ?? "—")} {l.original.unit ?? ""}
              </div>
            ) : null}
            <FormError message={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Enregistrer
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
