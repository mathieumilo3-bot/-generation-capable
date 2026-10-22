// Wikimedia Commons : uniquement fichiers sous licence CC-BY / CC-BY-SA / CC0 / domaine public ; l'attribution est notée dans le registre.
const fs = require("fs"), path = require("path");
const CACHE = path.join(__dirname, "..", "cache");
const OK = /^(cc0|cc[- ]by(-sa)?|public domain|pd)/i;
module.exports = {
  name: "wikimedia",
  async find(want, niche, ctx) {
    const q = want.query || (niche.stockQueries || [])[0];
    const api = "https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&generator=search&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|extmetadata|mime&gsrsearch=" + encodeURIComponent(q + " filetype:video");
    const r = await fetch(api);
    if (!r.ok) throw new Error("Wikimedia " + r.status);
    const pages = Object.values(((await r.json()).query || {}).pages || {});
    for (const p of pages) {
      const ii = (p.imageinfo || [])[0];
      if (!ii || !/^video\//.test(ii.mime) || ctx.used.has("wm:" + p.pageid)) continue;
      const lic = (ii.extmetadata.LicenseShortName || {}).value || "";
      if (!OK.test(lic)) continue;
      fs.mkdirSync(CACHE, { recursive: true });
      const file = path.join(CACHE, `wm-${p.pageid}${path.extname(ii.url)}`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(await (await fetch(ii.url)).arrayBuffer()));
      const author = ((ii.extmetadata.Artist || {}).value || "").replace(/<[^>]+>/g, "");
      return { file, source: "wikimedia", id: String(p.pageid), url: ii.descriptionurl,
        license: { owner: author, license: lic, proof: ii.descriptionurl, attribution: `${author} — ${lic} — ${ii.descriptionurl}` } };
    }
    return null;
  },
};
