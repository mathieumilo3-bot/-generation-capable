import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const SRC = join(__dirname, "..", "src");
const sources = files(SRC).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => ({ f, text: readFileSync(f, "utf8") }));

describe("garde-fous de sécurité (statique)", () => {
  it("aucune référence à service_role ni à une clé secrète dans le code navigateur", () => {
    // env.ts contient le détecteur de clé secrète (il nomme volontairement le rôle serveur pour le refuser).
    for (const { f, text } of sources.filter((s) => !s.f.endsWith("src/env.ts"))) {
      expect(text, f).not.toMatch(/service_role|SERVICE_ROLE|secret_key|sb_secret/);
    }
  });
  it("aucune écriture directe : jamais insert/update/delete/upsert sur une table", () => {
    for (const { f, text } of sources) {
      expect(text, f).not.toMatch(/\.from\([^)]*\)[\s\S]{0,120}\.(insert|update|upsert|delete)\(/);
    }
  });
  it("aucun type any ni TODO", () => {
    for (const { f, text } of sources) {
      expect(text, f).not.toMatch(/:\s*any\b|as any\b|<any>/);
      expect(text, f).not.toMatch(/TODO|FIXME/);
    }
  });
  it("aucun flottant pour les montants : pas de parseFloat sur des euros", () => {
    for (const { f, text } of sources) {
      expect(text, f).not.toMatch(/parseFloat|toFixed\(/);
    }
  });
  it("l'authentification ne crée jamais d'utilisateur", () => {
    const auth = sources.find((s) => s.f.endsWith("data/auth.ts"));
    expect(auth?.text).toContain("shouldCreateUser: false");
    expect(auth?.text).not.toContain("shouldCreateUser: true");
  });
  it("seuls les RPC admin_* (et rien d'autre) sont appelés par les modules de données", () => {
    for (const { f, text } of sources.filter((s) => s.f.includes("/data/"))) {
      for (const m of text.matchAll(/db\.rpc\(\s*"([a-z_]+)"/g)) expect(m[1], f).toMatch(/^admin_/);
    }
  });
});
