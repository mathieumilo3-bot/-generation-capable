# Musique originale + bruitages, synthétisés à partir de reel.json : python3 -I sfx.py reel.json sortie.wav
# Trap/phonk épique à 140 bpm en fa mineur (Fm – Ab – Bbm – C) : 808 saturée avec glissés, cloche phonk en mélodie,
# caisse claire lourde au demi-temps, charleys en roulements, « BRAAAM » de bande-annonce et chœurs sur les impacts.
# Signature plomberie : coups de tuyau sur les gestes, gouttes, chasses d'eau, bulles quand le « 21 » se remplit.
# Structure (mesures) : accroche 0-3, montée 4-5, drop 6-14, coupure 15-16, groove 17-22, montée 23-24, drop final 25-26, fin.
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
rng = np.random.default_rng(140)

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

def filt(sig, h_of_f):
    S = np.fft.rfft(sig, axis=0); f = np.fft.rfftfreq(len(sig), 1 / SR); h = h_of_f(np.maximum(f, 1))
    return np.fft.irfft(S * (h[:, None] if sig.ndim == 2 else h), len(sig), axis=0)
def band(sig, lo, hi): return filt(sig, lambda f: ((f >= lo) & (f <= hi)).astype(float))
def lowpass(sig, fc, o=4): return filt(sig, lambda f: 1 / np.sqrt(1 + (f / fc) ** o))
def norm(s): return s / (np.abs(s).max() + 1e-9)
def saw(f, n, ph=0.0): return 2 * ((np.cumsum(np.broadcast_to(f, (n,))) / SR + ph) % 1) - 1
def square(f, n): return np.sign(np.sin(2 * np.pi * f * tt(n)))

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
    n = int(0.3 * SR); x = tt(n)
    f = 52 + 180 * np.exp(-x * 55)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 11) + band(rng.standard_normal(n), 2500, 9000) * np.exp(-x * 400) * 0.6
    return norm(np.tanh(3.0 * s))
KICK = kick()

def snare():
    # caisse claire trap lourde : corps + bruit + clap superposés
    n = int(0.5 * SR); x = tt(n)
    body = np.sin(2 * np.pi * np.cumsum(190 + 60 * np.exp(-x * 40)) / SR) * np.exp(-x * 22)
    nz = band(rng.standard_normal(n), 1200, 11000) * np.exp(-x * 13)
    cl = band(rng.standard_normal(n), 900, 5000) * sum(np.exp(-np.maximum(x - d, 0) / 0.006) * (x >= d) for d in (0, .009, .018))
    return norm(np.tanh(1.8 * (body * .8 + nz * .9 + cl * .7)))
SNARE = snare()

def hat(open_=False):
    n = int((0.25 if open_ else 0.04) * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 7500, 18000) * np.exp(-x / (0.07 if open_ else 0.008)))
HAT, OHAT = hat(), hat(True)

def crash():
    n = int(2.4 * SR); x = tt(n)
    return norm(band(rng.standard_normal(n), 3500, 16000) * np.exp(-x / 0.7) * np.minimum(x / 0.002, 1))

def boom(size):
    d = {"big": 2.2, "mid": 0.9, "small": 0.45}[size]; n = int(d * SR); x = tt(n)
    f = (36 if size == "big" else 50) + 80 * np.exp(-x * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * {"big": 1.6, "mid": 4.5, "small": 9}[size])
    s += band(rng.standard_normal(n), 150, 3000) * np.exp(-x * 28) * 0.6
    return norm(np.tanh(2.0 * s) * np.minimum(x / 0.002, 1))

# ---------------- 808 saturée ----------------
def b808(f, d, glide_to=None):
    n = int(d * SR); x = tt(n)
    fr = f * (1 + 1.2 * np.exp(-x * 50))
    if glide_to: fr = fr * np.where(x < d * .55, 1, (glide_to / f) ** np.clip((x - d * .55) / (d * .3), 0, 1))
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR)
    env = np.minimum(x / 0.002, 1) * np.clip((d - x) / 0.025, 0, 1) * (0.75 + 0.25 * np.exp(-x * 4))
    return np.tanh(4.0 * s * env) / np.tanh(4.0)

# ---------------- cloche phonk ----------------
_cb = {}
def cowbell(name):
    if name in _cb: return _cb[name]
    f = freq(name); n = int(0.5 * SR); x = tt(n)
    s = square(f, n) + 0.8 * square(f * 1.483, n)
    s = band(s, 350, 6000) * (np.exp(-x * 22) + 0.22 * np.exp(-x * 5))
    _cb[name] = norm(np.tanh(2.5 * norm(s)) * np.minimum(x / 0.001, 1))
    return _cb[name]

# ---------------- cuivres et chœurs de bande-annonce ----------------
def braam(notes, d=2.6):
    # « BRAAAM » : pile de dents de scie désaccordées, filtre qui s'ouvre d'un coup puis se referme, saturation
    n = int(d * SR); x = tt(n); s = np.zeros(n)
    for nm in notes:
        f = freq(nm)
        for det in (-11, -4, 4, 11): s += saw(f * 2 ** (det / 1200), n, rng.uniform())
    dark, bright = lowpass(s, 260), lowpass(s, 2600)
    e = np.minimum(x / 0.06, 1) * np.exp(-np.maximum(x - .06, 0) * 2.2)
    out = dark * (1 - e) + bright * e
    out = np.tanh(2.2 * norm(out)) * np.minimum(x / 0.02, 1) * np.clip((d - x) / 0.6, 0, 1)
    return norm(out)

def stab(notes, d=0.32):
    n = int(d * SR); x = tt(n); s = np.zeros(n)
    for nm in notes:
        for det in (-9, 9): s += saw(freq(nm) * 2 ** (det / 1200), n, rng.uniform())
    out = lowpass(s, 3200) * np.exp(-x * 9) + band(rng.standard_normal(n), 300, 5000) * np.exp(-x * 60) * 2
    return norm(np.tanh(1.8 * norm(out)))

def choir(notes, d):
    # chœur « ah » : dents de scie avec vibrato, passées dans trois formants
    n = int(d * SR); x = tt(n); s = np.zeros((n, 2))
    for k, nm in enumerate(notes):
        for c, det in ((0, -6), (1, 6)):
            f = freq(nm) * 2 ** (det / 1200) * (1 + .005 * np.sin(2 * np.pi * (5 + k * .3) * x))
            s[:, c] += saw(f, n, rng.uniform())
    form = lambda f: sum(a * np.exp(-0.5 * ((f - c) / w) ** 2) for c, w, a in ((800, 110, 1), (1150, 130, .6), (2900, 250, .25)))
    s = filt(s, form)
    env = np.minimum(x / 0.5, 1) * np.clip((d - x) / 0.5, 0, 1)
    return s / (np.abs(s).max() + 1e-9) * env[:, None]

# ---------------- signature : tuyau, goutte, eau ----------------
def clang():
    n = int(1.6 * SR); x = tt(n); s = np.zeros(n)
    for f, a, d in ((523, 1, .9), (1187, .7, .55), (1873, .55, .4), (2741, .4, .3), (3698, .3, .2), (4420, .2, .14)):
        s += a * np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * np.exp(-x / d)
    s += band(rng.standard_normal(n), 3000, 12000) * np.exp(-x * 200) * 0.8
    return norm(s * np.minimum(x / 0.0008, 1))

def bloop():
    n = int(0.35 * SR); x = tt(n)
    f = 650 + 1500 * (1 - np.exp(-x * 60))
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 22) * np.minimum(x / 0.001, 1))

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

def whoosh(d=0.5):
    n = int(d * SR); x = tt(n); s = sweep(n, 300, 5000, .55) * np.sin(np.pi * x / d) ** 2.2
    return np.stack([s * np.linspace(1.2, .5, n), s * np.linspace(.5, 1.2, n)], 1)

def riser(d):
    n = int(d * SR); x = tt(n); p = x / d
    s = sweep(n, 200, 10000, .45) * p ** 2 + np.sin(2 * np.pi * np.cumsum(110 * 2 ** (3 * p)) / SR) * p ** 2.5 * .35
    return norm(s)

def subdrop(d=1.6):
    n = int(d * SR); x = tt(n)
    return norm(np.tanh(2 * np.sin(2 * np.pi * np.cumsum(75 * (28 / 75) ** (x / d)) / SR)) * np.exp(-x * 1.5) * np.minimum(x / .005, 1))

# =============== ARRANGEMENT ===============
ROOT = ["F1", "Ab1", "Bb1", "C2"]
CHORD = [("F3", "Ab3", "C4"), ("Eb3", "Ab3", "C4"), ("F3", "Bb3", "Db4"), ("E3", "G3", "C4")]
BELL = [[(0, "F5"), (3, "C5"), (6, "F5"), (8, "Ab5"), (10, "G5"), (11, "F5"), (14, "C5")],
        [(0, "Eb5"), (3, "C5"), (6, "Eb5"), (8, "Ab5"), (10, "G5"), (11, "Eb5"), (14, "C5")],
        [(0, "Db5"), (3, "Bb4"), (6, "Db5"), (8, "F5"), (10, "Eb5"), (11, "Db5"), (14, "Bb4")],
        [(0, "E5"), (3, "C5"), (6, "E5"), (8, "G5"), (10, "F5"), (11, "E5"), (13, "Db5"), (14, "C5")]]
BRAAM = ("F1", "F2", "C3", "F3", "Ab3")
kick_times = []

def bar(n, drums=True, bass=True, bell=True, snare_=True, rolls=True, big=False, dark=False):
    t0 = n * BAR; c = n % 4
    if drums:
        for s in ((0, 10) if n % 2 == 0 else (0, 6, 10)):
            add("drums", t0 + s * S16, KICK, 0.85); kick_times.append(t0 + s * S16)
        # charleys : doubles croches, roulements en triolets ou en triples croches sur la fin de mesure
        hs = [s * S16 for s in range(16)]
        if rolls:
            if n % 2 == 1: hs = [h for h in hs if h < 12 * S16] + [12 * S16 + k * S16 / 2 for k in range(8)]
            else: hs = [h for h in hs if not (4 * S16 <= h < 8 * S16)] + [4 * S16 + k * b / 6 for k in range(6)]
        for k, h in enumerate(sorted(hs)):
            add("drums", t0 + h, HAT, 0.22 + 0.08 * (k % 2 == 0), pan=.22)
        add("drums", t0 + 6 * S16, OHAT, 0.14, pan=-.25)
    if snare_:
        add("drums", t0 + 8 * S16, SNARE, 0.75, rev=.22)
        if big: add("drums", t0 + 15 * S16, SNARE, 0.25, pan=.15, rev=.2)
    if bass:
        pat = [0, 3, 6, 10, 13]
        for i, s in enumerate(pat):
            nxt = pat[i + 1] if i + 1 < len(pat) else 16
            f = freq(ROOT[c]); gl = f * 2 if (s == 13 and n % 2 == 1) else None
            add("bass", t0 + s * S16, b808(f, (nxt - s) * S16 + .015, gl), 0.9)
    if bell:
        for s, nm in BELL[c]:
            g = 0.3 if not dark else 0.16
            add("music", t0 + s * S16, cowbell(nm), g, pan=-.1, rev=.2)
            add("music", t0 + s * S16 + 3 * S16, cowbell(nm), g * .28, pan=.45, rev=.3)   # écho
            if big: add("music", t0 + s * S16, cowbell(nm[:-1] + str(int(nm[-1]) + 1)), g * .45, pan=.2, rev=.2)

def snare_roll(t0, d, gain=.5):
    t = t0
    while t < t0 + d - 1e-6:
        p = (t - t0) / d
        add("drums", t, SNARE, 0.08 + gain * p ** 1.6, pan=.1, rev=.15)
        t += S16 if p < .5 else (S16 / 2 if p < .8 else S16 / 3)

# --- accroche (mesures 0-3) : ça cogne dès la première seconde, la caisse claire arrive à la mesure 2 ---
add("music", 0, braam(BRAAM, 1.6), 0.5, rev=.3)
for n in range(4): bar(n, snare_=n >= 2, rolls=n >= 2)

# --- montée (mesures 4-5) : chœur, roulement sur deux mesures, 808 qui monte, silence avant le drop ---
add("music", 4 * BAR, choir(("F4", "Ab4", "C5"), 2 * BAR + .3), 0.35, rev=.5)
for n in (4, 5):
    for s_, nm in BELL[n % 4]: add("music", n * BAR + s_ * S16, cowbell(nm), 0.12 + .04 * (n - 4), rev=.4)
bar(4, drums=False, bass=False, bell=False)
snare_roll(4 * BAR, 2 * BAR - 2 * S16)
add("bass", 5 * BAR, b808(freq("F1"), BAR - 2 * S16, freq("F2")), 0.6)

# --- drop (mesures 6-14) : logo, titre, les gestes ---
add("music", T["logo"], braam(BRAAM), 0.6, rev=.35)
for n in range(6, 15):
    bar(n, big=n >= 12)
    if n % 2 == 0: add("music", n * BAR, stab(CHORD[n % 4]), 0.32, rev=.25)

# --- coupure (mesures 15-16) : la salle, chœur et 808 tenue ---
add("music", 15 * BAR, choir(("F4", "Ab4", "C5", "F5"), 2 * BAR + .4), 0.4, rev=.5)
for n in (15, 16):
    add("bass", n * BAR, b808(freq(ROOT[n % 4]), BAR * .9), 0.7)
    bar(n, drums=False, bass=False, snare_=False, dark=True)
    for k in range(8): add("drums", n * BAR + k * b / 2, HAT, 0.08, pan=.3)

# --- groove (mesures 17-22) : diagnostic, pratique, formateur ---
for n in range(17, 23): bar(n, big=n >= 21)
add("music", T["auteur"], braam(BRAAM, 2.0), 0.4, rev=.4)

# --- montée (mesures 23-24) : kick aux temps puis à la croche, roulement serré, 808 qui glisse ---
for k in range(4):
    tk = 23 * BAR + k * b; add("drums", tk, KICK, 0.45); kick_times.append(tk)
for k in range(7):
    tk = 24 * BAR + k * b / 2; add("drums", tk, KICK, 0.5 + .06 * k); kick_times.append(tk)
snare_roll(23 * BAR, 2 * BAR - 2 * S16, .6)
add("bass", 23 * BAR, b808(freq("C2"), BAR), 0.55)
add("bass", 24 * BAR, b808(freq("C2"), BAR - 2 * S16, freq("C3")), 0.6)
add("music", 23 * BAR, choir(("E4", "G4", "C5"), 2 * BAR), 0.3, rev=.5)
for s_, nm in BELL[3]: add("music", 23 * BAR + s_ * S16, cowbell(nm), 0.16, rev=.4)

# --- drop final (mesures 25-26) ---
add("music", T["date"], braam(BRAAM, 3.0), 0.7, rev=.4)
add("music", T["date"], choir(("F4", "Ab4", "C5", "F5"), 2 * BAR), 0.25, rev=.5)
add("drums", T["date"], crash(), 0.32, rev=.3)
for n in (25, 26):
    bar(n, big=True)
    add("music", n * BAR, stab(CHORD[n % 4]), 0.36, rev=.25)

# --- fin : braam, chœur, 808 tenue, dernière phrase de cloche en écho ---
t15 = 27 * BAR
add("music", t15, braam(BRAAM, 3.2), 0.5, rev=.5)
add("music", t15, choir(("F4", "Ab4", "C5", "F5"), DUR - t15), 0.3, rev=.6)
add("bass", t15, b808(freq("F1"), 2.2), 0.8)
add("drums", t15, SNARE, 0.5, rev=.4)
for s, nm in BELL[0]:
    add("music", t15 + s * S16, cowbell(nm), 0.2, rev=.5); add("music", t15 + (s + 3) * S16, cowbell(nm), 0.07, pan=.5, rev=.5)

# --- impacts, gestes, gouttes, eau, transitions ---
for t, size in reel["hits"]:
    add("fx", t, boom(size), {"big": .9, "mid": .35, "small": .18}[size], rev=.25)
    if size == "big": add("bass", t, subdrop(), 0.7); add("drums", t, crash(), 0.25, rev=.25)
for t in reel["clang"]: add("fx", t, clang(), 0.3, pan=rng.uniform(-.3, .3), rev=.35)
for t in reel["drops"]: add("fx", t - .02, bloop(), 0.3, rev=.5)
for t in reel["whoosh"]: add("fx", t - .22, whoosh(), 0.3, rev=.3)
for a, z in reel["risers"]: add("fx", a, riser(z - a - S16 * 2), 0.36, rev=.3)
for t in reel["wipes"]: add("fx", t - .4, flush(), 0.42, rev=.35)
for t in reel["reverse"]:
    add("fx", t - 1.2, crash()[::-1][-int(1.2 * SR):], 0.32, rev=.2)
a, z = reel["fill"]; add("fx", a, bubbles(z - a + .4, 70, 300, 900, grow=True), 0.22, pan=-.1, rev=.4)

# =============== MIXAGE ===============
kenv = np.zeros(N)
for kt in kick_times:
    i = int(kt * SR); m = min(N - i, int(.3 * SR))
    if m > 0: kenv[i:i + m] = np.maximum(kenv[i:i + m], np.exp(-np.arange(m) / (.08 * SR)))
duck = (1 - .5 * kenv)[:, None]

L = int(2.2 * SR); xi = tt(L)
ir = rng.standard_normal((L, 2)) * np.exp(-xi / .5)[:, None]; ir[: int(.015 * SR)] = 0
for c in range(2):
    S = np.fft.rfft(ir[:, c]); f = np.fft.rfftfreq(L, 1 / SR); ir[:, c] = np.fft.irfft(S / (1 + (f / 5000) ** 2), L)
ir /= np.abs(ir).sum(0).max() / 16
M = 1 << int(np.ceil(np.log2(N + L)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], M) * np.fft.rfft(ir[:, c], M), M)[:N] for c in range(2)], 1)

G = {"drums": 1.0, "bass": 0.36, "music": 2.0, "fx": 0.85}
for k, v in BUS.items():
    seg = v[int(T["coupe"] * SR):int(T["theorie"] * SR)]
    print(f"  {k:6s} RMS drop : {20 * np.log10(G[k] * np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dB")
mix = BUS["drums"] * G["drums"] + BUS["bass"] * G["bass"] + BUS["music"] * G["music"] * duck + BUS["fx"] * G["fx"] + wet * 0.4 * duck
mix = filt(mix, lambda f: 1 / np.sqrt(1 + (28 / f) ** 8))            # coupe-bas sous 28 Hz
mix = np.tanh(1.8 * mix / np.abs(mix).max()) / np.tanh(1.8) * 0.95    # saturation de bus : ça pousse
fa, fb = reel["fadeOut"]; x = tt(N)
mix *= np.clip((fb + .25 - x) / (fb + .25 - fa), 0, 1)[:, None]

with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("bande-son :", sys.argv[2], f"{DUR:.1f} s")
