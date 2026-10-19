# Bande-son originale, synthétisée à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Direction : classe, dynamique, épuré (voir ../CLAUDE.md) — ici en version tension et graves.
# Règle de mixage : un seul son à la fois par-dessus un lit grave, jamais d'embouteillage.
#  - Lit de tension : nappe grave qui change d'accord à chaque scène (elle s'efface sur la salle, remplacée par des
#    cordes aiguës), « dum » grave sur chaque coupe, horloge à l'ouverture, montées coupées net avant chaque impact,
#    son de Shepard dans la dernière montée, cuivres graves (BRAAAM) sur le 21 novembre et le titre, fa majeur au final.
#  - Bruitages propres et espacés : souffle de sabre sur les mots, avion qui passe sur les trois transitions d'eau
#    (seul, rien par-dessus), coup de tuyau grave et accordé sur chaque geste, impact grave et propre sur les moments
#    clés, une goutte avant le titre et la carte finale.
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
BUS = {k: np.zeros((N, 2)) for k in ("bed", "pulse", "fx")}
send = np.zeros((N, 2))
rng = np.random.default_rng(2111)

SEMI = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
def freq(name): return 440 * 2 ** ((SEMI[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)
def mfreq(m): return 440 * 2 ** ((m - 69) / 12)
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

def pan_lr(sig, p):
    return np.stack([sig * np.cos((p + 1) * np.pi / 4) * 1.414, sig * np.sin((p + 1) * np.pi / 4) * 1.414], 1)

# ---------------- harmonie : un accord par mesure ----------------
CHORDS = {"Fm": ("F", "Ab", "C"), "Db": ("Db", "F", "Ab"), "Ab": ("Ab", "C", "Eb"), "Eb": ("Eb", "G", "Bb"),
          "Bbm": ("Bb", "Db", "F"), "C": ("C", "E", "G"), "F": ("F", "A", "C")}
PLAN = ["Fm"] * 4 + ["Fm", "Db", "Ab", "Bbm", "C",        # 0-3 : ouverture, 21 novembre ; 4-8 : accroche
        "Fm", "Fm", "Db", "Ab", "Eb", "Bbm", "C",          # 9-15 : titre, gestes
        "Db",                                              # 16 : la salle
        "Bbm", "C", "Db",                                  # 17-19 : montée
        "Fm", "Eb",                                        # 20-21 : les trois mots
        "F", "F", "F", "F"]                                # 22+ : fa majeur
def tones(ch, octv):
    root = SEMI[CHORDS[ch][0]] + 12 * (octv + 1); out = []
    for nm in CHORDS[ch]:
        m = SEMI[nm] + 12 * (octv + 1)
        while m < root: m += 12
        out.append(m)
    return out
def low_root(ch):
    # fondamentale grave entre 41 et 78 Hz
    r = CHORDS[ch][0]; return SEMI[r] + 12 * (2 if SEMI[r] >= 5 else 3)
def bars(a, z): return range(a, z + 1)

# ---------------- lit de tension ----------------
def drone(ch, d, fc=220, bright=0.0):
    # nappe grave : fondamentale, octave et quinte en dents de scie désaccordées, filtre qui respire lentement
    n = int(d * SR); x = tt(n); r = low_root(ch); s = np.zeros((n, 2))
    for m, a in ((r, 1.0), (r + 12, .6), (r + 19, .35)):
        for c, det in ((0, -6), (1, 6)):
            s[:, c] += a * saw(mfreq(m) * 2 ** (det / 1200), n, rng.uniform())
    lfo = .5 + .5 * np.sin(2 * np.pi * .35 * x)
    out = lowpass(s, fc) * (1 - .4 * lfo[:, None]) + lowpass(s, fc * (2.2 + 3 * bright)) * (.4 * lfo[:, None])
    env = np.minimum(x / .35, 1) * np.clip((d - x) / .35, 0, 1)
    return out / (np.abs(out).max() + 1e-9) * env[:, None]

def strings_high(ch, d):
    # cordes aiguës en trémolo léger : la texture de la salle, à la place de la nappe grave
    n = int(d * SR); x = tt(n); s = np.zeros((n, 2))
    for k, m in enumerate(tones(ch, 5)):
        for c, det in ((0, -5), (1, 5)):
            s[:, c] += saw(mfreq(m) * 2 ** (det / 1200), n, rng.uniform()) * (.65 + .35 * np.sin(2 * np.pi * (9 + k) * x + k))
    s = lowpass(s, 3200, 2)
    env = np.minimum(x / .4, 1) * np.clip((d - x) / .4, 0, 1)
    return s / (np.abs(s).max() + 1e-9) * env[:, None]

def braam(ch, d=3.0):
    # cuivres graves : le filtre s'ouvre d'un coup puis se referme
    n = int(d * SR); x = tt(n); s = np.zeros(n); r = low_root(ch)
    for m in (r, r + 12, r + 19, tones(ch, 3)[1]):
        for det in (-9, -3, 3, 9): s += saw(mfreq(m) * 2 ** (det / 1200), n, rng.uniform())
    e = np.minimum(x / .08, 1) * np.exp(-np.maximum(x - .08, 0) * 1.8)
    out = lowpass(s, 220) * (1 - e) + lowpass(s, 1500) * e
    return norm(np.tanh(1.6 * norm(out)) * np.minimum(x / .03, 1) * np.clip((d - x) / .7, 0, 1))

def dum(g=1.0):
    # « dum » grave sur les coupes : sub qui plonge, attaque feutrée
    n = int(.6 * SR); x = tt(n)
    s = np.sin(2 * np.pi * np.cumsum(44 + 50 * np.exp(-x * 25)) / SR) * np.exp(-x * 7)
    return norm(s + lowpass(rng.standard_normal(n), 600) * np.exp(-x * 60) * .2)
DUM = dum()

def clock(hi=True):
    n = int(.04 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 2500 if hi else 1200, 7000 if hi else 4000) * np.exp(-x * 280))

def shepard(d):
    # montée de Shepard : l'oreille croit que ça monte sans fin
    n = int(d * SR); x = tt(n); out = np.zeros(n)
    for k in range(7):
        pos = (k + 1.6 * x / d) % 7
        out += np.exp(-0.5 * ((pos - 3.5) / 1.3) ** 2) * np.sin(2 * np.pi * np.cumsum(35 * 2 ** pos) / SR)
    return norm(out) * np.minimum(x / (d * .4), 1)

def riser(d):
    n = int(d * SR); x = tt(n); p = x / d
    return norm(sweep(n, 120, 3000, .5) * p ** 2.5)

# ---------------- bruitages propres ----------------
def saber(direction=1, d=.45):
    # souffle de sabre : la lame passe, un bourdonnement grave qui monte et redescend, très peu de grésillement
    n = int(d * SR); x = tt(n); e = np.sin(np.pi * x / d) ** 1.4
    ph = np.cumsum(95 * (1 + .45 * np.sin(np.pi * x / d))) / SR
    hum = np.tanh(1.3 * (np.sin(2 * np.pi * ph) + .45 * np.sin(2 * np.pi * 2.01 * ph)))
    s = norm(hum * e * .6 + sweep(n, 700, 3200, .5) * e ** 2)
    return pan_lr(s, np.linspace(-.7, .7, n) * direction)

def jet(d=1.9, c=.55):
    # avion qui passe : grondement qui arrive, effet Doppler au passage, puis s'éloigne de l'autre côté
    n = int(d * SR); x = tt(n); tc = d * c; u = (x - tc) / .28
    dop = 1 + .25 * np.tanh(-u)
    roar = norm(sweep(n, 1600, 300, .8)) + .6 * norm(lowpass(rng.standard_normal(n), 160))
    whine = np.sin(2 * np.pi * np.cumsum(1300 * dop) / SR) * .08
    env = np.exp(-0.5 * ((x - tc) / .35) ** 2) * .85 + np.exp(-0.5 * ((x - tc) / .75) ** 2) * .3
    return pan_lr(norm(roar + whine) * env, np.tanh(u * .7))

def dong(name):
    # coup de tuyau grave et accordé : partiels de métal longs
    n = int(2.0 * SR); x = tt(n); f = freq(name)
    s = sum(a * np.sin(2 * np.pi * f * r * x + rng.uniform(0, 6)) * np.exp(-x / d) for r, a, d in ((1, 1, 1.2), (2.42, .5, .6), (3.9, .25, .35), (5.6, .12, .2)))
    return norm(s * np.minimum(x / .002, 1) + band(rng.standard_normal(n), 1500, 6000) * np.exp(-x * 120) * .15)

def impact(g=1.0, d=3.0):
    # impact grave et propre : sub qui descend, attaque feutrée, longue traîne dans la réverbération
    n = int(d * SR); x = tt(n)
    s = np.sin(2 * np.pi * np.cumsum(55 * (30 / 55) ** np.minimum(x / 1.0, 1)) / SR) * np.exp(-x * 1.2)
    s += lowpass(rng.standard_normal(n), 500) * np.exp(-x * 12) * .4
    return norm(np.tanh(1.4 * s) * np.minimum(x / .002, 1))

def swell(d=1.2):
    n = int(d * SR); x = tt(n)
    return norm(lowpass(rng.standard_normal(n), 2000) * (x / d) ** 3)

def plip():
    n = int(.3 * SR); x = tt(n)
    return norm(np.sin(2 * np.pi * np.cumsum(650 + 1200 * (1 - np.exp(-x * 60))) / SR) * np.exp(-x * 24) * np.minimum(x / .001, 1))

def bubbles(d, n):
    out = np.zeros(int(d * SR))
    for _ in range(n):
        i = int(rng.uniform(0, 1) ** .6 * (len(out) - 4000)); m = int(rng.uniform(1500, 3500)); f0 = rng.uniform(300, 900)
        x = np.arange(m) / SR
        out[i:i + m] += np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2 * x / (m / SR))) / SR) * np.exp(-x * 45) * rng.uniform(.3, 1)
    return norm(out)

# =============== LIT DE TENSION ===============
def bed(i, nbars=1, fc=220, gain=.3, bright=0.0):
    add("bed", i * BAR - .1, drone(PLAN[i], nbars * BAR + .4, fc, bright), gain, rev=.25)
cuts = []
def d_(t, g=.7): add("pulse", t, DUM, g); cuts.append(t)

# ouverture (0-1) : nappe grave qui monte, horloge, montée coupée net
bed(0, 2, 160, .26)
for k in range(8): add("fx", k * b, clock(k % 2 == 0), .1 - .01 * (k % 2), pan=.3 if k % 2 else -.3, rev=.15)

# le 21 novembre (2-3) : cuivres graves, la nappe s'éclaircit, deux « dum » comme un cœur
add("bed", T["date"], braam("Fm", 3.2), .5, rev=.4)
bed(2, 2, 260, .3)
for k in (2, 6): d_(3 * BAR + k * b, .5)

# accroche (4-7) : un « dum » sur chaque coupe, la nappe change d'accord à chaque mesure
for i in bars(4, 7):
    bed(i, 1, 240 + 40 * (i - 4), .3)
    d_(i * BAR); d_(i * BAR + 2 * b, .55)

# la plomberie s'apprend (8) : nappe de dominante qui s'ouvre, horloge en doubles croches, silence avant le titre
bed(8, 1, 300, .3, bright=.6)
for k in range(14): add("fx", 8 * BAR + k * S16, clock(k % 2 == 0), .05 + .006 * k, pan=-.3 + .05 * k, rev=.1)

# titre et gestes (9-15) : cuivres graves, puis un « dum » par temps fort
add("bed", T["title"], braam("Fm", 3.0), .45, rev=.4)
for i in bars(9, 15):
    bed(i, 1, 280 + 30 * (i - 9), .28)
    d_(i * BAR); d_(i * BAR + 2 * b, .5)
    if i >= 12: d_(i * BAR + 3 * b, .35)

# la salle (16) : la nappe grave s'efface, cordes aiguës en trémolo
add("bed", 16 * BAR - .05, strings_high("Db", BAR + .4), .14, rev=.5)

# montée (17-19) : nappe de plus en plus claire, « dum » qui s'accélèrent, Shepard, silence avant les trois mots
for i in bars(17, 19):
    j = i - 17
    bed(i, 1, 260 + 120 * j, .3 + .03 * j, bright=.3 * j)
    step = (2 * b, b, b / 2)[j]
    t_ = i * BAR
    while t_ < (i + 1) * BAR - (2 * S16 if j == 2 else 0) - 1e-6:
        d_(t_, .4 + .1 * j); t_ += step
add("bed", 18 * BAR, shepard(2 * BAR - 2 * S16), .12, rev=.3)

# les trois mots (20-21) : un impact grave par mot, la nappe se tait entre les coups
for k, ch in enumerate(("Fm", "Db", "Eb")):
    t0 = T["build"] + k * 2 * b
    add("bed", t0, braam(ch, 2 * b + .6), .3 + .06 * k, rev=.4)

# carte finale (22+) : fa majeur, cuivres graves qui s'ouvrent, cordes aiguës, longue traîne
R0 = T["reveal"]
add("bed", R0, braam("F", 4.5), .45, rev=.55)
add("bed", R0 + .3, strings_high("F", DUR - R0 - .3), .1, rev=.6)

# =============== BRUITAGES : un à la fois ===============
G_ = ("coupe", "sertir", "racc", "etanch", "monter")
WIPES = reel["wipes"]
busy = lambda t: any(abs(t - w) < .5 for w in WIPES)              # rien par-dessus l'avion
DONGS = ["F3", "Ab3", "Bb3", "C4", "Db4"]                          # le tuyau monte d'une note à chaque geste
sab_k = 0
for cue in reel["cues"]:
    t, kind = cue[0], cue[1]
    if kind == "air":
        if busy(t) or abs(t - T["date"] - .3) < .1: continue         # l'avion ou l'impact suffit à ce moment-là
        add("fx", t - .23, saber(1 if sab_k % 2 else -1), .32, rev=.3); sab_k += 1
    elif kind == "water": add("fx", t - 1.9 * .55, jet(), .5, rev=.3)
    elif kind == "tink": add("fx", t, dong(DONGS[cue[2]]), .28, pan=-.2 + .1 * cue[2], rev=.45)
    elif kind == "boom": add("fx", t, impact(), .85, rev=.5)
    elif kind == "thud": add("fx", t, impact(), .45 + .15 * cue[2], rev=.45); add("fx", t - .23, saber(1 if cue[2] % 2 else -1), .25, rev=.3)
    elif kind == "click": add("fx", t, dong(["C5", "Eb5", "F5"][cue[2]]), .1, pan=-.3 + .3 * cue[2], rev=.35)
    elif kind == "plip": add("fx", t, plip(), .2, rev=.5)
    elif kind == "fill": add("fx", t, bubbles(cue[2] + .4, 25), .08, rev=.4)
    elif kind == "shine": add("fx", t, dong("F6"), .06, rev=.6)
for t in reel["swells"]: add("fx", t - 1.2, swell(), .16, rev=.3)
for a_, z_ in reel["risers"]:                                      # montée coupée net deux doubles croches avant l'impact
    add("fx", a_, riser(z_ - a_ - 2 * S16), .14, rev=.3)

# =============== MIXAGE ===============
cenv = np.zeros(N)                                                  # la nappe se pousse sous chaque « dum »
for ct in cuts:
    i = int(ct * SR); m = min(N - i, int(.4 * SR))
    if m > 0: cenv[i:i + m] = np.maximum(cenv[i:i + m], np.exp(-np.arange(m) / (.12 * SR)))
duck = (1 - .3 * cenv)[:, None]

L = int(2.8 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .7)[:, None]; ir[: int(.02 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 4500) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

G = {"bed": 1.0, "pulse": .7, "fx": 1.0}
for k, v in BUS.items():
    seg = v[int(T["title"] * SR):int(T["theorie"] * SR)]
    print(f"  {k:6s} RMS gestes : {20 * np.log10(G[k] * np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB")
mix = BUS["bed"] * G["bed"] * duck + BUS["pulse"] * G["pulse"] + BUS["fx"] * G["fx"] + wet * .45
mix = filt(mix, lambda f: 1 / np.sqrt(1 + (28 / f) ** 8))
mix = filt(mix, lambda f: np.clip((f / 250) ** .3, .55, 2.2))       # égaliseur en pente : les graves restent, la présence passe sur téléphone
mix = np.tanh(1.1 * mix / np.abs(mix).max()) / np.tanh(1.1) * 0.95
fa, fb = reel["fadeOut"]; x = tt(N)
mix *= np.clip((fb + .25 - x) / (fb + .25 - fa), 0, 1)[:, None]

with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("bande-son :", sys.argv[2], f"{DUR:.1f} s")
