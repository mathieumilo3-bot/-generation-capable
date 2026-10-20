/**
 * Ligne de commande à lancer SUR LE SERVEUR (fly ssh console) — rien
 * n'est téléchargé sur ton Mac.
 *
 *   node dist/cli.js check  <lien>                         # accès automatisé possible ? (aucun téléchargement)
 *   node dist/cli.js import <lien> [--client Nom] [--sample 3] [--user <id>]
 *   node dist/cli.js import <lien> --full                  # import complet direct
 *   node dist/cli.js full   <importId>                     # passe un import testé en complet
 *   node dist/cli.js retry  <importId>                     # relance les fichiers en échec
 *   node dist/cli.js status <importId>
 *   node dist/cli.js storage-check                         # les clés R2 marchent-elles ? (écrit/relit un petit fichier)
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Db } from "@video-editor/db";
import { createObjectStoreFromEnv } from "./object-store.js";
import { runImport } from "./import-runner.js";
import { parseShareUrl, PROVIDER_LABEL_FR } from "./share-url.js";
import { createMediaSource } from "./sources/index.js";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Écrit, relit et signe un petit objet : prouve que les secrets R2 sont bons. */
async function storageCheck(): Promise<void> {
  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT ?? join(process.cwd(), "..", "..", "storage");
  const store = createObjectStoreFromEnv(storageRoot);
  console.log(`Stockage : ${store.label}`);
  if (store.backend !== "r2") {
    console.log("✗ R2 non configuré : il manque R2_ACCOUNT_ID (ou R2_ENDPOINT), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY ou R2_BUCKET.");
    process.exitCode = 1;
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), "r2-check-"));
  const content = `video-editor storage-check ${new Date().toISOString()}`;
  const key = `_healthcheck/${Date.now()}.txt`;
  try {
    await writeFile(join(dir, "in.txt"), content);
    await store.putFile(key, join(dir, "in.txt"), "text/plain");
    const size = await store.head(key);
    await store.getToFile(key, join(dir, "out.txt"));
    const back = await readFile(join(dir, "out.txt"), "utf-8");
    const signed = await store.presignGet(key, 60);
    if (size !== Buffer.byteLength(content) || back !== content || !signed) throw new Error("relecture incohérente");
    console.log(`✓ R2 OK — écriture, relecture et URL signée fonctionnent (objet test : ${key})`);
  } catch (err) {
    console.log(`✗ R2 refuse l'accès : ${(err as Error).message}`);
    console.log("  Vérifie l'Account ID, le nom du bucket, et que le jeton a le droit « Object Read & Write » sur ce bucket.");
    process.exitCode = 1;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const [cmd, target, ...rest] = process.argv.slice(2);
  if (cmd === "storage-check") return storageCheck();
  if (!cmd || !target) {
    console.log("Usage : cli.js check|import|full|retry|status <lien|importId> [options] | storage-check — voir l'en-tête de src/cli.ts");
    process.exitCode = 1;
    return;
  }

  if (cmd === "check") {
    const link = parseShareUrl(target);
    console.log(`Source : ${PROVIDER_LABEL_FR[link.provider]}`);
    const listing = await createMediaSource(link).list();
    const videos = listing.items.filter((i) => i.kind === "video");
    const bytes = listing.items.reduce((s, i) => s + (i.sizeBytes ?? 0), 0);
    console.log(`✓ Accès automatisé OK — « ${listing.title ?? "sans titre"} »`);
    console.log(`  ${listing.items.length} fichier(s) : ${videos.length} vidéo(s), ${listing.items.length - videos.length} photo(s), ${(bytes / 1e9).toFixed(2)} Go annoncés`);
    for (const i of listing.items.slice(0, 10)) {
      console.log(`  - ${i.filename} (${i.kind}${i.durationSec ? `, ${i.durationSec.toFixed(1)}s` : ""}${i.sizeBytes ? `, ${(i.sizeBytes / 1e6).toFixed(1)} Mo` : ""})`);
    }
    return;
  }

  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT ?? join(process.cwd(), "..", "..", "storage");
  const db = new Db(process.env.VIDEO_EDITOR_DB_PATH ?? join(storageRoot, "web.sqlite"));
  const store = createObjectStoreFromEnv(storageRoot);
  const workDir = join(storageRoot, "ingest-tmp");
  try {
    let importId = target;
    if (cmd === "import") {
      const link = parseShareUrl(target);
      const full = rest.includes("--full");
      const imp = db.createMediaImport({
        userId: flag(rest, "user") ?? "cli",
        clientName: flag(rest, "client") ?? "Client",
        sourceUrl: link.normalizedUrl,
        provider: link.provider,
        mode: full ? "full" : "probe",
        sampleSize: parseInt(flag(rest, "sample") ?? "3", 10),
      });
      importId = imp.id;
      console.log(`Import ${importId} créé (${full ? "complet" : `test sur ${imp.sampleSize} fichier(s)`}) — stockage : ${store.label}`);
    } else if (cmd === "full") {
      db.requeueMediaImport(importId, { mode: "full" });
    } else if (cmd === "retry") {
      db.requeueMediaImport(importId, { resetFailed: true });
    } else if (cmd !== "status") {
      throw new Error(`Commande inconnue : ${cmd}`);
    }

    if (cmd !== "status") {
      // Traité directement par ce process (pas de claim : il pourrait prendre un autre import de la file).
      db.updateMediaImport(importId, { status: "listing" });
      await runImport({ db, store, importId, workDir });
    }
    const imp = db.getMediaImport(importId);
    const c = db.countMediaAssets(importId);
    console.log(`\nImport ${importId} : ${imp?.status}${imp?.error ? ` — ${imp.error}` : ""}`);
    console.log(`  ${c.ready}/${c.total} prêts · ${c.failed} échec(s) · ${c.pending} en attente · ${c.videos} vidéos · ${c.photos} photos · ${(c.readyBytes / 1e9).toFixed(2)} Go dans le stockage`);
    if (imp?.status === "sampled") console.log(`  Test concluant → lancer l'import complet : node dist/cli.js full ${importId}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exitCode = 1;
});
