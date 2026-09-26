"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Upload, X } from "lucide-react";
import { NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, fileKind, MAX_FILE_BYTES } from "@/lib/files";
import { guessDocKind } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type PickedFile = { file: File; kind: "dpgf" | "cctp" | "other" };

function sizeLabel(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;
}

export function FileUploader({
  files,
  onChange,
  onError,
  disabled,
}: {
  files: PickedFile[];
  onChange: (files: PickedFile[]) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!fileKind(f.name)) {
        onError(`« ${f.name} » : seuls les fichiers PDF, XLSX, XLS et CSV sont acceptés.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        onError(`« ${f.name} » dépasse 25 Mo.`);
        continue;
      }
      if (f.size === 0) {
        onError(`« ${f.name} » est vide.`);
        continue;
      }
      if (!next.some((x) => x.file.name === f.name && x.file.size === f.size)) next.push({ file: f, kind: guessDocKind(f.name) });
    }
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onError(null);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-secondary" : "hover:bg-secondary/60",
        )}
      >
        <Upload className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">Déposez vos fichiers ou cliquez pour les choisir</span>
        <span className="text-xs text-muted-foreground">DPGF, CCTP, autres documents — PDF, Excel ou CSV, 25 Mo maximum</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          onError(null);
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length ? (
        <ul className="divide-y rounded-lg border">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              {/\.pdf$/i.test(f.file.name) ? (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{f.file.name}</span>
              <span className="text-xs text-muted-foreground tabular">{sizeLabel(f.file.size)}</span>
              <NativeSelect
                aria-label={`Type de ${f.file.name}`}
                className="h-8 w-44"
                value={f.kind}
                disabled={disabled}
                onChange={(e) => onChange(files.map((x, j) => (j === i ? { ...x, kind: e.target.value as PickedFile["kind"] } : x)))}
              >
                <option value="dpgf">DPGF / quantitatif</option>
                <option value="cctp">CCTP</option>
                <option value="other">Autre document</option>
              </NativeSelect>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Retirer ${f.file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
