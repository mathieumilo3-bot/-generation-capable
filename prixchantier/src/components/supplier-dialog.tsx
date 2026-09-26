"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/form-bits";
import { saveSupplier } from "@/actions/suppliers";
import { CATEGORIES } from "@/lib/labels";

export type SupplierRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  categories: string[];
  notes: string | null;
};

export function SupplierDialog({
  open,
  supplier,
  onClose,
  onSaved,
}: {
  open: boolean;
  supplier: SupplierRow | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
        </DialogHeader>
        <form
          key={supplier?.id ?? "new"}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const f = new FormData(e.currentTarget);
            start(async () => {
              const res = await saveSupplier(supplier?.id ?? null, {
                companyName: String(f.get("company") ?? ""),
                contactName: String(f.get("contact") ?? ""),
                email: String(f.get("email") ?? ""),
                phone: String(f.get("phone") ?? ""),
                categories: f.getAll("categories").map(String),
                notes: String(f.get("notes") ?? ""),
              });
              if (!res.ok) setError(res.error);
              else onSaved(res.data.id);
            });
          }}
        >
          <Field label="Société" htmlFor="s-company">
            <Input id="s-company" name="company" defaultValue={supplier?.company_name ?? ""} required maxLength={200} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Commercial" htmlFor="s-contact">
              <Input id="s-contact" name="contact" defaultValue={supplier?.contact_name ?? ""} maxLength={200} />
            </Field>
            <Field label="Téléphone" htmlFor="s-phone" hint="Facultatif">
              <Input id="s-phone" name="phone" defaultValue={supplier?.phone ?? ""} maxLength={50} />
            </Field>
          </div>
          <Field label="E-mail" htmlFor="s-email">
            <Input id="s-email" name="email" type="email" defaultValue={supplier?.email ?? ""} required maxLength={254} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Familles fournies</legend>
            <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="categories" value={c} defaultChecked={supplier?.categories.includes(c)} className="size-4 accent-[var(--primary)]" />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Notes" htmlFor="s-notes" hint="Facultatif">
            <Textarea id="s-notes" name="notes" defaultValue={supplier?.notes ?? ""} maxLength={2000} rows={2} />
          </Field>
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
      </DialogContent>
    </Dialog>
  );
}
