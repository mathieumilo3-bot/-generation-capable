import "server-only";
import { randomBytes } from "node:crypto";
import { buildMime, htmlToText, parseAddress } from "./mime";
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

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const UPLOAD = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart";

type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
};

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export class GmailProvider implements MailProvider {
  constructor(
    private getToken: () => Promise<string>,
    private selfEmail: string,
  ) {}

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 401) throw new MailAuthError("google");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 400 && /invalid to header|recipient/i.test(body)) {
        throw new MailRejectedError("Adresse du destinataire refusée par Gmail.");
      }
      throw new MailApiError(`Gmail ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  }

  async send(msg: OutgoingMessage): Promise<SentMessage> {
    const { raw } = buildMime(msg);
    const boundary = `pc_rel_${randomBytes(8).toString("hex")}`;
    const metadata = msg.replyTo?.providerThreadId ? { threadId: msg.replyTo.providerThreadId } : {};
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: message/rfc822",
      "",
      raw,
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const sent = await this.request<{ id: string; threadId: string }>(UPLOAD, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    // Gmail peut réécrire le Message-ID : on relit celui réellement émis.
    const meta = await this.request<GmailMessage>(`${API}/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`);
    const messageId = meta.payload?.headers?.find((h) => h.name.toLowerCase() === "message-id")?.value ?? null;
    return {
      providerMessageId: sent.id,
      providerThreadId: sent.threadId,
      internetMessageId: messageId,
      sentAt: new Date().toISOString(),
    };
  }

  async listInbound(since: Date): Promise<InboundSummary[]> {
    const q = `after:${Math.floor(since.getTime() / 1000)} -in:sent -in:drafts -in:chats -in:spam -in:trash`;
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const url = `${API}/messages?maxResults=100&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const page = await this.request<{ messages?: { id: string }[]; nextPageToken?: string }>(url);
      ids.push(...(page.messages ?? []).map((m) => m.id));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < 500);

    const out: InboundSummary[] = [];
    for (const id of ids) {
      const m = await this.request<GmailMessage>(
        `${API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=References`,
      );
      const summary = toSummary(m);
      if (summary.fromEmail && summary.fromEmail !== this.selfEmail.toLowerCase()) out.push(summary);
    }
    return out;
  }

  async getMessage(id: string): Promise<InboundMessage> {
    const m = await this.request<GmailMessage>(`${API}/messages/${id}?format=full`);
    const texts: string[] = [];
    const htmls: string[] = [];
    const attachmentParts: GmailPart[] = [];
    const walk = (p?: GmailPart) => {
      if (!p) return;
      if (p.filename && (p.body?.attachmentId || p.body?.data)) attachmentParts.push(p);
      else if (p.mimeType === "text/plain" && p.body?.data) texts.push(b64url(p.body.data).toString("utf8"));
      else if (p.mimeType === "text/html" && p.body?.data) htmls.push(b64url(p.body.data).toString("utf8"));
      p.parts?.forEach(walk);
    };
    walk(m.payload);
    const attachments = [];
    for (const p of attachmentParts) {
      let data: Buffer;
      if (p.body?.attachmentId) {
        const a = await this.request<{ data: string; size: number }>(`${API}/messages/${id}/attachments/${p.body.attachmentId}`);
        data = b64url(a.data);
      } else data = b64url(p.body!.data!);
      attachments.push({ filename: p.filename!, contentType: p.mimeType ?? "application/octet-stream", content: data, size: data.length });
    }
    return {
      ...toSummary(m),
      bodyText: texts.join("\n").trim() || htmlToText(htmls.join("\n")),
      attachments,
    };
  }
}

function toSummary(m: GmailMessage): InboundSummary {
  const h = (name: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? null;
  const from = parseAddress(h("From"));
  return {
    providerMessageId: m.id,
    providerThreadId: m.threadId,
    internetMessageId: h("Message-ID"),
    inReplyTo: h("In-Reply-To"),
    references: h("References"),
    fromEmail: from.email,
    fromName: from.name,
    subject: h("Subject") ?? "",
    receivedAt: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString(),
  };
}
