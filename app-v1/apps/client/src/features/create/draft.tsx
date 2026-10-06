import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CreationMode } from "@app/domain";
import { api } from "@/lib/supabase";
import { INITIAL_DRAFT, draftReducer, draftStorageKey, parseDraft, type CreateDraft } from "./logic";

interface DraftContextValue {
  draft: CreateDraft;
  patch(p: Partial<CreateDraft>): void;
  reset(): void;
  hydrate(projectId: string): Promise<void>;
  /** Crée le brouillon serveur au premier besoin (premier fichier ajouté, fin de l'idée) ; idempotent. */
  ensureProject(mode: CreationMode): Promise<string>;
  forget(projectId: string): Promise<void>;
}

const Ctx = createContext<DraftContextValue | null>(null);

const defaultTitle = () => `Vidéo du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

/**
 * État du flow Créer. Le brouillon SERVEUR reste la source de vérité pour les fichiers ; ici on ne garde
 * que les choix (prix, style, texte), sauvegardés par projet pour qu'un retour de paiement, un rechargement
 * de page ou une reprise de brouillon retombe sur le même récapitulatif.
 */
export function CreateDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, dispatch] = useReducer(draftReducer, INITIAL_DRAFT);
  const latest = useRef(draft);
  latest.current = draft;
  const creating = useRef<Promise<string> | null>(null);
  const hydrating = useRef<string | null>(null);

  useEffect(() => {
    if (!draft.projectId) return;
    void AsyncStorage.setItem(draftStorageKey(draft.projectId), JSON.stringify(draft)).catch(() => undefined);
  }, [draft]);

  const hydrate = useCallback(async (projectId: string) => {
    if (latest.current.projectId === projectId || hydrating.current === projectId) return;
    hydrating.current = projectId;
    let stored: CreateDraft | null = null;
    try { stored = parseDraft(await AsyncStorage.getItem(draftStorageKey(projectId)), projectId); } catch { stored = null; }
    dispatch({ type: "hydrate", draft: stored ?? { ...INITIAL_DRAFT, projectId } });
    hydrating.current = null;
  }, []);

  const ensureProject = useCallback(async (mode: CreationMode) => {
    const cur = latest.current;
    if (cur.projectId && cur.mode === mode) return cur.projectId;
    if (!creating.current) {
      creating.current = api.projects.createDraft({ mode, title: defaultTitle() })
        .then((id) => { dispatch({ type: "hydrate", draft: { ...INITIAL_DRAFT, mode, projectId: id, idea: cur.idea, objective: cur.objective, objectiveDetail: cur.objectiveDetail, urls: cur.urls } }); return id; })
        .finally(() => { creating.current = null; });
    }
    return creating.current;
  }, []);

  const patch = useCallback((p: Partial<CreateDraft>) => dispatch({ type: "patch", patch: p }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const forget = useCallback(async (projectId: string) => {
    try { await AsyncStorage.removeItem(draftStorageKey(projectId)); } catch { /* sans importance */ }
  }, []);

  const value = useMemo<DraftContextValue>(
    () => ({ draft, patch, reset, hydrate, ensureProject, forget }),
    [draft, patch, reset, hydrate, ensureProject, forget],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Accès au brouillon pour un écran. `projectId` vient des paramètres de route : si le contexte n'est pas encore
 * sur ce projet (rechargement, retour de paiement), il est relu depuis le stockage et `ready` reste faux d'ici là.
 */
export function useCreateDraft(projectIdParam?: string | null): DraftContextValue & { ready: boolean; projectId: string | null } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCreateDraft hors CreateDraftProvider");
  const { hydrate, draft } = ctx;
  useEffect(() => {
    if (projectIdParam && draft.projectId !== projectIdParam) void hydrate(projectIdParam);
  }, [projectIdParam, draft.projectId, hydrate]);
  const ready = !projectIdParam || draft.projectId === projectIdParam;
  return { ...ctx, ready, projectId: projectIdParam ?? draft.projectId };
}
