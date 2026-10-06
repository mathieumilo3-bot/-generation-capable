/* 02 — 3D PRODUCT FILM · « VIF—ARGENT » (parfum fictif) · chrome liquide
 * 96 BPM → 1 mesure = 2,5 s · 6 mesures = 15 s. Un plan par mesure, coupes sur les temps forts.
 */
(() => {
  const { tl } = MP;
  const b = MP.tempo(96);
  const cut = (n) => MP.cut(b(n));
  const $ = (s) => document.querySelector(s);
  const sig = MP.signature();
  MP.meta.tune = 'film'; // encodage x264 adapté au grain / dégradés
  MP.meta.bitrate = '14M'; // deux passes à débit cible (le grain aléatoire coûte très cher en CRF)

  // état lu par le shader à chaque image (animé par GSAP)
  const U = {
    time: 0, jitter: [0, 0], camPos: [0, 0, 4], camTgt: [0, 0, 0], fov: 30, roll: 0,
    balls: new Float32Array(24), k: 0.15, torus: 0, bottle: 0, wobble: 0.03,
    shockR: 0, shockA: 0, iri: 0.5, sweep: -2, floor: 0, spin: 0, tilt: 0, envRot: 0, bound: 2.6, glow: 1,
    threshold: 1.4, exposure: 1.0, bloom: 0.09, streak: 0.06, vignette: 0.85, seed: 0, fade: 0, flare: 0, flareY: 0.5, ca: 0.012, grain: 0.032,
  };
  const CAM = { az: 0.35, el: 0.1, dist: 1.4, oy: 0, sx: 0, fov: 30, roll: -0.02 };
  const S = { spread: 1, orbit: 1, size: 1, collapse: 1, core: 0.28, drip: 0, spinRate: 0 };

  const ORB = [
    // rayon, vitesse, phase, amplitude verticale, taille
    [1.35, 0.9, 0.0, 0.35, 0.44],
    [1.05, -1.15, 1.3, 0.5, 0.36],
    [1.6, 0.7, 2.6, 0.25, 0.31],
    [0.85, 1.4, 3.9, 0.6, 0.34],
    [1.45, -0.85, 5.0, 0.4, 0.28],
    [0.55, 1.8, 0.7, 0.3, 0.38],
  ];
  // poussières en suspension (bokeh au premier plan) : 22 disques flous en dérive lente
  const dust = [];
  function makeDust() {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;z-index:5';
    for (let i = 0; i < 22; i++) {
      const h = (k) => MP.hash(i * 977 + k);
      const sz = 6 + 46 * h(3) * h(3);
      const d = document.createElement('div');
      const a = (0.38 / (1 + sz * 0.06)).toFixed(3);
      d.style.cssText = `position:absolute;left:0;top:0;width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;border-radius:50%;` +
        `background:radial-gradient(circle, rgba(200,215,255,${a}) 0%, rgba(200,215,255,${a}) 55%, rgba(200,215,255,${(a * 1.4).toFixed(3)}) 72%, rgba(200,215,255,0) 76%);` +
        `filter:blur(${(sz * 0.05).toFixed(1)}px)`;
      layer.appendChild(d);
      dust.push({ el: d, h });
    }
    document.getElementById('stage').insertBefore(layer, document.getElementById('tagline'));
    return layer;
  }
  function updateDust(t) {
    for (let i = 0; i < dust.length; i++) {
      const { el, h } = dust[i];
      let x = h(1) + 0.006 * t * (0.4 + h(5)) * Math.sin(i);
      let y = h(2) - 0.012 * t * (0.4 + h(5));
      x = (x % 1 + 1) % 1;
      y = (y % 1 + 1) % 1;
      el.style.transform = `translate(${(x * 1920).toFixed(1)}px, ${(y * 1080).toFixed(1)}px)`;
    }
  }
  // décalages sous-pixel par sous-image (anticrénelage) : grille diagonale / grille tournée
  const JITTER = {
    2: [[-0.25, -0.25], [0.25, 0.25]],
    4: [[-0.125, -0.375], [0.375, -0.125], [0.125, 0.375], [-0.375, 0.125]],
  };

  function updateBalls(t) {
    for (let i = 0; i < 6; i++) {
      const [R, w, ph, ya, sz] = ORB[i];
      const a = ph + w * t * S.orbit;
      const c = S.collapse;
      const x = R * S.spread * Math.cos(a) * (1 - c);
      const y = ya * S.spread * Math.sin(a * 1.3 + i) * (1 - c);
      const z = R * S.spread * Math.sin(a) * (1 - c);
      const r0 = sz * S.size;
      const r = i === 0 ? r0 + (S.core - r0) * c : r0 * (1 - c);
      U.balls.set([x, y, z, r], i * 4);
    }
    if (S.drip > 0) {
      const d = S.drip;
      const g = Math.min(1, d * 2.5);
      U.balls.set([0.37 * d, 0.13 * d, 0.05 * d, 0.07 * g], 4);
      U.balls.set([-0.31 * d, -0.18 * d, 0.1 * d, 0.055 * g], 8);
    }
  }

  function updateCamera() {
    const { az, el, dist, oy, sx } = CAM;
    const pos = [dist * Math.cos(el) * Math.sin(az), oy + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az)];
    const fwd = [-pos[0], oy - pos[1], -pos[2]];
    const fl = Math.hypot(...fwd);
    const f = fwd.map((v) => v / fl);
    const right = [f[2] * 0 - 0 * f[1], 0, 0];
    // right = normalize(cross(f, up)) avec up = (0,1,0) → (-f.z, 0, f.x)
    const rl = Math.hypot(f[2], f[0]) || 1;
    right[0] = -f[2] / rl;
    right[2] = f[0] / rl;
    U.camPos = pos;
    U.camTgt = [-right[0] * sx, oy, -right[2] * sx];
    U.fov = CAM.fov;
    U.roll = CAM.roll;
  }

  MP.build(
    ['italic 400 100px "Instrument Serif"', '400 100px "Instrument Serif"', '500 20px "JetBrains Mono Variable"', '400 20px "Space Grotesk Variable"'],
    () => {
      const glr = new LiquidGL($("#gl"));
      MP.gl = glr;
      const dustLayer = makeDust();
      tl.fromTo(dustLayer, { opacity: 0 }, { opacity: 1, duration: 1.5 }, 0.3);

      /* HUD */
      const hud = MP.hud({ color: '#efeeeb' });
      MP.decode(hud.items.tl, '02 — 3D Product Film', 0.5, 0.5);
      MP.decode(hud.items.bl, 'Liquid Chrome — ©' + (window.PORTFOLIO?.year || '2026'), 0.6, 0.6);
      MP.decode(hud.items.br, 'GLSL · Raymarched · 60 fps', 0.7, 0.6);
      tl.fromTo('#hud', { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.4 }, 0.45);

      /* ───── Plan 1 · la goutte (0 → 2,5 s) ───── */
      tl.set(CAM, { az: 0.35, el: 0.1, dist: 1.4, oy: 0, sx: 0, fov: 30, roll: -0.02 }, 0);
      tl.set(S, { collapse: 1, core: 0.26, spread: 1, orbit: 1, size: 1, drip: 0 }, 0);
      tl.set(U, { k: 0.14, wobble: 0.028, iri: 0.3, floor: 0, torus: 0, bottle: 0, sweep: -2, glow: 0.8, bound: 0.75 }, 0);
      tl.to(CAM, { az: 0.02, dist: 1.0, roll: 0.02, duration: b(4), ease: 'none' }, 0);
      tl.fromTo(U, { fade: 0 }, { fade: 1, duration: 1.0, ease: 'power2.out' }, 0.12);
      tl.fromTo(U, { flare: 0 }, { flare: 0.9, duration: 0.2, ease: 'power2.out' }, 0.12);
      tl.to(U, { flare: 0, duration: 0.9, ease: 'power3.out' }, 0.32);
      tl.fromTo(U, { wobble: 0.05 }, { wobble: 0.018, duration: 1.6, ease: 'power2.out' }, 0.1);
      tl.to(S, { drip: 1, duration: 0.8, ease: 'power2.inOut' }, b(2.7));
      MP.cue(0.12, 'flare');
      MP.cue(b(2.7), 'drip');

      /* ───── Plan 2 · les gouttes en orbite fusionnent (2,5 → 5 s) ───── */
      const c2 = cut(4);
      tl.set(CAM, { az: -0.55, el: 0.28, dist: 4.7, oy: 0, sx: 0, fov: 34, roll: 0.0 }, c2);
      tl.set(S, { collapse: 0, drip: 0, spread: 1.0, orbit: 1 }, c2);
      tl.set(U, { k: 0.55, wobble: 0.012, iri: 0.32, glow: 1, bound: 2.4 }, c2);
      tl.to(CAM, { az: 0.25, el: 0.12, dist: 4.1, duration: b(4), ease: 'power1.inOut' }, c2);
      tl.to(S, { spread: 0.42, duration: b(4), ease: 'power2.in' }, c2);
      tl.fromTo(U, { exposure: 1.35 }, { exposure: 1.0, duration: 0.35, ease: 'power2.out' }, c2);
      MP.cue(b(4), 'cut', { n: 1 });
      MP.cue(b(6.5), 'merge');

      /* ───── Plan 3 · contre-plongée, l'anneau (5 → 7,5 s) ───── */
      const c3 = cut(8);
      tl.set(CAM, { az: 0.95, el: -0.16, dist: 4.8, oy: 0.05, sx: 1.05, fov: 32, roll: 0.05 }, c3);
      tl.set(S, { spread: 0.42, collapse: 0.55, core: 0.62 }, c3);
      tl.set(U, { k: 0.6, wobble: 0.014, iri: 0.28, bound: 1.45 }, c3);
      tl.to(CAM, { az: 0.6, dist: 4.45, roll: 0.0, duration: b(4), ease: 'none' }, c3);
      tl.to(S, { collapse: 1, duration: 0.6, ease: 'power2.inOut' }, c3);
      tl.fromTo(U, { torus: 0 }, { torus: 1, duration: 1.2, ease: 'power3.inOut' }, b(8.3));
      tl.fromTo(U, { exposure: 1.3 }, { exposure: 1.0, duration: 0.35, ease: 'power2.out' }, c3);
      MP.cue(b(8), 'cut', { n: 2 });
      MP.cue(b(8.3), 'morph');
      // texte éditorial
      const words = [...document.querySelectorAll('#tagline .tl1 span')];
      tl.set('#tagline', { autoAlpha: 1 }, b(8.6));
      tl.fromTo(words, { autoAlpha: 0, y: 42, filter: 'blur(16px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', stagger: 0.16 }, b(8.6));
      MP.decode($('#tl2'), 'Liquid state  /  chrome study', b(9.6), 0.5);
      MP.cue(b(8.6), 'words');
      tl.to('#tagline', { autoAlpha: 0, filter: 'blur(10px)', duration: 0.25, ease: 'power2.in' }, b(12) - 0.3);

      /* ───── Plan 4 · l'onde de choc, le flacon se forme (7,5 → 10 s) ───── */
      const c4 = cut(12);
      tl.set(CAM, { az: 0.22, el: 0.03, dist: 3.5, oy: -0.02, sx: 0, fov: 33, roll: 0.03 }, c4);
      tl.set(S, { collapse: 1, core: 0.74 }, c4);
      tl.set(U, { floor: 1, torus: 1, wobble: 0.012, iri: 0.22, k: 0.4, bound: 1.4 }, c4);
      tl.to(CAM, { az: -0.08, dist: 3.05, el: 0.0, roll: 0, duration: b(4), ease: 'power1.out' }, c4);
      tl.to(U, { torus: 0, duration: 0.75, ease: 'power2.inOut' }, c4);
      tl.fromTo(U, { exposure: 1.3 }, { exposure: 1.0, duration: 0.35, ease: 'power2.out' }, c4);
      MP.cue(b(12), 'cut', { n: 3 });
      // anticipation puis choc (temps 14)
      const tS = b(14);
      tl.to(U, { wobble: 0.035, duration: b(1), ease: 'power2.in' }, tS - b(1));
      tl.to(S, { core: 0.66, duration: b(1), ease: 'power2.in' }, tS - b(1));
      MP.cue(tS - b(1), 'anticip', { dur: b(1) });
      tl.set(U, { wobble: 0.0 }, tS);
      tl.fromTo(U, { shockR: 0.2, shockA: 0.07 }, { shockR: 2.6, shockA: 0.0, duration: 1.1, ease: 'power2.out' }, tS);
      tl.fromTo(U, { bottle: 0 }, { bottle: 1, duration: 1.15, ease: 'expo.out' }, tS);
      tl.fromTo(U, { exposure: 1.9, streak: 0.35 }, { exposure: 1.0, streak: 0.06, duration: 0.8, ease: 'power2.out' }, tS);
      tl.to(U, { iri: 0.06, duration: 1.2 }, tS);
      MP.cue(tS, 'shock');

      /* ───── Plan 5 · packshot héros (10 → 15 s) ───── */
      const c5 = cut(16);
      tl.set(CAM, { az: 0.7, el: 0.2, dist: 5.75, oy: -0.36, sx: 0, fov: 30, roll: 0 }, c5);
      tl.set(U, { bottle: 1, wobble: 0, shockA: 0, iri: 0.05, floor: 1, glow: 1.1, bound: 1.28 }, c5);
      tl.to(CAM, { az: -0.24, dist: 5.35, el: 0.17, duration: b(8), ease: 'power1.inOut' }, c5);
      tl.fromTo(U, { exposure: 1.3 }, { exposure: 1.0, duration: 0.35, ease: 'power2.out' }, c5);
      tl.fromTo(U, { sweep: -1.4 }, { sweep: 1.4, duration: 2.4, ease: 'sine.inOut' }, b(16.6));
      MP.cue(b(16), 'cut', { n: 4 });
      MP.cue(b(16.6), 'sweep', { dur: 2.4 });

      // logotype
      const nameCh = MP.split($('#brandName'), 'VIF—ARGENT');
      tl.set('#brand', { autoAlpha: 1 }, b(18));
      tl.fromTo(nameCh, { autoAlpha: 0, filter: 'blur(18px)', scale: 1.18 }, { autoAlpha: 1, filter: 'blur(0px)', scale: 1, duration: 1.2, ease: 'power3.out', stagger: { each: 0.055, from: 'center' } }, b(18));
      tl.fromTo('#brandRule', { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'expo.inOut' }, b(18.8));
      MP.decode($('#brandSub'), 'Eau de parfum — 50 ml', b(19.2), 0.6);
      MP.cue(b(18), 'brand');
      MP.cue(b(19.2), 'sub');

      // carte de fin
      $('#ecName').textContent = sig.line1;
      tl.to(hud.items.bl, { autoAlpha: 0, duration: 0.3 }, b(19.8));
      tl.set('#endcard', { autoAlpha: 1 }, b(20));
      tl.fromTo('#ecName', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }, b(20));
      MP.decode($('#ecRole'), `${sig.line2}  ·  3D Product Film 02/03`, b(20.3), 0.5);
      MP.cue(b(20.3), 'type');
      tl.to(U, { exposure: 0.95, duration: 1.0 }, b(22));

      MP.onFrame((t) => {
        U.time = t;
        U.seed = MP.frameOf(t) % 997;
        U.spin = t * 0.0;
        if (U.torus > 0 || (t > b(8) && t < b(12))) U.spin = (t - b(8)) * 0.55;
        if (t >= b(12)) U.spin = Math.max(0, b(13.2) - t) * 0.55 + 0.0;
        const js = JITTER[MP.nsub];
        const j = js ? js[MP.sub % js.length] : [0, 0];
        U.jitter = j;
        updateBalls(t);
        updateCamera();
        updateDust(t);
        if (!MP.warming) glr.render(U);
      });
    }
  );
})();
