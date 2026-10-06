import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import type { ProjectRow } from "@app/api";
import { Button, Input, Notice, Row, Section, Sheet, colors } from "@app/ui";
import { api } from "@/lib/supabase";
import { useUserId } from "@/providers/AuthProvider";
import { ConfirmSheet } from "@/features/common/ConfirmSheet";
import { codeOfThrown, errorFromCode } from "@/features/common/ErrorView";
import { href } from "@/features/common/nav";
import { ReportSheet } from "@/features/processing/ReportSheet";
import { titleForRename } from "./logic";

type Mode = null | "menu" | "rename" | "delete" | "report";

/** Menu ⋯ : Renommer, Dupliquer, Supprimer (avec confirmation), Signaler un problème. */
export function ProjectMenu({ project, versionId, onMessage }: {
  project: ProjectRow; versionId?: string; onMessage: (m: { tone: "success" | "error"; text: string } | null) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();
  const [mode, setMode] = useState<Mode>(null);
  const [title, setTitle] = useState(project.title);
  const [busy, setBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  /** iOS refuse de présenter une feuille pendant que l'autre se ferme : on laisse la première finir. */
  const switchTo = (next: Mode) => { setMode(null); setTimeout(() => setMode(next), 350); };

  const refresh = (opts: { keepProject?: boolean } = {}) => {
    if (!opts.keepProject) void qc.invalidateQueries({ queryKey: ["project", project.id] });
    void qc.invalidateQueries({ queryKey: ["projects"] });
    void qc.invalidateQueries({ queryKey: ["drafts", uid] });
  };
  const fail = (e: unknown, ctx?: { code?: string }) => {
    const h = errorFromCode(ctx?.code ?? codeOfThrown(e));
    onMessage({ tone: "error", text: `${h.title} ${h.detail}` });
  };

  const rename = async () => {
    const t = titleForRename(title);
    if (!t) { setRenameError("Donnez un nom à votre vidéo."); return; }
    setBusy(true);
    try {
      await api.projects.rename(project.id, t);
      refresh();
      setMode(null);
      onMessage({ tone: "success", text: "Le nom a été modifié." });
    } catch (e) { setMode(null); fail(e); } finally { setBusy(false); }
  };

  const duplicate = async () => {
    setMode(null);
    try {
      const newId = await api.projects.duplicate(project.id);
      refresh();
      router.push(href(`/project/${newId}`));
    } catch (e) { fail(e); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const r = await api.projects.remove(project.id);
      if (!r.ok) { setMode(null); fail(null, { code: r.code }); return; }
      refresh({ keepProject: true });
      setMode(null);
      router.replace(href("/projects"));
    } catch (e) { setMode(null); fail(e); } finally { setBusy(false); }
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Plus d'actions" onPress={() => { onMessage(null); setMode("menu"); }}
        style={({ pressed }) => ({ width: 48, height: 48, marginRight: -8, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
        <Ionicons name="ellipsis-horizontal" size={26} color={colors.text} />
      </Pressable>

      <Sheet visible={mode === "menu"} onClose={() => setMode(null)} title="Cette vidéo">
        <Section>
          <Row title="Renommer" leading={<Ionicons name="pencil-outline" size={22} color={colors.textSecondary} />} onPress={() => { setTitle(project.title); setRenameError(null); switchTo("rename"); }} />
          <Row title="Dupliquer" leading={<Ionicons name="copy-outline" size={22} color={colors.textSecondary} />} onPress={() => void duplicate()} />
          <Row title="Signaler un problème" leading={<Ionicons name="flag-outline" size={22} color={colors.textSecondary} />} onPress={() => switchTo("report")} />
          <Row title="Supprimer" destructive chevron={false} leading={<Ionicons name="trash-outline" size={22} color={colors.accentPressed} />} onPress={() => switchTo("delete")} />
        </Section>
      </Sheet>

      <Sheet visible={mode === "rename"} onClose={() => setMode(null)} title="Renommer la vidéo">
        <View style={{ gap: 12 }}>
          <Input label="Nom" value={title} onChangeText={(t) => { setTitle(t); setRenameError(null); }} error={renameError} maxLength={120} autoFocus returnKeyType="done" onSubmitEditing={() => void rename()} />
          {busy ? null : <Notice tone="neutral" title="Le nom n'est visible que par vous." />}
          <Button label="Enregistrer" loading={busy} onPress={() => void rename()} />
          <Button label="Annuler" variant="ghost" disabled={busy} onPress={() => setMode(null)} />
        </View>
      </Sheet>

      <ConfirmSheet visible={mode === "delete"} title="Supprimer cette vidéo ?" destructive loading={busy}
        body="La vidéo et toutes ses versions seront supprimées définitivement. Cette action est irréversible."
        confirmLabel="Supprimer" onConfirm={() => void remove()} onCancel={() => setMode(null)} />

      <ReportSheet visible={mode === "report"} onClose={() => setMode(null)} projectId={project.id} versionId={versionId} />
    </>
  );
}
