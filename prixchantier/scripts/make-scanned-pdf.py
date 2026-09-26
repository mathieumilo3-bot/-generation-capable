"""Produit tests/fixtures/files/devis-scanne.pdf : une image sans couche texte,
comme un devis scanné. Usage : python3 scripts/make-scanned-pdf.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "files"
lines = (root / "devis-scanne.txt").read_text(encoding="utf-8").splitlines()

img = Image.new("L", (1240, 1754), color=245)
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("DejaVuSans.ttf", 26)
except OSError:
    font = ImageFont.load_default()
y = 120
for line in lines:
    draw.text((90, y), line, fill=30, font=font)
    y += 48
img.save(root / "devis-scanne.pdf", "PDF", resolution=150)
print("devis-scanne.pdf généré")
