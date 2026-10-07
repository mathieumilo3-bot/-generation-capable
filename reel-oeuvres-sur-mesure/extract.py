"""Extrait chaque plan de l'EDL en images 1080x1920 étalonnées ; "slow" = ralenti interpolé."""
import json, subprocess, sys
from pathlib import Path
R = Path(sys.argv[1]); DL = Path(sys.argv[2])
edl = json.loads((R / "edl.json").read_text())
GRADE = "eq=brightness=0.015:contrast=0.97:saturation=1.04,curves=all='0/0.035 1/1'"
FIT = "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920"
for s in edl["shots"]:
    out = R / "shots" / s["id"]; out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.jpg"): f.unlink()
    chain = f"trim=start={s['in']}:duration={s['dur']},setpts=PTS-STARTPTS"
    if s.get("slow", 1) != 1:
        chain += f",setpts=PTS/{s['slow']},minterpolate=fps={edl['fps']}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
    chain += f",{FIT}" + (",unsharp=5:5:0.7:5:5:0" if s["src"] == "6" else "") + f",{GRADE},fps={edl['fps']}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(DL / f"{s['src']}.mp4"), "-an", "-vf", chain,
                    "-q:v", "2", str(out / "%04d.jpg")], check=True)
    s["frames"] = len(list(out.glob("*.jpg")))
    print(s["id"], s["src"], s["in"], s["dur"], s.get("slow", 1), "->", s["frames"], "images")
(R / "edl.json").write_text(json.dumps(edl, indent=1, ensure_ascii=False))
