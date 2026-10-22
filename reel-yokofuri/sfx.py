# Musique originale + bruitages, synthétisés à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Trap japonaise à 140 bpm en ré (gamme hirajoshi) : 808, clap, charleys en roulements, koto, shamisen,
# nappes, taikos. Structure : intro (2 mesures), drop A (2), respiration (1), drop B (6), montée (1), final.
import json, sys, wave
import numpy as np

SR = 48000
reel = json.load(open(sys.argv[1]))
T = reel["T"]
b = 60 / reel["bpm"]; BAR = 4 * b; S16 = b / 4
DUR = reel["duration"] + 0.2
N = int(DUR * SR)
BUS = {k: np.zeros((N, 2)) for k in ("drums", "bass", "music", "fx")}
send = np.zeros((N, 2))
rng = np.random.default_rng(5)

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
def kick():
    n = int(0.32 * SR); x = tt(n)
    f = 55 + 140 * np.exp(-x * 38)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9) + band(rng.standard_normal(n), 2000, 7000) * np.exp(-x * 300) * 0.3
    return norm(np.tanh(2.2 * s))

def clap():
    n = int(0.4 * SR); x = tt(n)
    nz = band(rng.standard_normal(n), 900, 5000)
    env = sum(np.exp(-np.maximum(x - d, 0) / 0.007) * (x >= d) for d in (0, .011, .022)) * 0.6 + np.exp(-x / 0.13) * (x >= .022) * 0.55
    body = np.sin(2 * np.pi * 195 * x) * np.exp(-x * 30) * 0.35
    return norm(nz * env + body)

def snare():
    n = int(0.2 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 700, 8000) * np.exp(-x * 26) + np.sin(2 * np.pi * 210 * x) * np.exp(-x * 40) * 0.5)

def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 7000, 16000) * np.exp(-x / (0.07 if open_ else 0.011)))

def taiko(size):
    d = {"big": 2.4, "mid": 1.2}[size]; n = int(d * SR); x = tt(n)
    base = 46 if size == "big" else 66
    f = base + 34 * np.exp(-x * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * (2.0 if size == "big" else 3.8))
    s += band(rng.standard_normal(n), 140, 1400) * np.exp(-x * 26) * 0.7
    if size == "big":
        s += 0.9 * np.sin(2 * np.pi * np.cumsum(30 + 24 * np.exp(-x * 2.5)) / SR) * np.exp(-x * 1.2)
    return norm(s * np.minimum(x / 0.0015, 1))

def crash():
    n = int(2.2 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 4000, 16000) * np.exp(-x / 0.6) * np.minimum(x / 0.002, 1))

# ---------------- basse 808 ----------------
def b808(f, d, glide=False):
    n = int(d * SR); x = tt(n)
    fr = f * (1 + 1.4 * np.exp(-x * 45))
    if glide: fr = fr * np.where(x < 0.09, 2 ** (x / 0.09), 2.0)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR)
    env = np.minimum(x / 0.003, 1) * np.exp(-x / max(d * 0.9, 0.25)) * np.clip((d - x) / 0.03, 0, 1)
    return np.tanh(2.2 * s * env) / np.tanh(2.2)

# ---------------- instruments mélodiques ----------------
_ks = {}
def ks(f, d=2.0, k=0.996, bright=0.5, key="koto"):
    if (f, d, key) in _ks: return _ks[(f, d, key)]
    n = int(d * SR); P = int(round(SR / f))
    buf = rng.uniform(-1, 1, P).tolist(); out = np.empty(n)
    for i in range(n):
        j = i % P; v = buf[j]; out[i] = v
        buf[j] = k * (bright * v + (1 - bright) * buf[(j + 1) % P])
    x = tt(n)
    out += band(rng.standard_normal(n), 2500, 9000) * np.exp(-x * 140) * 0.3
    _ks[(f, d, key)] = norm(out)
    return _ks[(f, d, key)]

def koto(name): return ks(freq(name), 2.2, 0.9962, 0.5, "koto")
def shamisen(name):
    s = ks(freq(name), 0.45, 0.985, 0.62, "sha")
    return norm(np.tanh(2.6 * s) * np.exp(-tt(len(s)) * 5))

def pad(notes, d, bright=1.0):
    n = int(d * SR); x = tt(n); s = np.zeros((n, 2))
    for nm in notes:
        f0 = freq(nm)
        for det, pan in ((-7, -.6), (0, 0), (7, .6)):
            f = f0 * 2 ** (det / 1200); v = np.zeros(n)
            for h in range(1, int(min(30, 1800 * bright / f)) + 1):
                v += np.sin(2 * np.pi * f * h * x + h * 1.3) / h ** 1.7
            s[:, 0] += v * (1 - pan) / 2; s[:, 1] += v * (1 + pan) / 2
    env = np.minimum(x / 0.35, 1) * np.clip((d - x) / 0.4, 0, 1)
    return s / (np.abs(s).max() + 1e-9) * env[:, None]

# ---------------- effets ----------------
def whoosh(d=0.5):
    n = int(d * SR); x = tt(n); s = sweep(n, 300, 4000, .55) * np.sin(np.pi * x / d) ** 2.2
    return np.stack([s * np.linspace(1.2, .5, n), s * np.linspace(.5, 1.2, n)], 1)

def riser(d):
    n = int(d * SR); x = tt(n); p = x / d
    s = sweep(n, 200, 8000, .45) * p ** 2.2 + np.sin(2 * np.pi * np.cumsum(140 * 2 ** (2 * p)) / SR) * p ** 2.5 * .3
    return norm(s)

def shimmer():
    n = int(2.0 * SR); x = tt(n)
    P = [(2093, 1, 1.2), (3140, .7, .9), (4186.5, .5, .7), (5270, .35, .5)]
    L = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x / d) for f, a, d in P)
    R = sum(a * np.sin(2 * np.pi * f * 1.003 * x + 1) * np.exp(-x / d) for f, a, d in P)
    s = np.stack([L, R], 1) * np.minimum(x / .004, 1)[:, None]
    return s / np.abs(s).max()

def gong():
    n = int(6.0 * SR); x = tt(n); s = np.zeros(n)
    for i, r in enumerate([1, 1.47, 2.03, 2.76, 3.42, 4.1, 5.3]):
        s += (1 / (1 + i * .6)) * np.sin(2 * np.pi * 98 * r * x) * (1 - np.exp(-x * (8 / (i + 1)))) * np.exp(-x / (5 - i * .5))
    return norm(s * np.minimum(x / .01, 1))

def laser(d):
    n = int(d * SR); x = tt(n); crack = np.zeros(n)
    for _ in range(int(d * 300)):
        i = rng.integers(0, max(1, n - 1500)); m = int(rng.uniform(80, 800))
        crack[i:i + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 4)) * rng.uniform(.2, 1)
    s = norm(band(crack, 1500, 12000)) + 0.3 * np.sin(2 * np.pi * 100 * x)
    return norm(s * np.minimum(x / .05, 1) * np.clip((d - x) / .1, 0, 1))

# =============== ARRANGEMENT ===============
CHORDS = [("D3", "F3", "A3"), ("Bb2", "D3", "F3"), ("F3", "A3", "C4"), ("A2", "E3", "A3")]
ROOTS = ["D1", "Bb1", "F1", "A1"]
TOPS = ["A4", "F4", "A4", "E4"]
PA = [(0, "D5"), (3, "A4"), (6, "Bb4"), (8, "A4"), (10, "F4"), (12, "E4"), (14, "F4"),
      (16, "A4"), (19, "D5"), (22, "E5"), (24, "F5"), (28, "E5"), (30, "D5")]
PB = [(0, "F5"), (3, "E5"), (6, "D5"), (8, "A4"), (12, "Bb4"), (14, "A4"),
      (16, "D5"), (19, "A4"), (22, "F4"), (24, "E4"), (28, "D4")]
kick_times = []

def drum_bar(n, mode):
    t0 = n * BAR
    ks_ = [0, 4, 8, 12] if mode == "stomp" else ([0, 7, 10, 13] if (mode == "B" and n % 2) else [0, 7, 10])
    for s in ks_:
        add("drums", t0 + s * S16, kick(), 0.85); kick_times.append(t0 + s * S16)
    for i, s in enumerate(ks_):
        nxt = ks_[i + 1] if i + 1 < len(ks_) else 16
        glide = mode == "B" and n % 4 == 3 and s == 10
        add("bass", t0 + s * S16, b808(freq(ROOTS[n % 4]), (nxt - s) * S16 + .02, glide), 0.8)
    for s in ([4, 12] if mode == "stomp" else [8]):
        add("drums", t0 + s * S16, clap(), 0.55, rev=.18)
    if mode == "B" and n % 2 == 1: add("drums", t0 + 15 * S16, snare(), 0.18, pan=.2)
    # charleys : croches, doubles en drop B, roulements en fin de mesure
    hs = [s * S16 for s in range(0, 16, 1 if mode in ("B", "stomp") else 2)]
    if n % 2 == 1: hs = [h for h in hs if h < 12 * S16] + [12 * S16 + k * S16 / 2 for k in range(8)]
    if n % 4 == 2: hs = [h for h in hs if not (4 * S16 <= h < 8 * S16)] + [4 * S16 + k * b / 6 for k in range(6)]
    for k, h in enumerate(sorted(hs)):
        add("drums", t0 + h, hat(), 0.13 + 0.06 * ((k % 2) == 0), pan=.25)
    if n % 2 == 0: add("drums", t0 + 14 * S16, hat(True), 0.12, pan=-.2)

def snare_roll(t0, d):
    t = t0
    while t < t0 + d - 1e-6:
        p = (t - t0) / d
        add("drums", t, snare(), 0.12 + 0.35 * p ** 1.5, pan=.1, rev=.15)
        t += S16 if p < .5 else S16 / 2

def phrase(n0, P, gain=0.42, rev=0.35):
    for s, nm in P:
        add("music", n0 * BAR + s * S16, koto(nm), gain, pan=-.15, rev=rev)

# --- nappes (fondu enchaîné par mesure) ---
for n in range(12):
    br = .5 if n < 2 else (.32 if n == 4 else 1.0)
    add("music", n * BAR - .15, pad(CHORDS[n % 4], BAR + .45, br), 0.11 if n != 4 else 0.16, rev=.3)
add("music", T["end"] - .1, pad(("D3", "F3", "A3", "D4"), DUR - T["end"], .7), 0.3, rev=.5)

# --- intro : arpège de koto, roulement de caisse claire ---
for i, nm in enumerate(["D4", "A4", "D5", "E5", "F5", "E5", "D5", "A4", "Bb3", "F4", "Bb4", "D5", "E5", "D5", "Bb4", "F4"]):
    add("music", i * b / 2, koto(nm), 0.5, pan=-.3 + .04 * (i % 8), rev=.5)
snare_roll(BAR + 2 * b, 2 * b)

# --- drop A ---
for n in (2, 3): drum_bar(n, "A")
phrase(2, PA)

# --- respiration : koto seul, sombre, puis roulement ---
for s, nm in [(0, "A4"), (6, "Bb4"), (8, "A4"), (12, "D5")]:
    add("music", 4 * BAR + s * S16, koto(nm), 0.3, rev=.6)
snare_roll(4 * BAR + 2 * b, 2 * b)
add("bass", T["breath"], b808(freq("D1"), 1.2), 0.6)

# --- drop B ---
for n in range(5, 11): drum_bar(n, "B")
phrase(5, PA); phrase(7, PB); phrase(9, PA)
for n in range(5, 11):
    for s in (3, 11):
        add("music", n * BAR + s * S16, shamisen(TOPS[n % 4]), 0.16, pan=.35, rev=.15)

# --- montée finale (signature) ---
drum_bar(11, "stomp"); snare_roll(11 * BAR + 2 * b, 2 * b)
for s in (0, 4, 8, 12):
    add("music", 11 * BAR + s * S16, shamisen("D5"), 0.18, pan=.3, rev=.2)

# --- final ---
add("bass", T["end"], b808(freq("D1"), 3.2), 0.85)
for i, nm in enumerate(["D4", "A4", "D5", "E5", "D5"]):
    add("music", T["end"] + b + i * b / 2, koto(nm), 0.36, pan=-.2 + .1 * i, rev=.55)
add("drums", T["end"], crash(), 0.3, rev=.3)
add("fx", T["end"], gong(), 0.5, rev=.6)

# --- impacts, transitions, laser ---
for t, size in reel["hits"]:
    if size == "big": add("fx", t, taiko("big"), 0.85, rev=.35); add("drums", t, crash(), 0.22, rev=.25)
    elif size == "mid": add("fx", t, taiko("mid"), 0.3, rev=.25)
for t in reel["whoosh"]: add("fx", t - .2, whoosh(), 0.35, rev=.3)
for a, z in reel["risers"]: add("fx", a, riser(z - a), 0.33, rev=.3)
for t in reel["shimmer"]: add("fx", t, shimmer(), 0.12, rev=.5)
a, z = reel["laser"]; add("fx", a, laser(z - a), 0.4, rev=.15)

# =============== MIXAGE ===============
x = tt(N)
kenv = np.zeros(N)
for kt in kick_times:
    i = int(kt * SR); m = min(N - i, int(.3 * SR))
    if m > 0: kenv[i:i + m] = np.maximum(kenv[i:i + m], np.exp(-np.arange(m) / (.11 * SR)))
duck = (1 - .5 * kenv)[:, None]

L = int(2.6 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .6)[:, None]; ir[: int(.018 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 4000) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

for k, v in BUS.items():
    seg = v[int(T["suka"] * SR):int(T["oni"] * SR)]
    g = {"drums": 1.0, "bass": 0.42, "music": 2.3, "fx": 0.9}[k]
    print(f"  {k:6s} RMS drop B : {20 * np.log10(g * np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB")
mix = BUS["drums"] * 1.0 + BUS["bass"] * 0.42 + BUS["music"] * 2.3 * duck + BUS["fx"] * 0.9 + wet * 0.5 * duck
for c in range(2):
    S = np.fft.rfft(mix[:, c]); f = np.fft.rfftfreq(N, 1 / SR)
    mix[:, c] = np.fft.irfft(S / np.sqrt(1 + (26 / np.maximum(f, 1)) ** 8), N)
mix /= np.abs(mix).max() / 0.9
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
f0, f1 = reel["fadeOut"]
mix *= np.clip((f1 - x) / (f1 - f0), 0, 1)[:, None]
pcm = (mix * 32767 * .97).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"musique : {DUR:.1f} s à {reel['bpm']} bpm")
