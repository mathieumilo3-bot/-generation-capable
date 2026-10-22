#!/usr/bin/env node
// Moteur multi-niches : node engine.js list | new <niche> <slug> | resolve <plan> | check <plan> | render <plan> <out.mp4> [--final]
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { spawnSync } = require("child_process");
const { pexels, pixabay } = require("./sources/stock");
const sources = { local: require("./sources/local"), official: require("./sources/local"), pexels, pixabay, wikimedia: require("./sources/wikimedia") };
const NICHES = path.join(__dirname, "niches");
const load = id => JSON.parse(fs.readFileSync(path.join(NICHES, id + ".json"), "utf8"));
const probe = f => { const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }); return parseFloat(r.stdout) || 0; };
const sha = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16);
const resolvedPath = p => p.replace(/\.json$/, ".resolved.json");
const ledgerPath = p => p.replace(/\.json$/, ".ledger.json");

async function resolve(planPath) {
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const niche = load(plan.niche);
  const ctx = { used: new Set() }, ledger = [], missing = [];
  let t = 0;
  for (const [i, sc] of plan.scenes.entries()) {
    sc.start = t; t += sc.dur;
    if (!sc.want) continue;
    let hit = null;
    for (const name of niche.sourcePriority) {
      const src = sources[name];
      if (!src) continue;
      try { hit = await src.find(sc.want, niche, ctx); } catch (e) { console.warn(`[${i}] ${name} : ${e.message}`); }
      if (hit) break;
    }
    if (!hit) { missing.push({ scene: i, want: sc.want }); continue; }
    ctx.used.add(hit.file); if (hit.id) ctx.used.add(hit.source + ":" + hit.id);
    const len = probe(hit.file);
    sc.clip = path.resolve(hit.file);
    sc.clipIn = sc.want.in != null ? sc.want.in : Math.max(0, Math.min(len - sc.dur * (sc.speed || 1) - .05, (len - sc.dur) / 2));
    const fps = plan.fps || 30, speed = sc.speed || 1;
    const fdir = path.join(__dirname, "_frames", path.basename(planPath, ".json"), String(i));
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    const fr = spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(sc.clipIn), "-t", String(sc.dur * speed + .1), "-i", sc.clip,
      "-vf", `setpts=PTS/${speed},fps=${fps},scale=-2:1280`, "-q:v", "3", "-frames:v", String(Math.ceil(sc.dur * fps) + 2), path.join(fdir, "%04d.jpg")], { encoding: "utf8" });
    if (fr.status) throw new Error("ffmpeg : " + fr.stderr);
    sc.frames = { dir: fdir, n: fs.readdirSync(fdir).length };
    ledger.push({ scene: i, text: (sc.captions && sc.captions[0] && sc.captions[0].text) || sc.badge || "", file: path.relative(__dirname, hit.file), sha256: sha(hit.file), source: hit.source, id: hit.id || null, url: hit.url || null, license: hit.license || null, matchScore: hit.score ?? null });
  }
  fs.writeFileSync(resolvedPath(planPath), JSON.stringify(plan, null, 1));
  fs.writeFileSync(ledgerPath(planPath), JSON.stringify({ plan: path.basename(planPath), niche: plan.niche, shots: ledger, missing }, null, 1));
  return { plan, ledger, missing };
}

function check(planPath, final) {
  const L = JSON.parse(fs.readFileSync(ledgerPath(planPath), "utf8"));
  const errs = [];
  for (const m of L.missing) errs.push(`plan ${m.scene} : aucune image trouvée pour « ${m.want.query || (m.want.tags || []).join(",")} »`);
  for (const s of L.shots) {
    const l = s.license;
    if (!l || !l.owner || !l.license || !l.proof) errs.push(`plan ${s.scene} : droits manquants pour ${s.file} (owner / license / proof requis)`);
    else if (final && l.placeholder) errs.push(`plan ${s.scene} : image de TEST (${s.file}) interdite en rendu final`);
  }
  return errs;
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "list") { for (const f of fs.readdirSync(NICHES).sort()) { const n = load(f.replace(".json", "")); console.log(n.id.padEnd(18), n.name, "→", n.sourcePriority.join(" > ")); } return; }
  if (cmd === "new") {
    const n = load(a), out = path.join(__dirname, "plans", `${b}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ niche: a, fps: 30, title: b, theme: n.theme, discord: { name: "TON_SERVEUR", line: n.cta, online: null, members: null }, voiceover: "", scenes: [
      { type: "shot", dur: 3, want: { query: (n.stockQueries[0] || ""), tags: [] }, captions: [{ t: 0, text: "ACCROCHE" }] },
      { type: "cta", dur: 5.6, captions: [{ t: 0, text: "L'astuce *#4*|la meilleure..." }, { t: 1.2, text: "est sur le ~DISCORD~" }], cardAt: 1.9, tapAt: 3.4, bioAt: 4.1 }] }, null, 1));
    console.log("plan créé :", out); return;
  }
  const planPath = path.resolve(a);
  if (cmd === "resolve" || cmd === "check" || cmd === "render") {
    const { ledger, missing } = await resolve(planPath);
    console.log(`images : ${ledger.length} trouvées, ${missing.length} manquantes → ${path.basename(ledgerPath(planPath))}`);
    const errs = check(planPath, c === "--final" || process.argv.includes("--final"));
    errs.forEach(e => console.error("✗", e));
    if (cmd !== "render") { process.exit(errs.length ? 1 : 0); }
    if (errs.length) { console.error("Rendu refusé : corrige les points ci-dessus."); process.exit(1); }
    const r = spawnSync("node", [path.join(__dirname, "..", "reel-clash-of-clans", "render.js"), resolvedPath(planPath), path.resolve(b)], { stdio: "inherit" });
    process.exit(r.status || 0);
  }
  console.log("usage : list | new <niche> <slug> | resolve <plan> | check <plan> | render <plan> <out.mp4> [--final]");
}
main().catch(e => { console.error(e); process.exit(1); });
