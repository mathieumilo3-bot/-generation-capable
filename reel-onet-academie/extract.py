# Extrait les deux rushs (coupe du cuivre, filasse) en images JPEG à 30 i/s, redressées : python3 -I extract.py <dossier du reel>
import os, subprocess, sys

R = sys.argv[1]
for name, src in (("coupe", "rush-coupe.mp4"), ("filasse", "rush-filasse.mov")):
    out = os.path.join(R, "shots", name)
    os.makedirs(out, exist_ok=True)
    # ffmpeg applique la rotation du téléphone ; léger contraste et saturation pour coller à l'étalonnage du montage
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(R, "assets", src),
                    "-vf", "fps=30,eq=contrast=1.06:saturation=1.12,unsharp=5:5:0.6", "-q:v", "2",
                    os.path.join(out, "f%04d.jpg")], check=True)
    print(name, len(os.listdir(out)), "images")
