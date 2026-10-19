// Rendu : node render.js <sortie.mp4> [16x9|9x16]                     → vidéo complète (image + bande-son)
//         node render.js <dossier> [16x9|9x16] --stills 0.5,6.4,…      → images fixes de contrôle
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

(async () => {
  const [out, fmt = "16x9", flag, list] = process.argv.slice(2);
  const R = __dirname;
  const reel = JSON.parse(fs.readFileSync(path.join(R, "reel.json"), "utf8"));
  const [W, H] = reel.formats[fmt];
  const html = fs.readFileSync(path.join(R, "comp.html"), "utf8")
    .replace("/*REEL*/null", JSON.stringify(reel)).replace("/*FMT*/null", JSON.stringify(fmt));
  fs.writeFileSync(path.join(R, `_comp-${fmt}.html`), html);

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", e => console.error("PAGE", e.message));
  page.on("console", m => { if (m.type() === "error") console.error("CONSOLE", m.text()); });
  await page.goto("file://" + path.join(R, `_comp-${fmt}.html`));
  console.log(await page.evaluate(() => window.ready));

  if (flag === "--stills") {
    fs.mkdirSync(out, { recursive: true });
    for (const t of list.split(",").map(Number)) {
      await page.evaluate(t => window.renderFrame(t), t);
      await page.screenshot({ path: path.join(out, `${fmt}-t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 90 });
    }
    await browser.close();
    return;
  }

  const fps = reel.fps, N = Math.round(reel.duration * fps);
  const tmp = out.replace(/\.mp4$/, ""), wav = tmp + ".wav", vid = tmp + ".video.mp4";
  execFileSync("python3", ["-I", path.join(R, "sfx.py"), path.join(R, "reel.json"), wav], { stdio: "inherit" });
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-vf", "noise=alls=3:allf=t,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "12M", "-bufsize", "24M", "-x264-params", "aq-mode=3",
    "-profile:v", "high", "-level", "4.2", "-r", String(fps), vid], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise(r => ff.on("close", r));
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => window.renderFrame(t), f / fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`image ${f}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  console.log("vidéo, code", await done);
  await browser.close();
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", vid, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-12:TP=-1.5:LRA=9,aresample=48000,alimiter=limit=0.6:attack=5:release=50:level=false", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
  fs.unlinkSync(wav); fs.unlinkSync(vid);
  console.log("terminé :", out);
})();
