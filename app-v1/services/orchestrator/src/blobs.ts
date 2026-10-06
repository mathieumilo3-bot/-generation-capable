import { open, stat } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tusUpload } from "@app/api";

/** Accès au Storage privé. Aucune URL publique : téléchargements par URL signée courte, envois par TUS. */
export interface BlobStore {
  signedDownloadUrl(bucket: string, path: string, ttlSeconds: number): Promise<string>;
  uploadFile(bucket: string, path: string, filePath: string, contentType: string): Promise<void>;
  uploadBytes(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(bucket: string, path: string): Promise<void>;
}

export class SupabaseBlobs implements BlobStore {
  constructor(private sb: SupabaseClient, private o: { url: string; secretKey: string }) {}

  async signedDownloadUrl(bucket: string, path: string, ttl: number) {
    const { data, error } = await this.sb.storage.from(bucket).createSignedUrl(path, ttl);
    if (error || !data) throw new Error(`signed_url: ${error?.message}`);
    return data.signedUrl;
  }

  /** Gros fichiers (rendus) : TUS reprenable, morceaux de 6 Mio lus depuis le disque (jamais tout en mémoire). */
  async uploadFile(bucket: string, path: string, filePath: string, contentType: string) {
    const size = (await stat(filePath)).size;
    const blob = await openAsBlob(filePath);
    await tusUpload({
      file: { size, slice: (s, e) => blob.slice(s, e) },
      endpoint: `${this.o.url.replace(/\/$/, "")}/storage/v1/upload/resumable`,
      headers: async () => ({ authorization: `Bearer ${this.o.secretKey}`, apikey: this.o.secretKey, "x-upsert": "true" }),
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: "3600" },
    });
  }

  async uploadBytes(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.sb.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(`upload: ${error.message}`);
  }

  async remove(bucket: string, path: string) {
    const { error } = await this.sb.storage.from(bucket).remove([path]);
    if (error) throw new Error(`remove: ${error.message}`);
  }
}

export class MemoryBlobs implements BlobStore {
  readonly files = new Map<string, Uint8Array>();
  readonly removed: string[] = [];
  async signedDownloadUrl(bucket: string, path: string) { return `memory://${bucket}/${path}?sig=test`; }
  async uploadFile(bucket: string, path: string, filePath: string) {
    const fh = await open(filePath);
    try { this.files.set(`${bucket}/${path}`, new Uint8Array((await fh.readFile()).buffer.slice(0))); } finally { await fh.close(); }
  }
  async uploadBytes(bucket: string, path: string, bytes: Uint8Array) { this.files.set(`${bucket}/${path}`, bytes); }
  async remove(bucket: string, path: string) { this.removed.push(`${bucket}/${path}`); this.files.delete(`${bucket}/${path}`); }
}
