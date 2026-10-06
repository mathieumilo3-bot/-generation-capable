import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";

const PGBIN = process.env.PGBIN ?? "/usr/lib/postgresql/16/bin";
const SUPABASE = resolve(import.meta.dirname, "../../../supabase");
export const pgAvailable = (() => { try { return spawnSync(`${PGBIN}/initdb`, ["--version"]).status === 0; } catch { return false; } })();

export interface PgHarness { pool: pg.Pool; stop(): Promise<void> }

/** Postgres 16 jetable (stub Supabase + TOUTES les migrations réelles). Les tests tournent donc sur le vrai schéma. */
export async function startPg(port = 54500 + Math.floor(Math.random() * 400)): Promise<PgHarness> {
  const dir = mkdtempSync(join(tmpdir(), "pgtest-"));
  const root = process.getuid?.() === 0;
  const as = (cmd: string, args: string[]) => root ? execFileSync("runuser", ["-u", "postgres", "--", cmd, ...args], { stdio: "pipe" }) : execFileSync(cmd, args, { stdio: "pipe" });
  if (root) chownSync(dir, 102, 104);
  as(`${PGBIN}/initdb`, ["-D", `${dir}/data`, "-A", "trust", "-U", "postgres"]);
  as(`${PGBIN}/pg_ctl`, ["-D", `${dir}/data`, "-o", `-p ${port} -k ${dir} -c listen_addresses=''`, "-l", `${dir}/log`, "-w", "start"]);
  const admin = new pg.Pool({ host: dir, port, user: "postgres", database: "postgres", max: 1 });
  await admin.query("create database app");
  await admin.end();
  const pool = new pg.Pool({ host: dir, port, user: "postgres", database: "app", max: 8 });
  const run = async (file: string) => { await pool.query(readFileSync(file, "utf8")); };
  await run(join(SUPABASE, "tests/00_supabase_stub.sql"));
  for (const f of readdirSync(join(SUPABASE, "migrations")).sort()) await run(join(SUPABASE, "migrations", f));
  return {
    pool,
    stop: async () => { await pool.end(); try { as(`${PGBIN}/pg_ctl`, ["-D", `${dir}/data`, "stop", "-m", "fast"]); } catch { /* déjà arrêté */ } rmSync(dir, { recursive: true, force: true }); },
  };
}
