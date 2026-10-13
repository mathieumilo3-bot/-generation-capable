// Rendu du Reel : node render.js <dossier reel> <sortie.mp4>          → vidéo complète
//                 node render.js <dossier reel> <dossier> --stills 0.5,2,…  → images fixes de contrôle
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

(async () => {
  const [R, out, flag, list] = process.argv.slice(2);
  const edl = JSON.parse(fs.readFileSync(path.join(R, "edl.json"), "utf8"));
  const html = fs.readFileSync(path.join(R, "comp.html"), "utf8").replace("/*EDL*/null", JSON.stringify(edl));
  fs.writeFileSync(path.join(R, "_comp.html"), html);

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", e => console.error("PAGE", e.message));
  page.on("console", m => { if (m.type() === "error") console.error("CONSOLE", m.text()); });
  await page.goto("file://" + path.join(R, "_comp.html"));
  console.log("polices :", await page.evaluate(() => window.ready));

  if (flag === "--stills") {
    fs.mkdirSync(out, { recursive: true });
    for (const t of list.split(",").map(Number)) {
      await page.evaluate(t => window.renderFrame(t), t);
      await page.screenshot({ path: path.join(out, `t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 90 });
    }
    await browser.close();
    return;
  }

  const N = Math.round(edl.duration * edl.fps);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(edl.fps), "-c:v", "mjpeg", "-i", "-",
    "-vf", "noise=alls=3:allf=t,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
    "-profile:v", "high", "-level", "4.2", "-r", String(edl.fps), "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise(r => ff.on("close", r));
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => window.renderFrame(t), f / edl.fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`image ${f}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  console.log("ffmpeg terminé, code", await done);
  await browser.close();
})();
