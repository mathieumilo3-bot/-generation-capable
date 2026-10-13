// Banques d'images libres (usage commercial) : Pexels, Pixabay. Clés : PEXELS_API_KEY, PIXABAY_API_KEY.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const CACHE = path.join(__dirname, "..", "cache");

async function download(url, name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return file;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`téléchargement ${r.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}
const pick = (ctx, key) => !ctx.used.has(key);

const pexels = {
  name: "pexels",
  async find(want, niche, ctx) {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return null;
    const q = want.query || (niche.stockQueries || [])[0];
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=15`, { headers: { Authorization: key } });
    if (!r.ok) throw new Error("Pexels " + r.status);
    for (const v of (await r.json()).videos || []) {
      if (!pick(ctx, "pexels:" + v.id)) continue;
      const f = v.video_files.filter(x => x.file_type === "video/mp4" && x.height >= 1080).sort((a, b) => a.height - b.height)[0] || v.video_files.find(x => x.file_type === "video/mp4");
      if (!f) continue;
      const file = await download(f.link, `pexels-${v.id}.mp4`);
      return { file, source: "pexels", id: String(v.id), url: v.url,
        license: { owner: v.user && v.user.name, license: "Pexels License (usage commercial autorisé, sans attribution obligatoire)", proof: v.url } };
    }
    return null;
  },
};

const pixabay = {
  name: "pixabay",
  async find(want, niche, ctx) {
    const key = process.env.PIXABAY_API_KEY;
    if (!key) return null;
    const q = want.query || (niche.stockQueries || [])[0];
    const r = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(q)}&per_page=20`);
    if (!r.ok) throw new Error("Pixabay " + r.status);
    for (const v of (await r.json()).hits || []) {
      if (!pick(ctx, "pixabay:" + v.id)) continue;
      const f = v.videos.large && v.videos.large.url ? v.videos.large : v.videos.medium;
      const file = await download(f.url, `pixabay-${v.id}.mp4`);
      return { file, source: "pixabay", id: String(v.id), url: v.pageURL,
        license: { owner: v.user, license: "Pixabay Content License (usage commercial autorisé)", proof: v.pageURL } };
    }
    return null;
  },
};
module.exports = { pexels, pixabay };
