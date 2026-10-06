import React, { useState } from "react";
import { View } from "react-native";
import { Button, Input, Notice, Sheet, Text } from "@app/ui";
import { api } from "@/lib/supabase";
import { errorFromCode, codeOfThrown } from "@/features/common/ErrorView";

/** « Signaler un problème » : le support reçoit automatiquement le projet, la création, la version, la version de l'app et la plateforme. */
export function ReportSheet({ visible, onClose, projectId, jobId, versionId }: {
  visible: boolean; onClose: () => void; projectId?: string; jobId?: string; versionId?: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { onClose(); setTimeout(() => { setSent(false); setError(null); setMessage(""); }, 300); };

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await api.account.supportRequest({ category: "video_problem", message: message.trim() || "Problème signalé depuis l'application.", projectId, jobId, versionId });
      setSent(true);
    } catch (e) {
      const h = errorFromCode(codeOfThrown(e));
      setError(`${h.title} ${h.detail}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Signaler un problème">
      {sent ? (
        <View style={{ gap: 12 }}>
          <Notice tone="success" icon="checkmark-circle-outline" title="Merci, nous avons bien reçu votre signalement." body="Nous revenons vers vous par e-mail." />
          <Button label="Fermer" onPress={close} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text variant="secondary" color="textSecondary">Décrivez ce qui s'est passé. Les informations utiles (vidéo, création, appareil) sont jointes automatiquement.</Text>
          <Input label="Votre message" value={message} onChangeText={setMessage} multiline placeholder="Ex. : la vidéo ne s'est pas terminée." maxLength={1000} />
          {error ? <Notice tone="error" icon="alert-circle-outline" title={error} /> : null}
          <Button label="Envoyer" loading={sending} onPress={() => void send()} />
          <Button label="Annuler" variant="ghost" disabled={sending} onPress={close} />
        </View>
      )}
    </Sheet>
  );
}
