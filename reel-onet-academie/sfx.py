# Musique originale + bruitages, synthétisés à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Musique de bande-annonce cinématique en fa mineur, construite en actes et sans boucle : chaque mesure a son accord,
# l'ostinato de cordes monte en registre et en densité, les percussions changent de motif, la tension grimpe jusqu'aux
# trois coups finaux et à la résolution en fa majeur. Instruments : nappe grave, horloge, battement de cœur, piano,
# cordes (ostinato, tenues, trémolo), cuivres (BRAAAM, mélodie héroïque), chœurs, taikos, caisse claire militaire,
# son de Shepard (montée sans fin). Par-dessus : habillage cinéma (impacts, souffles sur chaque texte, tics) et sons
# de plomberie (coups de tuyau, gouttes, chasses d'eau, bulles).
#
# Mesures (140 bpm, 1 mesure = 1,71 s) : 0-1 ouverture « Rendez-vous le », 2-3 impact du 21 novembre, 4-9 acte I
# (accroche, la plomberie s'apprend), 10-16 acte II (titre, gestes), 17-18 respiration (la salle), 19-22 acte III
# (montée), 23-25 les trois coups, 26+ final.
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
rng = np.random.default_rng(2611)

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

# ---------------- harmonie : un accord par mesure, jamais la même boucle ----------------
CHORDS = {"Fm": ("F", "Ab", "C"), "Db": ("Db", "F", "Ab"), "Ab": ("Ab", "C", "Eb"), "Eb": ("Eb", "G", "Bb"),
          "Bbm": ("Bb", "Db", "F"), "C": ("C", "E", "G"), "F": ("F", "A", "C")}
PLAN = ["Fm"] * 6 + ["Db", "Db", "Bbm", "C",              # 0-9 : ouverture, impact, acte I
        "Fm", "Fm", "Db", "Ab", "Eb", "Bbm", "C",          # 10-16 : acte II
        "Db", "C",                                         # 17-18 : respiration
        "Bbm", "C", "Db", "Eb",                            # 19-22 : acte III, la basse monte
        "Fm", "Db", "Eb",                                  # 23-25 : les trois coups
        "F", "F", "F", "F"]                                # 26+ : résolution en fa majeur
def tones(ch, octv):
    # notes de l'accord en midi, empilées au-dessus de la fondamentale
    root = SEMI[CHORDS[ch][0]] + 12 * (octv + 1); out = []
    for nm in CHORDS[ch]:
        m = SEMI[nm] + 12 * (octv + 1)
        while m < root: m += 12
        out.append(m)
    return out

# ---------------- cordes ----------------
_str = {}
def string_note(m, d, fc, spic=True):
    key = (m, round(d, 3), int(fc / 50), spic)
    if key not in _str:
        n = int(d * SR); x = tt(n); f = mfreq(m)
        s = sum(saw(f * 2 ** (det / 1200) * (1 + .003 * np.sin(2 * np.pi * 5.5 * x + k)), n, rng.uniform()) for k, det in enumerate((-9, 0, 9)))
        s = lowpass(s, fc, 2)
        env = np.minimum(x / .004, 1) * np.exp(-x * 13) if spic else np.minimum(x / .3, 1) * np.clip((d - x) / .35, 0, 1)
        _str[key] = norm(s) * env
    return _str[key]

def ostinato(bar_i, octv, fc, gain, density=16, pan=0.0):
    # doubles croches en notes de l'accord, accent sur les temps ; motif qui change d'une mesure à l'autre
    tn = tones(PLAN[bar_i], octv); tn = tn + [tn[0] + 12]
    pats = [[0, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 2, 1, 2], [0, 2, 1, 2, 0, 2, 3, 2, 0, 2, 1, 2, 3, 1, 2, 3],
            [0, 0, 1, 0, 2, 0, 1, 0, 3, 0, 2, 0, 1, 2, 3, 2], [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 0]]
    pat = pats[bar_i % 4]; step = 16 // density
    for s in range(0, 16, step):
        add("music", bar_i * BAR + s * S16, string_note(tn[pat[s]], S16 * step + .05, fc), gain * (1 if s % 4 == 0 else .7), pan=pan, rev=.25)

def strings_hold(bar_i, nbars, octv, fc, gain, rev=.45):
    for m in tones(PLAN[bar_i], octv):
        add("music", bar_i * BAR, string_note(m, nbars * BAR + .3, fc, spic=False), gain, pan=rng.uniform(-.4, .4), rev=rev)

def tremolo(m, d, gain, at):
    n = int(d * SR); x = tt(n)
    add("music", at, string_note(m, d, 4000, spic=False)[:n] * (.6 + .4 * np.sin(2 * np.pi * 12 * x)), gain, pan=rng.uniform(-.5, .5), rev=.5)

# ---------------- cuivres, chœurs, piano ----------------
def brass(m, d, bright=2200):
    n = int(d * SR); x = tt(n); f = mfreq(m); s = np.zeros(n)
    for det in (-7, 0, 7): s += saw(f * 2 ** (det / 1200), n, rng.uniform())
    s += .6 * saw(f / 2, n, rng.uniform())
    e = np.minimum(x / .45, 1)
    out = lowpass(s, 380) * (1 - e) + lowpass(s, bright) * e
    return norm(np.tanh(1.6 * norm(out))) * np.minimum(x / .05, 1) * np.clip((d - x) / .4, 0, 1)

def braam(ch, d=2.8, octv=1):
    # « BRAAAM » : pile de dents de scie graves, filtre qui s'ouvre d'un coup puis se referme, saturation
    n = int(d * SR); x = tt(n); s = np.zeros(n)
    tn = tones(ch, octv)
    for m in tn + [tn[0] + 12, tn[0] - 12]:
        for det in (-11, -4, 4, 11): s += saw(mfreq(m) * 2 ** (det / 1200), n, rng.uniform())
    e = np.minimum(x / 0.06, 1) * np.exp(-np.maximum(x - .06, 0) * 2.2)
    out = lowpass(s, 260) * (1 - e) + lowpass(s, 2600) * e
    return norm(np.tanh(2.2 * norm(out)) * np.minimum(x / 0.02, 1) * np.clip((d - x) / 0.6, 0, 1))

def choir(ch, d, octv=4):
    n = int(d * SR); x = tt(n); s = np.zeros((n, 2)); tn = tones(ch, octv)
    for k, m in enumerate(tn + [tn[0] + 12]):
        for c, det in ((0, -6), (1, 6)):
            s[:, c] += saw(mfreq(m) * 2 ** (det / 1200) * (1 + .005 * np.sin(2 * np.pi * (5 + k * .3) * x)), n, rng.uniform())
    form = lambda f: sum(a * np.exp(-0.5 * ((f - c) / w) ** 2) for c, w, a in ((800, 110, 1), (1150, 130, .6), (2900, 250, .25)))
    s = filt(s, form)
    env = np.minimum(x / 0.5, 1) * np.clip((d - x) / 0.6, 0, 1)
    return s / (np.abs(s).max() + 1e-9) * env[:, None]

def piano(name, d=3.0):
    n = int(d * SR); x = tt(n); f0 = freq(name)
    v = sum(np.sin(2 * np.pi * f0 * h * (1 + .0004 * h * h) * x) * np.exp(-x * (1.2 + h * .9)) / h ** 1.1 for h in range(1, 9))
    return norm(v) * np.minimum(x / .003, 1) * np.clip((d - x) / .3, 0, 1)

# ---------------- percussions de bande-annonce ----------------
def taiko(size):
    d = {"big": 2.0, "mid": 1.0, "small": .5}[size]; n = int(d * SR); x = tt(n)
    base = {"big": 48, "mid": 70, "small": 110}[size]
    s = np.sin(2 * np.pi * np.cumsum(base + 40 * np.exp(-x * 10)) / SR) * np.exp(-x * {"big": 2.2, "mid": 4.5, "small": 9}[size])
    s += band(rng.standard_normal(n), 120, 1600) * np.exp(-x * 30) * .7
    return norm(np.tanh(1.5 * s) * np.minimum(x / .0015, 1))
TK = {k: taiko(k) for k in ("big", "mid", "small")}

def msnare():
    n = int(.25 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 1500, 10000) * np.exp(-x * 30) + np.sin(2 * np.pi * 220 * x) * np.exp(-x * 45) * .6)
SN = msnare()

def crash():
    n = int(2.4 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 3500, 16000) * np.exp(-x / 0.7) * np.minimum(x / 0.002, 1))

def heartbeat():
    n = int(.6 * SR); x = tt(n)
    def thump(d, a):
        y = np.maximum(x - d, 0)
        return np.sin(2 * np.pi * np.cumsum(55 + 30 * np.exp(-y * 30)) / SR) * np.exp(-y * 16) * (x >= d) * a
    return norm(thump(0, 1) + thump(.19, .7))

def clock(hi=True):
    n = int(.05 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 2000 if hi else 900, 7000 if hi else 3500) * np.exp(-x * 260)
                + np.sin(2 * np.pi * (2400 if hi else 1300) * x) * np.exp(-x * 150) * .4)

def shepard(d):
    # montée de Shepard : glissandos d'octaves superposés, l'oreille croit que ça monte sans fin
    n = int(d * SR); x = tt(n); out = np.zeros(n)
    for k in range(7):
        pos = (k + 2.0 * x / d) % 7
        out += np.exp(-0.5 * ((pos - 3.5) / 1.3) ** 2) * np.sin(2 * np.pi * np.cumsum(35 * 2 ** pos) / SR)
    return norm(out) * np.minimum(x / (d * .4), 1)

# ---------------- bruitages cinéma ----------------
def impact(size):
    d = {"big": 3.0, "mid": 1.6, "small": .8}[size]; n = int(d * SR); x = tt(n)
    sub = np.sin(2 * np.pi * np.cumsum(62 * (28 / 62) ** np.minimum(x / 1.2, 1)) / SR) * np.exp(-x * {"big": 1.2, "mid": 2.6, "small": 5.5}[size])
    body = np.sin(2 * np.pi * np.cumsum(105 + 95 * np.exp(-x * 25)) / SR) * np.exp(-x * 9)
    crack = band(rng.standard_normal(n), 1500, 9000) * np.exp(-x * 70)
    ring = sum(a * np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * np.exp(-x / dd) for f, a, dd in ((311, .5, .9), (743, .35, .6), (1290, .25, .4)))
    s_ = 1.1 * sub + .8 * body + .7 * crack + (.1 if size == "small" else .25) * ring
    return norm(np.tanh(1.6 * s_) * np.minimum(x / 0.001, 1))

def swish(d=.3):
    n = int(d * SR); x = tt(n)
    s_ = norm(sweep(n, 1500, 7000, .5) * (x / d) ** 1.5 * np.exp(-np.maximum(x - d * .8, 0) * 40))
    return np.stack([s_ * np.linspace(1.3, .3, n), s_ * np.linspace(.3, 1.3, n)], 1)

def tick():
    n = int(.04 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 2500, 9000) * np.exp(-x * 300) + np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 120) * .5)

def drone(d):
    n = int(d * SR); x = tt(n)
    rum = norm(lowpass(rng.standard_normal(n), 90))
    saws = sum(saw(freq(nm) * (1 + .002 * np.sin(2 * np.pi * .3 * x + k)), n, rng.uniform()) for k, nm in enumerate(("F1", "C2", "F2")))
    out = .8 * norm(lowpass(saws, 220)) + .6 * rum
    return norm(out) * np.minimum(x / .8, 1) * np.clip((d - x) / .3, 0, 1) * (1 + .15 * np.sin(2 * np.pi * .5 * x))

def subdrop(d=1.6):
    n = int(d * SR); x = tt(n)
    return norm(np.tanh(2 * np.sin(2 * np.pi * np.cumsum(75 * (28 / 75) ** (x / d)) / SR)) * np.exp(-x * 1.5) * np.minimum(x / .005, 1))

def riser(d):
    n = int(d * SR); x = tt(n); p = x / d
    return norm(sweep(n, 200, 10000, .45) * p ** 2 + np.sin(2 * np.pi * np.cumsum(110 * 2 ** (3 * p)) / SR) * p ** 2.5 * .35)

def whoosh(d=0.5):
    n = int(d * SR); x = tt(n); s = sweep(n, 300, 5000, .55) * np.sin(np.pi * x / d) ** 2.2
    return np.stack([s * np.linspace(1.2, .5, n), s * np.linspace(.5, 1.2, n)], 1)

# ---------------- plomberie : tuyau, goutte, eau ----------------
def clang():
    n = int(1.6 * SR); x = tt(n); s = np.zeros(n)
    for f, a, d in ((523, 1, .9), (1187, .7, .55), (1873, .55, .4), (2741, .4, .3), (3698, .3, .2), (4420, .2, .14)):
        s += a * np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * np.exp(-x / d)
    s += band(rng.standard_normal(n), 3000, 12000) * np.exp(-x * 200) * 0.8
    return norm(s * np.minimum(x / 0.0008, 1))

def bloop():
    n = int(0.35 * SR); x = tt(n)
    return norm(np.sin(2 * np.pi * np.cumsum(650 + 1500 * (1 - np.exp(-x * 60))) / SR) * np.exp(-x * 22) * np.minimum(x / 0.001, 1))

def bubbles(d, n, f_lo=350, f_hi=1200, grow=False):
    out = np.zeros(int(d * SR))
    for _ in range(n):
        p = rng.uniform(0, 1) ** (.5 if grow else 1)
        i = int(p * (len(out) - 4000)); m = int(rng.uniform(1500, 3800)); f0 = rng.uniform(f_lo, f_hi)
        x = np.arange(m) / SR
        out[i:i + m] += np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2.2 * x / (m / SR))) / SR) * np.exp(-x * 45) * rng.uniform(.3, 1)
    return norm(out)

def flush(d=0.8):
    n = int(d * SR); x = tt(n); env = np.sin(np.pi * x / d) ** 1.4
    s = norm(sweep(n, 220, 2200, .7) * env + bubbles(d, 45) * .45 * env)
    return np.stack([s * np.linspace(.6, 1.2, n), s * np.linspace(1.2, .6, n)], 1)

# =============== ARRANGEMENT ===============
drum_times = []
def hit(at, size, gain):
    add("drums", at, TK[size], gain, pan=rng.uniform(-.2, .2), rev=.3)
    if size != "small": drum_times.append(at)
def bars(a, z): return range(a, z + 1)

def snare_build(a, z, top=.35):
    # caisse claire militaire qui serre : doubles croches, puis triples, puis sextolets
    t_ = a
    while t_ < z - 2 * S16 - 1e-6:
        p_ = (t_ - a) / (z - a)
        add("drums", t_, SN, .06 + top * p_ ** 1.5, pan=.15, rev=.2)
        t_ += S16 if p_ < .5 else (S16 / 2 if p_ < .85 else S16 / 3)

# --- ouverture (mesures 0-1) : « Rendez-vous le… » — horloge, cœur, nappe, piano, la tension monte ---
for k in range(8):
    add("fx", k * b, clock(k % 2 == 0), 0.16 - .01 * (k % 2), pan=.3 if k % 2 else -.3, rev=.2)
for k in (0, 2, 4, 6): add("bass", k * b, heartbeat(), 0.5 + .06 * k)
add("music", 0, piano("F5", 3.4), 0.22, rev=.7)
add("music", BAR, piano("Db5", 2.0), 0.2, rev=.7)
tremolo(tones("Fm", 5)[2], 2 * BAR, 0.05, 0)
add("music", BAR, shepard(BAR - 2 * S16), 0.12, rev=.3)

# --- impact du 21 novembre (mesures 2-3) ---
add("music", T["date"], braam("Fm", 3.4), 0.65, rev=.45)
add("music", T["date"], choir("Fm", 2 * BAR + .4), 0.32, rev=.5)
strings_hold(2, 2, 3, 1600, 0.12)
hit(T["date"], "big", .9)
for k in (2, 4, 6): add("bass", T["date"] + k * b, heartbeat(), 0.45)

# --- acte I (mesures 4-9) : l'ostinato entre au loin et se rapproche ---
for i in bars(4, 9):
    fc = 500 + 380 * (i - 4)
    ostinato(i, 2, fc, .1 + .025 * (i - 4), density=8 if i < 6 else 16, pan=-.15)
    if i >= 7: ostinato(i, 3, fc * 1.3, .05 + .02 * (i - 7), density=16, pan=.25)
    strings_hold(i, 1, 3, 900, .05)
    add("bass", i * BAR, heartbeat(), .45); add("bass", i * BAR + 2 * b, heartbeat(), .38)
for i, nm in zip(bars(4, 9), ["C6", "Ab5", "G5", "F5", "Eb5", "E5"]):   # phrase de piano descendante, sans redite
    add("music", i * BAR, piano(nm, 2.4), .16, rev=.7)
hit(5 * BAR, "mid", .35)
for i in (6, 7): hit(i * BAR, "mid", .45); hit(i * BAR + 2.5 * b, "small", .3)
for i in (8, 9):
    for s_ in (0, 3, 6, 8, 10, 12, 14): hit(i * BAR + s_ * S16, "mid" if s_ in (0, 8) else "small", .5 + .1 * (i - 8))
snare_build(8 * BAR, 10 * BAR, .3)
add("music", 8 * BAR, shepard(2 * BAR - 2 * S16), 0.13, rev=.3)
add("music", 8 * BAR, choir("Bbm", BAR), .18, rev=.5); add("music", 9 * BAR, choir("C", BAR - 2 * S16), .22, rev=.5)

# --- acte II (mesures 10-16) : le titre, puis les gestes — percussions pleines, mélodie de cuivres qui monte ---
add("music", T["title"], braam("Fm", 3.0), 0.6, rev=.4)
add("music", T["title"], choir("Fm", 2 * BAR), .25, rev=.5)
TPAT = [[(0, "big"), (6, "mid"), (8, "mid"), (11, "small"), (14, "mid")],
        [(0, "big"), (3, "small"), (8, "mid"), (10, "small"), (12, "mid"), (14, "small")],
        [(0, "big"), (6, "mid"), (10, "mid"), (12, "small"), (13, "small"), (14, "mid"), (15, "small")]]
for i in bars(10, 16):
    ostinato(i, 2, 2600, .14); ostinato(i, 3, 3200, .1, pan=.3)
    for s_, sz in TPAT[(i - 10) % 3]: hit(i * BAR + s_ * S16, sz, .65)
    if i >= 13:
        for s_ in range(0, 16, 2): add("drums", i * BAR + s_ * S16, SN, .08 + .04 * (s_ % 4 == 0), pan=.2, rev=.15)
    strings_hold(i, 1, 3, 1800, .06)
    tremolo(tones(PLAN[i], 5)[1], BAR, .045, i * BAR)            # cordes aiguës en trémolo : l'air au-dessus
for i, m in zip(bars(12, 16), [53, 56, 58, 60, 61]):            # fa, la bémol, si bémol, do, ré bémol : ça grimpe
    add("music", i * BAR, brass(m, BAR + .2), .2, rev=.35)
add("drums", 17 * BAR - .6, crash()[::-1][-int(.6 * SR):], .2)

# --- respiration (mesures 17-18) : la salle — cordes tenues, chœur, piano, cœur ---
add("drums", 17 * BAR, crash(), .2, rev=.4); hit(17 * BAR, "big", .6)
strings_hold(17, 1, 3, 1400, .14); strings_hold(18, 1, 3, 1400, .14)
add("music", 17 * BAR, choir("Db", BAR + .3), .25, rev=.6); add("music", 18 * BAR, choir("C", BAR), .25, rev=.6)
for i, nm in ((17, "F5"), (17.5, "Ab5"), (18, "G5"), (18.5, "E5")): add("music", i * BAR, piano(nm, 2.0), .16, rev=.7)
for k in range(4): add("bass", 17 * BAR + k * 2 * b, heartbeat(), .42)

# --- acte III (mesures 19-22) : la basse monte d'un ton par mesure, tout se resserre ---
for i in bars(19, 22):
    j = i - 19
    ostinato(i, 2, 1200 + 600 * j, .1 + .02 * j, pan=-.15); ostinato(i, 3, 1600 + 800 * j, .06 + .025 * j, pan=.25)
    if j >= 2: ostinato(i, 4, 2800 + 600 * j, .05)
    strings_hold(i, 1, 2, 1200, .08)
    tremolo(tones(PLAN[i], 5)[2], BAR, .03 + .015 * j, i * BAR)
    add("music", i * BAR, brass(tones(PLAN[i], 2)[0], BAR + .2, 1400 + 500 * j), .14 + .03 * j, rev=.3)
    pat = (0, 8) if j == 0 else (0, 6, 8, 14) if j == 1 else (0, 3, 6, 8, 10, 12, 14) if j == 2 else range(0, 16, 2)
    for s_ in pat: hit(i * BAR + s_ * S16, "mid" if s_ in (0, 8) else "small", .45 + .08 * j)
snare_build(21 * BAR, 23 * BAR)
add("music", 21 * BAR, shepard(2 * BAR - 2 * S16), 0.16, rev=.3)
add("music", 21 * BAR, choir("Db", BAR), .2, rev=.5); add("music", 22 * BAR, choir("Eb", BAR - 2 * S16), .26, rev=.5)

# --- les trois coups (mesures 23-25) : un mot par coup, chacun plus haut que le précédent ---
for i, ch in zip(bars(23, 25), ("Fm", "Db", "Eb")):
    k = i - 23
    add("music", i * BAR, braam(ch, BAR + .6), .55 + .07 * k, rev=.45)
    add("music", i * BAR, choir(ch, BAR + .2), .22 + .04 * k, rev=.5)
    hit(i * BAR, "big", .9); add("drums", i * BAR, crash(), .22 + .05 * k, rev=.3)
    ostinato(i, 3, 3600, .1 + .02 * k)
    tremolo(tones(ch, 5)[0], BAR, .06, i * BAR); tremolo(tones(ch, 5)[2], BAR, .05, i * BAR)
    for s_, sz in ((6, "mid"), (8, "mid"), (11, "small"), (12, "mid"), (14, "small")): hit(i * BAR + s_ * S16, sz, .5 + .1 * k)
    if k == 2:
        for s_ in range(8, 14): add("drums", i * BAR + s_ * S16, SN, .12 + .04 * s_, pan=.2, rev=.2)

# --- final (mesure 26+) : la goutte, résolution en fa majeur, longue traîne ---
R0 = T["reveal"]
add("music", R0, braam("F", 4.0), .7, rev=.55)
add("music", R0, choir("F", DUR - R0), .32, rev=.6)
strings_hold(26, 3, 3, 2400, .14, rev=.6)
tremolo(tones("F", 5)[1], DUR - R0 - .3, .06, R0)
hit(R0, "big", 1.0)
for i, nm in ((26.75, "C6"), (27.25, "A5"), (27.75, "F5")): add("music", i * BAR, piano(nm, 3.0), .18, rev=.75)

# --- habillage cinéma ---
for t, size in reel["hits"]:
    add("fx", t, impact(size), {"big": 1.0, "mid": .5, "small": .3}[size], rev=.45)
    if size == "big": add("bass", t, subdrop(), 0.7)
for t in reel["texthits"]:
    add("fx", t - .2, swish(), 0.22, rev=.25); add("fx", t, impact("small"), 0.18, rev=.35)
for t0, n, step in reel["ticks"]:
    for i in range(n): add("fx", t0 + i * step + .1, tick(), 0.12, pan=-.5 + i / max(1, n - 1), rev=.1)
for a_, z_ in reel["drone"]: add("fx", a_, drone(z_ - a_ + .3), 0.32, rev=.2)
for a_, z_ in reel["risers"]: add("fx", a_, riser(z_ - a_ - S16 * 2), 0.34, rev=.3)
for t in reel["reverse"]: add("fx", t - 1.2, crash()[::-1][-int(1.2 * SR):], 0.32, rev=.2)
for t in reel["whoosh"]: add("fx", t - .22, whoosh(), 0.3, rev=.3)

# --- plomberie ---
for t in reel["clang"]: add("fx", t, clang(), 0.3, pan=rng.uniform(-.3, .3), rev=.35)
for t in reel["drops"]: add("fx", t - .02, bloop(), 0.35, rev=.5)
for t in reel["wipes"]: add("fx", t - .4, flush(), 0.45, rev=.35)
a_, z_ = reel["fill"]; add("fx", a_, bubbles(z_ - a_ + .4, 70, 300, 900, grow=True), 0.22, pan=-.1, rev=.4)

# =============== MIXAGE ===============
denv = np.zeros(N)
for kt in drum_times:
    i = int(kt * SR); m = min(N - i, int(.3 * SR))
    if m > 0: denv[i:i + m] = np.maximum(denv[i:i + m], np.exp(-np.arange(m) / (.1 * SR)))
duck = (1 - .3 * denv)[:, None]

L = int(3.0 * SR); xi = tt(L)                                   # grande salle : réverbération longue
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .8)[:, None]; ir[: int(.02 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 4500) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

G = {"drums": 1.0, "bass": 0.5, "music": 1.6, "fx": 1.0}
for k, v in BUS.items():
    seg = v[int(T["title"] * SR):int(T["theorie"] * SR)]
    print(f"  {k:6s} RMS acte II : {20 * np.log10(G[k] * np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB")
mix = BUS["drums"] * G["drums"] + BUS["bass"] * G["bass"] + BUS["music"] * G["music"] * duck + BUS["fx"] * G["fx"] + wet * 0.5
mix = filt(mix, lambda f: 1 / np.sqrt(1 + (28 / f) ** 8))            # coupe-bas sous 28 Hz
mix = filt(mix, lambda f: np.clip((f / 250) ** .4, .45, 2.6))        # égaliseur en pente : moins de sub, plus de médium et d'aigu (téléphones)
mix = np.tanh(1.5 * mix / np.abs(mix).max()) / np.tanh(1.5) * 0.95    # saturation de bus douce
fa, fb = reel["fadeOut"]; x = tt(N)
mix *= np.clip((fb + .25 - x) / (fb + .25 - fa), 0, 1)[:, None]

with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("bande-son :", sys.argv[2], f"{DUR:.1f} s")
