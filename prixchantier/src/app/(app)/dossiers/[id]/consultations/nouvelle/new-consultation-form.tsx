"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Switch } from "@/components/ui/misc";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FormError } from "@/components/form-bits";
import { SupplierDialog } from "@/components/supplier-dialog";
import { createConsultations } from "@/actions/consultations";
import { quantity } from "@/lib/format";
import { DOC_KIND } from "@/lib/labels";

type Line = { id: string; lot: string | null; code: string | null; designation: string; quantity: number | null; unit: string | null; category: string | null; supplier_required: boolean };
type Supplier = { id: string; company_name: string; contact_name: string | null; email: string; categories: string[] };
type Doc = { id: string; file_name: string; kind: string; size_bytes: number };

export function NewConsultationForm({
  projectId,
  defaultDueDate,
  lines,
  suppliers,
  documents,
  sentTo,
}: {
  projectId: string;
  defaultDueDate: string | null;
  lines: Line[];
  suppliers: Supplier[];
  documents: Doc[];
  sentTo: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lot, setLot] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [selectedLines, setSelectedLines] = useState<Set<string>>(() => new Set(lines.filter((l) => l.supplier_required).map((l) => l.id)));
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState(defaultDueDate ?? "");
  const [includeExcel, setIncludeExcel] = useState(true);
  const [autoFollowup, setAutoFollowup] = useState(true);
  const [newSupplier, setNewSupplier] = useState(false);

  const lots = useMemo(() => [...new Set(lines.map((l) => l.lot).filter((x): x is string => Boolean(x)))], [lines]);
  const categories = useMemo(() => [...new Set(lines.map((l) => l.category).filter((x): x is string => Boolean(x)))].sort(), [lines]);
  const visible = lines.filter((l) => (!lot || l.lot === lot) && (!category || l.category === category));
  const chosenCategories = new Set(lines.filter((l) => selectedLines.has(l.id) && l.category).map((l) => l.category!));
  const rankedSuppliers = [...suppliers].sort((a, b) => {
    const score = (s: Supplier) => s.categories.filter((c) => chosenCategories.has(c)).length;
    return score(b) - score(a) || a.company_name.localeCompare(b.company_name);
  });

  const toggleSet = <T,>(set: Set<T>, value: T, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(value);
    else next.delete(value);
    return next;
  };

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await createConsultations(projectId, {
        supplierIds: [...selectedSuppliers],
        lineIds: lines.filter((l) => selectedLines.has(l.id)).map((l) => l.id),
        dueDate: dueDate || null,
        includeExcel,
        autoFollowup,
        attachedDocumentIds: [...selectedDocs],
      });
      if (!res.ok) setError(res.error);
      else router.push(`/dossiers/${projectId}/consultations/envoi`);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>1. Lignes à chiffrer</CardTitle>
          <CardDescription>
            {selectedLines.size} ligne{selectedLines.size > 1 ? "s" : ""} sélectionnée{selectedLines.size > 1 ? "s" : ""} sur {lines.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {lots.length > 1 ? (
              <NativeSelect className="w-auto" value={lot} onChange={(e) => setLot(e.target.value)} aria-label="Filtrer par lot">
                <option value="">Tous les lots</option>
                {lots.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {categories.length ? (
              <NativeSelect className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrer par famille">
                <option value="">Toutes les familles</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelectedLines(new Set([...selectedLines, ...visible.map((l) => l.id)]))}>
              Tout cocher
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedLines(new Set([...selectedLines].filter((id) => !visible.some((l) => l.id === id))))}>
              Tout décocher
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <ul className="divide-y">
              {visible.map((l) => (
                <li key={l.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/40">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedLines.has(l.id)}
                      onCheckedChange={(v) => setSelectedLines(toggleSet(selectedLines, l.id, v === true))}
                    />
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{l.code ?? ""}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      {l.designation}
                      {sentTo[l.id]?.length ? (
                        <Badge variant="neutral" className="ml-2">
                          déjà consultée ({sentTo[l.id].length})
                        </Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular">
                      {quantity(l.quantity)} {l.unit ?? ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>2. Fournisseurs</CardTitle>
              <CardDescription>Un e-mail distinct par fournisseur.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setNewSupplier(true)}>
              <Plus /> Nouveau
            </Button>
          </CardHeader>
          <CardContent>
            {suppliers.length ? (
              <ul className="grid max-h-72 gap-1 overflow-y-auto">
                {rankedSuppliers.map((s) => {
                  const matches = s.categories.filter((c) => chosenCategories.has(c)).length;
                  return (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
                        <Checkbox
                          className="mt-0.5"
                          checked={selectedSuppliers.has(s.id)}
                          onCheckedChange={(v) => setSelectedSuppliers(toggleSet(selectedSuppliers, s.id, v === true))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{s.company_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
                        </span>
                        {matches ? <Badge variant="success">Famille</Badge> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun fournisseur : ajoutez-en un.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Options</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Retour souhaité avant le" htmlFor="due">
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              Joindre le fichier Excel à compléter
              <Switch checked={includeExcel} onCheckedChange={setIncludeExcel} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Relance automatique
                <span className="block text-xs text-muted-foreground">48 h après l&apos;envoi sans réponse</span>
              </span>
              <Switch checked={autoFollowup} onCheckedChange={setAutoFollowup} />
            </label>
            {documents.filter((d) => d.kind !== "dpgf").length ? (
              <div className="grid gap-2">
                <span className="text-sm font-medium">Joindre des documents du dossier</span>
                {documents
                  .filter((d) => d.kind !== "dpgf")
                  .map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selectedDocs.has(d.id)} onCheckedChange={(v) => setSelectedDocs(toggleSet(selectedDocs, d.id, v === true))} />
                      <span className="truncate">{d.file_name}</span>
                      <span className="text-xs text-muted-foreground">{DOC_KIND[d.kind]}</span>
                    </label>
                  ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <FormError message={error} />
        <Button size="lg" onClick={submit} disabled={pending || !selectedLines.size || !selectedSuppliers.size}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {selectedSuppliers.size > 1 ? `Créer les ${selectedSuppliers.size} consultations` : "Créer la consultation"}
        </Button>
      </div>

      <SupplierDialog
        open={newSupplier}
        supplier={null}
        onClose={() => setNewSupplier(false)}
        onSaved={(id) => {
          setNewSupplier(false);
          setSelectedSuppliers(new Set([...selectedSuppliers, id]));
          router.refresh();
        }}
      />
    </div>
  );
}
