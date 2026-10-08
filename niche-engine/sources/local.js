// Source locale : clips/<niche>/ , clips/_shared/ , clips/official/
// Chaque dossier DOIT contenir _license.json : { owner, license, proof, placeholder? }
// (un fichier <clip>.license.json à côté d'un clip prime sur celui du dossier).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "clips");
const tok = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

function index(dirs) {
  const out = [];
  for (const d of dirs) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    const lic = fs.existsSync(path.join(dir, "_license.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "_license.json"), "utf8")) : null;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(mp4|mov|webm|mkv)$/i.test(f)) continue;
      const side = path.join(dir, f.replace(/\.[^.]+$/, ".license.json"));
      const license = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, "utf8")) : lic;
      out.push({ file: path.join(dir, f), tags: tok(f.replace(/\.[^.]+$/, "")), license, folder: d });
    }
  }
  return out;
}

module.exports = {
  name: "local",
  async find(want, niche, ctx) {
    const dirs = [niche.id, "_shared", ...(niche.sourcePriority.includes("official") ? ["official"] : [])];
    const wanted = new Set([...(want.tags || []), ...tok(want.query || "")]);
    let best = null, bestScore = 0;
    for (const c of index(dirs)) {
      if (ctx.used.has(c.file) && !want.reuse) continue;
      const score = c.tags.filter(t => wanted.has(t)).length;
      const need = want.loose ? 1 : (want.tags && want.tags.length ? want.tags.length : 1);
      if (score >= need && score > bestScore) { best = c; bestScore = score; }
    }
    if (!best) return null;
    return { file: best.file, source: "local:" + best.folder, license: best.license, score: bestScore };
  },
};
