import { useCallback, useState } from "react";
import type { CreationMode, HumanError } from "@app/domain";
import type { FileRef, UploadItem } from "@app/api";
import { uploadManager } from "@/lib/uploads";
import { analytics } from "@/lib/analytics";
import { useConfig } from "@/providers/ConfigProvider";
import { describeRejections, validateSelection, type UploadLimits } from "./logic";
import { useCreateDraft } from "./draft";
import { useDraftFiles } from "./useDraftFiles";

/**
 * Ajout de fichiers à un brouillon : contrôle rapide des limites, création du brouillon serveur au premier
 * ajout, puis mise en file d'envoi (reprise/pause réseau gérées par le gestionnaire d'envois).
 */
export function useAddFiles(opts: { projectId: string | null; mode: CreationMode; kind: UploadItem["kind"]; onProjectCreated?: (id: string) => void }) {
  const { settings } = useConfig();
  const { ensureProject } = useCreateDraft(opts.projectId);
  const all = useDraftFiles(opts.projectId);
  const [rejection, setRejection] = useState<HumanError | null>(null);
  const { projectId, mode, kind, onProjectCreated } = opts;
  const rows = all.rows;

  const add = useCallback(async (files: FileRef[]) => {
    const limits: UploadLimits = {
      maxFiles: settings["upload.max_files"], maxFileBytes: settings["upload.max_file_bytes"],
      maxTotalBytes: settings["upload.max_total_bytes"], allowedMimes: settings["upload.allowed_mime_types"],
    };
    const { accepted, rejected } = validateSelection(rows, files, limits);
    setRejection(describeRejections(rejected, limits));
    if (accepted.length === 0) return;
    let id = projectId;
    if (!id) {
      try {
        id = await ensureProject(mode);
      } catch {
        setRejection({ title: "Impossible de préparer votre vidéo.", detail: "Vérifiez votre connexion puis réessayez. Vos fichiers n'ont pas été modifiés.", money: "Aucun montant n'a été prélevé.", action: "none", actionLabel: null });
        return;
      }
      onProjectCreated?.(id);
    }
    uploadManager.add(id, kind, accepted);
    analytics.track("upload_started", { kind, file_count: accepted.length, total_bytes: accepted.reduce((s, f) => s + f.size, 0) });
  }, [settings, rows, projectId, mode, kind, ensureProject, onProjectCreated]);

  return { add, rejection, clearRejection: () => setRejection(null) };
}
