import { describe, expect, it } from "vitest";
import type { ProjectRow } from "@app/api";
import {
  PAGE_SIZE, columnsForWidth, formatRelativeDate, nextCursor, padGrid, projectBadge, projectTitle, thumbnailPaths,
} from "../src/features/projects/logic";
import { activeJobTitle, greetingText, recentProjects, unreadBadgeLabel, unreadA11y } from "../src/features/home/logic";

const row = (i: number, over: Partial<ProjectRow> = {}): ProjectRow => ({
  id: `p${i}`, title: `Vidéo ${i}`, status: "ready", source_mode: "edit_rushes", current_version_id: null, thumbnail_path: `t/${i}.jpg`,
  owner_user_id: "u", organization_id: null, created_at: `2026-03-${String(30 - i).padStart(2, "0")}T10:00:00Z`, updated_at: "2026-03-30T10:00:00Z", ...over,
});

describe("pagination", () => {
  it("curseur = created_at du dernier, seulement si la page est pleine", () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, i) => row(i % 28));
    expect(nextCursor(full)).toBe(full[PAGE_SIZE - 1]!.created_at);
    expect(nextCursor(full.slice(0, 5))).toBeUndefined();
    expect(nextCursor([], 24)).toBeUndefined();
  });
});

describe("grille", () => {
  it("colonnes adaptatives", () => {
    expect(columnsForWidth(375)).toBe(2);
    expect(columnsForWidth(559)).toBe(2);
    expect(columnsForWidth(720)).toBe(3);
  });
  it("complète la dernière ligne", () => {
    expect(padGrid([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3, 4, 5, null]);
    expect(padGrid([1, 2, 3, 4], 2)).toEqual([1, 2, 3, 4]);
    expect(padGrid([], 3)).toEqual([]);
  });
  it("dédoublonne les miniatures et ignore les absentes", () => {
    expect(thumbnailPaths([{ thumbnail_path: "a" }, { thumbnail_path: null }, { thumbnail_path: "a" }, { thumbnail_path: "b" }])).toEqual(["a", "b"]);
  });
});

describe("dates et titres", () => {
  const now = new Date(2026, 5, 15, 12, 0, 0);
  it("dates relatives en français", () => {
    expect(formatRelativeDate(new Date(2026, 5, 15, 8).toISOString(), now)).toBe("Aujourd'hui");
    expect(formatRelativeDate(new Date(2026, 5, 14, 23).toISOString(), now)).toBe("Hier");
    expect(formatRelativeDate(new Date(2026, 2, 12).toISOString(), now)).toBe("12 mars");
    expect(formatRelativeDate(new Date(2025, 11, 2).toISOString(), now)).toBe("2 déc. 2025");
    expect(formatRelativeDate("pas une date", now)).toBe("");
  });
  it("titre par défaut", () => {
    expect(projectTitle({ title: "  " })).toBe("Sans titre");
    expect(projectTitle({ title: " Mon voyage " })).toBe("Mon voyage");
  });
  it("statuts", () => {
    expect(projectBadge("processing").label).toBe("En cours");
    expect(projectBadge("ready").label).toBe("Terminé");
    expect(projectBadge("failed").tone).toBe("error");
  });
});

describe("accueil", () => {
  it("salutation", () => {
    expect(greetingText("Léa")).toBe("Bonjour, Léa");
    expect(greetingText("  ")).toBe("Bonjour");
    expect(greetingText(null)).toBe("Bonjour");
  });
  it("récentes : jamais de brouillon, 6 maximum", () => {
    const list = [row(1, { status: "draft" }), ...Array.from({ length: 9 }, (_, i) => row(i + 2))];
    const r = recentProjects(list);
    expect(r).toHaveLength(6);
    expect(r.some((p) => p.status === "draft")).toBe(false);
  });
  it("titre de création active et pastille", () => {
    expect(activeJobTitle({ project_title: " Voyage " })).toBe("Voyage");
    expect(activeJobTitle({})).toBe("Votre vidéo");
    expect(unreadBadgeLabel(0)).toBeNull();
    expect(unreadBadgeLabel(4)).toBe("4");
    expect(unreadBadgeLabel(25)).toBe("9+");
    expect(unreadA11y(1)).toBe("Notifications, 1 non lue");
    expect(unreadA11y(3)).toBe("Notifications, 3 non lues");
  });
});
