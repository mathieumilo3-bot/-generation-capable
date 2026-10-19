import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Stockage objet des originaux et miniatures. Implémentation de
 * production : Cloudflare R2 (API S3). Repli local (disque du serveur)
 * uniquement quand R2 n'est pas configuré — annoncé comme tel dans l'UI,
 * jamais silencieux.
 */
export interface ObjectStore {
  readonly backend: "r2" | "local";
  /** Description lisible (bucket, dossier) pour l'UI et les logs. */
  readonly label: string;
  putFile(key: string, filePath: string, contentType: string): Promise<void>;
  /** Taille de l'objet, ou null s'il n'existe pas. */
  head(key: string): Promise<number | null>;
  getToFile(key: string, destPath: string): Promise<void>;
  /** URL de lecture temporaire (R2) ou null (local : servi par l'API). */
  presignGet(key: string, expiresInSec?: number): Promise<string | null>;
  /** Flux de lecture (repli local et proxy API). */
  getStream(key: string): Promise<{ stream: Readable; size: number }>;
}

export interface R2Config {
  accountId?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
}

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2Config | null {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  const accountId = env.R2_ACCOUNT_ID;
  const endpoint = env.R2_ENDPOINT;
  if (!accessKeyId || !secretAccessKey || !bucket || (!accountId && !endpoint)) return null;
  return { accountId, endpoint, accessKeyId, secretAccessKey, bucket, region: env.R2_REGION };
}

export class R2ObjectStore implements ObjectStore {
  readonly backend = "r2" as const;
  readonly label: string;
  // Chargé paresseusement : le SDK AWS n'entre dans le process que si R2 sert vraiment.
  private clientPromise: Promise<{ s3: import("@aws-sdk/client-s3").S3Client; sdk: typeof import("@aws-sdk/client-s3") }> | null = null;

  constructor(private readonly cfg: R2Config) {
    this.label = `Cloudflare R2 — bucket « ${cfg.bucket} »`;
  }

  private client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then((sdk) => ({
        sdk,
        s3: new sdk.S3Client({
          region: this.cfg.region ?? "auto",
          endpoint: this.cfg.endpoint ?? `https://${this.cfg.accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey },
          forcePathStyle: true,
          // R2 ne gère pas les checksums CRC « when_supported » des SDK récents sur tous les chemins.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
          maxAttempts: 5,
        }),
      }));
    }
    return this.clientPromise;
  }

  async putFile(key: string, filePath: string, contentType: string): Promise<void> {
    const { s3 } = await this.client();
    const { Upload } = await import("@aws-sdk/lib-storage");
    // Envoi multipart en flux (parts de 16 Mo, 4 en parallèle) : un fichier
    // de plusieurs Go ne passe jamais en mémoire.
    const upload = new Upload({
      client: s3,
      params: { Bucket: this.cfg.bucket, Key: key, Body: createReadStream(filePath), ContentType: contentType },
      partSize: 16 * 1024 * 1024,
      queueSize: 4,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  async head(key: string): Promise<number | null> {
    const { s3, sdk } = await this.client();
    try {
      const res = await s3.send(new sdk.HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return res.ContentLength ?? 0;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async getStream(key: string): Promise<{ stream: Readable; size: number }> {
    const { s3, sdk } = await this.client();
    const res = await s3.send(new sdk.GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    return { stream: res.Body as Readable, size: res.ContentLength ?? 0 };
  }

  async getToFile(key: string, destPath: string): Promise<void> {
    await mkdir(dirname(destPath), { recursive: true });
    const { stream } = await this.getStream(key);
    const tmp = `${destPath}.part`;
    await pipeline(stream, createWriteStream(tmp));
    await rename(tmp, destPath);
  }

  async presignGet(key: string, expiresInSec = 3600): Promise<string | null> {
    const { s3, sdk } = await this.client();
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(s3, new sdk.GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), { expiresIn: expiresInSec });
  }
}

export class LocalObjectStore implements ObjectStore {
  readonly backend = "local" as const;
  readonly label: string;

  constructor(private readonly root: string) {
    this.label = `Disque du serveur (${root}) — R2 non configuré`;
  }

  private pathFor(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(resolve(this.root) + sep)) throw new Error(`Clé d'objet invalide : ${key}`);
    return p;
  }

  async putFile(key: string, filePath: string): Promise<void> {
    const dest = this.pathFor(key);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(filePath, `${dest}.part`);
    await rename(`${dest}.part`, dest);
  }

  async head(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch {
      return null;
    }
  }

  async getStream(key: string): Promise<{ stream: Readable; size: number }> {
    const p = this.pathFor(key);
    const size = (await stat(p)).size;
    return { stream: createReadStream(p), size };
  }

  async getToFile(key: string, destPath: string): Promise<void> {
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(this.pathFor(key), `${destPath}.part`);
    await rename(`${destPath}.part`, destPath);
  }

  async presignGet(): Promise<string | null> {
    return null;
  }
}

/** R2 si les variables R2_* sont présentes, sinon disque local sous la racine de stockage. */
export function createObjectStoreFromEnv(storageRoot: string, env: NodeJS.ProcessEnv = process.env): ObjectStore {
  const cfg = r2ConfigFromEnv(env);
  if (cfg) return new R2ObjectStore(cfg);
  return new LocalObjectStore(join(storageRoot, "object-store"));
}

/** Convertit un Readable Node en ReadableStream web (réponses Next.js). */
export function toWebStream(stream: Readable): ReadableStream {
  return Readable.toWeb(stream) as ReadableStream;
}
