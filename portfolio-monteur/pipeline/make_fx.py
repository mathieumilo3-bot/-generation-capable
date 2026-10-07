"""Textures partagées : grain argentique (8 tuiles 512 px, gris moyen = neutre en mode overlay)."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/fx')
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)
for i in range(8):
    n = rng.normal(128, 46, (512, 512))
    img = Image.fromarray(np.clip(n, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.55))
    img.save(out / f'grain_{i}.png', optimize=True)
print('grain ok')
