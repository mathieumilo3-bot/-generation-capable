"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/page";
import { SupplierDialog, type SupplierRow } from "@/components/supplier-dialog";
import { deleteSupplier, importSuppliersCsv } from "@/actions/suppliers";

type Row = SupplierRow & { usage: { consulted: number; answered: number } };

export function SuppliersManager({ suppliers }: { suppliers: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<SupplierRow | "new" | null>(null);
  const [q, setQ] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = suppliers.filter((s) =>
    `${s.company_name} ${s.contact_name ?? ""} ${s.email} ${s.categories.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );

  const importCsv = (file: File) =>
    start(async () => {
      const form = new FormData();
      form.set("file", file);
      const res = await importSuppliersCsv(form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.imported} fournisseur(s) importé(s).`);
      if (res.data.skipped.length) {
        toast.warning(`${res.data.skipped.length} ligne(s) ignorée(s)`, { description: res.data.skipped.slice(0, 5).join("\n") });
      }
      router.refresh();
    });

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Rechercher un fournisseur" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" disabled={pending} onClick={() => fileInput.current?.click()}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Importer un CSV
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => setEditing("new")}>
            <Plus /> Ajouter un fournisseur
          </Button>
        </div>
      </div>

      {!suppliers.length ? (
        <EmptyState
          title="Aucun fournisseur"
          description="Ajoutez vos fournisseurs un par un, ou importez un CSV avec les colonnes Société, Commercial, E-mail, Téléphone, Catégories."
        />
      ) : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Société</TableHead>
                <TableHead className="hidden md:table-cell">Commercial</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="hidden lg:table-cell">Familles</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Consulté</TableHead>
                <TableHead className="w-24 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-5 font-medium">{s.company_name}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{s.contact_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {s.categories.slice(0, 3).map((c) => (
                        <Badge key={c} variant="neutral">
                          {c}
                        </Badge>
                      ))}
                      {s.categories.length > 3 ? <Badge variant="outline">+{s.categories.length - 3}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular sm:table-cell">
                    {s.usage.consulted ? `${s.usage.answered} rép. / ${s.usage.consulted}` : "—"}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Modifier ${s.company_name}`} onClick={() => setEditing(s)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Supprimer ${s.company_name}`}
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await deleteSupplier(s.id);
                            if (!res.ok) toast.error(res.error);
                            router.refresh();
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <SupplierDialog
        open={editing !== null}
        supplier={editing && editing !== "new" ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}
