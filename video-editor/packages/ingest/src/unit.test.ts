import { test } from "node:test";
import assert from "node:assert/strict";
import type { MediaAsset } from "@video-editor/shared-types";
import { parseShareUrl } from "./share-url.js";
import { sharedStreamsPartition } from "./sources/icloud-sharedstreams.js";
import { isTrustedIcloudUrl } from "./sources/icloud-hosts.js";
import { pickSample, clientSlug } from "./import-runner.js";
import { selectForMontage } from "./library-montage.js";
import { guessKind, safeFilename } from "./http.js";

test("liens iCloud : les 3 formats sont reconnus", () => {
  assert.deepEqual(parseShareUrl("https://www.icloud.com/sharedalbum/#B0aGWZuqDGKPZvv").provider, "icloud_shared_album");
  assert.equal(parseShareUrl("https://www.icloud.com/sharedalbum/fr-fr/#B0aGWZuqDGKPZvv").token, "B0aGWZuqDGKPZvv");
  const link = parseShareUrl("https://share.icloud.com/photos/0aBcDeFgHiJkLmNoPq");
  assert.equal(link.provider, "icloud_link");
  assert.equal(link.token, "0aBcDeFgHiJkLmNoPq");
  assert.equal(parseShareUrl("https://www.icloud.com/photos/#0aBcDeFgHiJkLmNoPq").token, "0aBcDeFgHiJkLmNoPq");
  assert.equal(parseShareUrl("https://www.icloud.com/photos/#/0aBcDeFgHiJkLmNoPq").token, "0aBcDeFgHiJkLmNoPq");
  assert.equal(parseShareUrl("https://photos.icloud.com/shared/album/AbCdEf123456/").provider, "icloud_shared_collection");
});

test("liens Google Drive : dossier, sous-compte, fichier, open?id, resourcekey", () => {
  const f = parseShareUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?resourcekey=0-xyz&usp=sharing");
  assert.equal(f.provider, "google_drive");
  assert.equal(f.token, "1AbCdEfGhIjKlMnOp");
  assert.equal(f.resourceKey, "0-xyz");
  assert.equal(f.isSingleFile, undefined);
  assert.equal(parseShareUrl("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOp").token, "1AbCdEfGhIjKlMnOp");
  assert.equal(parseShareUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing").isSingleFile, true);
  assert.equal(parseShareUrl("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp").token, "1AbCdEfGhIjKlMnOp");
});

test("liens refusés avec un message clair", () => {
  assert.throws(() => parseShareUrl("pas un lien"), /Lien invalide/);
  assert.throws(() => parseShareUrl("http://www.icloud.com/sharedalbum/#B0aGWZuqDGKPZvv"), /https/);
  assert.throws(() => parseShareUrl("https://www.icloud.com/sharedalbum/"), /jeton/);
  assert.throws(() => parseShareUrl("https://example.com/video.mp4"), /non prise en charge/);
});

test("partition sharedstreams déduite du jeton (algorithme de icloud.com)", () => {
  // 'B' → deux caractères base62 : "0a" = 0*62 + 36
  assert.equal(sharedStreamsPartition("B0aGWZuqDGKPZvv"), 36);
  // 'A' → un caractère base62 : "1" = 1
  assert.equal(sharedStreamsPartition("A1bcdefghijk"), 1);
});

test("URLs de téléchargement : seules les CDN Apple en HTTPS sont acceptées", () => {
  assert.ok(isTrustedIcloudUrl("https://cvws.icloud-content.com/B/abc/IMG_0001.MOV?o=1"));
  assert.ok(!isTrustedIcloudUrl("http://cvws.icloud-content.com/B/abc"));
  assert.ok(!isTrustedIcloudUrl("https://evil.example.com/icloud-content.com"));
  assert.ok(!isTrustedIcloudUrl("https://169.254.169.254/latest/meta-data"));
});

test("types et noms de fichiers", () => {
  assert.equal(guessKind("IMG_0001.MOV"), "video");
  assert.equal(guessKind("IMG_0002.HEIC"), "photo");
  assert.equal(guessKind("x", "video/quicktime"), "video");
  assert.equal(guessKind("notes.pdf", "application/pdf"), "other");
  assert.equal(safeFilename("../../etc/passwd", "f"), "_.._etc_passwd");
  assert.equal(safeFilename("", "fallback.bin"), "fallback.bin");
  assert.equal(clientSlug("Mariage Julie & Élodie"), "mariage-julie-elodie");
});

function asset(partial: Partial<MediaAsset> & { id: string }): MediaAsset {
  return {
    importId: "imp",
    externalId: partial.id,
    originalFilename: `${partial.id}.mov`,
    kind: "video",
    status: "ready",
    attempts: 1,
    objectKey: `k/${partial.id}`,
    position: 0,
    createdAt: "",
    updatedAt: "",
    durationSec: 10,
    ...partial,
  };
}

test("mode test : surtout des vidéos et au moins une photo", () => {
  const pending = [
    asset({ id: "p1", kind: "photo", position: 0, status: "pending" }),
    asset({ id: "v1", position: 1, status: "pending" }),
    asset({ id: "v2", position: 2, status: "pending" }),
    asset({ id: "v3", position: 3, status: "pending" }),
    asset({ id: "p2", kind: "photo", position: 4, status: "pending" }),
  ];
  const picked = pickSample(pending, 3).map((a) => a.id);
  assert.deepEqual(picked, ["p1", "v1", "v2"]);
  assert.deepEqual(pickSample(pending.filter((a) => a.kind === "video"), 5).length, 3);
  assert.deepEqual(pickSample(pending, 0), []);
});

test("sélection automatique : écarte les vidéos sombres, réduit les longues à leurs passages utiles, garde l'ordre de l'album", () => {
  const assets = [
    asset({ id: "long", position: 2, durationSec: 300, analysis: { score: 0.9, highlights: [{ start: 10, end: 16, score: 0.9, reason: "" }, { start: 100, end: 104, score: 0.8, reason: "" }], notes: [] } }),
    asset({ id: "dark", position: 0, durationSec: 8, analysis: { score: 0.4, tooDark: true, highlights: [], notes: [] } }),
    asset({ id: "short", position: 1, durationSec: 12, analysis: { score: 0.8, highlights: [], notes: [] } }),
    asset({ id: "photo", kind: "photo", position: 3, durationSec: undefined }),
    asset({ id: "notready", status: "pending", position: 4 }),
  ];
  const plans = selectForMontage(assets);
  assert.deepEqual(
    plans.map((p) => `${p.asset.id}:${p.startSec ?? "full"}`),
    ["short:full", "long:10", "long:100"]
  );
  assert.equal(plans.reduce((s, p) => s + p.durationSec, 0), 22);
  // Budget et nombre max respectés.
  assert.equal(selectForMontage(assets, { maxRushes: 1 }).length, 1);
  // Sélection manuelle : la vidéo sombre est prise si le monteur la coche.
  assert.deepEqual(selectForMontage(assets, { assetIds: ["dark"] }).map((p) => p.asset.id), ["dark"]);
});
