"""synth.py — mini studio audio en numpy : instruments, effets, mixage, mastering.

Tout est généré (aucun sample) : batteries, basses, nappes, risers, impacts, whooshes.
Le mastering vise -14 LUFS / -1 dBFS (standard Instagram / YouTube / Vimeo).
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
RNG = np.random.default_rng(7)

NOTE_IDX = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(note):
    """'F2' -> fréquence (A4 = 440 Hz)."""
    if isinstance(note, (int, float)):
        return float(note)
    name, octave = note[:-1], int(note[-1])
    midi = NOTE_IDX[name] + (octave + 1) * 12
    return 440.0 * 2 ** ((midi - 69) / 12)


def tsamp(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur, rng=None):
    rng = rng or RNG
    return rng.standard_normal(int(dur * SR))


# ───────────────────────── filtres ─────────────────────────
def _biquad(kind, f, q=0.707, gain_db=0.0):
    f = min(max(f, 10.0), SR * 0.45)
    w0 = 2 * np.pi * f / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'bp':
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'peak':
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
        a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
    elif kind == 'highshelf':
        sq = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
        a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def filt(x, kind, f, q=0.707, gain_db=0.0):
    b, a = _biquad(kind, f, q, gain_db)
    return signal.lfilter(b, a, x, axis=-1)


def sweep(x, kind, fc, q=0.707, block=64):
    """Filtre dont la fréquence varie : fc(p) avec p ∈ [0,1] sur la durée du son."""
    n = x.shape[-1]
    y = np.zeros_like(x)
    zi = np.zeros(2) if x.ndim == 1 else np.zeros((x.shape[0], 2))
    for i in range(0, n, block):
        b, a = _biquad(kind, fc(i / max(1, n - 1)), q)
        if x.ndim == 1:
            y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
        else:
            for c in range(x.shape[0]):
                y[c, i:i + block], zi[c] = signal.lfilter(b, a, x[c, i:i + block], zi=zi[c])
    return y


def exp_curve(f0, f1, power=1.0):
    return lambda p: f0 * (f1 / f0) ** (p ** power)


# ───────────────────────── enveloppes ─────────────────────────
def env_exp(dur, decay, attack=0.001):
    t = tsamp(dur)
    e = np.exp(-t / max(decay, 1e-4))
    if attack > 0:
        e *= np.clip(t / attack, 0, 1)
    return e


def env_adsr(dur, a=0.005, d=0.1, s=0.7, r=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-5), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel_start = max(dur - r, a)
    e = np.where(t > rel_start, e * np.clip(1 - (t - rel_start) / max(r, 1e-4), 0, 1) ** 2, e)
    return e


def fade(x, fin=0.002, fout=0.01):
    n = x.shape[-1]
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        x[..., :a] *= np.linspace(0, 1, a)
    if b > 0:
        x[..., n - b:] *= np.linspace(1, 0, b)
    return x


# ───────────────────────── oscillateurs ─────────────────────────
def _phase(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return np.cumsum(f / SR), f / SR


def sine(freq, dur, phase0=0.0):
    n = int(dur * SR)
    ph, _ = _phase(freq, n)
    return np.sin(2 * np.pi * (ph + phase0))


def saw(freq, dur, phase0=0.0):
    """Dent de scie anti-aliasée (polyBLEP)."""
    n = int(dur * SR)
    ph, dt = _phase(freq, n)
    t = (ph + phase0) % 1.0
    y = 2 * t - 1
    m = t < dt
    x = t[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = t > 1 - dt
    x = (t[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def square(freq, dur, width=0.5):
    return 0.5 * (saw(freq, dur) - saw(freq, dur, phase0=width))


def supersaw(freq, dur, voices=7, detune=0.18, stereo=True, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for v in range(voices):
        off = (v - (voices - 1) / 2) / ((voices - 1) / 2) if voices > 1 else 0
        cents = off * detune * 100
        f = np.asarray(freq) * 2 ** (cents / 1200)
        s = saw(f, dur, phase0=rng.random())
        pan = 0.5 + 0.5 * off * (0.9 if stereo else 0)
        L += s * np.cos(pan * np.pi / 2)
        R += s * np.sin(pan * np.pi / 2)
    return np.stack([L, R]) / np.sqrt(voices)


def fm(fc, ratio, index, dur, index_env=None):
    n = int(dur * SR)
    ph_m, _ = _phase(np.asarray(fc) * ratio, n)
    I = index * (index_env if index_env is not None else 1)
    ph_c, _ = _phase(fc, n)
    return np.sin(2 * np.pi * ph_c + I * np.sin(2 * np.pi * ph_m))


def karplus(freq, dur, bright=0.5, decay=0.996, seed=1):
    """Corde pincée (Karplus-Strong), vectorisée période par période."""
    rng = np.random.default_rng(seed)
    N = max(2, int(round(SR / freq)))
    n = int(dur * SR)
    buf = rng.uniform(-1, 1, N)
    buf = filt(buf, 'lp', 800 + bright * 9000)
    out = np.zeros(n + N)
    out[:N] = buf
    for i in range(N, n + N, N):
        prev = out[i - N:i]
        nxt = 0.5 * (prev + np.roll(prev, 1)) * decay
        out[i:i + N] = nxt[: len(out[i:i + N])]
    return out[:n]


# ───────────────────────── instruments : batterie ─────────────────────────
def kick(f0=230, f1=46, pitch_decay=0.032, decay=0.32, click=0.6, drive=1.6, dur=0.7):
    t = tsamp(dur)
    f = f1 + (f0 - f1) * np.exp(-t / pitch_decay)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, decay, 0.0008)
    ck = filt(noise(dur), 'hp', 2500) * env_exp(dur, 0.0025) * click
    ck += sine(3800, dur) * env_exp(dur, 0.004) * click * 0.5
    x = np.tanh(drive * (body + ck)) / np.tanh(drive)
    return fade(x, 0, 0.02)


def sub_boom(f0=70, f1=28, dur=2.2, decay=0.9):
    t = tsamp(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, decay, 0.003)
    return fade(np.tanh(1.4 * x), 0, 0.05)


def clap(dur=0.45, tone=1300, tail=0.16, seed=3):
    rng = np.random.default_rng(seed)
    x = np.zeros(int(dur * SR))
    n = noise(dur, rng)
    for k, off in enumerate([0, 0.009, 0.018, 0.026]):
        e = np.zeros_like(x)
        i = int(off * SR)
        d = tail if k == 3 else 0.006
        tt = np.arange(len(x) - i) / SR
        e[i:] = np.exp(-tt / d) * np.clip(tt / 0.0005, 0, 1)
        x += n * e * (1.0 if k == 3 else 0.8)
    x = filt(x, 'bp', tone, 0.9) + 0.35 * filt(x, 'hp', 4000)
    return fade(x * 1.6, 0, 0.02)


def snare(dur=0.4, tone=190, ndecay=0.17, seed=4):
    t = tsamp(dur)
    f = tone * (1 + 0.4 * np.exp(-t / 0.01))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(dur, 0.07)
    nz = filt(noise(dur, np.random.default_rng(seed)), 'bp', 4500, 0.6) * env_exp(dur, ndecay)
    nz += filt(noise(dur, np.random.default_rng(seed + 1)), 'hp', 7000) * env_exp(dur, ndecay * 0.6) * 0.5
    return fade(np.tanh(1.5 * (0.6 * body + nz)), 0, 0.02)


def _metal(dur, base=320):
    ratios = [1.0, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637]
    return sum(square(base * r, dur) for r in ratios) / 6


def hat(open_=False, dur=None, seed=5, tone=1.0):
    dur = dur or (0.5 if open_ else 0.12)
    m = _metal(dur, 330 * tone)
    nz = noise(dur, np.random.default_rng(seed))
    x = filt(0.6 * m + 0.5 * nz, 'hp', 7200)
    x = filt(x, 'peak', 10500, 1.0, 4)
    return fade(x * env_exp(dur, 0.22 if open_ else 0.028, 0.0004), 0, 0.01)


def crash(dur=2.6, seed=6):
    m = _metal(dur, 410)
    nz = noise(dur, np.random.default_rng(seed))
    x = filt(0.5 * m + 0.8 * nz, 'hp', 3500)
    x = sweep(x * env_exp(dur, 0.75, 0.001), 'lp', exp_curve(16000, 4500), 0.6)
    return fade(x, 0, 0.2)


def rev_cymbal(dur=1.2, seed=8):
    x = crash(dur * 1.4, seed)[: int(dur * SR)][::-1].copy()
    return fade(x * np.linspace(0.2, 1, len(x)) ** 2, 0.05, 0.004)


# ───────────────────────── instruments : tonals ─────────────────────────
def bass(freq, dur, cutoff=900, env_amt=2400, decay=0.18, drive=1.8, sub=0.7):
    x = 0.5 * saw(freq, dur) + 0.5 * saw(np.asarray(freq) * 1.004, dur, 0.37)
    fenv = lambda p: cutoff + env_amt * np.exp(-p * dur / decay)
    x = sweep(x, 'lp', fenv, 1.1)
    x += sub * sine(np.asarray(freq) / 2 if np.asarray(freq).size == 1 and float(freq) > 70 else freq, dur)
    x = np.tanh(drive * x) / np.tanh(drive)
    return fade(x * env_adsr(dur, 0.003, 0.25, 0.75, min(0.05, dur * 0.3)), 0.002, 0.01)


def stab(freqs, dur=0.5, cutoff=3200, decay=0.22, detune=0.16, seed=0):
    out = np.zeros((2, int(dur * SR)))
    for k, f in enumerate(freqs):
        out += supersaw(hz(f), dur, 7, detune, seed=seed + k)
    out = sweep(out, 'lp', lambda p: 600 + cutoff * np.exp(-p * dur / decay), 0.9)
    out *= env_exp(dur, decay * 1.6, 0.002)
    return fade(out / np.sqrt(len(freqs)), 0.002, 0.03)


def pad(freqs, dur, cutoff=1400, attack=0.6, release=0.8, detune=0.22, seed=10, lfo=0.12):
    out = np.zeros((2, int(dur * SR)))
    for k, f in enumerate(freqs):
        out += supersaw(hz(f), dur, 7, detune, seed=seed + k)
    t = tsamp(dur)
    out = sweep(out, 'lp', lambda p: cutoff * (1 + 0.25 * np.sin(2 * np.pi * lfo * p * dur)), 0.7)
    e = np.clip(t / attack, 0, 1) ** 2 * np.clip((dur - t) / release, 0, 1)
    return out * e / np.sqrt(len(freqs))


def bell(freq, dur=2.5, ratio=3.5, index=2.2, decay=1.1):
    e = env_exp(dur, decay, 0.001)
    x = fm(freq, ratio, index, dur, index_env=env_exp(dur, decay * 0.4))
    x += 0.4 * fm(freq * 2.01, 1.0, 0.6, dur)
    return fade(x * e, 0.001, 0.05)


def pluck(freq, dur=0.6, bright=0.6, decay=0.995, seed=1):
    x = karplus(freq, dur, bright, decay, seed)
    return fade(x * env_exp(dur, dur * 0.5, 0.0005), 0.001, 0.02)


def marimba(freq, dur=0.7, decay=0.22):
    t = tsamp(dur)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / decay)
    x += 0.35 * np.sin(2 * np.pi * freq * 3.99 * t) * np.exp(-t / (decay * 0.25))
    x += 0.12 * np.sin(2 * np.pi * freq * 10.1 * t) * np.exp(-t / (decay * 0.06))
    return fade(x * np.clip(t / 0.0015, 0, 1), 0, 0.02)


# ───────────────────────── bruitages (sound design) ─────────────────────────
def whoosh(dur=0.6, f0=300, f1=3200, peak=0.6, q=1.4, seed=11, f_end=None):
    """Souffle filtré qui balaye ; peak = position du maximum (0..1)."""
    x = noise(dur, np.random.default_rng(seed))
    if f_end is None:
        fc = exp_curve(f0, f1)
    else:
        fc = lambda p: (f0 * (f1 / f0) ** (p / peak)) if p < peak else (f1 * (f_end / f1) ** ((p - peak) / (1 - peak)))
    x = sweep(x, 'bp', fc, q) * 2.2
    t = np.linspace(0, 1, len(x))
    e = np.where(t < peak, (t / peak) ** 2.2, ((1 - t) / (1 - peak)) ** 1.6)
    return fade(x * e, 0.003, 0.01)


def riser(dur=2.0, f0=200, f1=7000, pitch0=180, pitch1=1400, seed=12, tone=0.25):
    x = noise(dur, np.random.default_rng(seed))
    x = sweep(x, 'bp', exp_curve(f0, f1, 1.3), 1.2) * 2
    t = tsamp(dur)
    p = t / dur
    f = pitch0 * (pitch1 / pitch0) ** (p ** 1.6)
    x += tone * (saw(f, dur) + saw(f * 1.01, dur, 0.3)) * 0.5
    x = filt(x, 'hp', 150)
    return fade(x * p ** 2.4, 0.01, 0.004)


def impact(dur=3.0, seed=13):
    b = sub_boom(85, 30, dur, 1.0)
    nz = filt(noise(dur, np.random.default_rng(seed)), 'lp', 1800) * env_exp(dur, 0.18, 0.001)
    k = np.zeros_like(b)
    kk = kick(260, 42, 0.04, 0.5, 1.0, 2.2, 1.0)
    k[: len(kk)] = kk
    return fade(np.tanh(1.3 * (0.9 * b + 0.7 * nz + 0.8 * k)), 0, 0.1)


def tick(freq=2600, dur=0.05, decay=0.012):
    t = tsamp(dur)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / decay)
    x += 0.5 * np.sin(2 * np.pi * freq * 2.37 * t) * np.exp(-t / (decay * 0.5))
    x += 0.3 * filt(noise(dur), 'hp', 6000) * np.exp(-t / 0.002)
    return fade(x, 0, 0.005)


def blip(f0=1200, f1=420, dur=0.22, decay=0.07):
    t = tsamp(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    return fade(x, 0.0005, 0.01)


def pop(freq=600, dur=0.12):
    t = tsamp(dur)
    f = freq * (1 + 1.5 * np.exp(-t / 0.006))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    x += 0.4 * filt(noise(dur), 'bp', freq * 3, 2) * np.exp(-t / 0.004)
    return fade(x, 0.0003, 0.01)


def boing(f0=180, f1=520, dur=0.45, wobble=14):
    t = tsamp(dur)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.05))
    f *= 1 + 0.06 * np.sin(2 * np.pi * wobble * t) * np.exp(-t / 0.2)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    x += 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08)
    return fade(x, 0.001, 0.02)


def stretch(dur=0.45, f0=70, f1=150, seed=14):
    t = tsamp(dur)
    p = t / dur
    f = f0 + (f1 - f0) * np.sin(np.pi * p * 0.8)
    x = saw(f, dur) + 0.6 * square(f * 0.5, dur)
    x = sweep(x, 'lp', lambda q: 300 + 2600 * np.sin(np.pi * q), 2.5)
    x = np.tanh(2 * x) * np.sin(np.pi * np.clip(p * 1.1, 0, 1)) ** 0.5
    return fade(x, 0.004, 0.02)


def glitch(dur=0.11, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    f = 80 + rng.random() * 900
    x = square(f, dur, 0.3 + rng.random() * 0.4)
    x += 0.6 * filt(noise(dur, rng), 'bp', 1000 + rng.random() * 5000, 3)
    step = int(4 + rng.random() * 30)  # échantillonnage réduit
    x = np.repeat(x[::step], step)[:n]
    levels = 2 ** int(2 + rng.random() * 4)
    x = np.round(x * levels) / levels
    return fade(x * 0.6, 0.0005, 0.004)


def digital_type(dur=0.45, rate=40, seed=21):
    rng = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    k = 0
    tt = 0.0
    while tt < dur - 0.02:
        tk = tick(1800 + rng.random() * 2600, 0.02, 0.003) * (0.35 + 0.65 * rng.random())
        i = int(tt * SR)
        out[i:i + len(tk)] += tk[: len(out) - i]
        tt += 1 / rate * (0.6 + 0.8 * rng.random())
        k += 1
    return out


def shimmer(dur=0.9, base=2093, seed=31):
    rng = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    for k in range(9):
        f = base * [1, 1.25, 1.5, 2, 2.5, 3, 1.875, 2.25, 3.75][k]
        st = k * 0.045 + rng.random() * 0.01
        s = sine(f, dur - st) * env_exp(dur - st, 0.18, 0.002) * (0.5 + 0.5 * rng.random())
        i = int(st * SR)
        out[i:i + len(s)] += s
    return out * 0.35


# ───────────────────────── réverbération / delay ─────────────────────────
def make_ir(rt60=2.2, pre=0.018, seed=40, bright=1.0):
    rng = np.random.default_rng(seed)
    dur = rt60 * 1.1
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    bands = [('lp', 500, 1.0), ('bp', 1200, 0.85), ('bp', 3500, 0.6 * bright), ('hp', 7000, 0.35 * bright)]
    for c in range(2):
        acc = np.zeros(n)
        for kind, f, k in bands:
            nz = rng.standard_normal(n)
            nz = filt(nz, kind, f, 0.7)
            acc += nz * np.exp(-6.9 * t / (rt60 * k))
        # premières réflexions
        for _ in range(10):
            d = int((0.004 + rng.random() * 0.05) * SR)
            acc[d] += (rng.random() - 0.5) * 3
        ir[c] = acc
    p = int(pre * SR)
    ir = np.concatenate([np.zeros((2, p)), ir], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve(x, ir):
    if x.ndim == 1:
        x = np.stack([x, x])
    n = x.shape[1]
    return np.stack([signal.fftconvolve(x[c], ir[c])[:n] for c in range(2)])


def delay(x, time, feedback=0.35, mix=0.3, pingpong=True):
    if x.ndim == 1:
        x = np.stack([x, x])
    d = int(time * SR)
    out = x.copy()
    tap = x.copy()
    for k in range(1, 7):
        tap = np.roll(tap, d, axis=1)
        tap[:, :d] = 0
        tap = tap * feedback
        if pingpong:
            tap = tap[::-1]
        out += tap * mix / feedback * (feedback ** 0)
    return out


# ───────────────────────── mixage ─────────────────────────
def pan2(x, pan=0.0):
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)]) * np.sqrt(2)


class Mix:
    def __init__(self, dur):
        self.dur = dur
        self.n = int(dur * SR)
        self.buses = {}
        self.sends = {}
        self.kicks = []

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.n + SR * 4))
        return self.buses[name]

    def add(self, sig, t, gain=1.0, pan=0.0, bus='main', verb=0.0, verb_bus='verb'):
        if sig.ndim == 1:
            sig = pan2(sig, pan)
        i0 = int(round(t * SR))
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        B = self.bus(bus)
        m = min(sig.shape[1], B.shape[1] - i0)
        if m <= 0:
            return
        B[:, i0:i0 + m] += sig[:, :m] * gain
        if verb > 0:
            V = self.bus(verb_bus)
            V[:, i0:i0 + m] += sig[:, :m] * gain * verb

    def duck(self, bus, times, depth=0.7, release=0.16, attack=0.004):
        """Sidechain : baisse le bus à chaque coup de kick."""
        B = self.bus(bus)
        t = np.arange(B.shape[1]) / SR
        g = np.ones_like(t)
        for tk in times:
            m = t >= tk - attack
            dt = t[m] - tk
            shape = np.where(dt < 0, 1 - depth * (dt + attack) / attack, 1 - depth * np.exp(-dt / release))
            g[m] = np.minimum(g[m], shape)
        B *= g

    def reverb(self, bus='verb', rt60=2.2, out='main', gain=1.0, pre=0.018, bright=1.0, hp=180):
        if bus not in self.buses:
            return
        x = filt(self.buses[bus], 'hp', hp)
        wet = convolve(x, make_ir(rt60, pre, bright=bright))
        self.bus(out)[:, : wet.shape[1]] += wet * gain
        del self.buses[bus]

    def master(self, lufs=-14.0, ceiling_db=-1.0, fade_out=0.04, low_cut=28):
        x = sum(self.buses.values())[:, : self.n]
        x = filt(x, 'hp', low_cut)
        x = filt(x, 'highshelf', 9000, 0.7, 1.0)
        # gain vers la cible LUFS, puis limiteur à anticipation
        L = loudness(x)
        x *= 10 ** ((lufs - L) / 20)
        x = limiter(x, 10 ** (ceiling_db / 20))
        L2 = loudness(x)
        x *= 10 ** ((lufs - L2) / 20)
        x = limiter(x, 10 ** (ceiling_db / 20))
        x = fade(x, 0.002, fade_out)
        self.out = x
        return x

    def write(self, path):
        wavfile.write(path, SR, self.out.T.astype(np.float32))


def loudness(x):
    """Intensité intégrée BS.1770 (LUFS), avec seuils de gating."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = []
    for i in range(0, y.shape[1] - blk, hop):
        ms.append(np.sum(np.mean(y[:, i:i + blk] ** 2, axis=1)))
    ms = np.array(ms) + 1e-12
    lk = -0.691 + 10 * np.log10(ms)
    ms = ms[lk > -70]
    if len(ms) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(ms)) - 10
    ms = ms[(-0.691 + 10 * np.log10(ms)) > rel]
    return float(-0.691 + 10 * np.log10(np.mean(ms)))


def limiter(x, ceiling=0.89, look=0.003, release=0.08):
    # crête « true peak » approchée par sur-échantillonnage x4
    up = signal.resample_poly(x, 4, 1, axis=1)
    peak = np.max(np.abs(up), axis=0).reshape(-1, 4).max(axis=1)[: x.shape[1]]
    if len(peak) < x.shape[1]:
        peak = np.pad(peak, (0, x.shape[1] - len(peak)), mode='edge')
    req = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    L = max(3, int(look * SR))
    g = minimum_filter1d(req, size=2 * L + 1)
    g = uniform_filter1d(g, size=L)
    # relâchement progressif (one-pole), sans jamais dépasser la réduction requise
    coef = np.exp(-1 / (release * SR))
    out = np.empty_like(g)
    prev = 1.0
    for i in range(len(g)):
        v = g[i]
        prev = v if v < prev else v + (prev - v) * coef
        out[i] = prev
    return x * np.minimum(out, g)
