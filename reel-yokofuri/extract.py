"""Extrait la séquence d'étincelles de la vidéo de gravure en images 1080x1920 étalonnées (shots/laser/).
Usage : python3 -I extract.py . <vidéo source gravure pendentif .mp4>"""
import subprocess, sys
from pathlib import Path
R = Path(sys.argv[1]); SRC = sys.argv[2]
IN, DUR, FPS = 20.0, 2.5, 30
out = R / "shots" / "laser"; out.mkdir(parents=True, exist_ok=True)
for f in out.glob("*.jpg"): f.unlink()
# recadrage serré sur le pendentif, table assombrie, hautes lumières chaudes
chain = (f"trim=start={IN}:duration={DUR},setpts=PTS-STARTPTS,fps={FPS},"
         "crop=iw*0.8:ih*0.8:iw*0.1:ih*0.2,scale=1080:1920:flags=lanczos,unsharp=5:5:0.8:5:5:0,"
         "curves=all='0/0 0.35/0.17 0.7/0.6 1/1',eq=contrast=1.08:saturation=1.18,"
         "colorbalance=rs=0.03:bs=-0.04:rh=0.05:bh=-0.05")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-an", "-vf", chain, "-q:v", "2", str(out / "%04d.jpg")], check=True)
print("laser :", len(list(out.glob("*.jpg"))), "images")
