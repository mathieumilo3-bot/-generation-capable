"""score.py — compose la bande-son d'une scène à partir de ses repères (cues.json).

    python3 audio/score.py 01-kinetic build/01-kinetic/cues.json build/01-kinetic/audio.wav

La musique est écrite sur la grille du tempo ; les bruitages sont posés
exactement sur les repères exportés par l'animation → synchro parfaite.
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *  # noqa: E402,F403


def by_type(cues, kind):
    return [c for c in cues if c['type'] == kind]


# ═══════════════════════════════════════════════════════════════════
#  01 — KINETIC TYPE · 128 BPM · Fa mineur · tech minimale percutante
# ═══════════════════════════════════════════════════════════════════
def score_01(meta):
    cues = meta['cues']
    B = 60 / 128
    b = lambda n: n * B
    M = Mix(meta['duration'])

    # ── batterie
    kicks = [b(1)] + [b(n) for n in range(4, 12)] + [b(14), b(15)] + [b(n) for n in range(16, 27)] + [b(n) for n in range(28, 32)]
    K = kick(f0=240, f1=48, decay=0.26, click=0.95, drive=1.9)
    for t in kicks:
        g = 0.75 if t == b(1) else 1.0
        M.add(K, t, gain=g, bus='drums')
    # intro : kicks étouffés (filtre passe-bas) qui annoncent le groove
    Km = filt(filt(K, 'lp', 260), 'lp', 260)
    for n in [2, 3, 3.5]:
        M.add(Km, b(n), gain=0.55, bus='drums')
    M.kicks = kicks

    C = clap()
    for n in [5, 7, 9, 11, 15, 17, 19, 21, 23, 25, 29, 31]:
        M.add(C, b(n), gain=0.75, bus='drums', verb=0.25)

    Hc = hat()
    Ho = hat(True)
    for n in range(4, 12):
        if 8 <= n < 12:
            continue  # la mesure « TIMING » laisse la place aux tic-tac
        M.add(Hc, b(n + 0.5), gain=0.45, pan=0.25, bus='drums')
    for n in range(16, 24):
        for s in range(4):
            g = [0.16, 0.3, 0.48, 0.28][s]
            M.add(Hc, b(n + s / 4), gain=g, pan=0.3 * (1 if s % 2 else -1), bus='drums')
    for n in [16.5, 17.5, 18.5, 19.5]:
        M.add(Ho, b(n), gain=0.16, pan=-0.2, bus='drums')
    for n in range(28, 32):
        M.add(Hc, b(n + 0.5), gain=0.45, pan=0.25, bus='drums')
        M.add(Hc, b(n + 0.75), gain=0.2, pan=-0.25, bus='drums')

    # roulement de caisse claire qui accélère (montée)
    S = snare()
    roll = []
    for n in range(20, 24):
        roll += [n, n + 0.5]
    for n in range(24, 26):
        roll += [n + k / 4 for k in range(4)]
    roll += [26 + k / 8 for k in range(8)]
    for x in roll:
        p = (x - 20) / 7
        M.add(filt(S, 'hp', 200 + 1800 * p), b(x), gain=0.12 + 0.4 * p ** 1.5, pan=0.1, bus='drums', verb=0.15)

    # ── basse : doubles-croches qui roulent entre les kicks (Fa)
    root = {4: 'F1', 8: 'F1', 16: 'F1', 18: 'Db2', 20: 'F1', 22: 'Eb2', 24: 'F1', 28: 'F1', 30: 'Db2'}
    sections = [(4, 12), (14, 16), (16, 27), (28, 32)]
    for a, z in sections:
        for n in range(a, z):
            key = max(k for k in root if k <= n)
            f = hz(root[key])
            for s in (1, 2, 3):
                oct_up = 2.0 if s == 2 else 1.0
                nb = bass(f * oct_up, b(0.22), cutoff=760, env_amt=2800, decay=0.06, drive=2.4, sub=0.28)
                M.add(nb, b(n + s / 4), gain=0.22, bus='music')

    # ── nappe d'intro (Fa m add9) qui s'ouvre
    P = pad(['F2', 'C3', 'Ab3', 'G4'], b(12.5), cutoff=900, attack=1.2, release=1.2)
    M.add(P, 0.0, gain=0.22, bus='music', verb=0.4)

    # ── stabs d'accords
    chords = {
        'Fm9': ['F3', 'Ab3', 'C4', 'Eb4', 'G4'],
        'Db': ['Db3', 'F3', 'Ab3', 'C4', 'Eb4'],
        'Eb': ['Eb3', 'G3', 'Bb3', 'D4', 'F4'],
        'Cm': ['C3', 'Eb3', 'G3', 'Bb3', 'D4'],
    }
    M.add(stab(chords['Fm9'], 0.9, cutoff=2800, decay=0.2), b(4), gain=0.45, bus='music', verb=0.35)
    M.add(stab(chords['Fm9'], 1.2, cutoff=4200, decay=0.3), b(14), gain=0.55, bus='music', verb=0.45)
    for k, ch in enumerate(['Fm9', 'Db', 'Eb', 'Cm']):
        M.add(stab(chords[ch], 0.6, cutoff=3200, decay=0.16, seed=k * 9), b(16 + k), gain=0.45, bus='music', verb=0.3)
    # petit motif d'arpège pendant la vague (B20 → B27)
    arp = ['F4', 'Ab4', 'C5', 'Eb5', 'G5', 'Eb5', 'C5', 'Ab4']
    for i, x in enumerate(np.arange(20, 27, 0.5)):
        nf = hz(arp[i % len(arp)])
        M.add(pluck(nf, 0.35, 0.7, 0.993, seed=i), b(x), gain=0.12 + 0.1 * (x - 20) / 7, pan=0.35 * np.sin(i), bus='music', verb=0.3)
    M.add(stab(chords['Fm9'], 2.6, cutoff=5200, decay=0.5), b(28), gain=0.62, bus='music', verb=0.5)
    # accord final tenu
    M.add(pad(chords['Fm9'], b(3.6), cutoff=2400, attack=0.25, release=0.9, seed=33), b(28.4), gain=0.22, bus='music', verb=0.5)

    # ── bruitages synchronisés sur les repères
    for c in cues:
        t, k = c['t'], c['type']
        if k == 'hairline':
            M.add(sine(3136, 0.9) * env_exp(0.9, 0.25, 0.004) * 0.25, t, gain=0.5, bus='fx', verb=0.6)
            M.add(sub_boom(60, 34, 1.4, 0.5), t, gain=0.35, bus='fx')
        elif k == 'whooshUp':
            M.add(whoosh(0.55, 250, 2600, 0.8, 1.2, seed=1), t, gain=0.75, pan=0.0, bus='fx', verb=0.3)
        elif k == 'stretch':
            M.add(stretch(0.5), t, gain=0.5, bus='fx', verb=0.2)
        elif k == 'shimmer':
            M.add(shimmer(1.0, 2093), t, gain=0.55, pan=0.15, bus='fx', verb=0.6)
        elif k == 'suck':
            M.add(rev_cymbal(b(4) - t), t, gain=0.4, bus='fx')
        elif k == 'flip':
            for i in range(6):
                M.add(filt(noise(0.03), 'bp', 2600 + 300 * i, 2) * env_exp(0.03, 0.006), t + i * 0.032, gain=0.35, pan=-0.5 + i * 0.2, bus='fx')
        elif k == 'zoom':
            M.add(whoosh(0.3, 400, 6000, 0.92, 1.0, seed=2), t, gain=0.55, bus='fx')
        elif k == 'swipe':
            M.add(whoosh(0.42, 700, 4200, 0.35, 1.3, seed=3, f_end=600), t - 0.05, gain=0.45, pan=c.get('pan', 0), bus='fx')
        elif k == 'blip':
            if c.get('last'):
                M.add(blip(900, 300, 0.3, 0.09), t, gain=0.5, bus='fx', verb=0.4)
            else:
                M.add(blip(1500, 520), t, gain=0.45, pan=0.35, bus='fx', verb=0.25)
        elif k == 'ring':
            sw = sine(np.geomspace(500, 1500, int(0.75 * SR)), 0.75) * np.sin(np.linspace(0, np.pi, int(0.75 * SR))) ** 2
            M.add(sw * 0.18, t, gain=0.6, pan=-0.2, bus='fx', verb=0.6)
        elif k == 'tick':
            n = c.get('n', 0)
            M.add(tick(2400 if n % 2 == 0 else 1800, 0.06, 0.014), t, gain=0.5, pan=-0.3 + 0.08 * n, bus='fx', verb=0.15)
            M.add(tick(800, 0.05, 0.02), t, gain=0.25, bus='fx')
        elif k == 'tension':
            d = c['dur']
            M.add(riser(d, 300, 9000, 220, 1800, seed=5, tone=0.35), t, gain=0.55, bus='fx', verb=0.2)
            for i in range(16):
                x = i / 16
                M.add(filt(S, 'hp', 600 + 3000 * x), t + x * d, gain=0.08 + 0.3 * x ** 2, bus='drums')
        elif k == 'release':
            M.add(impact(2.5), t, gain=0.75, bus='fx')
            M.add(crash(2.4), t, gain=0.35, pan=0.1, bus='fx', verb=0.3)
        elif k == 'fall':
            fsw = whoosh(0.6, 3000, 300, 0.25, 1.1, seed=6)
            M.add(fsw, t, gain=0.4, pan=-0.2, bus='fx')
            tt = tsamp(0.5)
            M.add(np.sin(2 * np.pi * np.cumsum(900 * np.exp(-tt * 4)) / SR) * env_exp(0.5, 0.2) * 0.25, t, gain=0.4, bus='fx', verb=0.3)
        elif k == 'pump':
            M.add(whoosh(0.18, 2000, 6000, 0.1, 1.0, seed=10 + c['k']), t - 0.02, gain=0.18, pan=0.4 * (-1) ** c['k'], bus='fx')
        elif k == 'rushOut':
            M.add(whoosh(b(0.5) + 0.05, 300, 7000, 0.95, 1.0, seed=9), t, gain=0.6, bus='fx')
        elif k == 'build':
            d = b(7.6)
            M.add(riser(d, 150, 9000, 110, 1700, seed=12, tone=0.3), t, gain=0.5, bus='fx', verb=0.25)
        elif k == 'glitch':
            M.add(glitch(B / 4 * 0.9, seed=c['k'] * 7 + 1), t, gain=0.5, pan=0.6 * np.sin(c['k'] * 2.1), bus='fx')
        elif k == 'slide':
            M.add(rev_cymbal(b(28) - t, seed=19), t, gain=0.5, bus='fx')
            M.add(whoosh(b(0.9), 200, 1500, 0.7, 1.2, seed=20), t, gain=0.35, pan=0.5, bus='fx')
        elif k == 'slam':
            M.add(whoosh(0.19, 500, 8000, 0.97, 0.9, seed=21), t, gain=0.7, pan=-0.6, bus='fx')
        elif k == 'impact':
            M.add(impact(3.0, seed=22), t, gain=0.9, bus='fx')
            M.add(crash(3.0, seed=23), t, gain=0.45, bus='fx', verb=0.35)
        elif k == 'swell':
            M.add(shimmer(1.2, 1397, seed=33), t, gain=0.3, pan=-0.2, bus='fx', verb=0.7)
        elif k == 'type':
            M.add(digital_type(0.45), t, gain=0.35, pan=-0.4, bus='fx')

    M.duck('music', kicks, depth=0.7, release=0.14)
    for name in ('drums', 'music', 'fx'):
        bb = M.bus(name)
        bb[:] = filt(filt(bb, 'lowshelf', 90, 0.7, -2.5), 'peak', 3200, 0.8, 2.0)
    M.reverb('verb', rt60=2.0, out='main', gain=0.5)
    M.master(lufs=-14, ceiling_db=-1)
    return M


# ═══════════════════════════════════════════════════════════════════
#  02 — 3D PRODUCT FILM · 96 BPM · Ré mineur · cinématique, luxe, métal liquide
# ═══════════════════════════════════════════════════════════════════
def brass(freqs, dur, attack=0.02, cutoff0=180, cutoff1=2600, drive=2.4):
    """« Braam » : pile de dents de scie filtrées qui s'ouvrent, saturées."""
    out = np.zeros((2, int(dur * SR)))
    for k, f in enumerate(freqs):
        out += supersaw(hz(f), dur, 5, 0.12, seed=50 + k)
    out = sweep(out, 'lp', lambda p: cutoff0 + (cutoff1 - cutoff0) * np.exp(-p * dur / 0.5) * np.clip(p * dur / attack, 0, 1), 1.2)
    out = np.tanh(drive * out / np.sqrt(len(freqs))) / np.tanh(drive)
    t = tsamp(dur)
    return out * np.clip(t / attack, 0, 1) * np.exp(-t / (dur * 0.5))


def gloop(f0=180, f1=520, dur=0.25, seed=0):
    """Bruit de goutte liquide : sinus qui monte vite + résonance."""
    t = tsamp(dur)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)
    x += 0.3 * filt(noise(dur, np.random.default_rng(seed)), 'bp', f1 * 2, 6) * np.exp(-t / 0.02)
    return fade(x, 0.001, 0.01)


def score_02(meta):
    cues = meta['cues']
    B = 60 / 96
    b = lambda n: n * B
    D = meta['duration']
    M = Mix(D)

    # ── drone de basse (Ré) qui gonfle
    t = tsamp(D)
    drone = 0.6 * np.sin(2 * np.pi * hz('D1') * t) + 0.3 * np.sin(2 * np.pi * hz('A1') * t + 0.5)
    drone += 0.18 * filt(noise(D), 'lp', 90)
    env = np.clip((t - 0.1) / 1.5, 0, 1) ** 2 * (0.75 + 0.25 * np.sin(2 * np.pi * t / 5.0))
    env *= np.where(t < b(14), 0.8 + 0.4 * (t / b(14)), 1.0)
    M.add(np.tanh(1.2 * drone) * env * 0.5, 0.0, gain=0.45, bus='music')

    # ── nappes : Rém(add9) → Si♭maj7 → Solm9 → (choc) Rém → Famaj7/Ré
    prog = [
        (0.1, b(8), ['D2', 'A2', 'F3', 'E4']),
        (b(8), b(4), ['Bb1', 'F2', 'D3', 'A3']),
        (b(12), b(2), ['G1', 'D2', 'Bb2', 'A3']),
        (b(16), D - b(16), ['D2', 'F3', 'A3', 'C4', 'E4']),
    ]
    for st, du, ch in prog:
        M.add(pad(ch, du + 0.9, cutoff=1100, attack=0.9, release=1.0, detune=0.16, seed=int(st * 10)), st, gain=0.28, bus='music', verb=0.5)

    # ── pulsation « battement de cœur » (plans 2 à 4)
    hb = kick(f0=110, f1=40, decay=0.32, click=0.05, drive=1.2)
    for n in range(4, 14):
        M.add(hb, b(n), gain=0.42, bus='drums')
        M.add(hb, b(n + 0.42), gain=0.25, bus='drums')
    # tic-tac métallique très discret
    for n in np.arange(4, 13.75, 0.25):
        M.add(hat(False, 0.05, seed=int(n * 4), tone=1.4), b(n), gain=0.08 + 0.05 * ((n * 4) % 2), pan=0.4 * np.sin(n * 3), bus='drums')

    # ── motif de cloches (luxe)
    motif = [(0.6, 'D5'), (1.25, 'A5'), (1.9, 'F5'), (b(4) + 0.02, 'E5'), (b(5.5), 'A5'), (b(8) + 0.02, 'F5'), (b(9.5), 'D6'),
             (b(16) + 0.02, 'A4'), (b(18), 'D5'), (b(18) + 0.12, 'F5'), (b(18) + 0.24, 'A5'), (b(18) + 0.36, 'E6'), (b(20.5), 'D6')]
    for tt, n in motif:
        M.add(bell(hz(n), 3.0, 3.5, 1.8, 1.0), tt, gain=0.2, pan=0.5 * np.sin(tt * 2.3), bus='music', verb=0.65)

    # ── bruitages
    for c in cues:
        tt, k = c['t'], c['type']
        if k == 'flare':
            M.add(whoosh(1.4, 3000, 9000, 0.25, 0.8, seed=60, f_end=2000), tt - 0.05, gain=0.35, bus='fx', verb=0.5)
            M.add(sub_boom(55, 30, 2.5, 1.0), tt, gain=0.45, bus='fx')
        elif k == 'drip':
            M.add(gloop(220, 640, 0.25, 1), tt + 0.25, gain=0.35, pan=0.35, bus='fx', verb=0.4)
            M.add(gloop(260, 760, 0.22, 2), tt + 0.42, gain=0.28, pan=-0.35, bus='fx', verb=0.4)
        elif k == 'cut':
            n = c['n']
            M.add(rev_cymbal(0.55, seed=70 + n), tt - 0.55, gain=0.3, bus='fx')
            M.add(impact(2.2, seed=80 + n), tt, gain=[0, 0.5, 0.45, 0.5, 0.6][n], bus='fx')
            M.add(whoosh(0.9, 200, 1200, 0.08, 1.1, seed=90 + n, f_end=180), tt, gain=0.3, bus='fx', verb=0.3)
        elif k == 'merge':
            for i, (a, z) in enumerate([(180, 420), (150, 380), (210, 520), (120, 300)]):
                M.add(gloop(a, z, 0.3, 10 + i), tt + i * 0.21, gain=0.25, pan=-0.4 + 0.27 * i, bus='fx', verb=0.4)
        elif k == 'morph':
            M.add(riser(1.2, 800, 9000, 300, 900, seed=11, tone=0.08) * 0.8, tt, gain=0.3, bus='fx', verb=0.6)
            M.add(shimmer(1.6, 1175, seed=12), tt + 0.8, gain=0.25, bus='fx', verb=0.8)
        elif k == 'words':
            M.add(whoosh(0.8, 600, 2400, 0.4, 1.0, seed=13), tt, gain=0.18, pan=-0.5, bus='fx', verb=0.5)
        elif k == 'anticip':
            M.add(rev_cymbal(c['dur'], seed=14), tt, gain=0.45, bus='fx')
            M.add(riser(c['dur'], 200, 6000, 90, 400, seed=15, tone=0.3), tt, gain=0.45, bus='fx')
        elif k == 'shock':
            M.add(brass(['D1', 'D2', 'A2', 'D3'], 2.6), tt, gain=0.55, bus='music', verb=0.35)
            M.add(impact(3.2, seed=16), tt, gain=0.85, bus='fx')
            M.add(crash(3.0, seed=17), tt, gain=0.35, bus='fx', verb=0.4)
            M.add(bell(hz('D4'), 3.5, 1.41, 3.0, 1.4), tt, gain=0.22, bus='fx', verb=0.7)
        elif k == 'sweep':
            d = c['dur']
            M.add(whoosh(d, 500, 6000, 0.5, 0.7, seed=18, f_end=800), tt, gain=0.22, pan=0.0, bus='fx', verb=0.6)
            M.add(shimmer(0.9, 2349, seed=19), tt + d * 0.45, gain=0.2, pan=0.2, bus='fx', verb=0.7)
        elif k == 'brand':
            M.add(sub_boom(48, 28, 3.0, 1.4), tt, gain=0.4, bus='fx')
            M.add(whoosh(1.2, 300, 3000, 0.15, 0.8, seed=20, f_end=400), tt - 0.1, gain=0.25, bus='fx', verb=0.6)
        elif k in ('sub', 'type'):
            M.add(digital_type(0.5, rate=34, seed=21 if k == 'sub' else 22), tt, gain=0.16, pan=-0.3, bus='fx', verb=0.2)

    M.reverb('verb', rt60=3.2, out='main', gain=0.55, pre=0.03)
    M.master(lufs=-15, ceiling_db=-1, fade_out=0.25)
    return M


# ═══════════════════════════════════════════════════════════════════
#  03 — 2D BRAND MOTION · 128 BPM · Do majeur · ludique, marimba & bois
# ═══════════════════════════════════════════════════════════════════
def wood(freq=900, dur=0.12):
    """Claquement de bois (pendule, dominos)."""
    t = tsamp(dur)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.018)
    x += 0.6 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t / 0.008)
    x += 0.5 * filt(noise(dur), 'bp', freq * 3.2, 3) * np.exp(-t / 0.004)
    return fade(x, 0, 0.01)


def pizz(freq, dur=0.4, seed=1):
    """Basse pizzicato : corde pincée + fondamentale arrondie."""
    t = tsamp(dur)
    x = 0.55 * karplus(freq, dur, 0.3, 0.992, seed)
    x += 0.9 * np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.22)
    x += 0.3 * np.sin(4 * np.pi * freq * t) * np.exp(-t / 0.12)
    return fade(np.tanh(1.3 * x) * np.clip(t / 0.003, 0, 1), 0, 0.03)


def soft_kick():
    return kick(f0=160, f1=52, pitch_decay=0.025, decay=0.2, click=0.25, drive=1.3, dur=0.45)


def snap_fx(dur=0.2, seed=40):
    t = tsamp(dur)
    x = filt(noise(dur, np.random.default_rng(seed)), 'bp', 2200, 1.6) * np.exp(-t / 0.012)
    x += 0.4 * filt(noise(dur, np.random.default_rng(seed + 1)), 'hp', 6000) * np.exp(-t / 0.03)
    return fade(x * 2, 0, 0.01)


def whistle(f0, f1, dur, vib=5.5):
    t = tsamp(dur)
    p = t / dur
    f = f0 * (f1 / f0) ** (0.5 - 0.5 * np.cos(np.pi * p))
    f *= 1 + 0.012 * np.sin(2 * np.pi * vib * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    e = np.clip(t / 0.06, 0, 1) * np.clip((dur - t) / 0.15, 0, 1)
    return x * e


def score_03(meta):
    cues = meta['cues']
    B = 60 / 128
    b = lambda n: n * B
    M = Mix(meta['duration'])
    PENTA = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6']

    # ── batterie ronde et légère
    K = soft_kick()
    kicks = [b(n) for n in list(range(4, 12)) + [12, 14] + list(range(16, 24)) + list(range(25, 28)) + [28, 30]]
    for t in kicks:
        M.add(K, t, gain=0.85, bus='drums')
    M.kicks = kicks
    for n in [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]:
        M.add(snap_fx(seed=n), b(n), gain=0.5, pan=0.15, bus='drums', verb=0.2)
    for n in np.arange(4, 28, 0.5):
        if 12 <= n < 16:
            g = 0.18
        else:
            g = 0.26 if (n * 2) % 2 else 0.16
        M.add(hat(False, 0.08, seed=int(n * 8), tone=1.2), b(n + 0.25 if 20 <= n < 24 else n), gain=g, pan=0.35 * np.sin(n * 2), bus='drums')
    for n in np.arange(20, 24, 0.25):
        M.add(hat(False, 0.05, seed=int(n * 16), tone=1.5), b(n), gain=0.1 + 0.12 * (n - 20) / 4, pan=-0.3, bus='drums')

    # ── basse pizzicato (Karplus-Strong)
    bassline = {4: ['C2', 'C2', 'G1', 'A1'], 8: ['A1', 'A1', 'F1', 'F1'], 12: ['F1', 'F1', 'G1', 'G1'], 16: ['C2', 'C2', 'E2', 'E2'],
                20: ['A1', 'F1', 'G1', 'G1'], 24: ['C2', 'C2', 'C2', 'G1'], 28: ['F1', 'F1', 'C2', 'C2']}
    for bar, notes in bassline.items():
        for i, n in enumerate(notes):
            for off in (0, 0.5):
                M.add(pizz(hz(n), 0.4, seed=bar + i), b(bar + i + off), gain=0.42 if off == 0 else 0.26, bus='music')

    # ── nappes très douces
    chords = [(4, ['C4', 'E4', 'G4', 'B4']), (8, ['A3', 'C4', 'E4', 'G4']), (10, ['F3', 'A3', 'C4', 'E4']), (12, ['F3', 'A3', 'C4', 'E4']),
              (14, ['G3', 'B3', 'D4', 'F4']), (16, ['C4', 'E4', 'G4', 'B4']), (20, ['A3', 'C4', 'E4', 'G4']), (22, ['G3', 'B3', 'D4', 'F4']),
              (24, ['C4', 'E4', 'G4', 'D5']), (28, ['F3', 'A3', 'C4', 'E4']), (30, ['C4', 'E4', 'G4', 'D5'])]
    for i, (st, ch) in enumerate(chords):
        end = chords[i + 1][0] if i + 1 < len(chords) else 32
        M.add(pad(ch, b(end - st) + 0.4, cutoff=1500, attack=0.15, release=0.35, detune=0.1, seed=st), b(st), gain=0.08, bus='music', verb=0.3)

    # ── bruitages synchronisés
    for c in cues:
        t, k = c['t'], c['type']
        if k == 'draw':
            M.add(whistle(900, 1600, 0.6) * 0.25, t, gain=0.35, bus='fx', verb=0.4)
        elif k == 'bounce':
            n = c['n']
            note = ['C5', 'E5', 'G5', 'C6', 'E6'][n]
            M.add(marimba(hz(note), 0.6), t, gain=0.55 * (1 - 0.12 * n), pan=-0.2 + 0.1 * n, bus='fx', verb=0.3)
            M.add(pop(260 + 60 * n, 0.12), t, gain=0.4 * (1 - 0.15 * n), bus='fx')
        elif k == 'charge':
            M.add(boing(320, 140, 0.35, 0), t, gain=0.3, bus='fx')
        elif k == 'split':
            M.add(pop(700, 0.12), t, gain=0.6, bus='fx')
            for i, n in enumerate(['C6', 'E6', 'G6']):
                M.add(bell(hz(n), 1.2, 2.0, 1.2, 0.35), t + i * 0.03, gain=0.12, pan=-0.5 + 0.5 * i, bus='fx', verb=0.5)
            M.add(whoosh(0.4, 400, 3000, 0.3, 1.2, seed=31), t, gain=0.3, bus='fx')
        elif k == 'land':
            M.add(marimba(hz('C4'), 0.5, 0.15), t, gain=0.5, bus='fx', verb=0.2)
            M.add(filt(soft_kick(), 'lp', 400), t, gain=0.4, bus='fx')
        elif k == 'tumble':
            M.add(wood(420, 0.15), t, gain=0.6, pan=0.1, bus='fx', verb=0.2)
        elif k == 'hop':
            M.add(blip(700 + 200 * c['n'], 900 + 300 * c['n'], 0.12, 0.05), t - b(0.25), gain=0.3, pan=-0.4, bus='fx')
            M.add(pop(500 + 120 * c['n']), t, gain=0.35, pan=-0.4, bus='fx')
        elif k == 'spin':
            M.add(boing(200, 620, 0.5, 16), t, gain=0.35, pan=0.45, bus='fx', verb=0.2)
        elif k == 'crouch':
            M.add(boing(300, 160, 0.2, 0), t, gain=0.22, bus='fx')
        elif k == 'jump':
            M.add(whoosh(0.35, 300, 2400, 0.7, 1.4, seed=32), t, gain=0.35, bus='fx')
        elif k == 'morph':
            M.add(shimmer(0.7, 1568, seed=33), t, gain=0.4, bus='fx', verb=0.5)
        elif k == 'poof':
            for i in range(3):
                M.add(pop(800 + 200 * i, 0.1), t + i * 0.03 + b(0.2), gain=0.45, pan=-0.5 + 0.5 * i, bus='fx')
        elif k == 'tiles':
            n, spread = c['n'], c['spread']
            for i in range(n):
                dt = spread * (i / n) ** 0.8 + 0.02
                M.add(pop(hz(PENTA[i % len(PENTA)]) * 0.5, 0.08), t + dt + 0.12, gain=0.16, pan=np.sin(i * 1.7) * 0.7, bus='fx')
            M.add(marimba(hz('A4'), 0.6), t, gain=0.4, bus='fx', verb=0.3)
        elif k == 'rotate':
            kk = c['k']
            M.add(whoosh(0.4, 600, 3500, 0.5, 1.2, seed=40 + kk), t - 0.08, gain=0.28, pan=-0.3 + 0.3 * kk, bus='fx')
            for i, n in enumerate([['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5']][kk]):
                M.add(marimba(hz(n), 0.5), t + 0.15 + i * 0.012, gain=0.22, bus='fx', verb=0.25)
        elif k == 'flipWave':
            for i in range(14):
                M.add(snap_fx(0.05, seed=60 + i) * 0.6, t + i * 0.022, gain=0.3, pan=-0.7 + 0.1 * i, bus='fx')
        elif k == 'pen':
            M.add(whistle(hz('G5'), hz('C7'), c['dur']) * 0.2, t, gain=0.5, pan=0.0, bus='fx', verb=0.5)
        elif k == 'rings':
            for i, n in enumerate(['C6', 'G6', 'E7']):
                M.add(bell(hz(n), 1.6, 3.0, 1.5, 0.5), t + i * 0.08, gain=0.14, pan=-0.4 + 0.4 * i, bus='fx', verb=0.6)
            M.add(pop(520, 0.15), t - 0.25, gain=0.5, bus='fx')
        elif k == 'iris':
            M.add(whoosh(c['dur'] + 0.05, 300, 5000, 0.9, 1.0, seed=50), t, gain=0.4, bus='fx')
        elif k == 'cradleIn':
            M.add(wood(260, 0.2), t + b(0.6), gain=0.5, bus='fx', verb=0.2)
            M.add(whoosh(0.3, 2000, 400, 0.2, 1.2, seed=51), t, gain=0.25, bus='fx')
        elif k == 'clack':
            M.add(wood(1400, 0.12), t, gain=0.8, pan=0.0, bus='fx', verb=0.25)
            M.add(wood(2100, 0.08), t + 0.004, gain=0.3, bus='fx')
        elif k == 'snap':
            M.add(boing(240, 900, 0.4, 0), t, gain=0.35, pan=0.5, bus='fx')
            M.add(whoosh(0.4, 500, 6000, 0.85, 1.0, seed=52), t, gain=0.35, pan=0.5, bus='fx')
        elif k == 'sun':
            M.add(sub_boom(90, 45, 1.0, 0.25), t, gain=0.5, bus='fx')
            M.add(marimba(hz('C4'), 0.8), t, gain=0.4, bus='fx', verb=0.4)
        elif k == 'planet':
            n = ['C5', 'E5', 'G5', 'B5'][c['k']]
            M.add(pluck(hz(n), 0.6, 0.8, 0.996, seed=70 + c['k']), t, gain=0.4, pan=0.4 * np.sin(c['k'] * 2), bus='fx', verb=0.35)
            M.add(pop(hz(n) / 2, 0.08), t, gain=0.25, bus='fx')
        elif k == 'spiral':
            M.add(riser(c['dur'], 300, 8000, 200, 1600, seed=53, tone=0.2), t, gain=0.4, bus='fx')
        elif k == 'flash':
            M.add(impact(1.6, seed=54), t, gain=0.35, bus='fx')
            M.add(crash(1.8, seed=55), t, gain=0.22, bus='fx', verb=0.3)
            for i, n in enumerate(['C5', 'E5', 'G5', 'C6']):
                M.add(marimba(hz(n), 0.8), t + i * 0.02, gain=0.25, bus='fx', verb=0.35)
        elif k == 'slide':
            M.add(whoosh(0.4, 500, 2500, 0.35, 1.3, seed=56, f_end=400), t, gain=0.35, pan=-0.6, bus='fx')
            M.add(wood(500, 0.12), t + b(0.75) * 0.5, gain=0.35, pan=-0.3, bus='fx')
        elif k == 'boing':
            M.add(boing(180 + 40 * c['n'], 520 + 80 * c['n'], 0.45, 14), t, gain=0.4 - 0.1 * c['n'], bus='fx', verb=0.2)
        elif k == 'tap':
            M.add(marimba(hz(['E5', 'G5', 'C6'][c['n']]), 0.5), t, gain=0.35, pan=-0.4 + 0.4 * c['n'], bus='fx', verb=0.3)
        elif k == 'letter':
            n = c['n']
            M.add(pop(hz(['C5', 'D5', 'E5', 'G5', 'A5'][n]) * 0.5, 0.1), t, gain=0.4, pan=-0.4 + 0.2 * n, bus='fx')
            M.add(marimba(hz(['C5', 'D5', 'E5', 'G5', 'A5'][n]), 0.4), t, gain=0.2, bus='fx', verb=0.3)
        elif k == 'type':
            M.add(digital_type(0.55, rate=38, seed=57), t, gain=0.25, pan=0.2, bus='fx')
        elif k == 'idle':
            if c['n'] == 30:
                for i, n in enumerate(['C4', 'G4', 'C5', 'E5', 'G5', 'D6']):
                    M.add(marimba(hz(n), 1.4, 0.4), t + i * 0.035, gain=0.28, bus='fx', verb=0.5)
            else:
                M.add(bell(hz('C6'), 2.5, 3.5, 1.4, 0.9), t, gain=0.16, bus='fx', verb=0.6)

    M.duck('music', kicks, depth=0.35, release=0.12)
    M.reverb('verb', rt60=1.6, out='main', gain=0.45, bright=1.1)
    M.master(lufs=-14, ceiling_db=-1, fade_out=0.3)
    return M


SCORES = {'01-kinetic': score_01, '02-liquid': score_02, '03-shapes': score_03}

if __name__ == '__main__':
    scene, cues_path, out_path = sys.argv[1:4]
    meta = json.load(open(cues_path))
    if scene not in SCORES:
        print(f'(pas de partition pour {scene})')
        sys.exit(1)
    M = SCORES[scene](meta)
    M.write(out_path)
    print(f'  son : {out_path} ({loudness(M.out):.1f} LUFS)')
