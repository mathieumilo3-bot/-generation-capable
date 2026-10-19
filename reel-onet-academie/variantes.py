# Pose les autres habillages sonores sur la vidéo déjà rendue, sans refaire les images :
#   python3 -I variantes.py <dossier du reel>
# Pour chaque format, part de ONET-Academie-<format>-envoi.mp4 (habillage « epure ») et écrit
# ONET-Academie-<format>-cinema-envoi.mp4 et ONET-Academie-<format>-cinema-plus-envoi.mp4.
import os, subprocess, sys, tempfile

R = sys.argv[1]
AF = "loudnorm=I=-12:TP=-1.5:LRA=9,aresample=48000,alimiter=limit={}:attack=5:release=50:level=false"  # comme render.js

def true_peak(path):
    log = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(log.rsplit("Peak:", 1)[1].split()[0])

with tempfile.TemporaryDirectory() as tmp:
    for var in ("cinema", "cinema-plus"):
        wav = os.path.join(tmp, var + ".wav")
        subprocess.run(["python3", "-I", os.path.join(R, "sfx.py"), os.path.join(R, "reel.json"), wav, var], check=True)
        for fmt in ("16x9", "9x16"):
            src = os.path.join(R, f"ONET-Academie-{fmt}-envoi.mp4")
            out = os.path.join(R, f"ONET-Academie-{fmt}-{var}-envoi.mp4")
            for lim in (.5, .42, .36, .3):        # l'AAC fait dépasser les crêtes : on baisse le plafond jusqu'à rester sous −1,5 dBFS
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                                "-af", AF.format(lim), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out], check=True)
                tp = true_peak(out)
                if tp <= -1.5: break
            print(f"écrit : {out} (crête {tp} dBFS, plafond {lim})")
