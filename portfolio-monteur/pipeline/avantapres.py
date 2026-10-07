"""Prépare l'Avant/Après d'un reel déjà rendu : props pour la composition AvantApres.

    python3 pipeline/avantapres.py <id-du-reel> [--intro 4.0] [--credit "Nom"]
"""
import argparse
import shutil
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import PUBLIC, ROOT, load_audio, read_json, write_json  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('id')
ap.add_argument('--intro', type=float, default=4.0)
ap.add_argument('--credit', default=None)
ap.add_argument('--bins', type=int, default=150)
a = ap.parse_args()

props = read_json(PUBLIC / a.id / 'props.json')
edit = props['edit']
srcs = {c['src'] for c in edit['clips']}
if len(srcs) != 1:
    sys.exit('l’avant/après demande un reel tiré d’une seule plage de rush')
graded = srcs.pop()
raw = graded.replace('.mp4', '_raw.mp4')
if not (PUBLIC / raw).exists():
    raw = graded
shutil.copy(ROOT / 'renders' / f'{a.id}.mp4', PUBLIC / a.id / 'reel.mp4')

voice = [c for c in edit['clips'] if c['start'] < edit['meta']['voiceEnd']]
s0 = max(0.0, min(c['srcIn'] for c in voice) - 0.3)
s1 = max(c['srcIn'] + (c['end'] - c['start']) for c in voice) + 0.3
x = load_audio(PUBLIC / raw, s0, s1 - s0)
n = len(x) // a.bins
rms = np.sqrt(np.mean(x[: n * a.bins].reshape(a.bins, n) ** 2, axis=1))
wave = (rms / (rms.max() or 1)) ** 0.7

out = {
    'edit': edit,
    'reel': f'{a.id}/reel.mp4',
    'rawSrc': raw,
    'intro': {'srcIn': round(s0, 3), 'dur': a.intro},
    'wave': [round(float(v), 3) for v in wave],
    'srcMin': round(s0, 3),
    'srcMax': round(s1, 3),
    'credit': a.credit,
}
write_json(PUBLIC / a.id / 'avantapres.json', out)
print(f'✔ public/{a.id}/avantapres.json (rush {s1 - s0:.1f} s → reel {edit["duration"]:.1f} s)')
