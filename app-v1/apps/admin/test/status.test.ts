import { describe, expect, it } from "vitest";
import {
  customerStatus, effectiveInvitationStatus, invitationStatus, jobStatus, isFinalJobStatus, ledgerLabel,
  paymentStatus, webhookStatus, supportStatus, JOB_STATUS_OPTIONS, auditEntityLabel,
} from "../src/lib/status";
import { isCurrentRule, formatDurationRange, modeLabel } from "../src/lib/pricing";
import { layoutBars, layoutSegments, successRate } from "../src/lib/charts";
import { pageRequest, toPage, parsePageParam } from "../src/lib/pagination";

describe("statuts", () => {
  it("couvre tous les statuts de job du schéma", () => {
    for (const s of JOB_STATUS_OPTIONS) expect(jobStatus(s).label).not.toBe(s);
    expect(jobStatus("failed")).toEqual({ label: "Échec", tone: "danger" });
    expect(jobStatus("zzz")).toEqual({ label: "zzz", tone: "neutral" });
    expect(isFinalJobStatus("completed")).toBe(true);
    expect(isFinalJobStatus("rendering")).toBe(false);
  });
  it("paiement, webhook, support, client, ledger", () => {
    expect(paymentStatus("partially_refunded").label).toBe("Remb. partiel");
    expect(webhookStatus("failed").tone).toBe("danger");
    expect(supportStatus("open").tone).toBe("warning");
    expect(customerStatus("suspended")).toEqual({ label: "Suspendu", tone: "danger" });
    expect(ledgerLabel("manual_adjustment")).toBe("Ajustement manuel");
    expect(ledgerLabel("inconnu")).toBe("inconnu");
    expect(auditEntityLabel("video_job")).toBe("Job vidéo");
  });
  it("invitation en attente et dépassée = expirée", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(effectiveInvitationStatus("pending", "2026-04-30T00:00:00Z", now)).toBe("expired");
    expect(effectiveInvitationStatus("pending", "2026-05-02T00:00:00Z", now)).toBe("pending");
    expect(effectiveInvitationStatus("revoked", "2026-05-02T00:00:00Z", now)).toBe("revoked");
    expect(effectiveInvitationStatus("accepted", "2026-04-01T00:00:00Z", now)).toBe("accepted");
    expect(invitationStatus("expired").label).toBe("Expirée");
  });
});

describe("tarifs en vigueur", () => {
  const now = new Date("2026-05-01T00:00:00Z");
  it("miroir de pricing_rule_is_current", () => {
    expect(isCurrentRule({ active: true, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null }, now)).toBe(true);
    expect(isCurrentRule({ active: false, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: "2026-04-01T00:00:00Z" }, now)).toBe(false);
    expect(isCurrentRule({ active: true, effectiveFrom: "2026-06-01T00:00:00Z", effectiveTo: null }, now)).toBe(false);
    expect(isCurrentRule({ active: true, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: "2026-04-01T00:00:00Z" }, now)).toBe(false);
  });
  it("libellés", () => {
    expect(formatDurationRange(0, 30)).toBe("0 s – 30 s");
    expect(formatDurationRange(60, 120)).toBe("1 min – 2 min");
    expect(modeLabel("revision")).toBe("Modification");
  });
});

describe("graphiques", () => {
  it("barres : relatif au max, 0 reste 0, non nul ≥ 2 %", () => {
    const l = layoutBars([
      { key: "a", label: "A", value: 1000 },
      { key: "b", label: "B", value: 500 },
      { key: "c", label: "C", value: 1 },
      { key: "d", label: "D", value: 0 },
    ]);
    expect(l.map((x) => x.pct)).toEqual([100, 50, 2, 0]);
  });
  it("segments : somme 100 %, offsets cumulés ; total nul → rien", () => {
    const l = layoutSegments([{ key: "a", label: "A", value: 3 }, { key: "b", label: "B", value: 1 }]);
    expect(l[0]).toMatchObject({ pct: 75, offset: 0 });
    expect(l[1]).toMatchObject({ pct: 25, offset: 75 });
    expect(layoutSegments([{ key: "a", label: "A", value: 0 }])[0]?.pct).toBe(0);
  });
  it("taux de réussite", () => {
    expect(successRate(9, 1)).toBe(90);
    expect(successRate(0, 0)).toBeNull();
  });
});

describe("pagination", () => {
  it("demande size+1 lignes pour détecter la page suivante", () => {
    const req = pageRequest(2, 25);
    expect(req).toMatchObject({ limit: 26, offset: 50, size: 25, page: 2 });
    const rows = Array.from({ length: 26 }, (_, i) => i);
    const p = toPage(rows, req);
    expect(p.rows).toHaveLength(25);
    expect(p.hasNext).toBe(true);
    expect(toPage(rows.slice(0, 25), req).hasNext).toBe(false);
  });
  it("paramètre de page de l'URL (1-indexé) → index 0", () => {
    expect(parsePageParam(null)).toBe(0);
    expect(parsePageParam("3")).toBe(2);
    expect(parsePageParam("-4")).toBe(0);
    expect(parsePageParam("abc")).toBe(0);
    expect(pageRequest(-1).offset).toBe(0);
  });
});
