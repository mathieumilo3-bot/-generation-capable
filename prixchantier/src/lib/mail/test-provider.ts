import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { InboundMessage, InboundSummary, MailProvider, OutgoingMessage, SentMessage } from "./types";

/**
 * Boîte mail de test sur disque, utilisée UNIQUEMENT par les tests
 * bout-en-bout (ENABLE_TEST_MAILBOX=1, interdit en production).
 * Les messages envoyés sont écrits dans <dir>/<boîte>/sent, et le test
 * dépose les réponses fournisseurs dans <dir>/<boîte>/inbox.
 */

export type StoredMessage = {
  id: string;
  threadId: string;
  internetMessageId: string;
  inReplyTo: string | null;
  references: string | null;
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  text: string;
  date: string;
  attachments: { filename: string; contentType: string; base64: string }[];
};

export function testMailboxDir() {
  return process.env.TEST_MAILBOX_DIR || join(process.cwd(), ".e2e", "mailbox");
}

export class TestMailProvider implements MailProvider {
  constructor(private email: string) {}

  private dir(kind: "sent" | "inbox") {
    return join(testMailboxDir(), this.email.toLowerCase(), kind);
  }

  async send(msg: OutgoingMessage): Promise<SentMessage> {
    if (/invalide|bounce/i.test(msg.to)) throw new Error("Adresse du destinataire refusée (test).");
    await mkdir(this.dir("sent"), { recursive: true });
    const id = `sent-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const stored: StoredMessage = {
      id,
      threadId: msg.replyTo?.providerThreadId ?? `thread-${randomBytes(6).toString("hex")}`,
      internetMessageId: `<${id}@test.prixchantier>`,
      inReplyTo: msg.replyTo?.internetMessageId ?? null,
      references: msg.replyTo?.internetMessageId ?? null,
      from: msg.fromEmail,
      fromName: msg.fromName ?? null,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      date: new Date().toISOString(),
      attachments: msg.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, base64: a.content.toString("base64") })),
    };
    await writeFile(join(this.dir("sent"), `${id}.json`), JSON.stringify(stored, null, 2));
    return { providerMessageId: id, providerThreadId: stored.threadId, internetMessageId: stored.internetMessageId, sentAt: stored.date };
  }

  private async readInbox(): Promise<StoredMessage[]> {
    const dir = this.dir("inbox");
    const files = await readdir(dir).catch(() => []);
    const out: StoredMessage[] = [];
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      out.push(JSON.parse(await readFile(join(dir, f), "utf8")) as StoredMessage);
    }
    return out;
  }

  async listInbound(since: Date): Promise<InboundSummary[]> {
    return (await this.readInbox())
      .filter((m) => new Date(m.date) >= since)
      .map((m) => ({
        providerMessageId: m.id,
        providerThreadId: m.threadId,
        internetMessageId: m.internetMessageId,
        inReplyTo: m.inReplyTo,
        references: m.references,
        fromEmail: m.from.toLowerCase(),
        fromName: m.fromName,
        subject: m.subject,
        receivedAt: m.date,
      }));
  }

  async getMessage(id: string): Promise<InboundMessage> {
    const m = (await this.readInbox()).find((x) => x.id === id);
    if (!m) throw new Error("Message introuvable");
    return {
      providerMessageId: m.id,
      providerThreadId: m.threadId,
      internetMessageId: m.internetMessageId,
      inReplyTo: m.inReplyTo,
      references: m.references,
      fromEmail: m.from.toLowerCase(),
      fromName: m.fromName,
      subject: m.subject,
      receivedAt: m.date,
      bodyText: m.text,
      attachments: m.attachments.map((a) => {
        const content = Buffer.from(a.base64, "base64");
        return { filename: a.filename, contentType: a.contentType, content, size: content.length };
      }),
    };
  }
}
