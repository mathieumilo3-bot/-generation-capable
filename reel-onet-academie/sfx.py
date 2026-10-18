# Musique originale + bruitages, synthétisés à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# House/pop à 120 bpm en la mineur (Am – F – C – G) : kick, clap, charleys, basse en contretemps, accords de piano,
# pluck en mélodie, nappes. Signature sonore : coups métalliques de tuyau sur les gestes et gouttes d'eau sur le logo.
# Structure : accroche (2 mesures), montée (1), drop (5), salle (3), relance (1), montée (1), drop final (2), fin.
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
rng = np.random.default_rng(21)

def freq(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)

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

def band(sig, lo, hi):
    S = np.fft.rfft(sig); f = np.fft.rfftfreq(len(sig), 1 / SR)
    return np.fft.irfft(S * ((f >= lo) & (f <= hi)), len(sig))

def lowpass(sig, fc):
    S = np.fft.rfft(sig, axis=0); f = np.fft.rfftfreq(len(sig), 1 / SR)
    h = 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(S * (h[:, None] if sig.ndim == 2 else h), len(sig), axis=0)

def norm(s): return s / (np.abs(s).max() + 1e-9)

def sweep(n, f0, f1, width=0.5):
    win, hop = 2048, 512
    noise = rng.standard_normal(n + win); out = np.zeros(n + win); w = np.hanning(win)
    fr = np.fft.rfftfreq(win, 1 / SR); fr[0] = 1
    for i in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (i / max(1, n))
        out[i:i + win] += np.fft.irfft(np.fft.rfft(noise[i:i + win] * w) * np.exp(-0.5 * (np.log(fr / fc) / width) ** 2), win) * w
    return norm(out[:n])

# ---------------- batterie ----------------
_kick = None
def kick():
    global _kick
    if _kick is None:
        n = int(0.38 * SR); x = tt(n)
        f = 48 + 150 * np.exp(-x * 42)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7.5) + band(rng.standard_normal(n), 2500, 8000) * np.exp(-x * 350) * 0.35
        _kick = norm(np.tanh(2.0 * s))
    return _kick

def clap():
    n = int(0.35 * SR); x = tt(n)
    nz = band(rng.standard_normal(n), 1000, 6000)
    env = sum(np.exp(-np.maximum(x - d, 0) / 0.006) * (x >= d) for d in (0, .01, .02)) * 0.6 + np.exp(-x / 0.11) * (x >= .02) * 0.55
    return norm(nz * env)

def snare():
    n = int(0.2 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 800, 9000) * np.exp(-x * 24) + np.sin(2 * np.pi * 200 * x) * np.exp(-x * 40) * 0.5)

def hat(open_=False):
    n = int((0.24 if open_ else 0.045) * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 7500, 17000) * np.exp(-x / (0.08 if open_ else 0.01)))

def crash():
    n = int(2.4 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 3500, 16000) * np.exp(-x / 0.7) * np.minimum(x / 0.002, 1))

def boom(size):
    d = {"big": 2.2, "mid": 0.9, "small": 0.45}[size]; n = int(d * SR); x = tt(n)
    f = (38 if size == "big" else 52) + 70 * np.exp(-x * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * {"big": 1.8, "mid": 4.5, "small": 9}[size])
    s += band(rng.standard_normal(n), 150, 2500) * np.exp(-x * 30) * 0.5
    return norm(np.tanh(1.6 * s) * np.minimum(x / 0.002, 1))

# ---------------- signature : tuyau et goutte ----------------
def clang():
    # tuyau d'acier frappé : partiels inharmoniques, attaque métallique
    n = int(1.6 * SR); x = tt(n); s = np.zeros(n)
    for f, a, d in ((523, 1, .9), (1187, .7, .55), (1873, .55, .4), (2741, .4, .3), (3698, .3, .2), (4420, .2, .14)):
        s += a * np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * np.exp(-x / d) * (1 + .004 * np.sin(2 * np.pi * 5 * x))
    s += band(rng.standard_normal(n), 3000, 12000) * np.exp(-x * 200) * 0.8
    return norm(s * np.minimum(x / 0.0008, 1))

def bloop():
    # goutte d'eau : sinus dont la hauteur remonte très vite
    n = int(0.35 * SR); x = tt(n)
    f = 650 + 1500 * (1 - np.exp(-x * 60))
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 22) * np.minimum(x / 0.001, 1))

# ---------------- basse ----------------
def bass(f, d):
    n = int(d * SR); x = tt(n); s = np.zeros(n)
    for h in range(1, 9): s += np.sin(2 * np.pi * f * h * x) / h ** 1.3
    s = lowpass(s, 1200)
    env = np.minimum(x / 0.004, 1) * np.exp(-x * 5) * np.clip((d - x) / 0.02, 0, 1)
    return np.tanh(1.8 * norm(s) * env) + 0.6 * np.sin(2 * np.pi * f * x) * env

# ---------------- instruments mélodiques ----------------
_ks = {}
def ks(f, d=1.2, k=0.994, bright=0.55):
    if (f, d) in _ks: return _ks[(f, d)]
    n = int(d * SR); P = int(round(SR / f))
    buf = rng.uniform(-1, 1, P).tolist(); out = np.empty(n)
    for i in range(n):
        j = i % P; v = buf[j]; out[i] = v
        buf[j] = k * (bright * v + (1 - bright) * buf[(j + 1) % P])
    _ks[(f, d)] = norm(out)
    return _ks[(f, d)]

def pluck(name): return ks(freq(name))

def piano(notes, d=0.9):
    n = int(d * SR); x = tt(n); s = np.zeros((n, 2))
    for k, nm in enumerate(notes):
        f0 = freq(nm); pan = (k / max(1, len(notes) - 1) - .5) * .6
        v = sum(np.sin(2 * np.pi * f0 * h * (1 + .0004 * h * h) * x) * np.exp(-x * (2.2 + h * 1.3)) / h ** 1.1 for h in range(1, 9))
        s[:, 0] += v * (1 - pan); s[:, 1] += v * (1 + pan)
    env = np.minimum(x / 0.003, 1) * np.clip((d - x) / 0.05, 0, 1)
    return s / (np.abs(s).max() + 1e-9) * env[:, None]

def pad(notes, d, bright=1.0):
    n = int(d * SR); x = tt(n); s = np.zeros((n, 2))
    for nm in notes:
        f0 = freq(nm)
        for det, pan in ((-8, -.6), (0, 0), (8, .6)):
            f = f0 * 2 ** (det / 1200); v = np.zeros(n)
            for h in range(1, int(min(26, 2000 * bright / f)) + 1):
                v += np.sin(2 * np.pi * f * h * x + h * 1.1) / h ** 1.6
            s[:, 0] += v * (1 - pan) / 2; s[:, 1] += v * (1 + pan) / 2
    env = np.minimum(x / 0.3, 1) * np.clip((d - x) / 0.4, 0, 1)
    return s / (np.abs(s).max() + 1e-9) * env[:, None]

# ---------------- effets ----------------
def whoosh(d=0.5):
    n = int(d * SR); x = tt(n); s = sweep(n, 300, 5000, .55) * np.sin(np.pi * x / d) ** 2.2
    return np.stack([s * np.linspace(1.2, .5, n), s * np.linspace(.5, 1.2, n)], 1)

def riser(d):
    n = int(d * SR); x = tt(n); p = x / d
    s = sweep(n, 200, 9000, .45) * p ** 2.2 + np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2 * p)) / SR) * p ** 2.5 * .3
    return norm(s)

# =============== ARRANGEMENT ===============
CH = [("A3", "C4", "E4", "A4"), ("F3", "A3", "C4", "F4"), ("G3", "C4", "E4", "G4"), ("G3", "B3", "D4", "G4")]
PADS = [("A2", "E3", "A3", "C4"), ("F2", "C3", "F3", "A3"), ("C3", "G3", "C4", "E4"), ("G2", "D3", "G3", "B3")]
ROOT = ["A1", "F1", "C2", "G1"]
LEAD = [[(0, "E5"), (2, "A5"), (4, "C6"), (6, "B5"), (7, "A5"), (10, "E5"), (12, "G5"), (14, "A5")],
        [(0, "F5"), (2, "A5"), (4, "C6"), (6, "A5"), (7, "G5"), (10, "F5"), (12, "E5"), (14, "C5")],
        [(0, "E5"), (2, "G5"), (4, "C6"), (6, "D6"), (7, "C6"), (10, "G5"), (12, "E5"), (14, "G5")],
        [(0, "D5"), (2, "G5"), (4, "B5"), (6, "D6"), (8, "B5"), (10, "A5"), (12, "G5"), (14, "B5")]]
kick_times = []

def groove(n, kick_=True, clap_=True, bass_=True, keys=True, lead=False, hats=True):
    t0 = n * BAR; c = n % 4
    if kick_:
        for s in (0, 4, 8, 12):
            add("drums", t0 + s * S16, kick(), 0.9); kick_times.append(t0 + s * S16)
    if clap_:
        for s in (4, 12): add("drums", t0 + s * S16, clap(), 0.5, rev=.15)
    if hats:
        for s in range(16):
            if s % 4 == 2: add("drums", t0 + s * S16, hat(True), 0.16, pan=-.15)
            else: add("drums", t0 + s * S16, hat(), 0.09 + .05 * (s % 2 == 0), pan=.25)
    if bass_:
        for s in (2, 6, 10, 14):
            add("bass", t0 + s * S16, bass(freq(ROOT[c]), 2 * S16 - .01), 0.7)
        add("bass", t0 + 15 * S16, bass(freq(ROOT[c]) * 2, S16 - .01), 0.35)
    if keys:
        for s in (0, 3, 6, 10, 12):
            add("music", t0 + s * S16, piano(CH[c], 0.32 if s else 0.5), 0.3, rev=.2)
    if lead:
        for s, nm in LEAD[c]:
            add("music", t0 + s * S16, pluck(nm), 0.22, pan=.2, rev=.35)
            add("music", t0 + s * S16 + 3 * S16, pluck(nm), 0.07, pan=-.4, rev=.4)   # écho

def snare_roll(t0, d):
    t = t0
    while t < t0 + d - 1e-6:
        p = (t - t0) / d
        add("drums", t, snare(), 0.1 + 0.35 * p ** 1.5, pan=.1, rev=.15)
        t += S16 if p < .5 else S16 / 2

# --- nappes sur toute la durée ---
for n in range(15):
    add("music", n * BAR - .1, pad(PADS[n % 4], BAR + .4, .55 if n < 3 else .9), 0.14, rev=.3)

# --- accroche (mesures 0-1) : tic-tac de charleys, arpège en pluck filtré ---
for s in range(32):
    add("drums", s * S16, hat(), 0.05 + .04 * (s % 4 == 0), pan=.3)
arp = ["A4", "C5", "E5", "A5", "E5", "C5", "F4", "A4", "C5", "F5", "C5", "A4", "G4", "C5", "E5", "G5"]
for i, nm in enumerate(arp): add("music", i * b / 2, pluck(nm), 0.16, pan=-.2 + .05 * (i % 6), rev=.5)
for t0 in (T["hook1"], T["hook2"], T["hook3"]): add("bass", t0, bass(freq("A1"), 0.9), 0.55)

# --- montée (mesure 2) : piano, roulement, silence avant le drop ---
add("music", T["learn"], piano(("A3", "C4", "E4", "A4"), 1.5), 0.35, rev=.5)
add("music", T["learn2"], piano(("F3", "A3", "C4", "F4"), 0.75), 0.3, rev=.5)
snare_roll(T["learn"] + b, 3 * b - S16 * 2)

# --- drop (mesures 3-7) ---
for n in range(3, 8): groove(n, lead=n >= 4)

# --- salle (mesures 8-10) : la batterie se retire puis revient ---
groove(8, kick_=False, clap_=False, bass_=False, hats=False)
for s, nm in LEAD[0]: add("music", 8 * BAR + s * S16, pluck(nm), 0.16, rev=.55)
groove(9, clap_=False); groove(10, lead=True)
# --- relance (mesure 11) ---
groove(11, lead=True)

# --- montée (mesure 12) : kick à la croche, roulement, silence ---
for s in range(0, 14, 2):
    add("drums", 12 * BAR + s * S16, kick(), 0.5 + .03 * s); kick_times.append(12 * BAR + s * S16)
snare_roll(12 * BAR, BAR - S16 * 2)
for s in (0, 4, 8): add("music", 12 * BAR + s * S16, piano(CH[3], 0.4), 0.3, rev=.3)

# --- drop final (mesures 13-14) ---
for n in (13, 14): groove(n, lead=True)
add("drums", T["date"], crash(), 0.3, rev=.3)

# --- fin : accord tenu ---
add("music", 15 * BAR, piano(("A3", "C4", "E4", "A4"), 2.5), 0.4, rev=.6)
add("music", 15 * BAR, pad(("A2", "E3", "A3", "C4", "E4"), DUR - 15 * BAR, .7), 0.3, rev=.5)
add("bass", 15 * BAR, bass(freq("A1"), 1.2), 0.6)
for i, nm in enumerate(["E5", "A5", "C6", "E6"]):
    add("music", 15 * BAR + b + i * b / 2, pluck(nm), 0.15, rev=.6)

# --- impacts, gestes, gouttes, transitions ---
for t, size in reel["hits"]:
    add("fx", t, boom(size), {"big": .9, "mid": .35, "small": .18}[size], rev=.25)
    if size == "big": add("drums", t, crash(), 0.25, rev=.25)
for t in reel["clang"]: add("fx", t, clang(), 0.28, pan=rng.uniform(-.3, .3), rev=.35)
for t in reel["drops"]: add("fx", t - .02, bloop(), 0.3, rev=.5)
for t in reel["whoosh"]: add("fx", t - .22, whoosh(), 0.3, rev=.3)
for a, z in reel["risers"]: add("fx", a, riser(z - a - S16 * 2), 0.3, rev=.3)

# =============== MIXAGE ===============
kenv = np.zeros(N)
for kt in kick_times:
    i = int(kt * SR); m = min(N - i, int(.3 * SR))
    if m > 0: kenv[i:i + m] = np.maximum(kenv[i:i + m], np.exp(-np.arange(m) / (.09 * SR)))
duck = (1 - .55 * kenv)[:, None]

L = int(2.2 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .5)[:, None]; ir[: int(.015 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 5000) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

G = {"drums": 0.8, "bass": 0.55, "music": 2.8, "fx": 0.9}
for k, v in BUS.items():
    seg = v[int(T["coupe"] * SR):int(T["theorie"] * SR)]
    print(f"  {k:6s} RMS drop : {20 * np.log10(G[k] * np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB")
mix = BUS["drums"] * G["drums"] + BUS["bass"] * G["bass"] * duck + BUS["music"] * G["music"] * duck + BUS["fx"] * G["fx"] + wet * 0.45 * duck
for c in range(2):
    S = np.fft.rfft(mix[:, c]); f = np.fft.rfftfreq(N, 1 / SR)
    mix[:, c] = np.fft.irfft(S / np.sqrt(1 + (28 / np.maximum(f, 1)) ** 8), N)
mix = np.tanh(1.3 * mix / np.abs(mix).max()) / np.tanh(1.3) * 0.9
fa, fb = reel["fadeOut"]; x = tt(N)
mix *= np.clip((fb + .25 - x) / (fb + .25 - fa), 0, 1)[:, None]

with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("bande-son :", sys.argv[2], f"{DUR:.1f} s")
