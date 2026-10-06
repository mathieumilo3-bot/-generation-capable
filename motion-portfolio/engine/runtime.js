/* runtime.js — moteur d'animation déterministe, piloté image par image.
 *
 * Chaque scène construit UNE timeline GSAP en pause (MP.tl) + des fonctions
 * "onFrame(t)" pour ce qui est procédural (bruit, marquees, WebGL...).
 * Le moteur de rendu (engine/render.mjs) appelle MP.seek(t) pour chaque
 * sous-image puis capture l'écran : le résultat est identique à chaque rendu.
 * Ouvert dans un navigateur (sans ?render), la scène se lit en boucle (preview).
 */
(() => {
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');

  gsap.ticker.lagSmoothing(0);
  // Pas de translate3d : Chrome re-rastérise le texte à chaque image (net même en gros plan).
  gsap.config({ force3D: false, nullTargetWarn: false });

  const MP = (window.MP = {
    RENDER,
    W: 1920,
    H: 1080,
    fps: 60,
    duration: 15,
    time: 0,
    isReady: false,
    tl: gsap.timeline({ paused: true }),
    cues: [],
    renderers: [],
    meta: {},
  });

  /* ---------- utilitaires temps / musique ---------- */
  MP.tempo = (bpm) => {
    MP.bpm = bpm;
    MP.beat = 60 / bpm;
    return (b) => b * MP.beat; // beat -> secondes
  };
  // Coupe franche calée entre deux images (évite qu'une image floutée mélange deux plans).
  MP.cut = (t) => (Math.round(t * MP.fps - 0.5) + 0.5) / MP.fps;
  // Repère sonore : lu par audio/score.py pour placer les bruitages au bon endroit.
  MP.cue = (t, type, params = {}) => {
    MP.cues.push({ t: +t.toFixed(5), type, ...params });
  };
  MP.onFrame = (fn) => MP.renderers.push(fn);
  MP.sub = 0;
  MP.nsub = 1;
  MP.seek = (t, sub = 0, nsub = 1) => {
    MP.time = t;
    MP.sub = sub;
    MP.nsub = nsub;
    MP.tl.totalTime(Math.max(0, t), true);
    for (const fn of MP.renderers) fn(t);
  };

  /* ---------- aléatoire déterministe ---------- */
  MP.hash = (n) => {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  MP.rng = (seed = 1) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // bruit 1D lissé dans [-1, 1]
  MP.noise = (x, seed = 0) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = MP.hash(i * 7919 + seed * 104729);
    const b = MP.hash((i + 1) * 7919 + seed * 104729);
    return (a + (b - a) * u) * 2 - 1;
  };
  MP.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  MP.lerp = (a, b, t) => a + (b - a) * t;
  MP.smooth = (e0, e1, x) => {
    const t = MP.clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  // arrondi : les sous-images du motion blur (±¼ d'image) gardent le même numéro d'image
  MP.frameOf = (t) => Math.round(t * MP.fps);

  /* ---------- tremblement caméra (impulsions décroissantes) ---------- */
  MP.shaker = (el, seed = 3) => {
    const hits = [];
    MP.onFrame((t) => {
      let amp = 0;
      let rot = 0;
      for (const h of hits) {
        if (t < h.t) continue;
        const k = Math.exp(-(t - h.t) / h.decay);
        amp += h.amp * k;
        rot += (h.rot || 0) * k;
      }
      if (amp < 0.05) {
        el.style.translate = '';
        el.style.rotate = '';
        return;
      }
      const x = MP.noise(t * 38, seed) * amp;
      const y = MP.noise(t * 41, seed + 7) * amp;
      el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      el.style.rotate = `${(MP.noise(t * 23, seed + 13) * rot).toFixed(3)}deg`;
    });
    return (t, amp = 24, decay = 0.18, rot = 0.6) => hits.push({ t, amp, decay, rot });
  };

  /* ---------- grain argentique ---------- */
  MP.grain = ({ opacity = 0.06, blend = 'normal', size = 256, tiles = 8, seed = 11 } = {}) => {
    const el = document.createElement('div');
    el.id = 'grain';
    Object.assign(el.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      opacity: String(opacity),
      mixBlendMode: blend,
      zIndex: 90,
    });
    const urls = [];
    const rand = MP.rng(seed);
    for (let k = 0; k < tiles; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        // bruit gaussien approx. (somme de 3 uniformes)
        const v = ((rand() + rand() + rand()) / 3) * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      urls.push(`url(${c.toDataURL()})`);
    }
    document.getElementById('stage').appendChild(el);
    MP.onFrame((t) => {
      const f = MP.frameOf(t);
      el.style.backgroundImage = urls[f % tiles];
      el.style.backgroundPosition = `${Math.floor(MP.hash(f * 3) * size)}px ${Math.floor(MP.hash(f * 3 + 1) * size)}px`;
    });
    return el;
  };

  /* ---------- HUD (coins) commun aux trois pièces ---------- */
  MP.hud = ({ tl = '', tr = 'tc', bl = '', br = '', color = '#fff' } = {}) => {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.style.setProperty('--hud', color);
    const mk = (pos, text) => {
      const d = document.createElement('div');
      d.className = `hud-item hud-${pos}`;
      d.innerHTML = text;
      hud.appendChild(d);
      return d;
    };
    const items = { tl: mk('tl', tl), tr: mk('tr', tr === 'tc' ? '' : tr), bl: mk('bl', bl), br: mk('br', br) };
    document.getElementById('stage').appendChild(hud);
    if (tr === 'tc') {
      MP.onFrame((t) => {
        const f = MP.frameOf(t);
        const s = Math.floor(f / MP.fps);
        const ff = f % MP.fps;
        items.tr.textContent = `TC 00:00:${String(s).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
      });
    }
    return { el: hud, items };
  };

  /* ---------- carte de fin (nom, rôle) ---------- */
  MP.signature = () => {
    const P = window.PORTFOLIO || {};
    const name = (P.name || '').trim();
    return {
      name,
      line1: name || 'Motion Design Portfolio',
      line2: [P.role || 'Motion Designer', P.handle || '', P.year || '2026'].filter(Boolean).join('  —  '),
    };
  };

  /* ---------- texte qui se « décode » (effet scramble déterministe) ---------- */
  MP.decode = (el, text, t0, dur = 0.5, glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%+=') => {
    const chars = [...text];
    MP.onFrame((t) => {
      if (t < t0) {
        el.textContent = '';
        return;
      }
      const p = MP.clamp((t - t0) / dur);
      if (p >= 1) {
        el.innerHTML = text;
        return;
      }
      const f = MP.frameOf(t);
      const shown = Math.floor(p * chars.length);
      const tail = Math.min(chars.length - shown, 4);
      let s = chars.slice(0, shown).join('');
      for (let i = 0; i < tail; i++) {
        const c = chars[shown + i];
        s += c === ' ' ? ' ' : glyphs[Math.floor(MP.hash(f * 31 + i * 7) * glyphs.length)];
      }
      el.textContent = s;
    });
  };

  /* ---------- texte découpé en lettres ---------- */
  MP.split = (el, text) => {
    el.textContent = '';
    const chars = [];
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s);
      chars.push(s);
    }
    return chars;
  };
  // ajuste la taille de police pour que el fasse `width` px de large
  MP.fitWidth = (el, width) => {
    const fs0 = parseFloat(getComputedStyle(el).fontSize);
    const w = el.getBoundingClientRect().width;
    el.style.fontSize = `${(fs0 * width) / w}px`;
    return (fs0 * width) / w;
  };

  /* ---------- démarrage ---------- */
  MP.build = async (fonts, fn) => {
    await Promise.all(fonts.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    await fn();
    MP.tl.set({}, {}, MP.duration); // la timeline couvre toute la durée
    // initialise les tweens dans l'ordre chronologique (seek aléatoire fiable ensuite)
    MP.warming = true; // les scènes lourdes (WebGL) peuvent sauter le rendu pendant ce passage
    for (let t = 0; t <= MP.duration; t += 0.1) MP.seek(t);
    MP.warming = false;
    MP.seek(0);
    MP.isReady = true;
    if (!RENDER) startPreview();
  };

  /* ---------- prévisualisation temps réel dans un navigateur ---------- */
  function startPreview() {
    const stage = document.getElementById('stage');
    document.documentElement.style.background = '#000';
    const fit = () => {
      const s = Math.min(innerWidth / MP.W, (innerHeight - 28) / MP.H);
      Object.assign(stage.style, {
        position: 'absolute',
        transformOrigin: '0 0',
        transform: `scale(${s})`,
        left: `${(innerWidth - MP.W * s) / 2}px`,
        top: `${(innerHeight - 28 - MP.H * s) / 2}px`,
      });
    };
    fit();
    addEventListener('resize', fit);
    const bar = document.createElement('div');
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;height:28px;background:#111;cursor:pointer;font:12px monospace;color:#aaa;z-index:999';
    const fill = document.createElement('div');
    fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;background:#333';
    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;left:10px;top:7px';
    bar.append(fill, label);
    document.body.appendChild(bar);
    const scene = document.body.dataset.scene;
    const audio = new Audio(`../../build/${scene}/audio.wav`);
    let playing = true;
    let base = performance.now();
    let offset = 0;
    let t = 0;
    const play = () => {
      base = performance.now();
      offset = t;
      playing = true;
      audio.currentTime = t;
      audio.play().catch(() => {});
    };
    const pause = () => {
      playing = false;
      audio.pause();
    };
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') playing ? pause() : play();
      if (e.code === 'ArrowRight') { pause(); t = Math.min(MP.duration, t + 1 / MP.fps); }
      if (e.code === 'ArrowLeft') { pause(); t = Math.max(0, t - 1 / MP.fps); }
    });
    bar.addEventListener('pointerdown', (e) => {
      t = (e.clientX / innerWidth) * MP.duration;
      playing ? play() : null;
    });
    stage.addEventListener('click', () => (playing ? pause() : play()));
    const loop = () => {
      if (playing) {
        t = offset + (performance.now() - base) / 1000;
        if (t >= MP.duration) {
          t = 0;
          play();
        }
      }
      MP.seek(t);
      fill.style.width = `${(t / MP.duration) * 100}%`;
      label.textContent = `${t.toFixed(2)}s  —  espace : lecture/pause · ← → : image par image · clic : son`;
      requestAnimationFrame(loop);
    };
    loop();
  }
})();
