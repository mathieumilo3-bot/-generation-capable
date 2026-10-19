# Bande-son originale, synthétisée à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Direction : classe, dynamique, épuré (voir ../CLAUDE.md).
#  - Musique : piano et beat hip-hop cinématique, en fa mineur, sans aucun élément qui tourne du début à la fin.
#    Chaque section a sa texture : piano seul à l'ouverture ; le beat lourd (grosse caisse et caisse claire au
#    demi-temps, calées sur les coupes) entre avec l'accroche ; groove complet avec basse syncopée sur les gestes ;
#    break piano seul sur la salle ; montée ; trois grands accords pour les trois mots ; final en fa majeur.
#    Les accords sont enrichis (9e, 7e majeures), le piano change de motif d'accompagnement à chaque mesure, les cordes
#    n'arrivent qu'aux passages.
#  - Bruitages : peu, variés et musicaux, un par repère (« cues ») : souffle doux sur les textes, « tink » de tuyau
#    accordé sur chaque geste, clics accordés sur le diagnostic, eau sur les transitions, une goutte, et un boom grave
#    et propre réservé aux moments clés (21 novembre, titre, carte finale).
# Trois habillages possibles sur la même musique (3e argument) :
#  - « epure » (par défaut) : bruitages musicaux décrits ci-dessus ;
#  - « cinema » : les bruitages de cinéma demandés par le client (sabre, flash, voiture qui passe, demi-explosion),
#    dosés et adoucis, seulement sur les moments clés, les débuts d'accroche et les gestes ;
#  - « cinema-plus » : les mêmes, sur chaque mot et chaque coupe, toujours adoucis.
#
# Mesures (140 bpm, 1 mesure = 1,71 s) : 0-1 ouverture « Rendez-vous le », 2-3 le 21 novembre, 4-8 accroche,
# 9-15 titre et gestes, 16 la salle, 17-19 montée, 20-21 les trois mots, 22+ carte finale.
import json, sys, wave
import numpy as np

SR = 48000
reel = json.load(open(sys.argv[1]))
T = reel["T"]
b = 60 / reel["bpm"]; BAR = 4 * b; S16 = b / 4
DUR = reel["duration"] + 0.3
N = int(DUR * SR)
BUS = {k: np.zeros((N, 2)) for k in ("drums", "bass", "music", "fx")}
send = np.zeros((N, 2))
rng = np.random.default_rng(2111)
VAR = sys.argv[3] if len(sys.argv) > 3 else "epure"
assert VAR in ("epure", "cinema", "cinema-plus"), VAR

NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
SEMI = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
def freq(name): return 440 * 2 ** ((SEMI[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)
def mfreq(m): return 440 * 2 ** ((m - 69) / 12)
def mname(m): return NAMES[m % 12] + str(m // 12 - 1)
def tt(n): return np.arange(n) / SR

def add(bus, at, sig, gain=1.0, pan=0.0, rev=0.0):
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        sig = np.stack([sig * l, sig * r], 1)
    i = int(round(at * SR))
    if i < 0: sig, i = sig[-i:], 0
    if i >= N: return
    j = min(N, i + len(sig))
    BUS[bus][i:j] += sig[: j - i] * gain
    send[i:j] += sig[: j - i] * gain * rev

def filt(sig, h_of_f):
    S = np.fft.rfft(sig, axis=0); f = np.fft.rfftfreq(len(sig), 1 / SR); h = h_of_f(np.maximum(f, 1))
    return np.fft.irfft(S * (h[:, None] if sig.ndim == 2 else h), len(sig), axis=0)
def band(sig, lo, hi): return filt(sig, lambda f: ((f >= lo) & (f <= hi)).astype(float))
def lowpass(sig, fc, o=4): return filt(sig, lambda f: 1 / np.sqrt(1 + (f / fc) ** o))
def norm(s): return s / (np.abs(s).max() + 1e-9)
def saw(f, n, ph=0.0): return 2 * ((np.cumsum(np.broadcast_to(f, (n,))) / SR + ph) % 1) - 1

def sweep(n, f0, f1, width=0.5):
    win, hop = 2048, 512
    noise = rng.standard_normal(n + win); out = np.zeros(n + win); w = np.hanning(win)
    fr = np.fft.rfftfreq(win, 1 / SR); fr[0] = 1
    for i in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (i / max(1, n))
        out[i:i + win] += np.fft.irfft(np.fft.rfft(noise[i:i + win] * w) * np.exp(-0.5 * (np.log(fr / fc) / width) ** 2), win) * w
    return norm(out[:n])

# ---------------- harmonie : un accord par mesure ----------------
CHORDS = {"Fm": ("F", "Ab", "C"), "Db": ("Db", "F", "Ab"), "Ab": ("Ab", "C", "Eb"), "Eb": ("Eb", "G", "Bb"),
          "Bbm": ("Bb", "Db", "F"), "C": ("C", "E", "G"), "F": ("F", "A", "C")}
PLAN = ["Fm"] * 4 + ["Fm", "Db", "Ab", "Bbm", "C",        # 0-3 : ouverture, 21 novembre ; 4-8 : accroche
        "Fm", "Fm", "Db", "Ab", "Eb", "Bbm", "C",          # 9-15 : titre, gestes
        "Db",                                              # 16 : la salle
        "Bbm", "C", "Db",                                  # 17-19 : montée, la basse monte
        "Fm", "Eb",                                        # 20-21 : les trois mots
        "F", "F", "F", "F"]                                # 22+ : résolution en fa majeur
def tones(ch, octv):
    root = SEMI[CHORDS[ch][0]] + 12 * (octv + 1); out = []
    for nm in CHORDS[ch]:
        m = SEMI[nm] + 12 * (octv + 1)
        while m < root: m += 12
        out.append(m)
    return out
def bass_root(ch):
    # fondamentale entre 41 et 78 Hz : assez grave pour porter, assez haute pour s'entendre
    r = CHORDS[ch][0]
    return r + ("1" if SEMI[r] >= 5 else "2")
def bars(a, z): return range(a, z + 1)

# ---------------- instruments ----------------
_cache = {}
def cached(key, fn):
    if key not in _cache: _cache[key] = fn()
    return _cache[key]

def pad(ch, d, octv=3, fc=1400):
    # nappe de cordes : dents de scie désaccordées, filtrées, attaque lente
    def make():
        n = int(d * SR); x = tt(n); s = np.zeros((n, 2))
        for m in tones(ch, octv) + [tones(ch, octv)[0] + 12]:
            for c, det in ((0, -7), (1, 7)):
                s[:, c] += saw(mfreq(m) * 2 ** (det / 1200) * (1 + .003 * np.sin(2 * np.pi * 5 * x + m)), n, rng.uniform())
        s = lowpass(s, fc, 2)
        env = np.minimum(x / .5, 1) * np.clip((d - x) / .5, 0, 1)
        return s / (np.abs(s).max() + 1e-9) * env[:, None]
    return cached(("pad", ch, round(d, 2), octv, fc), make)

def piano(name, d=3.0, vel=.8):
    # piano : trois cordes légèrement désaccordées par note, partiels inharmoniques, plus brillant quand on tape fort
    def make():
        n = int(d * SR); x = tt(n); f0 = freq(name); v = np.zeros(n)
        k_dec = (f0 / 260) ** .35
        for h in range(1, 13):
            fh = f0 * h * np.sqrt(1 + .0003 * h * h)
            a = 1 / h ** (1.5 - .6 * vel)
            for det in (-.6, 0, .6):
                v += a * np.sin(2 * np.pi * fh * 2 ** (det / 1200) * x + h) * np.exp(-x * (.8 + .55 * h) * k_dec)
        v = norm(v) + band(rng.standard_normal(n), 900, 4000) * np.exp(-x * 90) * .05 * vel   # marteau
        return norm(v) * np.minimum(x / .002, 1) * np.clip((d - x) / .25, 0, 1)
    return cached(("piano", name, round(d, 2), vel), make)

VOI = {"Fm": ("Ab3", "C4", "Eb4", "G4"), "Db": ("F3", "Ab3", "C4", "F4"), "Ab": ("C4", "Eb4", "G4", "Bb4"),
       "Eb": ("G3", "Bb3", "D4", "F4"), "Bbm": ("Db4", "F4", "Ab4", "C5"), "C": ("E3", "G3", "Bb3", "D4"),
       "F": ("A3", "C4", "E4", "G4")}                       # accords enrichis : Fm9, Db maj7, Ab add9, Eb maj9, Bbm9, C9, F maj9
BASS = {"Fm": "F1", "Db": "Db2", "Ab": "Ab1", "Eb": "Eb2", "Bbm": "Bb1", "C": "C2", "F": "F1"}

def chord(t, ch, d=1.6, vel=.6, gain=.12, spread=.012):
    # accord plaqué, très légèrement égrené de bas en haut
    for k, nm in enumerate(VOI[ch]):
        add("music", t + k * spread, piano(nm, d, vel), gain, pan=-.3 + .2 * k, rev=.4)

def kick():
    def make():
        n = int(.45 * SR); x = tt(n)
        s_ = np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-x * 30)) / SR) * np.exp(-x * 6.5)
        return norm(np.tanh(1.6 * (s_ + band(rng.standard_normal(n), 2000, 7000) * np.exp(-x * 350) * .25)))
    return cached("kick", make)

def snare():
    # caisse claire hip-hop : corps chaud, peau, un peu de pièce
    def make():
        n = int(.4 * SR); x = tt(n)
        body = np.sin(2 * np.pi * np.cumsum(185 + 40 * np.exp(-x * 50)) / SR) * np.exp(-x * 22)
        skin = band(rng.standard_normal(n), 1200, 9000) * (np.exp(-x * 20) + .25 * np.exp(-x * 7))
        return norm(np.tanh(1.3 * (body * .7 + skin)))
    return cached("snare", make)

def rim():
    def make():
        n = int(.08 * SR); x = tt(n)
        return norm(band(rng.standard_normal(n), 1500, 5000) * np.exp(-x * 120) + np.sin(2 * np.pi * 1700 * x) * np.exp(-x * 90) * .5)
    return cached("rim", make)

def shaker():
    def make():
        n = int(.06 * SR); x = tt(n)
        return norm(band(rng.standard_normal(n), 6000, 14000) * np.sin(np.pi * np.minimum(x / .06, 1)) ** 2)
    return cached("shaker", make)

def bass(name, d):
    # basse chaude : fondamentale et un peu d'octave pour qu'on l'entende sur un téléphone
    n = int(d * SR); x = tt(n); f = freq(name)
    s_ = np.sin(2 * np.pi * f * x) + .25 * np.sin(2 * np.pi * 2 * f * x) + .08 * np.sin(2 * np.pi * 3 * f * x)
    return np.tanh(1.2 * s_) * np.minimum(x / .008, 1) * np.exp(-x * .8) * np.clip((d - x) / .04, 0, 1)

def sub(name, d):
    n = int(d * SR); x = tt(n)
    return np.sin(2 * np.pi * freq(name) * x) * np.minimum(x / .01, 1) * np.clip((d - x) / .05, 0, 1)

# ---------------- bruitages épurés ----------------
def air(k):
    # souffle doux sur un texte : bande de bruit qui passe, hauteur différente à chaque fois
    d = .38; n = int(d * SR); x = tt(n); c = 700 * 1.18 ** (k % 7)
    s = norm(sweep(n, c, c * 2.6, .45) * np.sin(np.pi * x / d) ** 2)
    p = np.linspace(-.5, .5, n) * (1 if k % 2 else -1)
    return np.stack([s * np.cos((p + 1) * np.pi / 4) * 1.414, s * np.sin((p + 1) * np.pi / 4) * 1.414], 1)

def tink(name):
    # petit tuyau frappé, accordé sur la musique : partiels de cloche courts
    n = int(1.4 * SR); x = tt(n); f = freq(name)
    s = sum(a * np.sin(2 * np.pi * f * r * x + rng.uniform(0, 6)) * np.exp(-x / d) for r, a, d in ((1, 1, .6), (2.76, .45, .25), (5.4, .2, .12)))
    return norm(s * np.minimum(x / .001, 1))

def boom():
    # boom grave et propre : sub qui descend, attaque feutrée, pas de débris
    n = int(3.0 * SR); x = tt(n)
    s = np.sin(2 * np.pi * np.cumsum(52 * (31 / 52) ** np.minimum(x / 1.0, 1)) / SR) * np.exp(-x * 1.3)
    s += lowpass(rng.standard_normal(n), 400) * np.exp(-x * 14) * .35
    return norm(np.tanh(1.3 * s) * np.minimum(x / .002, 1))

def swell(d=1.2):
    # souffle inversé qui aspire vers le boom
    n = int(d * SR); x = tt(n)
    return norm(lowpass(rng.standard_normal(n), 2500) * (x / d) ** 3)

def plip():
    n = int(.3 * SR); x = tt(n)
    return norm(np.sin(2 * np.pi * np.cumsum(700 + 1300 * (1 - np.exp(-x * 60))) / SR) * np.exp(-x * 24) * np.minimum(x / .001, 1))

def bubbles(d, n, f_lo=350, f_hi=1100):
    out = np.zeros(int(d * SR))
    for _ in range(n):
        i = int(rng.uniform(0, 1) ** .6 * (len(out) - 4000)); m = int(rng.uniform(1500, 3500)); f0 = rng.uniform(f_lo, f_hi)
        x = np.arange(m) / SR
        out[i:i + m] += np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2 * x / (m / SR))) / SR) * np.exp(-x * 45) * rng.uniform(.3, 1)
    return norm(out)

def water(d=.8):
    # transition d'eau : souffle filtré qui monte et retombe, quelques bulles
    n = int(d * SR); x = tt(n); env = np.sin(np.pi * x / d) ** 1.6
    s = norm(sweep(n, 300, 1600, .6) * env + bubbles(d, 12) * .25 * env)
    return np.stack([s * np.linspace(.7, 1.1, n), s * np.linspace(1.1, .7, n)], 1)

def shimmer(d):
    # nappe aiguë qui s'ouvre doucement : trémolo de cordes lointain
    n = int(d * SR); x = tt(n); s = np.zeros(n)
    for m in tones("Fm", 5):
        s += saw(mfreq(m), n, rng.uniform()) * (.6 + .4 * np.sin(2 * np.pi * 7 * x + m))
    return norm(lowpass(s, 3500, 2)) * (x / d) ** 1.5 * np.clip((d - x) / .15, 0, 1)

def shine():
    n = int(1.6 * SR); x = tt(n)
    s = sum(a * np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * np.exp(-x / d) for f, a, d in ((2093, 1, .8), (3136, .6, .6), (4186, .4, .5)))
    return norm(s * np.minimum(x / .02, 1))

# ---------------- bruitages de cinéma, version adoucie ----------------
def pan_sweep(sig, a=-1.0, z=1.0):
    p = np.linspace(a, z, len(sig))
    return np.stack([sig * np.cos((p + 1) * np.pi / 4) * 1.414, sig * np.sin((p + 1) * np.pi / 4) * 1.414], 1)

def saber(direction=1, d=.42):
    # coup de sabre feutré : surtout le souffle de la lame, un bourdonnement léger qui monte et redescend
    n = int(d * SR); x = tt(n); e = np.sin(np.pi * x / d) ** 1.4
    ph = np.cumsum(110 * (1 + .45 * np.sin(np.pi * x / d))) / SR
    hum_ = np.tanh(1.4 * (np.sin(2 * np.pi * ph) + .5 * np.sin(2 * np.pi * 2.02 * ph)))
    s_ = norm(hum_ * e * .45 + sweep(n, 1000, 4200, .5) * e ** 2)
    return pan_sweep(s_, -.7 * direction, .7 * direction)

def flash():
    # flash d'appareil photo : petite recharge aiguë puis le déclic ; le déclic tombe à .1 s
    n = int(.45 * SR); x = tt(n); y = np.maximum(x - .1, 0); on = x >= .1
    whine = np.sin(2 * np.pi * np.cumsum(3000 + 5000 * np.minimum(x / .1, 1)) / SR) * (x < .1) * .12 * np.minimum(x / .03, 1)
    pop = (band(rng.standard_normal(n), 2500, 11000) * np.exp(-y * 140) + np.sin(2 * np.pi * 4200 * x) * np.exp(-y * 50) * .2) * on
    return norm(whine + pop)

def car(d=1.6, c=.55):
    # voiture qui passe : moteur (harmoniques), roulement des pneus et air, effet Doppler au passage, de gauche à droite
    n = int(d * SR); x = tt(n); tc = d * c; u = (x - tc) / .22
    dop = 1 + .14 * np.tanh(-u)
    f0 = 78 * dop * (1 + .05 * x / d)
    ph = np.cumsum(f0) / SR
    eng = sum(np.sin(2 * np.pi * h * ph + h) / h ** .9 * (1.3 if h % 2 else .8) for h in range(1, 12))
    tyre = norm(sweep(n, 1600, 500, .9))
    env = np.exp(-0.5 * ((x - tc) / .3) ** 2) * .9 + np.exp(-0.5 * ((x - tc) / .65) ** 2) * .3
    s_ = norm(.8 * norm(lowpass(eng, 2500)) + .6 * tyre) * env
    p = np.tanh(u * .7)
    return np.stack([s_ * np.cos((p + 1) * np.pi / 4) * 1.414, s_ * np.sin((p + 1) * np.pi / 4) * 1.414], 1)

def half_explosion(size="big"):
    # demi-explosion propre : déclic, souffle sombre, sub qui plonge, quelques débris seulement
    d = {"big": 2.2, "mid": 1.3}[size]; n = int(d * SR); x = tt(n); noise = rng.standard_normal(n)
    crack = band(noise, 900, 7000) * np.exp(-x * 80)
    body = lowpass(noise, 1200) * np.exp(-x * 7) * .5 + lowpass(noise, 220) * np.exp(-x * (2.0 if size == "big" else 3.2))
    sub_ = np.sin(2 * np.pi * np.cumsum(54 * (30 / 54) ** np.minimum(x / .8, 1)) / SR) * np.exp(-x * 2.2)
    deb = np.zeros(n)
    for _ in range(12 if size == "big" else 6):
        at = rng.exponential(.3); i = int(at * SR); m = int(rng.uniform(.004, .015) * SR)
        if i + m < n: deb[i:i + m] += rng.standard_normal(m) * rng.uniform(.1, .4) * np.exp(-at * 3)
    s_ = .7 * crack + norm(body) + 1.2 * sub_ + .3 * norm(band(deb, 1500, 7000) + 1e-9)
    return norm(np.tanh(1.4 * norm(s_)) * np.minimum(x / .001, 1))

# =============== MUSIQUE ===============
kicks = []
def k_(t, g=.85): add("drums", t, kick(), g); kicks.append(t)
def sn(t, g=.55): add("drums", t, snare(), g, rev=.22)
def at16(i, s_): return i * BAR + s_ * S16

# motifs d'accompagnement du piano (position en doubles croches, durée, nuance) : ils tournent sans se répéter à l'identique
COMP = [[(0, 1.2, .7), (6, .4, .5), (10, .9, .6)], [(0, .5, .65), (3, .5, .5), (8, 1.0, .6), (14, .3, .45)],
        [(0, 1.6, .6), (11, .5, .55)], [(2, .4, .5), (6, .9, .65), (12, .6, .5)], [(0, .8, .7), (8, .4, .5), (10, .4, .5), (13, .8, .6)]]

# ouverture (0-1) : piano seul, un accord tenu puis une note qui reste en l'air ; cordes qui montent vers le 21
chord(0, "Fm", 3.4, .5, .13, .05)
add("music", BAR + 2 * b, piano("C6", 2.0, .45), .12, rev=.7)
add("music", BAR, pad("Fm", BAR + .2, 3, 1600), .12, rev=.5)

# le 21 novembre (2-3) : grand accord, basse, cordes ; trois notes de piano pour relancer
chord(T["date"], "Fm", 3.0, .85, .17, .02)
add("bass", T["date"], sub("F1", 2.5), .45)
add("music", T["date"], pad("Fm", 2 * BAR, 3, 1800), .16, rev=.5)
for k, nm in enumerate(("Ab5", "G5", "Eb5")): add("music", 3 * BAR + (k * 3 + 4) * S16, piano(nm, 1.2, .55), .11, rev=.6)

# accroche (4-7) : le beat lourd arrive — grosse caisse et caisse claire tombent sur les coupes
for i in bars(4, 7):
    k_(at16(i, 0)); sn(at16(i, 8))
    if i % 2: k_(at16(i, 14), .55)
    for s_, d_, v_ in COMP[i % 5]: chord(at16(i, s_), PLAN[i], d_ + .3, v_, .11)
    add("bass", at16(i, 0), bass(BASS[PLAN[i]], 5 * S16), .38); add("bass", at16(i, 10), bass(BASS[PLAN[i]], 4 * S16), .3)
    if i >= 6:
        for s_ in range(0, 16, 2): add("drums", at16(i, s_), shaker(), .08 + .04 * (s_ % 4 == 0), pan=.35)

# la plomberie s'apprend (8) : le beat s'arrête, le piano monte en arpège, silence avant le titre
for k, m in enumerate([60, 63, 67, 72, 75, 79, 84]):
    add("music", at16(8, 2 * k), piano(mname(m), 1.0, .5 + .05 * k), .1, pan=-.4 + .12 * k, rev=.5)
add("music", 8 * BAR, pad("C", BAR - 2 * S16, 3, 2400), .15, rev=.4)

# titre et gestes (9-15) : groove complet, chaque mesure varie (ghosts, relances), les cordes entrent à mi-chemin
for i in bars(9, 15):
    j = i - 9
    k_(at16(i, 0)); k_(at16(i, 10), .7); sn(at16(i, 8))
    if j % 2: k_(at16(i, 3), .5)
    if j % 3 == 2: add("drums", at16(i, 13), rim(), .25, pan=-.3)
    for s_ in range(16): add("drums", at16(i, s_), shaker(), .05 + .05 * (s_ % 4 == 2), pan=.35)
    add("drums", at16(i, 6), snare(), .12, pan=.2)              # caisse claire fantôme
    for s_, d_, v_ in COMP[(i * 3) % 5]: chord(at16(i, s_), PLAN[i], d_ + .3, v_, .1)
    for s_, d_ in ((0, 6), (7, 3), (10, 6)): add("bass", at16(i, s_), bass(BASS[PLAN[i]], d_ * S16), .4)
    if i >= 12: add("music", i * BAR, pad(PLAN[i], BAR + .3, 3, 1500 + 300 * (i - 12)), .1 + .02 * (i - 12), rev=.45)
for s_ in (12, 13, 14, 15): sn(at16(15, s_), .2 + .08 * (s_ - 12))   # relance avant la salle
add("music", T["title"], piano("F6", 2.5, .6), .12, rev=.7)

# la salle (16) : break, piano seul en phrase descendante, basse tenue
for s_, nm in ((0, "C6"), (3, "Ab5"), (6, "G5"), (8, "F5"), (11, "Eb5"), (14, "C5")): add("music", at16(16, s_), piano(nm, 1.6, .55), .13, rev=.65)
chord(16 * BAR, "Db", 1.8, .45, .08)
add("bass", 16 * BAR, sub("Db2", BAR), .35)

# montée (17-19) : le beat revient par couches, les cordes gonflent, silence avant les trois mots
for i in bars(17, 19):
    j = i - 17
    k_(at16(i, 0)); sn(at16(i, 8))
    if j >= 1:
        k_(at16(i, 10), .65)
        for s_ in range(0, 16, 2 if j == 1 else 1): add("drums", at16(i, s_), shaker(), .06 + .03 * j, pan=.35)
    for s_, d_, v_ in COMP[(i * 2) % 5]: chord(at16(i, s_), PLAN[i], d_ + .3, v_ + .05 * j, .1 + .015 * j)
    add("bass", at16(i, 0), bass(BASS[PLAN[i]], 8 * S16), .4); add("bass", at16(i, 10), bass(BASS[PLAN[i]], 4 * S16), .32)
    add("music", i * BAR, pad(PLAN[i], BAR + .3, 3, 1600 + 600 * j), .12 + .04 * j, rev=.45)
for s_ in range(8, 14): sn(at16(19, s_), .12 + .06 * (s_ - 8))

# les trois mots (20-21) : un grand accord par mot — piano, cordes, basse, grosse caisse et caisse claire ensemble
for k, ch in enumerate(("Fm", "Db", "Eb")):
    t0 = T["build"] + k * 2 * b
    chord(t0, ch, 1.2, .9, .16 + .02 * k, .006)
    add("music", t0, pad(ch, 2 * b + .4, 3, 2000 + 400 * k), .18, rev=.5)
    add("bass", t0, bass(BASS[ch], 2 * b), .45); k_(t0, .9); sn(t0, .45)

# carte finale (22+) : fa majeur, accord large puis arpège qui s'éteint, cordes longues
R0 = T["reveal"]
chord(R0, "F", 4.0, .75, .16, .03)
add("music", R0, pad("F", DUR - R0, 3, 2000), .2, rev=.6)
for k, nm in enumerate(("F4", "A4", "C5", "E5", "G5", "C6")): add("music", R0 + .9 + k * b / 2, piano(nm, 2.4, .5), .1, rev=.7)
add("bass", R0, sub("F1", 3.0), .45)

# =============== BRUITAGES ===============
air_k = 0
TINKS = ["F5", "Ab5", "Bb5", "C6", "Db6"]                       # une note de plus à chaque geste
CLICKS = ["C6", "Eb6", "F6"]
STARTS = [T["hook1"], T["hook2"], T["hook3"], T["title"], T["diag"], T["pratique"]]   # mots qui ouvrent une scène
is_start = lambda t: any(abs(t - s0) < .12 for s0 in STARTS)
for cue in reel["cues"]:
    t, kind = cue[0], cue[1]
    if VAR == "epure" or kind in ("plip", "fill", "shimmer", "shine"):
        if kind == "air": add("fx", t - .2, air(air_k), .16, rev=.3)
        elif kind == "boom": add("fx", t, boom(), .85, rev=.5)
        elif kind == "tink": add("fx", t, tink(TINKS[cue[2]]), .2, pan=-.3 + .15 * cue[2], rev=.45)
        elif kind == "click": add("fx", t, tink(CLICKS[cue[2]]), .12, pan=-.3 + .3 * cue[2], rev=.35)
        elif kind == "thud": add("fx", t, boom(), .3 + .12 * cue[2], rev=.4)
        elif kind == "water": add("fx", t - .4, water(), .3, rev=.35)
        elif kind == "plip": add("fx", t, plip(), .22, rev=.5)
        elif kind == "fill": add("fx", t, bubbles(cue[2] + .4, 30), .1, rev=.4)
        elif kind == "shimmer": add("music", t, shimmer(cue[2]), .07, rev=.5)
        elif kind == "shine": add("fx", t, shine(), .1, rev=.6)
    elif VAR == "cinema":                                        # dosé : sabre sur les mots qui ouvrent une scène, flash sur les gestes
        if kind == "air":
            if is_start(t): add("fx", t - .21, saber(1 if air_k % 2 else -1), .3, rev=.3)
            else: add("fx", t - .2, air(air_k), .14, rev=.3)
        elif kind == "boom": add("fx", t, half_explosion("big"), .7, rev=.45); add("fx", t, boom(), .35, rev=.4)
        elif kind == "tink": add("fx", t - .1, flash(), .28, rev=.2); add("fx", t, tink(TINKS[cue[2]]), .12, rev=.45)
        elif kind == "click": add("fx", t, tink(CLICKS[cue[2]]), .12, pan=-.3 + .3 * cue[2], rev=.35)
        elif kind == "thud":
            add("fx", t - .21, saber(1 if cue[2] % 2 else -1), .3, rev=.3)
            add("fx", t, half_explosion("big" if cue[2] == 2 else "mid"), .32 + .1 * cue[2], rev=.4)
        elif kind == "water": add("fx", t - 1.6 * .55, car(), .45, rev=.3); add("fx", t - .4, water(), .12, rev=.35)
    else:                                                        # cinema-plus : sur chaque mot et chaque coupe, toujours adouci
        if kind == "air":
            if air_k % 2 == 0: add("fx", t - .21, saber(1 if air_k % 4 else -1), .3, rev=.3)
            else: add("fx", t - .1, flash(), .24, pan=rng.uniform(-.3, .3), rev=.2); add("fx", t - .2, air(air_k), .1, rev=.3)
        elif kind == "boom": add("fx", t, half_explosion("big"), .85, rev=.45); add("fx", t, boom(), .3, rev=.4)
        elif kind == "tink":
            add("fx", t - .1, flash(), .3, rev=.2); add("fx", t - .21, saber(1 if cue[2] % 2 else -1), .26, rev=.3)
            add("fx", t, tink(TINKS[cue[2]]), .1, rev=.45)
        elif kind == "click": add("fx", t - .1, flash(), .14, pan=-.3 + .3 * cue[2], rev=.2)
        elif kind == "thud":
            add("fx", t - .1, flash(), .3, rev=.2)
            add("fx", t, half_explosion("big" if cue[2] == 2 else "mid"), .45 + .1 * cue[2], rev=.4)
        elif kind == "water": add("fx", t - 1.6 * .55, car(), .6, rev=.3); add("fx", t - .4, water(), .15, rev=.35)
    if kind == "air": air_k += 1
for t in reel["swells"]: add("fx", t - 1.2, swell(), .18, rev=.3)
for a_, z_ in reel["risers"]:                                   # montée douce, coupée deux doubles croches avant l'impact
    n_ = int((z_ - a_ - 2 * S16) * SR)
    add("fx", a_, sweep(n_, 300, 4000, .5) * np.linspace(0, 1, n_) ** 2.5, .12, rev=.3)

# =============== MIXAGE ===============
kenv = np.zeros(N)                                              # la musique se pousse un peu sous la grosse caisse
for kt in kicks:
    i = int(kt * SR); m = min(N - i, int(.3 * SR))
    if m > 0: kenv[i:i + m] = np.maximum(kenv[i:i + m], np.exp(-np.arange(m) / (.09 * SR)))
duck = (1 - .25 * kenv)[:, None]

L = int(2.6 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .6)[:, None]; ir[: int(.02 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 5000) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

G = {"drums": 1.0, "bass": .5, "music": 2.8, "fx": 1.0}
for k, v in BUS.items():
    seg = v[int(T["title"] * SR):int(T["theorie"] * SR)]
    print(f"  {k:6s} RMS gestes : {20 * np.log10(G[k] * np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB")
mix = BUS["drums"] * G["drums"] + BUS["bass"] * G["bass"] + BUS["music"] * G["music"] * duck + BUS["fx"] * G["fx"] + wet * .45
mix = filt(mix, lambda f: 1 / np.sqrt(1 + (30 / f) ** 8))
mix = filt(mix, lambda f: np.clip((f / 250) ** .35, .5, 2.4))        # égaliseur en pente : moins de sub, plus de présence (téléphones)
mix = np.tanh(1.1 * mix / np.abs(mix).max()) / np.tanh(1.1) * 0.95    # saturation très légère
fa, fb = reel["fadeOut"]; x = tt(N)
mix *= np.clip((fb + .25 - x) / (fb + .25 - fa), 0, 1)[:, None]

with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("bande-son :", sys.argv[2], f"{DUR:.1f} s")
