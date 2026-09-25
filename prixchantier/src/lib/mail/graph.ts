import "server-only";
import { htmlToText } from "./mime";
import {
  MailApiError,
  MailAuthError,
  MailRejectedError,
  type InboundMessage,
  type InboundSummary,
  type MailProvider,
  type OutgoingMessage,
  type SentMessage,
} from "./types";

const API = "https://graph.microsoft.com/v1.0/me";
const SMALL_ATTACHMENT = 3 * 1024 * 1024;

type GraphMessage = {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  receivedDateTime?: string;
  isDraft?: boolean;
  from?: { emailAddress?: { address?: string; name?: string } };
  internetMessageHeaders?: { name: string; value: string }[];
  body?: { contentType: string; content: string };
};

export class GraphProvider implements MailProvider {
  constructor(
    private getToken: () => Promise<string>,
    private selfEmail: string,
  ) {}

  private async request<T>(url: string, init: RequestInit = {}, raw = false): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(url.startsWith("http") ? url : `${API}${url}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        // Identifiants stables même quand le message change de dossier (brouillon → envoyés).
        Prefer: 'IdType="ImmutableId", outlook.body-content-type="text"',
        ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 401) throw new MailAuthError("microsoft");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 400 && /recipient|ErrorInvalidRecipients/i.test(body)) {
        throw new MailRejectedError("Adresse du destinataire refusée par Microsoft 365.");
      }
      throw new MailApiError(`Microsoft Graph ${res.status}`, res.status);
    }
    if (raw) return Buffer.from(await res.arrayBuffer()) as T;
    if (res.status === 202 || res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async attach(messageId: string, a: OutgoingMessage["attachments"][number]) {
    if (a.content.length <= SMALL_ATTACHMENT) {
      await this.request(`/messages/${messageId}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentType: a.contentType,
          contentBytes: a.content.toString("base64"),
        }),
      });
      return;
    }
    const session = await this.request<{ uploadUrl: string }>(`/messages/${messageId}/attachments/createUploadSession`, {
      method: "POST",
      body: JSON.stringify({ AttachmentItem: { attachmentType: "file", name: a.filename, size: a.content.length } }),
    });
    const CHUNK = 320 * 1024 * 12; // multiple de 320 Kio, < 4 Mio
    for (let start = 0; start < a.content.length; start += CHUNK) {
      const end = Math.min(start + CHUNK, a.content.length);
      const res = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes ${start}-${end - 1}/${a.content.length}`, "Content-Length": String(end - start) },
        body: new Uint8Array(a.content.subarray(start, end)),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new MailApiError(`Envoi de pièce jointe ${res.status}`, res.status);
    }
  }

  async send(msg: OutgoingMessage): Promise<SentMessage> {
    let draft: GraphMessage;
    if (msg.replyTo) {
      draft = await this.request<GraphMessage>(`/messages/${msg.replyTo.providerMessageId}/createReply`, {
        method: "POST",
        body: JSON.stringify({ comment: msg.text }),
      });
    } else {
      draft = await this.request<GraphMessage>("/messages", {
        method: "POST",
        body: JSON.stringify({
          subject: msg.subject,
          body: { contentType: "Text", content: msg.text },
          toRecipients: [{ emailAddress: { address: msg.to, name: msg.toName ?? undefined } }],
        }),
      });
    }
    for (const a of msg.attachments) await this.attach(draft.id, a);
    await this.request(`/messages/${draft.id}/send`, { method: "POST" });
    return {
      providerMessageId: draft.id,
      providerThreadId: draft.conversationId ?? null,
      internetMessageId: draft.internetMessageId ?? null,
      sentAt: new Date().toISOString(),
    };
  }

  async listInbound(since: Date): Promise<InboundSummary[]> {
    const select = "id,conversationId,internetMessageId,subject,from,receivedDateTime,isDraft,internetMessageHeaders";
    let url: string | undefined =
      `${API}/messages?$top=50&$select=${select}&$orderby=receivedDateTime desc&$filter=${encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`)}`;
    const out: InboundSummary[] = [];
    let pages = 0;
    while (url && pages < 10) {
      const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await this.request(url);
      for (const m of page.value) {
        if (m.isDraft) continue;
        const s = toSummary(m);
        if (s.fromEmail && s.fromEmail !== this.selfEmail.toLowerCase()) out.push(s);
      }
      url = page["@odata.nextLink"];
      pages++;
    }
    return out;
  }

  async getMessage(id: string): Promise<InboundMessage> {
    const m = await this.request<GraphMessage>(
      `/messages/${id}?$select=id,conversationId,internetMessageId,subject,from,receivedDateTime,internetMessageHeaders,body`,
    );
    const list = await this.request<{ value: { id: string; name: string; contentType: string; size: number; "@odata.type": string }[] }>(
      `/messages/${id}/attachments?$select=id,name,contentType,size`,
    );
    const attachments = [];
    for (const a of list.value) {
      if (a["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
      const content = await this.request<Buffer>(`/messages/${id}/attachments/${a.id}/$value`, {}, true);
      attachments.push({ filename: a.name, contentType: a.contentType, content, size: content.length });
    }
    const body = m.body?.content ?? "";
    return {
      ...toSummary(m),
      bodyText: m.body?.contentType?.toLowerCase() === "html" ? htmlToText(body) : body.trim(),
      attachments,
    };
  }
}

function toSummary(m: GraphMessage): InboundSummary {
  const h = (name: string) => m.internetMessageHeaders?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? null;
  return {
    providerMessageId: m.id,
    providerThreadId: m.conversationId ?? null,
    internetMessageId: m.internetMessageId ?? null,
    inReplyTo: h("In-Reply-To"),
    references: h("References"),
    fromEmail: (m.from?.emailAddress?.address ?? "").toLowerCase(),
    fromName: m.from?.emailAddress?.name ?? null,
    subject: m.subject ?? "",
    receivedAt: m.receivedDateTime ?? new Date().toISOString(),
  };
}
