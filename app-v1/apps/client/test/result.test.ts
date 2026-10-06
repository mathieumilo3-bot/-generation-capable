import { describe, expect, it } from "vitest";
import type { JobRow, VersionRow } from "@app/api";
import { activeJobOf, downloadFileName, failedJobOf, pickInitialVersion, playerAspect, titleForRename, versionLabel } from "../src/features/result/logic";
import { canSubmitPlan, composeInstructions, describePlan, quickCommands, topupHref } from "../src/features/result/revision";
import { jobPollInterval, percentLabel, progressValue, titleForJob } from "../src/features/processing/logic";
import { routeForNotificationData, formatNotificationTime } from "../src/features/notifications/logic";
import { describeJob, planRevision } from "@app/domain";

const ver = (n: number, over: Partial<VersionRow> = {}): VersionRow => ({
  id: `v${n}`, project_id: "p", version_number: n, parent_version_id: null, job_id: null, status: "ready", instructions: null,
  render_path: `r/${n}.mp4`, thumbnail_path: null, duration_sec: 30, width: 1080, height: 1920, size_bytes: 1, created_at: "2026-01-01T00:00:00Z", ready_at: "2026-01-01T00:01:00Z", expires_at: null, ...over,
});
const job = (over: Partial<JobRow> = {}): JobRow => ({
  id: "j", project_id: "p", version_id: "v1", kind: "create", status: "editing", progress: 0, current_stage: null, price_cents: 484, requested_duration_sec: 30,
  aspect_ratio: "9:16", error_code: null, cancel_requested: false, created_at: "2026-01-01T00:00:00Z", started_at: null, completed_at: null, ...over,
});

describe("version à lire", () => {
  it("préfère la version courante prête", () => {
    const vs = [ver(2), ver(1)];
    expect(pickInitialVersion({ current_version_id: "v1" }, vs)?.id).toBe("v1");
  });
  it("sinon la plus récente prête ; jamais une version en cours", () => {
    const vs = [ver(3, { status: "pending", render_path: null }), ver(2), ver(1)];
    expect(pickInitialVersion({ current_version_id: "v3" }, vs)?.id).toBe("v2");
    expect(pickInitialVersion({ current_version_id: null }, [ver(1, { status: "pending", render_path: null })])).toBeNull();
  });
  it("libellé et ratio", () => {
    expect(versionLabel(2)).toBe("Version 2");
    expect(playerAspect(ver(1))).toBeCloseTo(9 / 16);
    expect(playerAspect(null)).toBeCloseTo(9 / 16);
    expect(playerAspect(ver(1, { width: 1920, height: 1080 }))).toBeCloseTo(16 / 9);
    expect(playerAspect(ver(1, { width: 500, height: 4000 }))).toBeCloseTo(9 / 16);
  });
});

describe("jobs d'un projet", () => {
  it("détecte la création active et l'échec sans version lisible", () => {
    expect(activeJobOf([job({ status: "completed" }), job({ id: "k", status: "rendering" })])?.id).toBe("k");
    expect(activeJobOf([job({ status: "failed" })])).toBeUndefined();
    expect(failedJobOf([job({ status: "failed" })], [])?.status).toBe("failed");
    expect(failedJobOf([job({ status: "failed" })], [ver(1)])).toBeUndefined();
  });
});

describe("noms", () => {
  it("nom de fichier de téléchargement", () => {
    expect(downloadFileName("Mon voyage à Rome !", 2)).toBe("Mon-voyage-a-Rome-v2.mp4");
    expect(downloadFileName("   ", 1)).toBe("video-v1.mp4");
    expect(downloadFileName("../../etc/passwd", 1)).toBe("etc-passwd-v1.mp4");
  });
  it("renommer", () => {
    expect(titleForRename("  Nouveau   nom ")).toBe("Nouveau nom");
    expect(titleForRename("   ")).toBeNull();
    expect(titleForRename("x".repeat(300))).toHaveLength(120);
  });
});

describe("modification", () => {
  it("suggestions = commandes prises en charge, dans l'ordre", () => {
    expect(quickCommands(["more_zooms", "shorter", "inconnue"])).toEqual(["shorter", "more_zooms"]);
    expect(quickCommands([])).toEqual([]);
  });
  it("compose la demande sans doublon", () => {
    expect(composeInstructions("Raccourcis l'intro", ["shorter", "more_zooms"])).toBe("Raccourcis l'intro. Plus court. Plus de zooms");
    expect(composeInstructions("Plus court svp", ["shorter"])).toBe("Plus court svp");
    expect(composeInstructions("  ", [])).toBe("");
  });
  const supported = ["shorter", "faster", "slower", "more_zooms", "less_zooms"];
  it("aperçu honnête", () => {
    expect(describePlan("", planRevision("", supported)).status).toBe("empty");
    const ok = describePlan("Plus court", planRevision("Plus court", supported));
    expect(ok.status).toBe("ok");
    expect(ok.applied).toEqual(["Plus court"]);
    expect(canSubmitPlan(ok)).toBe(true);
    const unsupported = describePlan("Ajoute de la musique épique", planRevision("Ajoute de la musique épique", supported));
    expect(unsupported.status).toBe("unsupported");
    expect(canSubmitPlan(unsupported)).toBe(false);
    expect(unsupported.message).toMatch(/pas encore/);
    const partial = describePlan("Raccourcis la vidéo et change complètement toutes les couleurs", planRevision("Raccourcis la vidéo et change complètement toutes les couleurs", supported));
    expect(partial.status).toBe("partial");
    expect(canSubmitPlan(partial)).toBe(true);
  });
  it("commande non prise en charge par le moteur = non appliquée", () => {
    expect(describePlan("Plus de zooms", planRevision("Plus de zooms", ["shorter"])).status).toBe("unsupported");
  });
  it("lien de recharge avec retour", () => {
    const l = topupHref(124, 1000, [1000, 2000], "/project/abc/revise?versionId=v1");
    expect(l).toBe("/account/topup?amount=1000&returnTo=" + encodeURIComponent("/project/abc/revise?versionId=v1"));
    expect(topupHref(1500, 1000, [1000, 2000], "/x")).toContain("amount=2000");
  });
});

describe("suivi de création", () => {
  it("polling tant que la création est active", () => {
    expect(jobPollInterval("editing")).toBe(4000);
    expect(jobPollInterval(undefined)).toBe(4000);
    expect(jobPollInterval("completed")).toBe(false);
    expect(jobPollInterval("failed")).toBe(false);
    expect(jobPollInterval("cancelled")).toBe(false);
  });
  it("pas de fausse barre", () => {
    expect(progressValue(describeJob("analyzing", 0))).toBeNull();
    expect(percentLabel(describeJob("analyzing", 0))).toBeNull();
    expect(progressValue(describeJob("rendering", 42))).toBeCloseTo(0.42);
    expect(percentLabel(describeJob("rendering", 42))).toBe("42 %");
    expect(progressValue(describeJob("rendering", 100))).toBeCloseTo(0.99);
  });
  it("titres sans jargon", () => {
    expect(titleForJob({ kind: "create" }, "editing")).toBe("Nous créons votre vidéo");
    expect(titleForJob({ kind: "revision" }, "rendering")).toBe("Nous modifions votre vidéo");
    expect(titleForJob({ kind: "create" }, "completed")).toBe("Votre vidéo est prête");
    expect(titleForJob({ kind: "create" }, "cancelled")).toBe("Création annulée");
    const all = (["queued", "failed", "cancelled", "completed"] as const).map((s) => titleForJob({ kind: "create" }, s)).join(" ");
    expect(all).not.toMatch(/FFmpeg|worker|queue|encod/i);
  });
});

describe("notifications", () => {
  it("route depuis deep_link, project_id ou job_id", () => {
    expect(routeForNotificationData({ deep_link: "/project/3f0c9b1e-1111-4222-8333-444455556666" })).toBe("/project/3f0c9b1e-1111-4222-8333-444455556666");
    expect(routeForNotificationData({ deep_link: "https://app.example.com/video/3f0c9b1e-1111-4222-8333-444455556666" })).toBe("/project/3f0c9b1e-1111-4222-8333-444455556666");
    expect(routeForNotificationData({ deep_link: "/account/wallet" })).toBe("/account/wallet");
    expect(routeForNotificationData({ project_id: "abc12345" })).toBe("/project/abc12345");
    expect(routeForNotificationData({ job_id: "job-12345" })).toBe("/processing/job-12345");
    expect(routeForNotificationData({})).toBeNull();
    expect(routeForNotificationData(null)).toBeNull();
  });
  it("refuse les liens dangereux", () => {
    expect(routeForNotificationData({ deep_link: "//evil.com/x" })).toBeNull();
    expect(routeForNotificationData({ deep_link: "/project/../../admin" })).toBeNull();
    expect(routeForNotificationData({ deep_link: "javascript:alert(1)" })).toBeNull();
    expect(routeForNotificationData({ project_id: "../x" })).toBeNull();
  });
  it("heure relative", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    expect(formatNotificationTime("2026-06-15T11:59:50Z", now)).toBe("À l'instant");
    expect(formatNotificationTime("2026-06-15T11:30:00Z", now)).toBe("Il y a 30 min");
    expect(formatNotificationTime("2026-06-15T07:00:00Z", now)).toBe("Il y a 5 h");
    expect(formatNotificationTime("2026-06-14T09:00:00Z", now)).toBe("Hier");
  });
});
