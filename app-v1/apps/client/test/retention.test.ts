import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_SETTINGS } from "@app/config";
import type { ProjectRow, VersionRow } from "@app/api";
import {
  EXPIRED_TITLE, EXPIRY_SOON_HOURS, expiredBody, expiryBannerText, hasPurgedFiles, purgedDraftMessage, readyDownloadMessage,
  retentionAnswer, retentionHours, summaryRetentionLine, uploadRetentionCaption, versionAvailability,
} from "../src/features/retention/logic";
import { canOfferRevision, reviseGuard, revisionsEnabled, showVersionList } from "../src/features/result/flags";
import { resolveVersion } from "../src/features/result/logic";
import { expiredProjectIds, projectA11yLabel, projectBadge, thumbnailPaths } from "../src/features/projects/logic";
import { canSubmitPassword, describePasswordError, showPasswordLogin } from "../src/features/auth/logic";
import { AI_CONSENT_HELP, aiConsentKey, aiConsentLabel, canCreateWithConsent, isOpenableUrl, needsAiConsent, termsKey } from "../src/features/legal/logic";

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const ver = (over: Partial<VersionRow> = {}): VersionRow => ({
  id: "v1", project_id: "p", version_number: 1, parent_version_id: null, job_id: null, status: "ready", instructions: null,
  render_path: "r/1.mp4", thumbnail_path: "t/1.jpg", duration_sec: 30, width: 1080, height: 1920, size_bytes: 1,
  created_at: "2026-10-06T10:00:00Z", ready_at: "2026-10-06T10:01:00Z", expires_at: inHours(20), ...over,
});

describe("état d'une version (conservation)", () => {
  it("disponible, bientôt supprimée (< 3 h), supprimée", () => {
    expect(EXPIRY_SOON_HOURS).toBe(3);
    expect(versionAvailability(ver({ expires_at: inHours(20) }), NOW)).toBe("available");
    expect(versionAvailability(ver({ expires_at: inHours(3.01) }), NOW)).toBe("available");
    expect(versionAvailability(ver({ expires_at: inHours(2.9) }), NOW)).toBe("expiring");
    expect(versionAvailability(ver({ expires_at: inHours(0.1) }), NOW)).toBe("expiring");
    expect(versionAvailability(ver({ expires_at: inHours(-0.1) }), NOW)).toBe("expired");
    expect(versionAvailability(ver({ status: "expired", expires_at: inHours(-5), render_path: null }), NOW)).toBe("expired");
    expect(versionAvailability(ver({ status: "expired", expires_at: null, render_path: null }), NOW)).toBe("expired");
  });
  it("sans date ou pas prête : jamais d'avertissement", () => {
    expect(versionAvailability(ver({ expires_at: null }), NOW)).toBe("available");
    expect(versionAvailability(ver({ status: "pending", expires_at: inHours(1) }), NOW)).toBe("available");
  });
  it("texte du bandeau d'expiration", () => {
    const t = expiryBannerText(new Date(2026, 9, 6, 14, 32).toISOString(), NOW);
    expect(t).toBe("Disponible jusqu'à aujourd'hui 14 h 32. Téléchargez-la avant : elle est ensuite supprimée.");
    expect(expiryBannerText(new Date(2026, 9, 7, 9, 5).toISOString(), NOW)).toContain("demain 9 h 05");
    expect(expiryBannerText(new Date(2026, 9, 9, 9, 5).toISOString(), NOW)).toMatch(/jusqu'à 9 oct\.? 9 h 05/);
  });
});

describe("textes de conservation : toujours le nombre d'heures du réglage", () => {
  it("valeurs par défaut du serveur lues depuis la config, aucun nombre écrit en dur", () => {
    const h = retentionHours(DEFAULT_PUBLIC_SETTINGS);
    expect(h).toEqual({ raw: DEFAULT_PUBLIC_SETTINGS["retention.raw_hours"], renders: DEFAULT_PUBLIC_SETTINGS["retention.renders_hours"] });
  });
  it("reprennent N", () => {
    expect(uploadRetentionCaption(7)).toBe("Vos fichiers sont supprimés 7 h après leur envoi.");
    expect(purgedDraftMessage(7)).toBe("Vos fichiers précédents ont été supprimés (conservation 7 h). Ajoutez-les à nouveau.");
    expect(summaryRetentionLine(5)).toBe("Votre vidéo reste téléchargeable pendant 5 h.");
    expect(readyDownloadMessage(5)).toBe("Votre vidéo est prête — téléchargez-la dans les 5 h.");
    expect(EXPIRED_TITLE).toBe("Cette vidéo n'est plus disponible.");
    expect(expiredBody(5)).toBe("Pour votre confidentialité, les vidéos sont supprimées 5 h après leur création.");
  });
  it("réponse FAQ : identique ou distincte selon les réglages, avec les justificatifs de paiement", () => {
    expect(retentionAnswer({ raw: 9, renders: 9 })).toContain("supprimés 9 h après");
    const diff = retentionAnswer({ raw: 9, renders: 11 });
    expect(diff).toContain("9 h");
    expect(diff).toContain("11 h");
    expect(diff).toMatch(/justificatifs de paiement .* sans lien avec votre identité/);
  });
  it("fichiers purgés : supprimés ET plus vieux que la durée de conservation", () => {
    const old = { status: "deleted", created_at: new Date(NOW.getTime() - 25 * 3_600_000).toISOString() };
    const recentRemoved = { status: "deleted", created_at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString() };
    const alive = { status: "uploaded", created_at: new Date(NOW.getTime() - 30 * 3_600_000).toISOString() };
    expect(hasPurgedFiles([old], 24, NOW)).toBe(true);
    expect(hasPurgedFiles([recentRemoved, alive], 24, NOW)).toBe(false);
    expect(hasPurgedFiles([], 24, NOW)).toBe(false);
  });
});

describe("version affichée sur la page résultat", () => {
  const project = { current_version_id: "v1" };
  it("lisible : lecteur, non expirée", () => {
    const r = resolveVersion(project, [ver()], null, NOW)!;
    expect(r.version.id).toBe("v1");
    expect(r.expired).toBe(false);
  });
  it("date dépassée avant la purge : expirée, sans lecteur", () => {
    expect(resolveVersion(project, [ver({ expires_at: inHours(-1) })], null, NOW)?.expired).toBe(true);
  });
  it("purgée par le serveur : expirée (et non « pas encore prête »)", () => {
    const gone = ver({ status: "expired", render_path: null, thumbnail_path: null, expires_at: inHours(-1) });
    expect(resolveVersion(project, [gone], null, NOW)).toEqual({ version: gone, expired: true });
  });
  it("une version lisible prime sur une version purgée ; rien du tout = null", () => {
    const gone = ver({ id: "v1", status: "expired", render_path: null });
    const ok = ver({ id: "v2", version_number: 2 });
    expect(resolveVersion({ current_version_id: "v2" }, [ok, gone], null, NOW)?.version.id).toBe("v2");
    expect(resolveVersion(project, [ver({ status: "pending", render_path: null })], null, NOW)).toBeNull();
    expect(resolveVersion(project, [], null, NOW)).toBeNull();
  });
});

describe("modifications masquées par le réglage", () => {
  it("réglage lu strictement (faux par défaut)", () => {
    expect(DEFAULT_PUBLIC_SETTINGS["features.revisions"]).toBe(false);
    expect(revisionsEnabled(DEFAULT_PUBLIC_SETTINGS)).toBe(false);
    expect(revisionsEnabled({ "features.revisions": true })).toBe(true);
  });
  it("bouton Modifier : réglage ET moteur ET version lisible ET pas de création en cours", () => {
    const base = { settingEnabled: true, engineEnabled: true, hasPlayableVersion: true, hasActiveJob: false };
    expect(canOfferRevision(base)).toBe(true);
    expect(canOfferRevision({ ...base, settingEnabled: false })).toBe(false);
    expect(canOfferRevision({ ...base, engineEnabled: false })).toBe(false);
    expect(canOfferRevision({ ...base, hasPlayableVersion: false })).toBe(false);
    expect(canOfferRevision({ ...base, hasActiveJob: true })).toBe(false);
  });
  it("liste des versions : jamais si le réglage est faux", () => {
    expect(showVersionList(false, 3)).toBe(false);
    expect(showVersionList(true, 1)).toBe(false);
    expect(showVersionList(true, 2)).toBe(true);
  });
  it("garde de la route revise", () => {
    expect(reviseGuard(false, true)).toBe("loading");
    expect(reviseGuard(false, false)).toBe("loading");
    expect(reviseGuard(true, false)).toBe("redirect");
    expect(reviseGuard(true, true)).toBe("allow");
  });
});

describe("cartes de projets : vidéo expirée", () => {
  const p = (id: string, over: Partial<ProjectRow> = {}): ProjectRow => ({
    id, title: id, status: "ready", source_mode: "edit_rushes", current_version_id: `v-${id}`, thumbnail_path: `t/${id}.jpg`,
    owner_user_id: "u", organization_id: null, created_at: "2026-10-06T10:00:00Z", updated_at: "2026-10-06T10:00:00Z", ...over,
  });
  it("repère les projets expirés (état serveur ou date dépassée), jamais les autres", () => {
    const projects = [p("a"), p("b"), p("c"), p("d", { status: "processing" }), p("e", { current_version_id: null })];
    const ids = expiredProjectIds(projects, [
      { id: "v-a", status: "expired", expires_at: inHours(-2) },
      { id: "v-b", status: "ready", expires_at: inHours(5) },
      { id: "v-c", status: "ready", expires_at: inHours(-1) },
      { id: "v-d", status: "expired", expires_at: inHours(-1) },
    ], NOW);
    expect([...ids].sort()).toEqual(["a", "c"]);
  });
  it("badge « Expirée » neutre ; le filtre Terminés reste basé sur le statut du projet", () => {
    expect(projectBadge("ready", true)).toEqual({ label: "Expirée", tone: "neutral" });
    expect(projectBadge("ready").label).toBe("Terminé");
    expect(projectBadge("failed", true).label).toBe("Échec");
    expect(projectA11yLabel(p("a"), NOW, true)).toContain("Expirée");
  });
  it("aucune URL de miniature demandée pour un projet expiré ou sans miniature", () => {
    const list = [p("a"), p("b"), p("c", { thumbnail_path: null })];
    expect(thumbnailPaths(list, new Set(["a"]))).toEqual(["t/b.jpg"]);
    expect(thumbnailPaths(list)).toEqual(["t/a.jpg", "t/b.jpg"]);
  });
});

describe("connexion par mot de passe (App Review)", () => {
  it("lien visible seulement si le réglage vaut vrai", () => {
    expect(DEFAULT_PUBLIC_SETTINGS["features.password_login"]).toBe(false);
    expect(showPasswordLogin(DEFAULT_PUBLIC_SETTINGS)).toBe(false);
    expect(showPasswordLogin({})).toBe(false);
    expect(showPasswordLogin({ "features.password_login": true })).toBe(true);
  });
  it("envoi : e-mail valide et mot de passe non vide", () => {
    expect(canSubmitPassword("a@b.fr", "x")).toBe(true);
    expect(canSubmitPassword("a@b.fr", "")).toBe(false);
    expect(canSubmitPassword("pas-un-mail", "x")).toBe(false);
  });
  it("erreurs humaines, jamais le texte brut", () => {
    const bad = describePasswordError({ code: "invalid_credentials", message: "Invalid login credentials" });
    expect(bad.title).toBe("E-mail ou mot de passe incorrect.");
    expect(describePasswordError(new Error("Failed to fetch")).detail).toMatch(/Internet/);
  });
});

describe("consentement et conditions", () => {
  it("acceptation des conditions : une clé par utilisateur et par version", () => {
    expect(termsKey("u1", "2026-10-06")).toBe("u1:2026-10-06");
    expect(termsKey(null, "v")).toBeNull();
    expect(termsKey("u1", "")).toBeNull();
  });
  it("liens : seulement http(s)", () => {
    expect(isOpenableUrl("https://example.com/cgv")).toBe(true);
    expect(isOpenableUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableUrl("")).toBe(false);
    expect(isOpenableUrl(undefined)).toBe(false);
  });
  it("case IA : affichée seulement si le réglage est actif et le consentement absent", () => {
    expect(needsAiConsent({ enabled: true, granted: false })).toBe(true);
    expect(needsAiConsent({ enabled: true, granted: true })).toBe(false);
    expect(needsAiConsent({ enabled: false, granted: false })).toBe(false);
    expect(aiConsentKey("2026-10-06")).toBe("ai_consent:2026-10-06");
  });
  it("bouton Créer : désactivé tant que la case requise n'est pas cochée", () => {
    expect(canCreateWithConsent(true, { needsConsent: true, checked: false })).toBe(false);
    expect(canCreateWithConsent(true, { needsConsent: true, checked: true })).toBe(true);
    expect(canCreateWithConsent(true, { needsConsent: false, checked: false })).toBe(true);
    expect(canCreateWithConsent(false, { needsConsent: false, checked: true })).toBe(false);
    expect(AI_CONSENT_HELP.length).toBeGreaterThan(10);
  });
  it("libellé : prestataires issus des réglages", () => {
    expect(aiConsentLabel(["Alpha", "Beta"])).toBe("J'autorise l'analyse de mes vidéos par des services d'intelligence artificielle tiers (Alpha, Beta) pour réaliser mon montage.");
    expect(aiConsentLabel([])).not.toContain("(");
  });
});
