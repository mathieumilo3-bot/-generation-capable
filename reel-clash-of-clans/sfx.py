# Bruitages + boucle rythmique synthétisés à partir du script : python3 sfx.py videos/xx.json sortie.wav
import json, sys, wave
import numpy as np

SR = 44100
script = json.load(open(sys.argv[1]))
t = 0
for sc in script["scenes"]:
    sc["start"] = t
    t += sc["dur"]
dur = t + 0.3
mix = np.zeros(int(dur * SR))
rng = np.random.default_rng(3)

def add(at, sig, gain):
    i = int(at * SR)
    j = min(len(mix), i + len(sig))
    mix[i:j] += sig[: j - i] * gain

def env(n, a=0.004, d=0.1):
    x = np.arange(n) / SR
    return np.minimum(x / a, 1) * np.exp(-x / d)

def pop():
    n = int(0.12 * SR); x = np.arange(n) / SR
    f = 900 * np.exp(-x * 25) + 350
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.04)

def whoosh():
    n = int(0.35 * SR); x = np.arange(n) / SR
    noise = rng.standard_normal(n)
    k = np.exp(-np.linspace(0, 6, 64)); k /= k.sum()
    noise = np.convolve(noise, k, "same")
    shape = np.sin(np.pi * x / x[-1]) ** 2
    return noise * shape

def ding():
    n = int(0.8 * SR); x = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1318 * x) + 0.5 * np.sin(2 * np.pi * 1975 * x)) * env(n, 0.002, 0.25)

def kick():
    n = int(0.25 * SR); x = np.arange(n) / SR
    f = 150 * np.exp(-x * 30) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.12)

def hat():
    n = int(0.05 * SR)
    return np.diff(rng.standard_normal(n + 1)) * env(n, 0.001, 0.012)

def bass(freq, length):
    n = int(length * SR); x = np.arange(n) / SR
    s = np.sign(np.sin(2 * np.pi * freq * x)) * 0.5 + np.sin(2 * np.pi * freq * x)
    return s * env(n, 0.005, length * 0.6)

# boucle 128 bpm
beat = 60 / 128
notes = [55, 55, 65.4, 49]
b = 0
while b * beat < dur:
    add(b * beat, kick(), 0.55)
    add(b * beat + beat / 2, hat(), 0.12)
    if b % 2 == 0:
        add(b * beat, bass(notes[(b // 8) % 4], beat * 1.8), 0.09)
    b += 1

for sc in script["scenes"]:
    s = sc["start"]
    if s > 0:
        add(s - 0.12, whoosh(), 0.35)
    if sc["type"] == "card":
        add(s + 0.28, ding(), 0.28)
        add(s + 0.18, pop(), 0.4)
        add(s + 0.4, pop(), 0.4)
    for c in sc.get("captions", []):
        add(s + c["t"], pop(), 0.45)
    if sc["type"] == "teaser":
        add(s, pop(), 0.4)
        for i in range(len(sc["icons"])):
            add(s + 0.25 + i * 0.3, pop(), 0.4)
    if sc.get("big"):
        add(s + sc["big"]["t"], ding(), 0.3)
    if sc["type"] == "cta":
        add(s + sc["cardAt"], whoosh(), 0.4)
        add(s + sc["tapAt"], pop(), 0.6)
        add(s + sc["bioAt"], ding(), 0.35)

mix /= max(1e-6, np.abs(mix).max()) / 0.85
fade = int(0.3 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
pcm = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"audio : {dur:.1f} s")
