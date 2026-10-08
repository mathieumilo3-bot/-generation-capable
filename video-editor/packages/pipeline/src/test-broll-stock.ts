/**
 * Test B-roll sous licence : prouve, sur de vrais fichiers ffmpeg, que
 *  1. un plan fourni SANS droits (owner/license/proof) n'est jamais résolu ;
 *  2. un plan AVEC droits est résolu, inscrit au registre (SHA-256) ;
 *  3. overlayBroll l'insère réellement dans la vidéo (image différente
 *     pendant la fenêtre, identique avant/après), durée et audio inchangés ;
 *  4. un fournisseur qui échoue ne bloque pas le montage (warning).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { overlayBroll, probe } from "@video-editor/render";
import { resolveBrollFromStock, type StockProvider } from "@video-editor/agents";
import type { BrollSlot } from "@video-editor/shared-types";

const run = promisify(execFile);
let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log(`${c ? "✓" : "✗"} ${msg}`);
  if (!c) fails++;
};
const frameHash = async (file: string, t: number, out: string) => {
  await run("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=64:-1", out]);
  return createHash("md5").update(await readFile(out)).digest("hex");
};

const dir = await mkdtemp(join(tmpdir(), "broll-"));
try {
  const base = join(dir, "base.mp4"), stock = join(dir, "stock.mp4"), out = join(dir, "out.mp4");
  await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x224466:s=540x960:r=30:d=6", "-f", "lavfi", "-i", "sine=f=440:d=6", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", base]);
  await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", stock]);

  const slot = (id: string): BrollSlot => ({ id, afterClipId: "c1", timelineStart: 0, durationSec: 1.5, query: "mountain", resolvedSource: null, resolvedMediaId: null, resolvedPath: null, license: null });

  const withRights: StockProvider = {
    name: "fake-ok",
    async find() {
      return { provider: "fake-ok", id: "1", filePath: stock, license: { provider: "fake-ok", owner: "Jane", license: "CC0", proof: "https://example.test/1", attribution: null } };
    },
  };
  const noRights: StockProvider = {
    name: "fake-norights",
    async find() {
      return { provider: "fake-norights", id: "2", filePath: stock, license: { provider: "fake-norights", owner: "", license: "", proof: "", attribution: null } };
    },
  };
  const failing: StockProvider = { name: "fake-fail", async find() { throw new Error("réseau coupé"); } };

  const a = await resolveBrollFromStock([slot("s1")], { cacheDir: join(dir, "cache"), providers: [noRights] });
  ok(a.slots[0]!.resolvedSource === null && a.ledger.length === 0, "plan sans droits : jamais résolu");

  const b = await resolveBrollFromStock([slot("s1")], { cacheDir: join(dir, "cache"), providers: [failing, withRights] });
  ok(b.slots[0]!.resolvedSource === "stock" && b.slots[0]!.license?.owner === "Jane", "plan avec droits : résolu après l'échec d'un autre fournisseur");
  ok(b.warnings.some((w) => w.includes("réseau coupé")), "l'échec du fournisseur est remonté en warning, sans bloquer");
  ok(b.ledger.length === 1 && b.ledger[0]!.sha.length === 16, "registre : une ligne avec empreinte SHA-256");

  await overlayBroll(base, [{ filePath: b.slots[0]!.resolvedPath!, start: 2, duration: 1.5 }], out, { width: 540, height: 960 });
  const [before, during, after] = [await frameHash(out, 1, join(dir, "f1.png")), await frameHash(out, 2.7, join(dir, "f2.png")), await frameHash(out, 4.5, join(dir, "f3.png"))];
  const baseBefore = await frameHash(base, 1, join(dir, "g1.png"));
  ok(before === baseBefore, "avant la fenêtre : image de base inchangée");
  ok(during !== baseBefore, "pendant la fenêtre : le plan B-roll est affiché");
  ok(after === baseBefore, "après la fenêtre : retour à la base");
  const info = await probe(out);
  ok(Math.abs(info.durationSec - 6) < 0.2, `durée inchangée (${info.durationSec.toFixed(2)} s)`);
  ok(info.hasAudio === true, "audio conservé");
} finally {
  await rm(dir, { recursive: true, force: true });
}
if (fails) {
  console.error(`${fails} échec(s)`);
  process.exit(1);
}
console.log("OK");
process.exit(0);
