"""Suivi du visage pour le recadrage automatique (caméra virtuelle lissée).

track(src, t0, t1) → {fps, t0, cx[], cy[], fh[]} en coordonnées normalisées de la source,
échantillonné à 10 i/s. La caméra virtuelle ne bouge que si le visage sort d'une zone
morte, avec un amorti critique : pas de tremblement, pas de recadrage nerveux.
"""
import subprocess
from pathlib import Path

import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

MODEL = Path(__file__).resolve().parent / 'models' / 'blaze_face_short_range.tflite'
FPS = 10


def _frames(src, t0, t1, w=640):
    from lib import probe

    p = probe(src)
    h = int(round(p['height'] * w / p['width'] / 2) * 2)
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-i', str(src), '-t', f'{t1 - t0:.3f}',
           '-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw, np.uint8)[: n * w * h * 3].reshape(n, h, w, 3)


def _detect(frames):
    det = vision.FaceDetector.create_from_options(
        vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=str(MODEL)), min_detection_confidence=0.45)
    )
    out = []
    prev = None
    for f in frames:
        h, w = f.shape[:2]
        res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f)))
        best = None
        for d in res.detections:
            b = d.bounding_box
            c = ((b.origin_x + b.width / 2) / w, (b.origin_y + b.height / 2) / h, b.height / h)
            # plus grand visage, en favorisant la continuité avec l'image précédente
            score = c[2] - (abs(c[0] - prev[0]) * 0.5 if prev else 0)
            if best is None or score > best[0]:
                best = (score, c)
        out.append(best[1] if best else None)
        if best:
            prev = best[1]
    det.close()
    return out


def _fill(vals):
    idx = [i for i, v in enumerate(vals) if v is not None]
    if not idx:
        return np.array([[0.5, 0.42, 0.3]] * len(vals))
    arr = np.array([v if v is not None else (np.nan, np.nan, np.nan) for v in vals], dtype=float)
    for k in range(3):
        col = arr[:, k]
        good = ~np.isnan(col)
        arr[:, k] = np.interp(np.arange(len(col)), np.flatnonzero(good), col[good])
    return arr


def _camera(x, dead=0.035, omega=4.0):
    """Suiveur à amorti critique avec zone morte (secondes → échantillons à FPS)."""
    dt = 1 / FPS
    cam, vel = x[0], 0.0
    target = x[0]
    out = np.empty_like(x)
    for i, v in enumerate(x):
        if abs(v - target) > dead:
            target = v
        acc = omega * omega * (target - cam) - 2 * omega * vel
        vel += acc * dt
        cam += vel * dt
        out[i] = cam
    return out


def _gauss(x, sigma=1.5):
    r = int(sigma * 3)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(x, r, mode='edge'), k, mode='valid')


def track(src, t0, t1):
    frames = _frames(src, t0, t1)
    raw = _fill(_detect(frames))
    med = np.array([np.median(raw[max(0, i - 2): i + 3], axis=0) for i in range(len(raw))])
    cx = _gauss(_camera(med[:, 0]))
    cy = _gauss(_camera(med[:, 1], dead=0.05, omega=3.0))
    fh = _gauss(med[:, 2], sigma=4)
    found = sum(1 for _ in frames)
    return {
        'fps': FPS,
        't0': 0.0,
        'cx': [round(float(v), 4) for v in cx],
        'cy': [round(float(v), 4) for v in cy],
        'fh': [round(float(v), 4) for v in fh],
        'n': found,
    }


if __name__ == '__main__':
    import json
    import sys

    tr = track(sys.argv[1], float(sys.argv[2]), float(sys.argv[3]))
    print(json.dumps({k: (v[:12] if isinstance(v, list) else v) for k, v in tr.items()}))
