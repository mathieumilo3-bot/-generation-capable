# Bande-son originale, synthétisée à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Direction : classe, dynamique, épuré (voir ../CLAUDE.md).
#  - Musique minimale en fa mineur, sans boucle : pulsation de synthé en croches qui respire avec le kick, kick doux
#    sur chaque coupe (tous les deux temps), sub, pluck en mélodie qui change de phrase à chaque section, piano en notes
#    isolées, cordes en nappe. Elle s'ouvre et se resserre par section, et laisse un silence avant chaque moment fort.
#  - Peu de bruitages, mais variés et musicaux, un par repère (« cues ») : souffle doux sur les textes, « tink » de tuyau
#    accordé sur chaque geste (une note de plus à chaque geste), clics accordés sur le diagnostic, eau sur les transitions,
#    une goutte, et un boom grave et propre réservé aux trois moments clés (21 novembre, titre, carte finale).
#
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

def pulse_note(m, fc):
    # pulsation de synthé : note courte, filtrée, légèrement creuse
    def make():
        n = int(b / 2 * SR); x = tt(n); f = mfreq(m)
        s = saw(f, n) * .7 + saw(f * 1.004, n, .3) * .5 + np.sign(np.sin(2 * np.pi * f / 2 * x)) * .25
        return norm(lowpass(s, fc, 2)) * np.minimum(x / .003, 1) * np.exp(-x * 9)
    return cached(("pulse", m, int(fc / 50)), make)

def pulse(i, fc, gain, octv=3):
    tn = tones(PLAN[i], octv)
    seq = [tn[0], tn[0] + 12, tn[2], tn[0] + 12, tn[1], tn[0] + 12, tn[2], tn[1]]
    for k in range(8):
        add("music", i * BAR + k * b / 2, pulse_note(seq[k], fc), gain * (1 if k % 2 == 0 else .75), pan=(-.25 if k % 2 else .25), rev=.2)

def ks(f, d=1.4, k=0.996, bright=.55):
    # corde pincée (Karplus-Strong) : le « pluck » de la mélodie
    def make():
        n = int(d * SR); P = int(round(SR / f)); buf = rng.uniform(-1, 1, P).tolist(); out = np.empty(n)
        for i in range(n):
            j = i % P; v = buf[j]; out[i] = v; buf[j] = k * (bright * v + (1 - bright) * buf[(j + 1) % P])
        return norm(out)
    return cached(("ks", round(f, 2), d), make)
def pluck(name): return ks(freq(name))

def piano(name, d=3.0):
    def make():
        n = int(d * SR); x = tt(n); f0 = freq(name)
        v = sum(np.sin(2 * np.pi * f0 * h * (1 + .0004 * h * h) * x) * np.exp(-x * (1.2 + h * .9)) / h ** 1.1 for h in range(1, 9))
        return norm(v) * np.minimum(x / .003, 1) * np.clip((d - x) / .3, 0, 1)
    return cached(("piano", name, d), make)

def kick():
    def make():
        n = int(.35 * SR); x = tt(n)
        s = np.sin(2 * np.pi * np.cumsum(46 + 90 * np.exp(-x * 38)) / SR) * np.exp(-x * 9)
        return norm(s + band(rng.standard_normal(n), 1500, 6000) * np.exp(-x * 400) * .15)
    return cached("kick", make)

def snap():
    def make():
        n = int(.25 * SR); x = tt(n)
        return norm(band(rng.standard_normal(n), 1200, 7000) * (np.exp(-x * 45) + .3 * np.exp(-x * 12)))
    return cached("snap", make)

def hat(open_=False):
    def make():
        n = int((.18 if open_ else .04) * SR); x = tt(n)
        return norm(band(rng.standard_normal(n), 8000, 16000) * np.exp(-x / (.05 if open_ else .008)))
    return cached(("hat", open_), make)

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
def kick_at(t, g=.8):
    add("drums", t, kick(), g); kicks.append(t)
def groove(i, kick_=True, hats=True, snap_=True, extra=False):
    t0 = i * BAR
    if kick_:
        for s_ in ((0, 8, 11) if extra else (0, 8)): kick_at(t0 + s_ * S16, .5 if s_ == 11 else .8)
        add("bass", t0, sub(bass_root(PLAN[i]), BAR - .05), .5)
    if snap_: add("drums", t0 + 12 * S16, snap(), .35, rev=.25)
    if hats:
        for k in range(8): add("drums", t0 + k * b / 2, hat(), .1 + .05 * (k % 2 == 0), pan=.3)
        add("drums", t0 + 14 * S16, hat(True), .08, pan=-.3)

# mélodies de pluck : une phrase par section, jamais la même
MEL = {
    4: [(0, "C5"), (6, "Ab4"), (8, "F4")], 5: [(0, "Db5"), (6, "F5"), (8, "Ab4")],
    6: [(0, "C5"), (6, "Eb5"), (8, "Ab4")], 7: [(0, "Db5"), (6, "F5"), (8, "Bb4"), (12, "Db5")],
    9: [(0, "F5"), (3, "Ab5"), (6, "C6"), (10, "Ab5")], 10: [(0, "G5"), (3, "F5"), (6, "Eb5"), (10, "C5")],
    11: [(0, "F5"), (3, "Ab5"), (6, "Db6"), (10, "C6")], 12: [(0, "Eb6"), (3, "C6"), (6, "Ab5"), (10, "Eb5")],
    13: [(0, "Bb5"), (3, "G5"), (6, "Eb5"), (10, "G5")], 14: [(0, "F5"), (3, "Bb5"), (6, "Db6"), (10, "F6")],
    15: [(0, "E6"), (3, "C6"), (6, "G5"), (10, "E5")],
    17: [(0, "F5"), (6, "Db5"), (8, "Bb4")], 18: [(0, "G5"), (6, "E5"), (8, "C5"), (12, "E5")],
    19: [(0, "Ab5"), (3, "F5"), (6, "Db5"), (8, "Ab5"), (11, "F5"), (14, "Db6")],
}
for i, notes in MEL.items():
    for s_, nm in notes:
        add("music", i * BAR + s_ * S16, pluck(nm), .22, pan=-.15, rev=.35)
        add("music", i * BAR + (s_ + 3) * S16, pluck(nm), .06, pan=.45, rev=.4)          # écho

# ouverture (0-1) : piano en notes isolées, nappe grave qui monte
for at, nm in ((0, "F5"), (2 * b, "C5"), (4 * b, "Ab4"), (BAR + 2 * b, "Db5")): add("music", at, piano(nm, 2.6), .2, rev=.65)
add("music", 0, pad("Fm", 2 * BAR, 2, 700), .16, rev=.4)

# le 21 novembre (2-3) : nappe, piano, la pulsation entre filtrée
add("music", T["date"], pad("Fm", 2 * BAR + .3, 3, 1500), .22, rev=.45)
add("music", T["date"] + .1, piano("C6", 3.0), .16, rev=.7)
pulse(3, 700, .12)

# accroche (4-8) : kick sur chaque coupe, la pulsation s'ouvre, le pluck chante
for i in bars(4, 7):
    pulse(i, 900 + 350 * (i - 4), .16)
    groove(i, hats=i >= 6, snap_=i >= 6)
    add("music", i * BAR, pad(PLAN[i], BAR + .3, 3, 1200), .12, rev=.4)
pulse(8, 2200, .18); add("music", 8 * BAR, pad("C", BAR, 3, 2000), .16, rev=.4)
for k in range(8): add("drums", 8 * BAR + k * b / 2, hat(), .06 + .02 * k, pan=.3)

# titre et gestes (9-15) : tout le groove, la mélodie monte d'un geste à l'autre
for i in bars(9, 15):
    pulse(i, 3000, .17)
    groove(i, extra=i >= 12)
    add("music", i * BAR, pad(PLAN[i], BAR + .3, 3, 1800), .13, rev=.4)
add("music", T["title"], piano("F6", 2.5), .14, rev=.7)

# la salle (16) : respiration — pas de batterie, piano et nappe
pulse(16, 1100, .12)
add("music", 16 * BAR, pad("Db", BAR + .4, 3, 1300), .2, rev=.55)
for at, nm in ((0, "F5"), (2 * b, "Ab5")): add("music", 16 * BAR + at, piano(nm, 2.2), .16, rev=.7)

# montée (17-19) : le kick revient, la pulsation s'éclaircit, les charleys se resserrent
for i in bars(17, 19):
    j = i - 17
    pulse(i, 1800 + 900 * j, .16 + .02 * j)
    groove(i, extra=j == 2)
    add("music", i * BAR, pad(PLAN[i], BAR + .3, 3, 1500 + 500 * j), .13 + .03 * j, rev=.4)
for k in range(16): add("drums", 19 * BAR + k * S16, hat(), .05 + .006 * k, pan=-.2)

# les trois mots (20-21) : la musique se pose sous chaque mot
for k, ch in enumerate(("Fm", "Db", "Eb")):
    t0 = T["build"] + k * 2 * b
    add("music", t0, pad(ch, 2 * b + .4, 3, 1600 + 400 * k), .2, rev=.5)
    for m in tones(ch, 4): add("music", t0, piano(mname(m), 1.6), .1, rev=.6)

# carte finale (22+) : fa majeur, piano en arpège, nappe longue
R0 = T["reveal"]
add("music", R0, pad("F", DUR - R0, 3, 1800), .24, rev=.6)
for k, nm in enumerate(("F4", "A4", "C5", "F5", "A5")): add("music", R0 + .2 + k * b, piano(nm, 3.0), .15, rev=.7)
add("bass", R0, sub("F1", 3.0), .5)

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
kenv = np.zeros(N)                                              # la pulsation respire avec le kick
for kt in kicks:
    i = int(kt * SR); m = min(N - i, int(.3 * SR))
    if m > 0: kenv[i:i + m] = np.maximum(kenv[i:i + m], np.exp(-np.arange(m) / (.09 * SR)))
duck = (1 - .4 * kenv)[:, None]

L = int(2.6 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .6)[:, None]; ir[: int(.02 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 5000) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

G = {"drums": 1.0, "bass": .28, "music": 2.8, "fx": 1.0}
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
