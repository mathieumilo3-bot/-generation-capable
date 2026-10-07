#!/usr/bin/env node
// Rendu d'une composition Remotion.
//   node render.mjs <Composition> <props.json|-> <sortie.mp4>            vidéo finale
//   node render.mjs <Composition> <props.json|-> --stills 1.2,3.5,8     images de contrôle (secondes) + planche
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const [id, propsFile, ...rest] = process.argv.slice(2);
const opt = (n) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (!id) {
  console.error('usage: node render.mjs <Composition> <props.json|-> <out.mp4> | --stills t1,t2');
  process.exit(1);
}
const inputProps = propsFile && propsFile !== '-' ? JSON.parse(fs.readFileSync(propsFile, 'utf8')) : undefined;

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: path.join(ROOT, 'public') });
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable: BROWSER });
const common = { serveUrl, composition, inputProps, browserExecutable: BROWSER, logLevel: 'warn' };

if (opt('stills')) {
  const dir = opt('dir') ?? path.join(ROOT, 'work', 'stills', id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const times = opt('stills').split(',').map(Number);
  for (const [i, t] of times.entries()) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps));
    await renderStill({ ...common, frame, output: path.join(dir, `${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`) });
  }
  const cols = Math.min(composition.height > composition.width ? 5 : 3, times.length);
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-pattern_type', 'glob', '-i', path.join(dir, '*_*s.png'),
    '-vf', `scale=${composition.height > composition.width ? 300 : 560}:-1:flags=lanczos,tile=${cols}x${Math.ceil(times.length / cols)}:padding=6:color=0x222222`,
    '-frames:v', '1', path.join(dir, 'planche.png')]);
  console.log(`${times.length} images → ${dir}/planche.png`);
  process.exit(0);
}

const out = rest.find((a) => a.endsWith('.mp4'));
const t0 = Date.now();
let last = -1;
await renderMedia({
  ...common,
  codec: 'h264',
  outputLocation: out,
  crf: Number(opt('crf') ?? 17),
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  x264Preset: 'slow',
  audioBitrate: '320k',
  imageFormat: 'jpeg',
  jpegQuality: 94,
  concurrency: Number(opt('concurrency') ?? 4),
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) {
      last = p;
      process.stdout.write(`\r  ${id} : ${Math.round(progress * 100)} % · ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
    }
  },
});
console.log(`\n✔ ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} Mo)`);
