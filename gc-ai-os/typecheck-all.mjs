// Typage strict de tous les packages du monorepo.
//
// `turbo run typecheck` ne couvre que les packages déclarant le script ;
// ce runner parcourt chaque tsconfig et échoue au premier problème, pour
// que la CI ne puisse pas passer avec un package non vérifié.
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const roots = ["packages", "packages/agents", "apps"];
const projects = [];

for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    if (existsSync(join(dir, "tsconfig.json"))) projects.push(dir);
  }
}

let failed = 0;
for (const project of projects) {
  try {
    execFileSync("npx", ["tsc", "--noEmit", "-p", project], { stdio: "pipe" });
    console.log(`  ok   ${project}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${project}`);
    console.error(String(error.stdout ?? error.message));
  }
}

console.log(`\n${projects.length - failed}/${projects.length} packages typés sans erreur.`);
process.exit(failed > 0 ? 1 : 0);
