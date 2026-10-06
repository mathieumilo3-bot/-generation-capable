/* 01 — KINETIC TYPE · « MOTION IS NOT JUST MOVEMENT. IT'S TIMING. TENSION. RELEASE. RHYTHM. IT'S E·MOTION. »
 * 128 BPM → 1 temps = 0,46875 s · 8 mesures = 15 s pile. Tout est calé sur la grille musicale.
 */
(() => {
  const { tl } = MP;
  const b = MP.tempo(128);
  const cut = (n) => MP.cut(b(n));
  const $ = (s) => document.querySelector(s);
  const C = { ink: '#0b0b0c', bone: '#eeeae2', sig: '#ff4b1f' };
  const CAP = 0.711; // hauteur de capitale de Roboto Flex (em)
  const shake = MP.shaker($('#cam'), 5);
  const sig = MP.signature();
  const expoOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

  MP.build(
    ['900 100px "Roboto Flex Variable"', 'italic 400 100px "Instrument Serif"', '500 20px "JetBrains Mono Variable"'],
    () => {
      /* ───────────── HUD ───────────── */
      const hud = MP.hud({ color: C.bone });
      hud.items.br.innerHTML = '<span id="bpm"></span><span class="beats"><b></b><b></b><b></b><b></b></span>';
      MP.decode(hud.items.tl, '01 — Kinetic Type', 0.1, 0.45);
      MP.decode(hud.items.bl, 'Type in motion — ©' + (window.PORTFOLIO?.year || '2026'), 0.2, 0.55);
      MP.decode($('#bpm'), '128 BPM', 0.3, 0.3);
      const beatBoxes = [...document.querySelectorAll('.beats b')];
      MP.onFrame((t) => {
        const k = Math.floor(t / MP.beat) % 4;
        beatBoxes.forEach((el, i) => el.classList.toggle('on', i === k && t > 0.3));
      });

      /* Taille de référence : « EMOTION » final fait 1700 px de large. */
      const hW = $('#hWord');
      const hCh = MP.split(hW, 'EMOTION');
      gsap.set(hW, { '--wd': 151, '--wg': 1000, fontSize: 300 });
      const F = MP.fitWidth(hW, 1580);
      gsap.set(hW, { xPercent: -50, yPercent: -50, x: -F * 0.15 }); // place pour le point final
      const RECT = {
        word: hW.getBoundingClientRect(),
        E: hCh[0].getBoundingClientRect(),
        M: hCh[1].getBoundingClientRect(),
        N: hCh[6].getBoundingClientRect(),
      };

      /* ───────────── A · ignition (B0 → B4) ───────────── */
      const aWord = $('#aWord');
      const aCh = MP.split(aWord, 'MOTION');
      gsap.set(aWord, { '--wd': 151, '--wg': 1000, fontSize: F, xPercent: -50, yPercent: -50 });
      const slotH = F * CAP * 1.5;
      gsap.set('#aSlot', { yPercent: -50 });
      gsap.set(['#aHairT', '#aHairB'], { scaleX: 0 });
      tl.set('#sA', { autoAlpha: 1 }, 0);
      tl.to(['#aHairT', '#aHairB'], { scaleX: 1, duration: 0.6, ease: 'expo.out' }, 0.03);
      MP.cue(0.03, 'hairline');

      const open = b(1) - 0.14;
      tl.to('#aHairT', { y: -slotH / 2, duration: 0.5, ease: 'expo.inOut' }, open);
      tl.to('#aHairB', { y: slotH / 2, duration: 0.5, ease: 'expo.inOut' }, open);
      tl.to('#aSlot', { height: slotH, duration: 0.5, ease: 'expo.inOut' }, open);
      tl.fromTo(aCh, { yPercent: 120 }, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: 0.04 }, b(1) - 0.05);
      MP.cue(open, 'whooshUp');

      // B2 : large & écrasé → étroit & immense (axe de chasse variable)
      const sq = b(2) - 0.13;
      const F2 = F * 2.25;
      const slotH2 = F2 * CAP * 1.22;
      tl.to(aWord, { fontSize: F2, duration: 0.46, ease: 'power4.inOut' }, sq);
      tl.to(aCh, { '--wd': 25, duration: 0.46, ease: 'power4.inOut', stagger: { each: 0.016, from: 'center' } }, sq);
      tl.to('#aHairT', { y: -slotH2 / 2, duration: 0.46, ease: 'power4.inOut' }, sq);
      tl.to('#aHairB', { y: slotH2 / 2, duration: 0.46, ease: 'power4.inOut' }, sq);
      tl.to('#aSlot', { height: slotH2, duration: 0.46, ease: 'power4.inOut' }, sq);
      MP.cue(sq, 'stretch');

      // B3 : retour en large + vague de graisse 1000 → 110
      const wv = b(3) - 0.12;
      tl.to(aWord, { fontSize: F, duration: 0.42, ease: 'power3.inOut' }, wv);
      tl.to(aCh, { '--wd': 151, duration: 0.42, ease: 'power3.inOut', stagger: { each: 0.016, from: 'center' } }, wv);
      tl.to(aCh, { '--wg': 110, duration: 0.42, ease: 'power2.inOut', stagger: 0.04 }, wv + 0.06);
      tl.to('#aHairT', { y: -slotH / 2, duration: 0.42, ease: 'power3.inOut' }, wv);
      tl.to('#aHairB', { y: slotH / 2, duration: 0.42, ease: 'power3.inOut' }, wv);
      tl.to('#aSlot', { height: slotH, duration: 0.42, ease: 'power3.inOut' }, wv);
      MP.cue(wv, 'shimmer');

      // fermeture de la fente
      const cl = b(4) - 0.2;
      tl.to(['#aHairT', '#aHairB'], { y: 0, duration: 0.2, ease: 'power4.in' }, cl);
      tl.to('#aSlot', { height: 0, duration: 0.2, ease: 'power4.in' }, cl);
      tl.to(['#aHairT', '#aHairB'], { scaleX: 0.0, duration: 0.12, ease: 'power2.in' }, cl + 0.1);
      MP.cue(cl, 'suck');
      tl.set('#sA', { autoAlpha: 0 }, cut(4));

      /* ───────────── B1 · IS NOT (B4 → B5) ───────────── */
      const bIsNot = $('#bIsNot');
      const bCh = MP.split(bIsNot, 'IS NOT');
      gsap.set(bIsNot, { '--wd': 115, '--wg': 950, fontSize: 300, color: C.ink });
      MP.fitWidth(bIsNot, 1500);
      gsap.set(bIsNot, { xPercent: -50, yPercent: -50 });
      gsap.set(bCh.slice(3), { color: C.sig });
      tl.set('#bg', { backgroundColor: C.bone }, cut(4));
      tl.set('#hud', { color: C.ink }, cut(4));
      tl.set('#sB1', { autoAlpha: 1 }, cut(4));
      tl.fromTo(
        bCh,
        { rotationX: -90, yPercent: 25, transformPerspective: 1100, transformOrigin: '50% 100%', backfaceVisibility: 'hidden' },
        { rotationX: 0, yPercent: 0, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.032 },
        b(4)
      );
      MP.cue(b(4), 'flip');
      tl.set('#sB1', { autoAlpha: 0 }, cut(5));

      /* ───────────── B2 · just (B5 → B6) ───────────── */
      const bJust = $('#bJust');
      const jCh = MP.split(bJust, 'just');
      gsap.set(bJust, { fontSize: 260, letterSpacing: '0.02em', xPercent: -50, yPercent: -50 });
      {
        const r0 = bJust.getBoundingClientRect();
        const ru = jCh[1].getBoundingClientRect();
        const rs = jCh[2].getBoundingClientRect();
        const ox = (ru.right + rs.left) / 2 - r0.left;
        const oy = ru.top + ru.height * 0.6 - r0.top;
        gsap.set(bJust, { transformOrigin: `${ox}px ${oy}px` });
      }
      tl.set('#bg', { backgroundColor: C.ink }, cut(5));
      tl.set('#hud', { color: C.bone }, cut(5));
      tl.set('#sB2', { autoAlpha: 1 }, cut(5));
      tl.fromTo(bJust, { letterSpacing: '0.32em', scale: 0.9 }, { letterSpacing: '0.02em', scale: 1.05, duration: b(0.8), ease: 'expo.out' }, b(5));
      tl.to(bJust, { scale: 24, duration: 0.21, ease: 'power3.in' }, b(6) - 0.21);
      MP.cue(b(6) - 0.21, 'zoom');
      tl.set('#sB2', { autoAlpha: 0 }, cut(6));

      /* ───────────── B3 · MOVEMENT. (B6 → B8) ───────────── */
      const bMove = $('#bMove');
      const mCh = MP.split(bMove, 'MOVEMENT');
      gsap.set(bMove, { '--wd': 140, '--wg': 950, fontSize: 250 });
      const mF = MP.fitWidth(bMove, 1480);
      gsap.set(bMove, { xPercent: -50, yPercent: -50, x: -mF * 0.12 });
      const dotSize = mF * 0.2;
      const dot = $('#dot');
      gsap.set(dot, { width: dotSize, height: dotSize, marginLeft: -dotSize / 2, marginTop: -dotSize / 2, transformOrigin: '50% 100%' });
      const mR = bMove.getBoundingClientRect();
      const dotX = mR.right + dotSize * 0.75;
      const dotY = 540 + (mF * CAP) / 2 - dotSize / 2;

      const sp = $('#bSpeed');
      const lines = [];
      for (let i = 0; i < 11; i++) {
        const l = document.createElement('i');
        l.style.width = `${180 + MP.hash(i + 40) * 520}px`;
        l.style.top = `${150 + MP.hash(i + 70) * 780}px`;
        l.style.opacity = String(0.35 + MP.hash(i + 9) * 0.65);
        sp.appendChild(l);
        lines.push(l);
      }
      tl.set('#sB3', { autoAlpha: 1 }, cut(6));
      tl.fromTo(lines, { x: 2100 }, { x: -900, duration: 0.42, ease: 'power2.out', stagger: (i) => MP.hash(i + 90) * 0.16 }, b(6) - 0.04);
      tl.fromTo(mCh, { x: 2200 }, { x: 0, duration: 0.5, ease: 'expo.out', stagger: 0.018 }, b(6));
      MP.cue(b(6), 'swipe', { pan: 0.5 });
      const fallT = b(6.45);
      tl.set(dot, { autoAlpha: 1, x: dotX, y: dotY - 700 }, fallT);
      tl.to(dot, { y: dotY, duration: 0.26, ease: 'power3.in' }, fallT);
      tl.fromTo(dot, { scaleX: 0.75, scaleY: 1.35 }, { scaleX: 1, scaleY: 1, duration: 0.26, ease: 'power3.in' }, fallT);
      tl.to(dot, { scaleX: 1.45, scaleY: 0.55, duration: 0.05, ease: 'power2.out' }, fallT + 0.26);
      tl.to(dot, { scaleX: 1, scaleY: 1, duration: 0.45, ease: 'elastic.out(1, 0.35)' }, fallT + 0.31);
      MP.cue(fallT + 0.26, 'blip');
      tl.fromTo(lines, { x: 2100 }, { x: -1000, duration: 0.3, ease: 'power3.in', stagger: (i) => MP.hash(i + 95) * 0.1, immediateRender: false }, b(7.35));
      tl.to(mCh, { x: -2400, duration: 0.27, ease: 'power3.in', stagger: 0.011 }, b(7.35));
      MP.cue(b(7.35), 'swipe', { pan: -0.5 });
      tl.to(dot, { x: 960, y: 540, duration: b(0.62), ease: 'power3.inOut' }, b(7.38));
      tl.set('#sB3', { autoAlpha: 0 }, cut(8));

      /* ───────────── C · it's TIMING. (B8 → B12) ───────────── */
      const R = 380;
      const circ = 2 * Math.PI * R;
      gsap.set('#cRing', { attr: { 'stroke-dasharray': circ, 'stroke-dashoffset': circ, transform: 'rotate(-90)' } });
      const ticks = [];
      const tg = $('#cTicks');
      for (let k = 0; k < 60; k++) {
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const major = k % 5 === 0;
        ln.setAttribute('x1', 0);
        ln.setAttribute('x2', 0);
        ln.setAttribute('y1', -(R - (major ? 44 : 22)));
        ln.setAttribute('y2', -(R - 10));
        ln.setAttribute('stroke', 'currentColor');
        ln.setAttribute('stroke-width', major ? 3 : 1.5);
        ln.setAttribute('transform', `rotate(${k * 6})`);
        ln.setAttribute('opacity', 0);
        tg.appendChild(ln);
        ticks.push(ln);
      }
      tl.set('#sC', { autoAlpha: 1 }, cut(8));
      tl.to(dot, { scale: 0.42, y: 540 - dotSize / 2 + (0.42 * dotSize) / 2, duration: 0.35, ease: 'power3.out' }, b(8));
      tl.to('#cRing', { attr: { 'stroke-dashoffset': 0 }, duration: 0.75, ease: 'expo.inOut' }, b(8) - 0.22);
      tl.to(ticks, { attr: { opacity: 1 }, duration: 0.02, stagger: 0.0065 }, b(8));
      MP.cue(b(8) - 0.22, 'ring');
      gsap.set('#cHand', { scaleY: 0, svgOrigin: '0 0' });
      tl.to('#cHand', { scaleY: 1, duration: 0.45, ease: 'expo.out' }, b(8.25));

      const cIts = $('#cIts');
      gsap.set(cIts, { fontSize: 120, top: 318, xPercent: -50, yPercent: -50 });
      tl.fromTo(cIts, { autoAlpha: 0, filter: 'blur(16px)', y: 24 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.5, ease: 'power3.out' }, b(8));

      const cT = $('#cTiming');
      const tCh = MP.split(cT, 'TIMING');
      gsap.set(cT, { '--wd': 62, '--wg': 860, fontSize: 300 });
      const tF = MP.fitWidth(cT, 1020);
      gsap.set(cT, { xPercent: -50, yPercent: -50, x: -tF * 0.07 });
      const cR = cT.getBoundingClientRect();
      tCh.forEach((ch, k) => {
        const at = b(9 + k * 0.5);
        tl.fromTo(ch, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.001 }, at);
        tl.fromTo(ch, { scale: 1.32, yPercent: -5 }, { scale: 1, yPercent: 0, duration: 0.24, ease: 'expo.out' }, at);
        tl.to('#cHand', { rotation: (k + 1) * 30, svgOrigin: '0 0', duration: 0.14, ease: 'back.out(2.6)' }, at);
        MP.cue(at, 'tick', { n: k });
      });
      // le point devient le point final de « TIMING. »
      const tDot = (tF * 0.2) / dotSize;
      tl.to(dot, { x: cR.right + tF * 0.13, y: 540 + (tF * CAP) / 2 - dotSize / 2, scale: tDot, duration: 0.22, ease: 'back.out(2)' }, b(11.75));
      tl.to('#cHand', { rotation: 7 * 30, svgOrigin: '0 0', duration: 0.14, ease: 'back.out(2.6)' }, b(11.75));
      MP.cue(b(11.75), 'tick', { n: 7 });
      const cFrame = $('#cFrame');
      MP.onFrame((t) => {
        if (t < b(8) || t > b(12)) return;
        const f = MP.frameOf(t);
        cFrame.textContent = `frame ${String(f).padStart(4, '0')} / 0900  ·  60 fps`;
      });
      tl.fromTo(cFrame, { autoAlpha: 0 }, { autoAlpha: 0.75, duration: 0.3 }, b(8.5));
      tl.set(['#sC', dot], { autoAlpha: 0 }, cut(12));

      /* ───────────── D1 · TENSION. (B12 → B14) ───────────── */
      const dT = $('#dTension');
      const teCh = MP.split(dT, 'TENSION');
      gsap.set(dT, { '--wd': 25, '--wg': 920, fontSize: 600, letterSpacing: '0.045em' });
      MP.fitWidth(dT, 1560);
      gsap.set(dT, { xPercent: -50, yPercent: -50 });
      tl.set('#sD1', { autoAlpha: 1 }, cut(12));
      tl.fromTo(dT, { scaleX: 1.04, scaleY: 0.96 }, { scaleX: 0.88, scaleY: 1.06, duration: b(2), ease: 'power2.in' }, b(12));
      tl.fromTo('#dMeter', { scaleX: 0 }, { scaleX: 1, duration: b(2), ease: 'power1.in' }, b(12));
      tl.fromTo('#zoom', { scale: 1 }, { scale: 1.1, duration: b(2), ease: 'power2.in' }, b(12));
      tl.set('#zoom', { scale: 1 }, cut(14));
      MP.cue(b(12), 'tension', { dur: b(2) });
      MP.onFrame((t) => {
        const on = t >= b(12) && t < b(14);
        const u = MP.clamp((t - b(12)) / b(2));
        const amp = 0.8 + 10 * u * u;
        teCh.forEach((ch, i) => {
          ch.style.translate = on ? `${(MP.noise(t * 34, i) * amp).toFixed(2)}px ${(MP.noise(t * 31, i + 20) * amp).toFixed(2)}px` : '';
        });
      });
      tl.set('#sD1', { autoAlpha: 0 }, cut(14));

      /* ───────────── D2 · RELEASE. (B14 → B16) ───────────── */
      const dR = $('#dRelease');
      const reCh = MP.split(dR, 'RELEASE');
      gsap.set(dR, { '--wd': 151, '--wg': 1000, fontSize: 300 });
      MP.fitWidth(dR, 1660);
      gsap.set(dR, { xPercent: -50, yPercent: -50 });
      tl.set('#sD2', { autoAlpha: 1 }, cut(14));
      tl.set('#flash', { autoAlpha: 1 }, cut(14));
      tl.set('#flash', { autoAlpha: 0 }, MP.cut(b(14) + 3 / 60));
      tl.fromTo(reCh, { '--wd': 25 }, { '--wd': 151, duration: 1.0, ease: 'elastic.out(1, 0.4)', stagger: { each: 0.012, from: 'center' } }, b(14));
      tl.fromTo(dR, { scale: 0.5 }, { scale: 1, duration: 0.95, ease: 'elastic.out(1.1, 0.45)' }, b(14));
      shake(b(14), 34, 0.22, 1.2);
      MP.cue(b(14), 'release');
      const order = [3, 1, 5, 0, 6, 2, 4];
      tl.to(
        reCh,
        {
          y: (i) => 950 + MP.hash(i + 3) * 260,
          rotation: (i) => (MP.hash(i + 11) - 0.5) * 70,
          duration: 0.55,
          ease: 'power2.in',
          stagger: (i) => order[i] * 0.035,
        },
        b(15.1)
      );
      MP.cue(b(15.1), 'fall');
      tl.set('#sD2', { autoAlpha: 0 }, cut(16));

      /* ───────────── E · RHYTHM (B16 → B20) ───────────── */
      const plane = $('#ePlane');
      const styles = ['solid', 'outline', 'serifrow', 'solid', 'outline', 'solid', 'serifrow', 'outline', 'solid'];
      const rows = styles.map((st, r) => {
        const d = document.createElement('div');
        d.className = `row ${st}`;
        d.textContent = (st === 'serifrow' ? 'rhythm — ' : 'RHYTHM — ').repeat(9);
        d.style.top = `${r * 205 + 180}px`;
        plane.appendChild(d);
        return d;
      });
      gsap.set(plane, { xPercent: -50, yPercent: -50, transformPerspective: 1700, rotationX: 26 });
      tl.set('#sE', { autoAlpha: 1 }, cut(16));
      tl.fromTo(plane, { rotation: -15, scale: 1.0 }, { rotation: -8, scale: 1.2, duration: b(4), ease: 'none' }, b(16));
      const E0 = b(16);
      MP.onFrame((t) => {
        if (t < E0 - 0.05 || t > b(20) + 0.05) return;
        const u = t - E0;
        const bi = Math.floor(u / MP.beat);
        rows.forEach((row, r) => {
          const dir = r % 2 ? -1 : 1;
          let pump = 0;
          for (let k = 0; k <= Math.min(bi, 3); k++) pump += 330 * expoOut((u - k * MP.beat) / 0.4);
          const entry = (1 - expoOut((u - r * 0.022) / 0.7)) * 2400;
          const exit = Math.pow(MP.clamp((t - b(19.5)) / b(0.5)), 3) * 5600;
          const base = -2400 + ((r * 331) % 700);
          const x = base + dir * (110 * u + pump + exit - entry);
          row.style.transform = `translateX(${x.toFixed(1)}px)`;
          const hot = bi >= 0 && bi <= 3 && (r === (bi * 2 + 1) % 9 || r === (bi * 2 + 6) % 9);
          row.classList.toggle('hot', hot);
        });
        plane.style.scale = String(1 + 0.03 * Math.exp(-((u % MP.beat) / 0.12)));
      });
      for (let k = 0; k < 4; k++) MP.cue(b(16 + k), 'pump', { k });
      MP.cue(b(19.5), 'rushOut');
      tl.set('#sE', { autoAlpha: 0 }, cut(20));

      /* ───────────── F · vague typographique (B20 → B24) ───────────── */
      const stack = $('#fStack');
      const fRows = [];
      for (let r = 0; r < 9; r++) {
        const d = document.createElement('div');
        d.className = 'frow';
        const chs = MP.split(d, 'MOTION');
        d.style.opacity = String(1 - Math.abs(r - 4) * 0.13);
        stack.appendChild(d);
        fRows.push({ el: d, chs });
      }
      gsap.set(stack, { yPercent: -50 });
      tl.set('#sF', { autoAlpha: 1 }, cut(20));
      tl.fromTo(
        fRows.map((r) => r.el),
        { y: (r) => (r - 4) * -70, scaleY: 0 },
        { y: 0, scaleY: 1, duration: 0.5, ease: 'expo.out', stagger: { each: 0.03, from: 'center' } },
        b(20)
      );
      tl.fromTo('#zoom', { scale: 1, rotation: 0 }, { scale: 1.42, rotation: -3, duration: b(4), ease: 'power2.in' }, b(20));
      tl.set('#zoom', { scale: 1, rotation: 0 }, cut(24));
      tl.to(
        fRows.filter((_, r) => r !== 4).map((r) => r.el),
        { y: (i) => { const r = i < 4 ? i : i + 1; return (r - 4) * 300; }, autoAlpha: 0, duration: b(0.75), ease: 'power3.in' },
        b(23.25)
      );
      MP.onFrame((t) => {
        if (t < b(20) - 0.05 || t > b(24) + 0.05) return;
        const u = MP.clamp((t - b(20)) / b(4));
        const ph = Math.PI * 2 * (1.1 * u + 2.6 * u * u * u);
        fRows.forEach(({ chs }, r) => {
          chs.forEach((ch, c) => {
            const p = r * 0.62 + c * 0.42 - ph;
            ch.style.setProperty('--wd', (88 + 63 * Math.sin(p)).toFixed(1));
            ch.style.setProperty('--wg', (560 + 440 * Math.sin(p + 0.9)).toFixed(0));
          });
        });
      });
      MP.cue(b(20), 'build', { dur: b(8) });
      tl.set('#sF', { autoAlpha: 0 }, cut(24));

      /* ───────────── G · it's … MOTION (B24 → B28) ───────────── */
      const gIts = $('#gIts');
      gsap.set(gIts, { fontSize: 124, top: 540 - (F * CAP) / 2 - 120, xPercent: -50, yPercent: -50 });
      const mkMotion = (el) => {
        const ch = MP.split(el, 'MOTION');
        gsap.set(el, { '--wd': 151, '--wg': 1000, fontSize: F, xPercent: -50, yPercent: -50 });
        return ch;
      };
      const gCh = mkMotion($('#gWord'));
      mkMotion($('#gWordA'));
      mkMotion($('#gWordB'));
      gsap.set('#gWordA', { color: C.sig });
      gsap.set('#gWordB', { color: 'transparent', webkitTextStroke: `3px ${C.bone}` });
      tl.set('#sG', { autoAlpha: 1 }, cut(24));
      tl.fromTo(gIts, { autoAlpha: 0, filter: 'blur(18px)', y: 26 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.5, ease: 'power3.out' }, b(24));
      tl.fromTo('#gWord', { scale: 1.08 }, { scale: 1, duration: 0.4, ease: 'expo.out' }, b(24));
      const g0 = b(25);
      const g1 = b(26.75);
      const gA = $('#gWordA');
      const gB = $('#gWordB');
      const gW = $('#gWord');
      const gWrap = $('#gWrap');
      MP.onFrame((t) => {
        const on = t >= g0 && t < g1;
        if (t >= b(24) - 0.05 && t < b(28)) {
          const step = Math.floor((t - g0) / (MP.beat / 4));
          const h = (n) => MP.hash(step * 13 + n);
          const inv = on && (step === 3 || step === 6);
          $('#bg').style.backgroundColor = inv ? C.bone : C.ink;
          $('#hud').style.color = inv ? C.ink : C.bone;
          gW.style.color = inv ? C.ink : C.bone;
          gIts.style.color = inv ? C.ink : C.bone;
          if (on) {
            const a0 = h(1) * 70;
            const b0 = h(2) * 30 + 8;
            gA.style.opacity = '1';
            gA.style.clipPath = `inset(${a0}% 0 ${Math.max(0, 100 - a0 - b0)}% 0)`;
            gA.style.translate = `${((h(3) - 0.5) * 140).toFixed(1)}px 0`;
            const a1 = h(4) * 70;
            gB.style.opacity = h(5) > 0.35 ? '1' : '0';
            gB.style.clipPath = `inset(${a1}% 0 ${Math.max(0, 100 - a1 - (h(6) * 35 + 10))}% 0)`;
            gB.style.translate = `${((h(7) - 0.5) * 220).toFixed(1)}px 0`;
            gW.style.translate = `${((h(8) - 0.5) * 22).toFixed(1)}px 0`;
            gWrap.style.scale = String(1 + 0.035 * Math.floor((t - g0) / (MP.beat / 2)));
          } else {
            gA.style.opacity = '0';
            gB.style.opacity = '0';
            gW.style.translate = '';
            gWrap.style.scale = '';
          }
        }
      });
      for (let k = 0; k < 7; k++) MP.cue(g0 + (k * MP.beat) / 4, 'glitch', { k });
      // déplacement : on laisse la place du « E »
      const gR = gCh[0].getBoundingClientRect();
      const shift = RECT.M.left - gR.left;
      tl.to(gIts, { autoAlpha: 0, filter: 'blur(10px)', duration: 0.3 }, b(27));
      tl.to(gW, { x: shift, duration: b(0.85), ease: 'power3.inOut' }, b(27));
      tl.to(gW, { skewX: -7, duration: b(0.4), ease: 'power2.out' }, b(27.5));
      MP.cue(b(27), 'slide');
      tl.set('#sG', { autoAlpha: 0 }, MP.cut(b(28) - 0.17));

      /* ───────────── H · E·MOTION (B28 → B32) ───────────── */
      const tE = b(28);
      tl.set('#sH', { autoAlpha: 1 }, MP.cut(tE - 0.17));
      gsap.set(hCh.slice(1), { skewX: -7 });
      tl.fromTo(hCh[0], { x: -1900, scaleX: 1.6, transformOrigin: '100% 100%' }, { x: 0, scaleX: 1, duration: 0.17, ease: 'power3.in' }, tE - 0.17);
      MP.cue(tE - 0.17, 'slam');
      tl.set('#bg', { backgroundColor: C.sig }, MP.cut(tE));
      tl.set([hW, '#hPre'], { color: C.ink }, MP.cut(tE));
      tl.set('#hud', { color: C.ink }, MP.cut(tE));
      shake(tE, 46, 0.25, 1.8);
      MP.cue(tE, 'impact');
      tl.fromTo(hCh[0], { scaleX: 0.74, scaleY: 1.14 }, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.32)', immediateRender: false }, tE);
      hCh.slice(1).forEach((ch, i) => {
        tl.to(ch, { x: 90 - i * 8, skewX: 4, duration: 0.07, ease: 'power2.out' }, tE + i * 0.028);
        tl.to(ch, { x: 0, skewX: 0, duration: 0.75, ease: 'elastic.out(1, 0.33)' }, tE + 0.07 + i * 0.028);
      });
      // éclats graphiques au point d'impact
      const burst = $('#hBurst');
      const ix = RECT.E.right + 6;
      const iy = 540;
      const bars = [];
      for (let k = 0; k < 14; k++) {
        const wrap = document.createElement('div');
        wrap.style.cssText = `position:absolute;left:${ix}px;top:${iy}px;transform:rotate(${k * (360 / 14) + 6}deg)`;
        const bar = document.createElement('i');
        wrap.appendChild(bar);
        burst.appendChild(wrap);
        bars.push(bar);
      }
      tl.fromTo(bars, { x: 150, scaleX: 0 }, { x: 330, scaleX: 1, duration: 0.16, ease: 'expo.out' }, tE);
      tl.to(bars, { x: 560, scaleX: 0, duration: 0.3, ease: 'power2.in' }, tE + 0.16);

      const pre = $('#hPre');
      gsap.set(pre, { fontSize: 128, left: RECT.word.left + 6, top: 540 - (F * CAP) / 2 - 104, xPercent: 0, yPercent: -50 });
      tl.fromTo(pre, { autoAlpha: 0, y: 34, filter: 'blur(12px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.65, ease: 'expo.out' }, b(29));
      MP.cue(b(29), 'swell');
      // le point revient : point final de « EMOTION. »
      const fDot = (F * 0.2) / dotSize;
      tl.set(dot, { autoAlpha: 1, backgroundColor: C.ink, x: RECT.N.right + F * 0.11, y: 540 + (F * CAP) / 2 - dotSize / 2 - 760, scale: fDot }, b(29.6));
      tl.to(dot, { y: 540 + (F * CAP) / 2 - dotSize / 2, duration: 0.26, ease: 'power3.in' }, b(29.6));
      tl.to(dot, { scaleX: fDot * 1.45, scaleY: fDot * 0.55, duration: 0.05, ease: 'power2.out' }, b(29.6) + 0.26);
      tl.to(dot, { scaleX: fDot, scaleY: fDot, duration: 0.5, ease: 'elastic.out(1, 0.35)' }, b(29.6) + 0.31);
      MP.cue(b(29.6) + 0.26, 'blip', { last: true });
      // respiration finale de la graisse
      tl.to(hCh, { '--wg': 860, duration: b(1), ease: 'sine.inOut', stagger: { each: 0.05, yoyo: true, repeat: 1 } }, b(30));

      /* carte de fin */
      $('#ecName').textContent = sig.line1;
      tl.to(hud.items.bl, { autoAlpha: 0, duration: 0.2 }, b(29.3));
      tl.set('#endcard', { autoAlpha: 1 }, b(29.5));
      tl.fromTo('#ecName', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' }, b(29.5));
      MP.decode($('#ecRole'), `${sig.line2}  ·  Kinetic Typography 01/03`, b(29.75), 0.45);
      MP.cue(b(29.75), 'type');

      MP.grain({ opacity: 0.045 });
    }
  );
})();
