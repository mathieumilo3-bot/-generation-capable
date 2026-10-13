# Bande-son bande-annonce synthétisée à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Taikos, gong, koto (Karplus-Strong, gamme hirajoshi), nappe grave, montées, whooshs, scintillements, laser.
import json, sys, wave
import numpy as np

SR = 48000
reel = json.load(open(sys.argv[1]))
DUR = reel["duration"] + 0.2
N = int(DUR * SR)
dry = np.zeros((N, 2))
send = np.zeros((N, 2))          # bus réverbération
rng = np.random.default_rng(11)

NOTE = {"D4": 293.66, "E4": 329.63, "F4": 349.23, "A4": 440.0, "Bb4": 466.16,
        "D5": 587.33, "E5": 659.26, "D2": 73.42, "Bb1": 58.27, "C2": 65.41, "F2": 87.31}

def add(at, sig, gain=1.0, pan=0.0, rev=0.25):
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    i = int(at * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    dry[i:j] += sig[: j - i] * gain
    send[i:j] += sig[: j - i] * gain * rev

def tt(n): return np.arange(n) / SR

def band(sig, lo, hi):
    S = np.fft.rfft(sig); f = np.fft.rfftfreq(len(sig), 1 / SR)
    S *= ((f >= lo) & (f <= hi)) * 1.0
    return np.fft.irfft(S, len(sig))

def sweep(n, f0, f1, width=0.5):
    """bruit filtré dont la bande passante glisse de f0 à f1 (ajout-recouvrement par blocs)"""
    win, hop = 2048, 512
    noise = rng.standard_normal(n + win)
    out = np.zeros(n + win); w = np.hanning(win)
    fr = np.fft.rfftfreq(win, 1 / SR); fr[0] = 1
    for i in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (i / max(1, n))
        mask = np.exp(-0.5 * (np.log(fr / fc) / width) ** 2)
        out[i:i + win] += np.fft.irfft(np.fft.rfft(noise[i:i + win] * w) * mask, win) * w
    out = out[:n]
    return out / (np.abs(out).max() + 1e-9)

def taiko(size):
    d = {"big": 2.6, "mid": 1.4, "small": 0.5}[size]
    n = int(d * SR); x = tt(n)
    if size == "small":   # shime-daiko : tendu, aigu
        f = 185 + 70 * np.exp(-x * 30); body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 13)
        slap = band(rng.standard_normal(n), 900, 4500) * np.exp(-x * 55) * 0.5
        s = body + slap
    else:                 # ō-daiko
        base = 47 if size == "big" else 64
        f = base + 34 * np.exp(-x * 9)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * (2.0 if size == "big" else 3.6))
        body += 0.3 * np.sin(2 * np.pi * np.cumsum(f * 1.58) / SR) * np.exp(-x * 6)
        slap = band(rng.standard_normal(n), 140, 1400) * np.exp(-x * 26) * 0.75
        s = body + slap
        if size == "big":
            fs = 30 + 26 * np.exp(-x * 2.5)
            s += 0.9 * np.sin(2 * np.pi * np.cumsum(fs) / SR) * np.exp(-x * 1.25)
    s *= np.minimum(x / 0.0015, 1)
    return s / np.abs(s).max()

def ka():
    n = int(0.08 * SR); x = tt(n)
    s = band(rng.standard_normal(n), 1800, 6000) * np.exp(-x * 70) + 0.4 * np.sin(2 * np.pi * 1650 * x) * np.exp(-x * 90)
    return s / np.abs(s).max()

def whoosh(d=0.55):
    n = int(d * SR); x = tt(n)
    s = sweep(n, 300, 3800, 0.55) * np.sin(np.pi * x / d) ** 2.2
    return np.stack([s * np.linspace(1.2, 0.5, n), s * np.linspace(0.5, 1.2, n)], 1)

def riser(d):
    n = int(d * SR); x = tt(n); p = x / d
    s = sweep(n, 180, 7000, 0.45) * p ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2 * p)) / SR) * p ** 2.5 * 0.35
    trem = 1 + 0.35 * np.sin(2 * np.pi * np.cumsum(3 + 18 * p) / SR)
    s = (s + tone) * trem
    return s / np.abs(s).max()

def shimmer():
    n = int(2.4 * SR); x = tt(n)
    parts = [(2093, 1.0, 1.3), (3140, .7, 1.0), (4186.5, .55, .8), (5270, .4, .6), (6280, .3, .5)]
    L = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x / d) for f, a, d in parts)
    R = sum(a * np.sin(2 * np.pi * f * 1.003 * x + 1) * np.exp(-x / d) for f, a, d in parts)
    att = np.minimum(x / 0.004, 1)
    s = np.stack([L * att, R * att], 1)
    return s / np.abs(s).max()

def koto(f, d=2.4):
    n = int(d * SR); P = int(SR / f)
    buf = rng.uniform(-1, 1, P)
    buf = np.convolve(buf, [0.5, 0.5], "same")            # attaque un peu adoucie
    out = np.empty(n); k = 0.9965 if f < 400 else 0.995
    b = buf.tolist()
    for i in range(n):
        j = i % P
        v = b[j]; out[i] = v
        b[j] = k * 0.5 * (v + b[(j + 1) % P])
    x = tt(n)
    click = band(rng.standard_normal(n), 2000, 8000) * np.exp(-x * 120) * 0.25
    s = out + click
    return s / np.abs(s).max()

def gong():
    n = int(7.0 * SR); x = tt(n)
    ratios = [1, 1.47, 2.03, 2.76, 3.42, 4.1, 5.3, 6.7]
    s = np.zeros(n)
    for i, r in enumerate(ratios):
        bloom = 1 - np.exp(-x * (8 / (i + 1)))
        s += (1 / (1 + i * .6)) * np.sin(2 * np.pi * 98 * r * x * (1 + 0.0015 * np.sin(2 * np.pi * .7 * x))) * bloom * np.exp(-x / (5.5 - i * .5))
    s *= np.minimum(x / 0.01, 1)
    return s / np.abs(s).max()

def laser(d):
    n = int(d * SR); x = tt(n)
    hum = 0.5 * np.sin(2 * np.pi * 100 * x) + 0.25 * np.sin(2 * np.pi * 300 * x) + 0.08 * np.sin(2 * np.pi * 7800 * x)
    crack = np.zeros(n)
    for _ in range(int(d * 260)):
        i = rng.integers(0, n - 2000); m = int(rng.uniform(80, 900))
        crack[i:i + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 4)) * rng.uniform(.2, 1)
    crack = band(crack, 1500, 12000)
    env = np.minimum(x / 0.08, 1) * np.minimum((d - x) / 0.2, 1)
    s = (hum * 0.35 + crack / (np.abs(crack).max() + 1e-9)) * env
    return s / np.abs(s).max()

def bass(f, d=0.48):
    n = int(d * SR); x = tt(n)
    s = np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * 2 * f * x) + 0.12 * np.sin(2 * np.pi * 3 * f * x)
    return s * np.minimum(x / 0.006, 1) * np.exp(-x * 5)

# ---- nappe grave (ré) : monte jusqu'au kanji, respire, revient en fin ----
x = tt(N)
drone = np.zeros(N)
for f, a in [(36.71, 1.0), (55.0, .5), (73.42, .45), (110.0, .18), (146.83, .08)]:
    drone += a * np.sin(2 * np.pi * f * x + 0.4 * np.sin(2 * np.pi * 0.11 * x))
auto = np.interp(x, [0, 1.5, 3.2, 3.25, 9.6, 10.6, 11.6, 25.6, 28.1, 31.6, 35.5, DUR],
                    [0, .5, .8, .55, .6, .25, .45, .35, .55, .4, .55, 0])
drone *= auto
add(0, np.stack([drone, np.roll(drone, 240)], 1), 0.085, rev=0.4)

# ---- impacts ----
for t, size in reel["hits"]:
    g = {"big": 1.0, "mid": 0.62, "small": 0.38}[size]
    add(t, taiko(size), g, pan=0.0, rev=0.35 if size != "small" else 0.15)
    if size == "big":
        add(t, ka(), 0.25, pan=-.2, rev=.3)
add(reel["gong"], gong(), 0.55, rev=0.6)

# ---- rythme du montage (120 bpm) ----
beat = reel["beat"]
bassline = [NOTE["D2"], NOTE["D2"], NOTE["Bb1"], NOTE["C2"]]
for a, b in reel["rhythm"]:
    k = 0; t = a
    while t < b - 0.01:
        bar = k % 4
        if bar == 0: add(t, taiko("mid"), 0.34, pan=-0.1, rev=0.25)
        if bar == 2: add(t, taiko("mid"), 0.24, pan=0.15, rev=0.25)
        add(t, bass(bassline[(k // 4) % 4]), 0.32, rev=0.05)
        add(t + beat / 2, taiko("small"), 0.13 + 0.05 * (k % 2), pan=0.35 * (-1) ** k, rev=0.1)
        if k % 2 == 1: add(t + beat * 0.75, ka(), 0.1, pan=-0.4, rev=0.15)
        k += 1; t = a + k * beat

# ---- transitions et scintillements ----
for t in reel["whoosh"]: add(t - 0.2, whoosh(), 0.42, rev=0.3)
for a, b in reel["risers"]: add(a, riser(b - a), 0.42 if b - a > 1.2 else 0.3, rev=0.3)
for t in reel["shimmer"]: add(t, shimmer(), 0.13, rev=0.5)
for t0, notes, gap in reel["koto"]:
    for i, nm in enumerate(notes):
        add(t0 + i * gap, koto(NOTE[nm]), 0.46, pan=(-0.3 + 0.15 * i), rev=0.45)
a, b = reel["laser"]; add(a, laser(b - a), 0.5, rev=0.2)

# ---- réverbération (convolution, réponse impulsionnelle synthétique 3 s) ----
L = int(3.0 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / 0.75)[:, None]
ir[: int(0.02 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR)
    ir[:, c] = np.fft.irfft(S / (1 + (f / 3500) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 18
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)
mix = dry + wet * 0.55

# ---- master : passe-haut 28 Hz, saturation douce, fondu final ----
for c in range(2):
    S = np.fft.rfft(mix[:, c]); f = np.fft.rfftfreq(N, 1 / SR)
    S *= 1 / np.sqrt(1 + (28 / np.maximum(f, 1)) ** 8)
    mix[:, c] = np.fft.irfft(S, N)
mix /= np.abs(mix).max() / 0.9
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
f0, f1 = reel["fadeOut"]
mix *= np.clip((f1 - tt(N)) / (f1 - f0), 0, 1)[:, None]
mix[int(f1 * SR):] = 0
pcm = (mix * 32767 * 0.97).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"audio : {DUR:.1f} s")
