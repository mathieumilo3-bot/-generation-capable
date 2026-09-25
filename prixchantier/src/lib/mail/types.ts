export type MailAttachment = { filename: string; contentType: string; content: Buffer };

export type OutgoingMessage = {
  fromEmail: string;
  fromName?: string | null;
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  attachments: MailAttachment[];
  /** Réponse dans un fil existant (relance). */
  replyTo?: {
    providerMessageId: string;
    providerThreadId: string | null;
    internetMessageId: string | null;
  };
};

export type SentMessage = {
  providerMessageId: string;
  providerThreadId: string | null;
  internetMessageId: string | null;
  sentAt: string;
};

export type InboundSummary = {
  providerMessageId: string;
  providerThreadId: string | null;
  internetMessageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
};

export type InboundMessage = InboundSummary & {
  bodyText: string;
  attachments: (MailAttachment & { size: number })[];
};

export interface MailProvider {
  send(msg: OutgoingMessage): Promise<SentMessage>;
  /** Messages reçus depuis `since` (hors messages envoyés par la boîte elle-même). */
  listInbound(since: Date): Promise<InboundSummary[]>;
  getMessage(providerMessageId: string): Promise<InboundMessage>;
}

/** Autorisation perdue (token expiré ou révoqué) : l'utilisateur doit reconnecter. */
export class MailAuthError extends Error {
  constructor(public provider: string) {
    super(
      provider === "microsoft"
        ? "Votre connexion Microsoft a expiré. Reconnectez votre boîte mail."
        : provider === "google"
          ? "Votre connexion Gmail a expiré. Reconnectez votre boîte mail."
          : "Votre connexion e-mail a expiré. Reconnectez votre boîte mail.",
    );
    this.name = "MailAuthError";
  }
}

/** Erreur définitive côté destinataire (adresse invalide, message refusé). */
export class MailRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailRejectedError";
  }
}

export class MailApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "MailApiError";
  }
}
