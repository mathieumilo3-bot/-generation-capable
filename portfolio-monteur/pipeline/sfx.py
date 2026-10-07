"""Banque de bruitages synthétisés (déterministes) → public/sfx/*.wav

whoosh, swoosh, pop, click, tick, riser, impact, sub, shimmer, glitch, shutter
"""
import sys
from pathlib import Path

import numpy as np
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import PUBLIC, SR, write_wav  # noqa: E402

rng = np.random.default_rng(42)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a, d, curve=4.0):
    """attaque linéaire puis décroissance exponentielle (en secondes)."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e


def bandsweep(noise, f0, f1, q=1.2, steps=64):
    """bruit filtré passe-bande dont la fréquence glisse de f0 à f1 (log)."""
    n = len(noise)
    out = np.zeros(n)
    edges = np.linspace(0, n, steps + 1).astype(int)
    zi = None
    for k in range(steps):
        f = f0 * (f1 / f0) ** (k / (steps - 1))
        lo, hi = f / (1 + 1 / q), min(f * (1 + 1 / q), SR / 2 * 0.95)
        sos = signal.butter(2, [lo, hi], btype='band', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg, zi = signal.sosfilt(sos, noise[edges[k]: edges[k + 1]], zi=zi)
        out[edges[k]: edges[k + 1]] = seg
    return out


def stereo(x, width=0.3, delay_ms=7):
    d = int(SR * delay_ms / 1000)
    l = x
    r = np.concatenate([np.zeros(d), x[:-d]]) if d else x
    return np.stack([l * (1 - width / 2) + r * width / 2, r * (1 - width / 2) + l * width / 2], axis=1)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x * (peak / m)


def whoosh(d=0.75, f0=300, f1=4200, peak=0.85):
    n = int(d * SR)
    x = bandsweep(rng.standard_normal(n), f0, f1, q=1.6)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * u ** 0.75) ** 2.2
    return stereo(norm(x * e, peak), width=0.6, delay_ms=11)


def swoosh():
    a = whoosh(0.42, 900, 7000, 0.8)
    return a


def pop():
    t = t_(0.14)
    f = 900 * np.exp(-t * 28) + 260
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.06)
    click = rng.standard_normal(len(t)) * env(len(t), 0.0005, 0.004) * 0.3
    return stereo(norm(x + click, 0.8), width=0.1)


def click():
    t = t_(0.05)
    x = rng.standard_normal(len(t)) * env(len(t), 0.0003, 0.006)
    x = signal.sosfilt(signal.butter(2, [1800, 9000], btype='band', fs=SR, output='sos'), x)
    return stereo(norm(x, 0.6), width=0.05)


def tick():
    t = t_(0.06)
    x = np.sin(2 * np.pi * 2400 * t) * env(len(t), 0.0005, 0.012) + 0.4 * np.sin(2 * np.pi * 5100 * t) * env(len(t), 0.0003, 0.006)
    return stereo(norm(x, 0.45), width=0.05)


def riser(d=1.6):
    n = int(d * SR)
    u = np.linspace(0, 1, n)
    x = bandsweep(rng.standard_normal(n), 200, 9000, q=2.0) * u ** 2.2
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (u * 3)) / SR) * 0.25 * u ** 3
    return stereo(norm(x + tone, 0.75), width=0.8, delay_ms=13)


def impact(d=1.8):
    n = int(d * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 6) + 38) / SR) * env(n, 0.002, 0.9, curve=3.5)
    noise = signal.sosfilt(signal.butter(2, 2500, btype='low', fs=SR, output='sos'), rng.standard_normal(n)) * env(n, 0.001, 0.18)
    crack = rng.standard_normal(n) * env(n, 0.0005, 0.02) * 0.5
    tail = signal.sosfilt(signal.butter(2, [200, 3000], btype='band', fs=SR, output='sos'), rng.standard_normal(n)) * env(n, 0.01, 1.2, curve=3) * 0.18
    return stereo(norm(sub * 1.0 + noise * 0.6 + crack + tail, 0.95), width=0.5)


def sub_drop(d=1.2):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 3) + 32) / SR) * env(n, 0.003, 0.8, curve=3)
    return stereo(norm(x, 0.9), width=0)


def shimmer(d=1.4):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, f in enumerate([1318.5, 1760, 2093, 2637, 3136]):
        start = int(k * 0.045 * SR)
        e = np.zeros(n)
        e[start:] = env(n - start, 0.002, 0.7, curve=3)
        x += np.sin(2 * np.pi * f * t + k) * e * (0.6 if k % 2 else 0.4)
    return stereo(norm(x, 0.5), width=0.9, delay_ms=17)


def glitch():
    n = int(0.22 * SR)
    x = np.zeros(n)
    pos = 0
    while pos < n:
        L = int(rng.uniform(0.008, 0.03) * SR)
        f = rng.uniform(200, 3000)
        seg = np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * rng.uniform(0.2, 0.6)
        x[pos: pos + L] = seg[: max(0, min(L, n - pos))]
        pos += L + int(rng.uniform(0, 0.01) * SR)
    x = signal.sosfilt(signal.butter(2, 6000, btype='low', fs=SR, output='sos'), x)
    return stereo(norm(x, 0.45), width=0.7)


def shutter():
    n = int(0.12 * SR)
    a = rng.standard_normal(n) * env(n, 0.0005, 0.012)
    b = np.roll(rng.standard_normal(n) * env(n, 0.0005, 0.02), int(0.05 * SR))
    x = signal.sosfilt(signal.butter(2, [1500, 8000], btype='band', fs=SR, output='sos'), a + b * 0.8)
    return stereo(norm(x, 0.6), width=0.2)


BANK = {
    'whoosh': whoosh,
    'swoosh': swoosh,
    'pop': pop,
    'click': click,
    'tick': tick,
    'riser': riser,
    'impact': impact,
    'sub': sub_drop,
    'shimmer': shimmer,
    'glitch': glitch,
    'shutter': shutter,
}

if __name__ == '__main__':
    out = PUBLIC / 'sfx'
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in BANK.items():
        write_wav(out / f'{name}.wav', fn())
    print('sfx :', ', '.join(BANK))
