#!/usr/bin/env node
// Rendu image par image d'une scène → MP4 (H.264 + AAC).
//
//   node engine/render.mjs 01-kinetic                 rendu final (60 fps, motion blur 8 sous-images)
//   node engine/render.mjs 01-kinetic --stills 1,2.5  images fixes pour vérifier (build/<scène>/stills)
//   node engine/render.mjs 01-kinetic --fps 30 --sub 1   brouillon rapide
//
// Motion blur : chaque image finale = moyenne de N sous-images réparties sur
// l'obturateur (180° par défaut), comme une vraie caméra.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, ROOT } from './server.mjs';

const argv = process.argv.slice(2);
const scene = argv.find((a) => !a.startsWith('--') && !/^[\d.,]+$/.test(a));
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);
if (!scene || !fs.existsSync(path.join(ROOT, 'scenes', scene))) {
  console.error('Usage: node engine/render.mjs <01-kinetic|02-liquid|03-shapes> [--stills t1,t2] [--fps 60] [--sub 8]');
  process.exit(1);
}

const BUILD = path.join(ROOT, 'build', scene);
fs.mkdirSync(BUILD, { recursive: true });
const { srv, port } = await startServer();

const launch = () =>
  chromium.launch({
    args: [
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--hide-scrollbars',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });

async function openScene(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  [page ${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/scenes/${scene}/index.html?render=1`);
  await page.waitForFunction(() => window.MP && window.MP.isReady, null, { timeout: 180000 });
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp };
}

const capture = async (cdp) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
};
const seek = (page, t, s = 0, n = 1) => page.evaluate(async ([t, s, n]) => {
  MP.seek(t, s, n);
  if (MP.afterSeek) await MP.afterSeek();
}, [t, s, n]);

/* ---------------- images fixes (contrôle qualité) ---------------- */
if (opt('stills')) {
  const times = opt('stills').split(',').map(Number);
  const dir = path.join(BUILD, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const { page, cdp } = await openScene(browser);
  const files = [];
  for (const [i, t] of times.entries()) {
    await seek(page, t);
    const f = path.join(dir, `${String(i).padStart(3, '0')}_${t.toFixed(3)}s.png`);
    fs.writeFileSync(f, await capture(cdp));
    files.push(f);
  }
  await browser.close();
  srv.close();
  // planche contact
  const cols = Math.min(4, files.length);
  const rows = Math.ceil(files.length / cols);
  spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', '1', '-pattern_type', 'glob', '-i', path.join(dir, '*.png'),
    '-vf', `scale=480:-1:flags=lanczos,tile=${cols}x${rows}:padding=4:color=0x333333`,
    '-frames:v', '1', path.join(dir, 'contact.png'),
  ]);
  console.log(`${files.length} images → ${dir}`);
  process.exit(0);
}

/* ---------------- rendu complet ---------------- */
const FPS = Number(opt('fps', 60));
const SUB = Number(opt('sub', 8));
const SHUTTER = Number(opt('shutter', 0.5));
const WORKERS = Number(opt('workers', 4));
const CRF = opt('crf', '16');

// métadonnées + repères son
const browser0 = await launch();
const { page: p0 } = await openScene(browser0);
const meta = await p0.evaluate(() => ({
  duration: MP.duration, cues: MP.cues, bpm: MP.bpm || 0,
  tune: MP.meta.tune || 'animation', bitrate: MP.meta.bitrate || null,
}));
await browser0.close();
fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify({ duration: meta.duration, bpm: meta.bpm, cues: meta.cues }, null, 1));

// son (en parallèle de l'image)
const wav = path.join(BUILD, 'audio.wav');
if (flag('audio-only')) {
  srv.close();
  const r = spawnSync('python3', [path.join(ROOT, 'audio', 'score.py'), scene, path.join(BUILD, 'cues.json'), wav], { stdio: 'inherit' });
  process.exit(r.status);
}
const audioJob = flag('no-audio')
  ? Promise.resolve(1)
  : new Promise((res) => {
      const py = spawn('python3', [path.join(ROOT, 'audio', 'score.py'), scene, path.join(BUILD, 'cues.json'), wav], { stdio: 'inherit' });
      py.on('close', res);
    });

const total = Math.round(meta.duration * FPS);
const from = Math.round(Number(opt('from', 0)) * FPS);
const to = opt('to') ? Math.round(Number(opt('to')) * FPS) : total;
const framesDir = path.join(BUILD, 'frames');
const encodeOnly = flag('encode-only'); // réencode à partir des images déjà rendues
if (from === 0 && !encodeOnly) fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

let done = 0;
const t0 = Date.now();
const tick = () => {
  done++;
  if (done % 30 === 0 || done === to - from) {
    const el = (Date.now() - t0) / 1000;
    const eta = (el / done) * (to - from - done);
    process.stdout.write(`\r  ${scene}: ${done}/${to - from} images · ${el.toFixed(0)}s · reste ~${eta.toFixed(0)}s   `);
  }
};

async function worker(a, b) {
  const browser = await launch();
  const { page, cdp } = await openScene(browser);
  let ff = null;
  if (SUB > 1) {
    ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
      '-vf', `tmix=frames=${SUB},select='eq(mod(n,${SUB}),${SUB - 1})'`,
      '-fps_mode', 'passthrough', '-start_number', String(a),
      path.join(framesDir, '%05d.png'),
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
  }
  for (let f = a; f < b; f++) {
    for (let s = 0; s < SUB; s++) {
      const t = SUB > 1 ? f / FPS + ((s + 0.5) / SUB - 0.5) * (SHUTTER / FPS) : f / FPS;
      await seek(page, Math.max(0, t), s, SUB);
      const png = await capture(cdp);
      if (ff) {
        if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
      } else {
        fs.writeFileSync(path.join(framesDir, `${String(f).padStart(5, '0')}.png`), png);
      }
    }
    tick();
  }
  if (ff) {
    ff.stdin.end();
    await once(ff, 'close');
  }
  await browser.close();
}

if (!encodeOnly) {
  console.log(`▶ ${scene} : ${to - from} images @${FPS} fps, motion blur ${SUB} sous-images, ${WORKERS} workers`);
  const chunk = Math.ceil((to - from) / WORKERS);
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const a = from + w * chunk;
    const b = Math.min(to, a + chunk);
    if (a < b) jobs.push(worker(a, b));
  }
  await Promise.all(jobs);
  console.log(`\n  images OK en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
srv.close();

const audioCode = await audioJob;
const n = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png')).length;
if (n !== total) {
  console.log(`  (rendu partiel : ${n}/${total} images, pas d'encodage final)`);
  process.exit(0);
}

/* ---------------- encodage final ---------------- */
const outDir = path.join(ROOT, 'renders');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${scene}.mp4`);
const hasAudio = audioCode === 0 && fs.existsSync(wav);
// Débit : CRF (qualité constante) par défaut ; les scènes très granuleuses (02) fixent un
// débit cible en deux passes, sinon le grain aléatoire ferait exploser la taille du fichier.
const rate = meta.bitrate
  ? ['-b:v', meta.bitrate, '-maxrate', `${Math.round(parseFloat(meta.bitrate) * 1.6)}M`, '-bufsize', `${Math.round(parseFloat(meta.bitrate) * 2.2)}M`]
  : ['-crf', CRF];
const video = [
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', ...rate, '-tune', meta.tune, '-x264-params', 'aq-mode=3',
  '-profile:v', 'high', '-level', '4.2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
];
const input = ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.png')];
const passlog = path.join(BUILD, 'x264pass');
if (meta.bitrate) {
  const p1 = spawnSync('ffmpeg', [...input, ...video, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
  if (p1.status !== 0) {
    console.error('✖ échec ffmpeg (passe 1)');
    process.exit(1);
  }
}
const args = [
  ...input,
  ...(hasAudio ? ['-i', wav] : []),
  ...video,
  ...(meta.bitrate ? ['-pass', '2', '-passlogfile', passlog] : []),
  '-movflags', '+faststart',
  ...(hasAudio ? ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest'] : []),
  out,
];
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
for (const f of fs.readdirSync(BUILD)) if (f.startsWith('x264pass')) fs.rmSync(path.join(BUILD, f));
if (r.status === 0) {
  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`✔ ${path.relative(process.cwd(), out)} (${mb} Mo)`);
} else {
  console.error('✖ échec ffmpeg');
  process.exit(1);
}
