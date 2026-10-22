// Rendu : node render.js videos/01-xxx.json sortie.mp4              → vidéo complète (avec bruitages)
//         node render.js videos/01-xxx.json stills --stills 1,4.5,…  → images fixes de contrôle
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

(async () => {
  const [scriptPath, out, flag, list] = process.argv.slice(2);
  const R = __dirname;
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const html = fs.readFileSync(path.join(R, "comp.html"), "utf8").replace("/*SCRIPT*/null", JSON.stringify(script));
  fs.writeFileSync(path.join(R, "_comp.html"), html);

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", e => console.error("PAGE", e.message));
  await page.goto("file://" + path.join(R, "_comp.html"));
  await page.evaluate(() => Promise.all(['400 40px "Lilita One"', '400 40px "Luckiest Guy"', '800 40px "Nunito"', '600 40px "Nunito"'].map(f => document.fonts.load(f))));
  const fps = script.fps, dur = await page.evaluate(() => window.duration);

  if (flag === "--stills") {
    fs.mkdirSync(out, { recursive: true });
    for (const t of list.split(",").map(Number)) {
      await page.evaluate(t => window.renderFrame(t), t);
      await page.screenshot({ path: path.join(out, `t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 88 });
    }
    await browser.close();
    return;
  }

  const wav = out.replace(/\.mp4$/, ".wav");
  execFileSync("python3", ["-I", path.join(R, "sfx.py"), scriptPath, wav], { stdio: "inherit" });
  const N = Math.round(dur * fps);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-i", wav,
    "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-r", String(fps),
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise(r => ff.on("close", r));
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => window.renderFrame(t), f / fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 90 === 0) console.log(`image ${f}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  console.log("ffmpeg terminé, code", await done);
  fs.unlinkSync(wav);
  await browser.close();
})();
