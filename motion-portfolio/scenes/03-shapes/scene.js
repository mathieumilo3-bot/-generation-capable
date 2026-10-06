/* 03 — 2D BRAND MOTION · « forma » (marque fictive de jouets) · kit Bauhaus
 * 128 BPM → 8 mesures = 15 s. Les 12 principes de l'animation : squash & stretch,
 * anticipation, arcs, overlap, timing, follow-through, staging, appeal…
 */
(() => {
  gsap.registerPlugin(MorphSVGPlugin, DrawSVGPlugin, MotionPathPlugin);
  const { tl } = MP;
  const b = MP.tempo(128);
  const cut = (n) => MP.cut(b(n));
  const $ = (s) => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const C = { cream: '#f2ebdd', ink: '#161616', red: '#e5412d', blue: '#2547d0', yellow: '#f4b91a' };
  const GROUND = 760;
  const sig = MP.signature();
  const shake = MP.shaker($('#cam'), 9);
  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const SHAPE = {
    circle: 'M0,-150 C41.42,-150 75,-116.42 75,-75 C75,-33.58 41.42,0 0,0 C-41.42,0 -75,-33.58 -75,-75 C-75,-116.42 -41.42,-150 0,-150 Z',
    square: 'M0,-150 L75,-150 L75,0 L-75,0 L-75,-150 Z',
    triangle: 'M0,-164 L88,0 L-88,0 Z',
  };

  MP.build(
    ['800 100px "Bricolage Grotesque Variable"', '500 20px "JetBrains Mono Variable"'],
    () => {
      /* HUD */
      const hud = MP.hud({ color: C.ink });
      MP.decode(hud.items.tl, '03 — 2D Brand Motion', 0.1, 0.45);
      MP.decode(hud.items.bl, 'Forma — Concept ©' + (window.PORTFOLIO?.year || '2026'), 0.2, 0.55);
      MP.decode(hud.items.br, '128 BPM · Bauhaus kit', 0.3, 0.45);

      /* ombres de contact : ellipses au sol, plus petites et plus claires quand l'objet s'élève */
      const shadowG = $('#shadows');
      const shadow = (w) => mk('ellipse', { cx: 0, cy: GROUND + 4, rx: w, ry: 9, fill: C.ink, opacity: 0 }, shadowG);
      const setShadow = (sh, x, yb, w, on = 1) => {
        const hgt = Math.max(0, GROUND - yb);
        const k = 1 / (1 + hgt / 260);
        sh.setAttribute('cx', x.toFixed(1));
        sh.setAttribute('rx', (w * (0.55 + 0.45 * k)).toFixed(1));
        sh.setAttribute('opacity', (0.16 * k * on).toFixed(3));
      };
      const shBall = shadow(70);
      const shTrio = { A: shadow(72), B: shadow(72), C: shadow(80) };
      tl.fromTo('#dotgrid', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.1);
      tl.set('#dotgrid', { autoAlpha: 0 }, cut(8));
      tl.set('#dotgrid', { autoAlpha: 1 }, cut(16));
      tl.set('#dotgrid', { autoAlpha: 0 }, cut(20));
      tl.set('#dotgrid', { autoAlpha: 1 }, cut(24));

      /* ───────── 1 · la balle qui rebondit (B0 → B4) ───────── */
      tl.set('#s1', { autoAlpha: 1 }, 0);
      gsap.set('#ground', { attr: { x1: 960, x2: 960, y1: GROUND, y2: GROUND } });
      tl.to('#ground', { attr: { x1: 300, x2: 1620 }, duration: 0.7, ease: 'expo.out' }, 0.04);
      MP.cue(0.04, 'draw');
      const g = 12000;
      const R = 72;
      const contacts = [b(1), b(2), b(2.75), b(3.25), b(3.5)];
      const sqAmp = [0.42, 0.33, 0.22, 0.12, 0.06];
      const xs = [700, 810, 885, 930, 952, 960];
      const tDrop = contacts[0] - Math.sqrt((2 * 900) / g);
      contacts.forEach((c, i) => MP.cue(c, 'bounce', { n: i }));
      const ball = $('#ball');
      const ballS = $('#ballS');
      MP.onFrame((t) => {
        if (t >= b(4)) return;
        let x = xs[0];
        let yb = GROUND - 900;
        let vy = 0;
        let mode = 'air';
        let sx = 1;
        let sy = 1;
        if (t < contacts[0]) {
          const dt = Math.max(0, t - tDrop);
          yb = GROUND - 900 + 0.5 * g * dt * dt;
          vy = g * dt;
        } else if (t < contacts[4]) {
          let i = 0;
          while (t >= contacts[i + 1]) i++;
          const T = contacts[i + 1] - contacts[i];
          const u = t - contacts[i];
          yb = GROUND - 0.5 * g * u * (T - u);
          vy = g * (u - T / 2);
          x = xs[i] + (xs[i + 1] - xs[i]) * (u / T);
        } else {
          yb = GROUND;
          x = xs[4] + (xs[5] - xs[4]) * MP.clamp((t - contacts[4]) / 0.3);
        }
        // écrasement au contact (la balle « colle » au sol pendant l'impact)
        const w = 0.045;
        contacts.forEach((c, i) => {
          const d = Math.abs(t - c);
          if (d < w) {
            const k = Math.cos((d / w) * Math.PI * 0.5);
            const sq = sqAmp[i] * k;
            sy = 1 - sq;
            sx = 1 + sq * 0.9;
            yb = GROUND;
            mode = 'squash';
          }
        });
        if (mode === 'air') {
          const s = 1 + Math.min(0.24, 0.000055 * Math.abs(vy));
          sy = s;
          sx = 1 / Math.sqrt(s);
        }
        // anticipation avant l'explosion
        if (t > b(3.62)) {
          const k = gsap.parseEase('power2.out')(MP.clamp((t - b(3.62)) / (b(4) - b(3.62))));
          sy = 1 - 0.36 * k;
          sx = 1 + 0.36 * k * 0.95;
          mode = 'squash';
        }
        setShadow(shBall, x, yb, 70 * sx);
        ball.setAttribute('transform', `translate(${x.toFixed(2)},${yb.toFixed(2)})`);
        ballS.setAttribute('transform', mode === 'squash' ? `scale(${sx.toFixed(4)},${sy.toFixed(4)})` : `translate(0,${-R}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(0,${R})`);
      });
      MP.cue(b(3.62), 'charge');
      tl.set('#ball', { autoAlpha: 0 }, b(4));
      MP.onFrame((t) => {
        if (t >= b(4)) shBall.setAttribute('opacity', 0);
        const on = t >= b(4) && t < b(7.72) + 0.2;
        for (const k of ['A', 'B', 'C']) {
          if (!on) {
            shTrio[k].setAttribute('opacity', 0);
            continue;
          }
          const x = gsap.getProperty(T[k], 'x');
          const y = gsap.getProperty(T[k], 'y');
          const sc = t > b(7.72) ? gsap.getProperty(P[k], 'scale') : 1;
          setShadow(shTrio[k], x, y, (k === 'C' ? 80 : 72) * sc, sc);
        }
      });

      /* ───────── 2 · le trio (B4 → B8) ───────── */
      const T = { A: $('#tA'), B: $('#tB'), C: $('#tC') };
      const P = { A: $('#pA'), B: $('#pB'), C: $('#pC') };
      P.A.setAttribute('d', SHAPE.circle);
      P.B.setAttribute('d', SHAPE.square);
      P.C.setAttribute('d', SHAPE.triangle);
      const SQ = { A: T.A.querySelector('.sq'), B: T.B.querySelector('.sq'), C: T.C.querySelector('.sq') };
      tl.set('#s2', { autoAlpha: 1 }, b(4));
      MP.cue(b(4), 'split');
      shake(b(4), 10, 0.15, 0.3);
      const land1 = { A: 520, B: 810, C: 1400 };
      const peak1 = { A: 420, B: 470, C: 400 };
      const spin1 = { A: 360, B: 180, C: -240 };
      const org1 = { A: '50% 50%', B: '50% 50%', C: '50% 66.7%' };
      for (const k of ['A', 'B', 'C']) {
        gsap.set(T[k], { x: 960, y: GROUND });
        tl.fromTo(T[k], { x: 960 }, { x: land1[k], duration: b(0.75), ease: 'power1.out' }, b(4));
        tl.fromTo(T[k], { y: GROUND }, { y: GROUND - peak1[k], duration: b(0.375), ease: 'power2.out' }, b(4));
        tl.to(T[k], { y: GROUND, duration: b(0.375), ease: 'power2.in' }, b(4.375));
        tl.fromTo(P[k], { rotation: 0, scale: 0.4, transformOrigin: org1[k], smoothOrigin: false }, { rotation: spin1[k], scale: 1, duration: b(0.75), ease: 'power1.out' }, b(4));
        tl.set(P[k], { rotation: 0 }, b(4.75));
        landSquash(SQ[k], b(4.75), 0.3);
      }
      MP.cue(b(4.75), 'land', { n: 3 });

      function landSquash(target, at, amt = 0.3, dur = 0.55) {
        gsap.set(target, { transformOrigin: '50% 100%', smoothOrigin: false });
        tl.fromTo(
          target,
          { scaleY: 1 - amt, scaleX: 1 + amt * 0.85, transformOrigin: '50% 100%', smoothOrigin: false },
          { scaleY: 1, scaleX: 1, duration: dur, ease: 'elastic.out(1, 0.35)', immediateRender: false },
          at
        );
      }

      // B5 : le carré bascule sur son arête (pivot explicite sur le coin, au sol)
      const tumbleG = document.createElementNS(NS, 'g');
      P.B.parentNode.insertBefore(tumbleG, P.B);
      tumbleG.appendChild(P.B);
      const tum = { a: 0, side: -1 };
      tl.to(tum, { a: -7, duration: b(0.25), ease: 'power2.out' }, b(4.8));
      tl.to(tum, { a: 0, duration: 0.06, ease: 'power1.in' }, b(5) - 0.06);
      tl.set(tum, { side: 1 }, b(5));
      tl.to(tum, { a: 90, duration: b(0.5), ease: 'power2.in' }, b(5));
      tl.set(tum, { a: 0 }, b(5.5));
      tl.set(T.B, { x: 960 }, b(5.5));
      MP.onFrame(() => tumbleG.setAttribute('transform', `rotate(${tum.a.toFixed(3)} ${75 * tum.side} 0)`));
      landSquash(SQ.B, b(5.5), 0.12, 0.4);
      MP.cue(b(5.5), 'tumble');
      // B5.5 / B5.75 : le cercle sautille
      [[b(5.5), 590], [b(5.75), 660]].forEach(([at, x], i) => {
        tl.to(T.A, { x, duration: b(0.25), ease: 'none' }, at);
        tl.to(T.A, { y: GROUND - 70, duration: b(0.125), ease: 'power2.out' }, at);
        tl.to(T.A, { y: GROUND, duration: b(0.125), ease: 'power2.in' }, at + b(0.125));
        landSquash(SQ.A, at + b(0.25), 0.18, 0.35);
        MP.cue(at + b(0.25), 'hop', { n: i });
      });
      // B6 : le triangle saute en tournant
      tl.to(T.C, { x: 1260, duration: b(0.5), ease: 'power1.inOut' }, b(6));
      tl.to(T.C, { y: GROUND - 170, duration: b(0.25), ease: 'power2.out' }, b(6));
      tl.to(T.C, { y: GROUND, duration: b(0.25), ease: 'power2.in' }, b(6.25));
      tl.fromTo(P.C, { rotation: 0, transformOrigin: '50% 66.7%', smoothOrigin: false }, { rotation: -120, duration: b(0.5), ease: 'power2.inOut', immediateRender: false }, b(6));
      tl.set(P.C, { rotation: 0 }, b(6.5));
      landSquash(SQ.C, b(6.5), 0.22, 0.4);
      MP.cue(b(6), 'spin');
      // B6.5 → B7.5 : anticipation, saut collectif, morphing en plein vol
      for (const k of ['A', 'B', 'C']) {
        gsap.set(SQ[k], { transformOrigin: '50% 100%' });
        tl.to(SQ[k], { scaleY: 0.7, scaleX: 1.22, duration: b(0.25), ease: 'power2.out' }, b(6.55));
        tl.to(SQ[k], { scaleY: 1.18, scaleX: 0.86, duration: 0.08, ease: 'power2.out' }, b(6.8));
        tl.to(SQ[k], { scaleY: 1, scaleX: 1, duration: b(0.3), ease: 'power2.out' }, b(6.8) + 0.08);
        tl.to(T[k], { y: GROUND - 330, duration: b(0.35), ease: 'power2.out' }, b(6.8));
        tl.to(T[k], { y: GROUND, duration: b(0.35), ease: 'power2.in' }, b(7.15));
        landSquash(SQ[k], b(7.5), 0.3, 0.5);
      }
      tl.to(P.A, { morphSVG: SHAPE.triangle, duration: b(0.4), ease: 'power2.inOut' }, b(6.95));
      tl.to(P.B, { morphSVG: SHAPE.circle, duration: b(0.4), ease: 'power2.inOut' }, b(6.95));
      tl.to(P.C, { morphSVG: SHAPE.square, duration: b(0.4), ease: 'power2.inOut' }, b(6.95));
      MP.cue(b(6.55), 'crouch');
      MP.cue(b(6.8), 'jump');
      MP.cue(b(6.95), 'morph');
      MP.cue(b(7.5), 'land', { n: 3 });
      // « pop » de sortie
      tl.fromTo([P.A, P.B, P.C], { scale: 1, transformOrigin: '50% 55%', smoothOrigin: false }, { scale: 0, duration: b(0.22), ease: 'back.in(2.2)', stagger: 0.03, immediateRender: false }, b(7.72));
      tl.to('#ground', { attr: { x1: 960, x2: 960 }, duration: b(0.3), ease: 'expo.in' }, b(7.6));
      MP.cue(b(7.72), 'poof');
      tl.set(['#s1', '#s2'], { autoAlpha: 0 }, cut(8));

      /* ───────── 3 · grille de motifs Bauhaus (B8 → B12) ───────── */
      const grid = $('#grid');
      const PAL = [C.cream, C.ink, C.red, C.blue, C.yellow];
      const tiles = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          const h = (k) => MP.hash((r * 8 + c) * 131 + k * 17 + 5);
          const tg = mk('g', {}, grid);
          const inner = mk('g', {}, tg);
          const bi = Math.floor(h(1) * 5);
          let fi = Math.floor(h(2) * 5);
          if (fi === bi) fi = (bi + 2) % 5;
          let ti = (fi + 1 + Math.floor(h(4) * 3)) % 5;
          if (ti === bi) ti = (ti + 1) % 5;
          mk('rect', { x: -120, y: -120, width: 240, height: 240, fill: PAL[bi] }, inner);
          const motif = mk('g', {}, inner);
          mk('rect', { x: -120, y: -120, width: 240, height: 240, fill: 'none' }, motif);
          const fg = PAL[fi];
          const kind = Math.floor(h(3) * 9);
          const shapes = [
            () => mk('path', { d: 'M-120,-120 L120,-120 A240,240 0 0 1 -120,120 Z', fill: fg }, motif),
            () => mk('path', { d: 'M-120,40 A120,120 0 0 1 120,40 Z', fill: fg }, motif),
            () => mk('circle', { r: 92, fill: fg }, motif),
            () => mk('path', { d: 'M-120,-120 L120,120 L-120,120 Z', fill: fg }, motif),
            () => mk('rect', { x: -64, y: -64, width: 128, height: 128, fill: fg }, motif),
            () => mk('path', { d: 'M-120,-120 A240,240 0 0 0 120,120 A240,240 0 0 0 -120,-120 Z', fill: fg }, motif),
            () => { mk('circle', { r: 98, fill: fg }, motif); mk('circle', { r: 44, fill: PAL[ti] }, motif); },
            () => { for (const y of [-100, -20, 60]) mk('rect', { x: -120, y, width: 240, height: 40, fill: fg }, motif); },
            () => mk('path', { d: 'M0,-120 A120,120 0 0 1 0,120 Z', fill: fg }, motif),
          ];
          shapes[kind]();
          const back = mk('rect', { x: -120, y: -120, width: 240, height: 240, fill: C.blue, visibility: 'hidden' }, inner);
          gsap.set(tg, { x: c * 240 + 120, y: r * 240 + 60 });
          const rot0 = Math.floor(h(5) * 4) * 90;
          gsap.set(motif, { rotation: rot0, transformOrigin: '50% 50%' });
          gsap.set(inner, { transformOrigin: '50% 50%' });
          tiles.push({ tg, inner, motif, back, r, c, rot0, d: Math.hypot(c - 3.5, r - 2) });
        }
      }
      tl.set('#s3', { autoAlpha: 1 }, cut(8));
      tl.to('#hud', { autoAlpha: 0, duration: 0.15 }, b(8));
      tl.to('#hud', { autoAlpha: 1, duration: 0.2 }, b(12));
      tl.fromTo(tiles.map((t) => t.inner), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(1.8)', stagger: (i) => tiles[i].d * 0.032 }, b(8));
      MP.cue(b(8), 'tiles', { n: tiles.length, spread: 4.3 * 0.032 });
      [9, 10, 11].forEach((n, k) => {
        tiles.forEach((tt) => {
          tl.to(tt.motif, { rotation: tt.rot0 + 90 * (k + 1), duration: 0.42, ease: 'back.inOut(1.5)' }, b(n) - 0.06 + (tt.c + tt.r) * 0.022);
        });
        MP.cue(b(n), 'rotate', { k });
      });
      tiles.forEach((tt) => {
        const at = b(11.5) + (tt.c + tt.r) * 0.02;
        tl.to(tt.inner, { scaleX: 0, duration: 0.09, ease: 'power2.in' }, at);
        tl.set(tt.back, { attr: { visibility: 'visible' } }, at + 0.09);
        tl.to(tt.inner, { scaleX: 1, duration: 0.09, ease: 'power2.out' }, at + 0.09);
      });
      MP.cue(b(11.5), 'flipWave');
      tl.set('#s3', { autoAlpha: 0 }, cut(12));

      /* ───────── 4 · la ligne et sa trajectoire (B12 → B16) ───────── */
      tl.set('#bg', { backgroundColor: C.blue }, cut(12));
      tl.set('#hud', { color: C.cream }, cut(12));
      tl.set('#s4', { autoAlpha: 1 }, cut(12));
      const loop = $('#loop');
      loop.setAttribute('d', 'M -90 840 C 250 840 330 400 620 370 C 900 340 1010 640 840 720 C 660 800 590 520 760 440 C 930 360 1190 330 1330 480 C 1470 630 1720 590 1735 400 C 1750 210 1480 190 1370 330 C 1270 460 1140 540 960 540');
      const LEN = loop.getTotalLength();
      const pen = { s: 0, e: 0 };
      tl.to(pen, { e: 100, duration: b(2.75), ease: 'power1.inOut' }, b(12));
      tl.to(pen, { s: 100, duration: b(1.5), ease: 'power2.in' }, b(13.5));
      const rider = $('#rider');
      rider.setAttribute('r', 24);
      MP.onFrame((t) => {
        if (t < b(12) - 0.05 || t > b(16)) return;
        gsap.set(loop, { drawSVG: `${pen.s}% ${pen.e}%` });
        const pt = loop.getPointAtLength((pen.e / 100) * LEN);
        rider.setAttribute('cx', pt.x.toFixed(2));
        rider.setAttribute('cy', pt.y.toFixed(2));
      });
      MP.cue(b(12), 'pen', { dur: b(2.75) });
      tl.fromTo(rider, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, ease: 'back.out(2)' }, b(12));
      // éclatement en anneaux
      const rings = $('#rings');
      const ringEls = [C.cream, C.red, C.yellow].map((col) => mk('circle', { cx: 960, cy: 540, r: 0, class: 'ring', stroke: col, 'stroke-width': 60 }, rings));
      tl.to(rider, { scale: 1.8, duration: 0.12, ease: 'power2.out' }, b(14.75));
      tl.to(rider, { scale: 0, duration: 0.18, ease: 'back.in(2)' }, b(14.75) + 0.12);
      ringEls.forEach((rg, i) => {
        tl.fromTo(rg, { attr: { r: 10, 'stroke-width': 70 } }, { attr: { r: 760, 'stroke-width': 0 }, duration: 0.85, ease: 'power3.out', immediateRender: false }, b(15) + i * 0.08);
      });
      MP.cue(b(15), 'rings');
      tl.set('#iris', { autoAlpha: 1, clipPath: 'circle(0px at 960px 540px)' }, b(15.35));
      tl.to('#iris', { clipPath: 'circle(1150px at 960px 540px)', duration: b(0.65), ease: 'power3.in' }, b(15.35));
      MP.cue(b(15.35), 'iris', { dur: b(0.65) });
      tl.set('#bg', { backgroundColor: C.cream }, cut(16));
      tl.set('#hud', { color: C.ink }, cut(16));
      tl.set(['#s4', '#iris'], { autoAlpha: 0 }, cut(16));

      /* ───────── 5 · pendule de Newton (B16 → B20) ───────── */
      const cradle = $('#cradle');
      const COLS = [C.red, C.blue, C.yellow, C.blue, C.red];
      const arms = COLS.map((col, i) => {
        const gg = mk('g', { transform: `translate(${960 + (i - 2) * 120},266)` }, cradle);
        const arm = mk('g', {}, gg);
        mk('line', { x1: 0, y1: 0, x2: 0, y2: 380, class: 'string' }, arm);
        const ballEl = mk('circle', { cx: 0, cy: 380, r: 58, fill: col }, arm);
        return { arm, ballEl };
      });
      const free = mk('circle', { r: 58, fill: C.red, visibility: 'hidden' }, cradle);
      tl.set('#s5', { autoAlpha: 1 }, cut(16));
      tl.fromTo(['#beam', '#cradle'], { y: -760 }, { y: 0, duration: b(0.9), ease: 'back.out(1.3)' }, b(16));
      MP.cue(b(16), 'cradleIn');
      const A = 40;
      const theta = (i, tb) => {
        const q = (x) => (x * Math.PI) / 2;
        if (i === 0) {
          if (tb < 16.5) return -A;
          if (tb < 17) return -A * Math.cos(q((tb - 16.5) / 0.5));
          if (tb < 18) return 0;
          if (tb < 18.5) return -A * Math.sin(q((tb - 18) / 0.5));
          if (tb < 19) return -A * Math.cos(q((tb - 18.5) / 0.5));
          return 0;
        }
        if (i === 4) {
          if (tb < 17) return 0;
          if (tb < 17.5) return A * Math.sin(q((tb - 17) / 0.5));
          if (tb < 18) return A * Math.cos(q((tb - 17.5) / 0.5));
          if (tb < 19) return 0;
          return 78 * Math.sin(q(Math.min(1, (tb - 19) / 0.32)));
        }
        let j = 0;
        for (const hit of [17, 18, 19]) {
          const d = tb - hit;
          if (d > 0) j += 1.8 * Math.exp(-d * 9) * Math.sin(d * 42) * (i % 2 ? 1 : -1);
        }
        return j;
      };
      const SNAP = b(19.32);
      MP.onFrame((t) => {
        if (t < b(16) - 0.05 || t > b(20) + 0.05) return;
        const tb = t / MP.beat;
        arms.forEach(({ arm }, i) => {
          let th = theta(i, tb);
          if (i === 4 && t >= SNAP) th = 78 - 70 * MP.clamp((t - SNAP) / 0.35); // la ficelle retombe
          arm.setAttribute('transform', `rotate(${(-th).toFixed(3)})`); // θ > 0 : vers la droite
        });
        const snapped = t >= SNAP;
        arms[4].ballEl.setAttribute('visibility', snapped ? 'hidden' : 'visible');
        free.setAttribute('visibility', snapped ? 'visible' : 'hidden');
        if (snapped) {
          const a0 = (78 * Math.PI) / 180;
          const px = 960 + 240 + 380 * Math.sin(a0);
          const py = 266 + 380 * Math.cos(a0);
          const dt = t - SNAP;
          // trajectoire balistique : vitesse tangentielle + gravité
          const vx = 1500 * Math.cos(a0);
          const vy = -1500 * Math.sin(a0) * 1.25;
          free.setAttribute('cx', (px + vx * dt).toFixed(2));
          free.setAttribute('cy', (py + vy * dt + 0.5 * 3000 * dt * dt).toFixed(2));
        }
      });
      [17, 18, 19].forEach((n) => MP.cue(b(n), 'clack', { n }));
      MP.cue(SNAP, 'snap');
      tl.to(['#beam', '#cradle'], { y: 900, duration: b(0.45), ease: 'power3.in' }, b(19.55));
      tl.set('#s5', { autoAlpha: 0 }, cut(20));

      /* ───────── 6 · orbites (B20 → B24) ───────── */
      tl.set('#bg', { backgroundColor: C.ink }, cut(20));
      tl.set('#hud', { color: C.cream }, cut(20));
      tl.set('#s6', { autoAlpha: 1 }, cut(20));
      // ciel étoilé discret qui scintille
      const stars = [];
      const starG = mk('g', {}, $('#s6'));
      $('#s6').insertBefore(starG, $('#orbits'));
      for (let i = 0; i < 70; i++) {
        const h = (k) => MP.hash(i * 389 + k * 7 + 2);
        stars.push({ el: mk('circle', { cx: (h(1) * 1920).toFixed(1), cy: (h(2) * 1080).toFixed(1), r: (1 + h(3) * 2.2).toFixed(2), fill: C.cream }, starG), h });
      }
      MP.onFrame((t) => {
        if (t < b(20) - 0.05 || t > b(24) + 0.05) return;
        const fadeIn = MP.clamp((t - b(20)) / 0.4);
        stars.forEach(({ el, h }, i) => el.setAttribute('opacity', ((0.15 + 0.45 * h(4) * (0.6 + 0.4 * MP.noise(t * 3 + i, i))) * fadeIn).toFixed(3)));
      });
      const orbits = $('#orbits');
      const RX = [235, 350, 470, 600];
      const orbitEls = RX.map((rx) => mk('ellipse', { cx: 960, cy: 540, rx, ry: rx * 0.36, class: 'orbit', transform: 'rotate(-10 960 540)' }, orbits));
      tl.fromTo(orbitEls, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.7, ease: 'power2.inOut', stagger: 0.09 }, b(20) + 0.05);
      tl.fromTo('#sun', { y: -720, scale: 1, transformOrigin: '50% 50%' }, { y: 0, duration: 0.3, ease: 'power2.in' }, b(20) - 0.06);
      tl.fromTo('#sun', { scaleX: 1.35, scaleY: 0.7 }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)', immediateRender: false }, b(20) + 0.24);
      MP.cue(b(20) + 0.24, 'sun');
      const back = $('#planets'); // avant le soleil (derrière)
      const front = mk('g', {}, $('#s6')); // après le soleil (devant)
      const PL = [
        { el: mk('circle', { r: 26, fill: C.yellow }), o: 0, ph: 0.3, w: 1.0 },
        { el: mk('rect', { x: -24, y: -24, width: 48, height: 48, fill: C.blue }), o: 1, ph: 2.2, w: 0.8 },
        { el: mk('path', { d: 'M0,-30 L28,20 L-28,20 Z', fill: C.cream }), o: 2, ph: 4.1, w: 0.65 },
        { el: mk('circle', { r: 18, fill: C.red }), o: 3, ph: 5.3, w: 0.5 },
      ];
      PL.forEach((p, k) => {
        front.appendChild(p.el);
        p.appear = b(20.5 + k * 0.85);
        MP.cue(p.appear, 'planet', { k });
      });
      const rotR = (-10 * Math.PI) / 180;
      MP.onFrame((t) => {
        if (t < b(20) - 0.05 || t > b(24) + 0.05) return;
        const u = MP.clamp((t - b(20)) / b(4));
        const spin = Math.PI * 2 * (0.55 * u + 1.6 * u * u * u);
        const shrink = 1 - gsap.parseEase('power3.in')(MP.clamp((t - b(23)) / b(1)));
        PL.forEach((p) => {
          const a = p.ph + spin * p.w * 1.6;
          const rx = RX[p.o] * shrink;
          const ex = rx * Math.cos(a);
          const ey = rx * 0.36 * Math.sin(a);
          const x = 960 + ex * Math.cos(rotR) - ey * Math.sin(rotR);
          const y = 540 + ex * Math.sin(rotR) + ey * Math.cos(rotR);
          const depth = Math.sin(a);
          const pop = gsap.parseEase('back.out(2.5)')(MP.clamp((t - p.appear) / 0.35));
          const s = (1 + 0.22 * depth) * pop * (0.35 + 0.65 * shrink);
          p.el.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${((a * 180) / Math.PI).toFixed(1)}) scale(${s.toFixed(3)})`);
          const target = depth < 0 ? back : front;
          if (p.el.parentNode !== target) target.appendChild(p.el);
        });
        orbitEls.forEach((o, i) => {
          o.setAttribute('rx', (RX[i] * shrink).toFixed(2));
          o.setAttribute('ry', (RX[i] * 0.36 * shrink).toFixed(2));
        });
      });
      tl.to('#sun', { scale: 0.55, duration: b(1), ease: 'power3.in' }, b(23));
      MP.cue(b(23), 'spiral', { dur: b(1) });
      tl.set('#s6', { autoAlpha: 0 }, cut(24));

      /* ───────── 7-8 · le logo (B24 → B32) ───────── */
      tl.set('#bg', { backgroundColor: C.cream }, cut(24));
      tl.set('#hud', { color: C.ink }, cut(24));
      tl.set('#s7', { autoAlpha: 1 }, cut(24));
      shake(b(24), 14, 0.16, 0.4);
      MP.cue(b(24), 'flash');
      const BASE = 470;
      const mark = { sq: $('#mSq'), ci: $('#mCi'), tr: $('#mTr') };
      gsap.set(mark.sq, { x: 960 - 236, y: BASE });
      gsap.set(mark.ci, { x: 960, y: BASE });
      gsap.set(mark.tr, { x: 960 + 240, y: BASE });
      const msq = (k) => mark[k].querySelector('.sq');
      // carré : glisse depuis la gauche en penchant (inertie)
      tl.fromTo(mark.sq, { x: -300, skewX: 0 }, { x: 960 - 236, duration: b(0.75), ease: 'expo.out' }, b(24.25));
      tl.fromTo(msq('sq'), { skewX: -22 }, { skewX: 0, duration: b(1.2), ease: 'elastic.out(1, 0.4)' }, b(24.25));
      MP.cue(b(24.25), 'slide');
      // cercle : tombe et rebondit
      tl.fromTo(mark.ci, { y: BASE - 900 }, { y: BASE, duration: b(0.5), ease: 'power2.in' }, b(24.75));
      tl.to(mark.ci, { y: BASE - 110, duration: b(0.25), ease: 'power2.out' }, b(25.25));
      tl.to(mark.ci, { y: BASE, duration: b(0.25), ease: 'power2.in' }, b(25.5));
      landSquash(msq('ci'), b(25.25), 0.34, 0.25);
      landSquash(msq('ci'), b(25.75), 0.18, 0.55);
      MP.cue(b(25.25), 'boing', { n: 0 });
      MP.cue(b(25.75), 'boing', { n: 1 });
      // triangle : arrive en arc depuis la droite en pivotant
      tl.fromTo(mark.tr, { x: 2200 }, { x: 960 + 240, duration: b(0.75), ease: 'power2.out' }, b(25.5));
      tl.fromTo(mark.tr, { y: BASE }, { y: BASE - 260, duration: b(0.375), ease: 'power2.out', immediateRender: false }, b(25.5));
      tl.to(mark.tr, { y: BASE, duration: b(0.375), ease: 'power2.in' }, b(25.875));
      tl.fromTo(msq('tr'), { rotation: 300, transformOrigin: '50% 66.7%', smoothOrigin: false }, { rotation: 0, duration: b(0.75), ease: 'power2.out' }, b(25.5));
      landSquash(msq('tr'), b(26.25), 0.28, 0.5);
      MP.cue(b(26.25), 'land', { n: 1 });
      // vague de sauts (overlap)
      ['sq', 'ci', 'tr'].forEach((k, i) => {
        const at = b(26.75) + i * 0.07;
        tl.to(mark[k], { y: BASE - 70, duration: 0.14, ease: 'power2.out' }, at);
        tl.to(mark[k], { y: BASE, duration: 0.14, ease: 'power2.in' }, at + 0.14);
        landSquash(msq(k), at + 0.28, 0.16, 0.4);
        MP.cue(at + 0.28, 'tap', { n: i });
      });
      // logotype
      const word = $('#word');
      const wch = MP.split(word, 'forma');
      gsap.set(word, { xPercent: -50, top: 506 });
      tl.set(word, { autoAlpha: 1 }, b(27));
      wch.forEach((ch, i) => {
        const at = b(27.25 + i * 0.25);
        tl.fromTo(ch, { yPercent: 70, scaleY: 0.2, autoAlpha: 0, transformOrigin: '50% 100%' }, { yPercent: 0, scaleY: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)' }, at);
        MP.cue(at, 'letter', { n: i });
      });
      const tag = $('#tagline');
      tag.textContent = 'Playful objects for curious minds';
      gsap.set(tag, { top: 786, left: 960 - tag.getBoundingClientRect().width / 2 });
      tl.set(tag, { autoAlpha: 1 }, b(28.75));
      MP.decode(tag, 'Playful objects for curious minds', b(28.75), 0.55);
      MP.cue(b(28.75), 'type');
      // respiration finale (animation secondaire)
      [30, 31].forEach((n) => {
        ['sq', 'ci', 'tr'].forEach((k, i) => {
          const at = b(n) + i * 0.05;
          tl.to(msq(k), { scaleY: 0.9, scaleX: 1.07, duration: 0.09, ease: 'power2.out' }, at);
          tl.to(msq(k), { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' }, at + 0.09);
        });
        MP.cue(b(n), 'idle', { n });
      });

      /* carte de fin */
      $('#ecName').textContent = sig.line1;
      tl.to(hud.items.bl, { autoAlpha: 0, duration: 0.2 }, b(29.3));
      tl.set('#endcard', { autoAlpha: 1 }, b(29.5));
      tl.fromTo('#ecName', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' }, b(29.5));
      MP.decode($('#ecRole'), `${sig.line2}  ·  2D Brand Motion 03/03`, b(29.75), 0.45);
    }
  );
})();
