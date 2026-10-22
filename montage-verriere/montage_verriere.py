#!/usr/bin/env python3
"""Montage automatique « La Verrière » à partir d'un dossier de rushs.

Produit deux vidéos verticales 1080x1920 prêtes pour Instagram :
  - Teaser_Verriere_9x16.mp4   (~45 s, cuts rapides, pour promouvoir l'épisode)
  - Verriere_Complet_9x16.mp4  (~3 min, toute l'histoire du chantier en une fois)

Usage : python3 montage_verriere.py [DOSSIER_DES_RUSHS]
Sans argument, cherche un dossier RUSHS à côté du script.
"""

import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

# ---------------------------------------------------------------- réglages --
TITRE = "LA VERRIÈRE"
SOUS_TITRE = "Le chantier"
TEXTE_FIN_TEASER = "Le dernier épisode\nest en ligne"
TEXTE_FIN_COMPLET = "La Verrière\nde A à Z"

DUREE_TEASER = 45      # secondes
DUREE_COMPLET = 180    # secondes (limite des Reels Instagram)
PLAN_TEASER = 1.6      # durée moyenne d'un plan dans le teaser
PLAN_COMPLET = 2.8     # durée moyenne d'un plan dans la version complète

LARGEUR, HAUTEUR, FPS = 1080, 1920, 30
VOLUME_SON_DIRECT = 0.25  # son des rushs sous la musique (si musique fournie)

EXTENSIONS_VIDEO = {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".mts", ".m2ts", ".3gp", ".webm"}
EXTENSIONS_AUDIO = {".mp3", ".m4a", ".wav", ".aac", ".flac", ".ogg"}
DOSSIER_SORTIE = "MONTAGE_SORTIE"
# ---------------------------------------------------------------------------

ICI = os.path.dirname(os.path.abspath(__file__))


def trouver_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg introuvable. Lance d'abord : python3 -m pip install imageio-ffmpeg pillow")


FFMPEG = trouver_ffmpeg()


def lancer(args, capture=False):
    cmd = [FFMPEG, "-hide_banner", "-nostdin", "-y"] + args
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0 and not capture:
        raise RuntimeError(res.stderr.decode("utf-8", "replace")[-1500:])
    return res


def filtres_dispo():
    out = subprocess.run([FFMPEG, "-hide_banner", "-filters"], stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL).stdout.decode("utf-8", "replace")
    return set(re.findall(r"^\s*\S+\s+(\w+)\s", out, re.M))


FILTRES = filtres_dispo()


# ------------------------------------------------------------ inventaire ---
def lister_fichiers(dossier, extensions):
    trouves = []
    for racine, dossiers, fichiers in os.walk(dossier):
        dossiers[:] = [d for d in dossiers if d != DOSSIER_SORTIE and not d.startswith(".")
                       and d != "__MACOSX"]
        for f in fichiers:
            if not f.startswith(".") and os.path.splitext(f)[1].lower() in extensions:
                trouves.append(os.path.join(racine, f))
    return sorted(trouves)


def sonder(chemin):
    """Durée, date de tournage, son, HDR — lus dans la sortie de `ffmpeg -i`."""
    txt = lancer(["-i", chemin], capture=True).stderr.decode("utf-8", "replace")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", txt)
    if not m:
        return None
    duree = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    date = None
    m = re.search(r"com\.apple\.quicktime\.creationdate\s*:\s*(\S+)", txt) or \
        re.search(r"creation_time\s*:\s*(\S+)", txt)
    if m:
        try:
            date = datetime.fromisoformat(m.group(1).replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    if date is None:
        date = os.path.getmtime(chemin)
    video = re.search(r"Stream #.*Video: (.*)", txt)
    return {
        "chemin": chemin,
        "duree": duree,
        "date": date,
        "son": "Audio:" in txt,
        "hdr": bool(video and re.search(r"arib-std-b67|smpte2084", video.group(1))),
    }


def analyser(clip):
    """Note chaque image-clé : bonne expo, couleurs, mouvement modéré (pas de bougé)."""
    res = lancer(["-skip_frame", "nokey", "-i", clip["chemin"], "-an",
                  "-vf", "scale=96:-2,signalstats,metadata=print:file=-",
                  "-f", "null", "-"], capture=True)
    temps, notes = [], []
    t = None
    vals = {}
    for ligne in res.stdout.decode("utf-8", "replace").splitlines():
        m = re.search(r"pts_time:([\d.]+)", ligne)
        if m:
            if t is not None and vals:
                temps.append(t)
                notes.append(noter(vals))
            t, vals = float(m.group(1)), {}
            continue
        m = re.search(r"lavfi\.signalstats\.(YAVG|SATAVG|YDIF|YLOW|YHIGH)=([\d.]+)", ligne)
        if m:
            vals[m.group(1)] = float(m.group(2))
    if t is not None and vals:
        temps.append(t)
        notes.append(noter(vals))
    clip["temps"], clip["notes"] = temps, notes
    clip["note"] = sorted(notes)[len(notes) // 2] if notes else 0.0
    return clip


def noter(v):
    yavg = v.get("YAVG", 110)
    expo = 1.0 - min(abs(yavg - 120) / 100.0, 1.0)            # ni trop sombre ni brûlé
    contraste = min((v.get("YHIGH", 200) - v.get("YLOW", 30)) / 180.0, 1.0)
    couleur = min(v.get("SATAVG", 20) / 45.0, 1.0)
    ydif = v.get("YDIF", 0)
    mouvement = min(ydif / 6.0, 1.0) if ydif < 18 else max(0.0, 1.0 - (ydif - 18) / 20.0)
    return 0.35 * expo + 0.2 * contraste + 0.2 * couleur + 0.25 * mouvement


def meilleur_passage(clip, duree):
    """Début du meilleur extrait de `duree` secondes (on évite début et fin du rush)."""
    marge = 0.6 if clip["duree"] > duree + 1.5 else 0.0
    debut_min, debut_max = marge, max(marge, clip["duree"] - duree - marge)
    if not clip.get("temps") or debut_max <= debut_min:
        return max(0.0, min((clip["duree"] - duree) / 2, debut_max))
    meilleur, meilleure_note = debut_min, -1.0
    pas = 0.5
    s = debut_min
    while s <= debut_max + 1e-6:
        dedans = [n for t, n in zip(clip["temps"], clip["notes"]) if s - 0.5 <= t <= s + duree]
        note = sum(dedans) / len(dedans) if dedans else 0
        if note > meilleure_note:
            meilleur, meilleure_note = s, note
        s += pas
    return meilleur


# ------------------------------------------------------------- sélection ---
def choisir(clips, nb):
    """Un plan par tranche chronologique (l'histoire avance), le meilleur de chaque tranche."""
    if len(clips) <= nb:
        return list(clips)
    choix = []
    for i in range(nb):
        tranche = clips[i * len(clips) // nb:(i + 1) * len(clips) // nb]
        choix.append(max(tranche, key=lambda c: c["note"]))
    return choix


def plan_de_montage(clips, duree_totale, duree_plan, intro, fin):
    nb = max(1, round((duree_totale - intro - fin) / duree_plan) + 2)
    choix = choisir([c for c in clips if c["duree"] >= 0.8], nb)
    if not choix:
        return []
    corps = duree_totale - intro - fin
    milieu = choix[1:-1]
    duree_milieu = corps / len(milieu) if milieu else 0
    plan = []
    for i, clip in enumerate(choix):
        if i == 0:
            d = intro
        elif i == len(choix) - 1:
            d = fin
        else:
            # léger rythme : alternance plans courts / plans un peu plus longs
            d = duree_milieu * (1.15 if i % 3 == 0 else 0.925)
        d = min(d, clip["duree"])
        plan.append({"clip": clip, "debut": meilleur_passage(clip, d), "duree": round(d, 3)})
    return plan


# ------------------------------------------------------------- habillage ---
POLICES = [
    "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def police(taille):
    from PIL import ImageFont
    for p in POLICES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, taille)
            except OSError:
                pass
    try:
        return ImageFont.load_default(size=taille)
    except TypeError:
        return ImageFont.load_default()


def carton(chemin, lignes, position="bas"):
    """PNG transparent 1080x1920 avec texte blanc ombré. Renvoie None sans Pillow."""
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        return None
    # carton de fin : voile sombre sur l'image pour que le texte ressorte
    voile = (0, 0, 0, 0) if position == "bas" else (0, 0, 0, 110)
    img = Image.new("RGBA", (LARGEUR, HAUTEUR), voile)
    blocs = []
    for texte, taille, espacement in lignes:
        f = police(taille)
        for l in texte.split("\n"):
            blocs.append((l, f, espacement))
    d = ImageDraw.Draw(img)
    hauteurs = [d.textbbox((0, 0), l, font=f)[3] for l, f, _ in blocs]
    total = sum(hauteurs) + 28 * (len(blocs) - 1)
    y = int(HAUTEUR * (0.70 if position == "bas" else 0.45)) - total // 2
    ombre = Image.new("RGBA", img.size, voile)
    do = ImageDraw.Draw(ombre)
    pos = []
    for (l, f, esp), h in zip(blocs, hauteurs):
        larg = d.textbbox((0, 0), l, font=f)[2] + esp * max(len(l) - 1, 0)
        x = (LARGEUR - larg) // 2
        pos.append((l, f, esp, x, y))
        y += h + 28
    for l, f, esp, x, y in pos:
        for dessin, couleur, dx in ((do, (0, 0, 0, 200), 4), (d, (255, 255, 255, 255), 0)):
            cx = x
            for ch in l:
                dessin.text((cx + dx, y + dx), ch, font=f, fill=couleur)
                cx += dessin.textbbox((0, 0), ch, font=f)[2] + esp
    ombre = ombre.filter(ImageFilter.GaussianBlur(10))
    Image.alpha_composite(ombre, img).save(chemin)
    return chemin


# --------------------------------------------------------------- rendu -----
def filtre_image(clip):
    f = []
    if clip["hdr"] and "zscale" in FILTRES and "tonemap" in FILTRES:
        f.append("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
                 "tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
    # format vertical : les plans horizontaux gardent tout le cadre sur fond flouté
    f.append(f"split[a][b];[a]scale={LARGEUR // 4}:{HAUTEUR // 4}:force_original_aspect_ratio=increase,"
             f"crop={LARGEUR // 4}:{HAUTEUR // 4},boxblur=8:2,eq=brightness=-0.12,"
             f"scale={LARGEUR}:{HAUTEUR}[fond];"
             f"[b]scale={LARGEUR}:{HAUTEUR}:force_original_aspect_ratio=decrease[av];"
             f"[fond][av]overlay=(W-w)/2:(H-h)/2")
    # étalonnage « premium » léger : contraste, couleurs, piqué, vignette
    f.append("eq=contrast=1.07:saturation=1.15:gamma=0.97,unsharp=5:5:0.35,vignette=PI/5")
    f.append(f"fps={FPS},setsar=1,format=yuv420p")
    return ",".join(f)


def rendre_plan(args):
    i, p, dossier_tmp, texte_png, premier, dernier = args
    clip, d = p["clip"], p["duree"]
    sortie = os.path.join(dossier_tmp, f"plan_{i:03d}.mp4")
    entrees = ["-ss", f"{p['debut']:.3f}", "-t", f"{d:.3f}", "-i", clip["chemin"],
               "-f", "lavfi", "-t", f"{d:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
    v = f"[0:v]{filtre_image(clip)}"
    if premier:
        v += ",fade=t=in:st=0:d=0.6"
    if dernier:
        v += f",fade=t=out:st={max(d - 1.0, 0):.3f}:d=1.0"
    graphe = v + "[v0]"
    sortie_v = "[v0]"
    if texte_png:
        entrees += ["-loop", "1", "-t", f"{d:.3f}", "-i", texte_png]
        ap, fin_txt = (0.4, d - 0.5) if premier else (0.5, d - 1.1)
        graphe += (f";[2:v]format=rgba,fade=t=in:st={ap}:d=0.5:alpha=1,"
                   f"fade=t=out:st={max(fin_txt, ap + 0.6):.3f}:d=0.5:alpha=1[txt];"
                   f"[v0][txt]overlay=0:0:format=auto,format=yuv420p[v1]")
        sortie_v = "[v1]"
    src_a = "[0:a]" if clip["son"] else "[1:a]"
    graphe += (f";{src_a}aresample=48000,aformat=channel_layouts=stereo,"
               f"atrim=0:{d:.3f},apad,atrim=0:{d:.3f},"
               f"afade=t=in:d=0.05,afade=t=out:st={max(d - 0.08, 0):.3f}:d=0.08[a]")
    lancer(entrees + ["-filter_complex", graphe, "-map", sortie_v, "-map", "[a]",
                      "-t", f"{d:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                      "-r", str(FPS), "-color_primaries", "bt709", "-color_trc", "bt709",
                      "-colorspace", "bt709", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                      sortie])
    return sortie


def assembler(plan, nom, texte_debut, texte_fin, musique, dossier_sortie):
    with tempfile.TemporaryDirectory() as tmp:
        png_debut = carton(os.path.join(tmp, "debut.png"), texte_debut)
        png_fin = carton(os.path.join(tmp, "fin.png"), texte_fin, position="milieu")
        taches = [(i, p, tmp, png_debut if i == 0 else png_fin if i == len(plan) - 1 else None,
                   i == 0, i == len(plan) - 1) for i, p in enumerate(plan)]
        fichiers = [None] * len(plan)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            for n, (t, f) in enumerate(zip(taches, pool.map(rendre_plan, taches)), 1):
                fichiers[t[0]] = f
                print(f"    plan {n}/{len(plan)}", end="\r", flush=True)
        print()
        liste = os.path.join(tmp, "liste.txt")
        with open(liste, "w", encoding="utf-8") as fh:
            for f in fichiers:
                fh.write("file '" + f.replace("\\", "/").replace("'", "'\\''") + "'\n")
        total = sum(p["duree"] for p in plan)
        sortie = os.path.join(dossier_sortie, nom)
        entrees = ["-f", "concat", "-safe", "0", "-i", liste]
        if musique:
            entrees += ["-stream_loop", "-1", "-i", musique]
            audio = (f"[1:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:d=0.5,afade=t=out:st={max(total - 2.5, 0):.3f}:d=2.5[m];"
                     f"[0:a]volume={VOLUME_SON_DIRECT}[n];"
                     f"[m][n]amix=inputs=2:duration=first:normalize=0,"
                     f"loudnorm=I=-14:TP=-1.5:LRA=11[a]")
        else:
            audio = "[0:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
        lancer(entrees + ["-filter_complex", audio, "-map", "0:v", "-map", "[a]",
                          "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                          "-t", f"{total:.3f}", "-movflags", "+faststart", sortie])
    return sortie


# --------------------------------------------------------------- main ------
def main():
    dossier = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ICI, "RUSHS")
    if not os.path.isdir(dossier):
        dossier = ICI
    dossier = os.path.abspath(dossier)
    sortie = os.path.join(dossier, DOSSIER_SORTIE)
    os.makedirs(sortie, exist_ok=True)

    print(f"\n=== Montage La Verrière ===\nRushs : {dossier}\n")
    videos = lister_fichiers(dossier, EXTENSIONS_VIDEO)
    if not videos:
        sys.exit("Aucune vidéo trouvée. Mets les rushs dans le dossier RUSHS à côté du script.")
    musiques = lister_fichiers(dossier, EXTENSIONS_AUDIO)
    musique = musiques[0] if musiques else None

    cache_path = os.path.join(sortie, "analyse.json")
    cache = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as fh:
            cache = json.load(fh)

    print(f"1/3  Analyse de {len(videos)} rushs (exposition, couleurs, mouvement)…")
    clips = []
    for n, v in enumerate(videos, 1):
        cle = f"{v}|{os.path.getsize(v)}"
        if cle in cache:
            clips.append(cache[cle])
        else:
            info = sonder(v)
            if info:
                clips.append(analyser(info))
                cache[cle] = clips[-1]
        print(f"    {n}/{len(videos)}  {os.path.basename(v)[:50]:<50}", end="\r", flush=True)
    print()
    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(cache, fh)
    clips.sort(key=lambda c: (c["date"], c["chemin"]))

    resume = []
    for nom, duree, plan_moy, txt_debut, txt_fin in (
            ("Teaser_Verriere_9x16.mp4", DUREE_TEASER, PLAN_TEASER,
             [(TITRE, 110, 14), (SOUS_TITRE, 54, 4)], [(TEXTE_FIN_TEASER, 78, 2)]),
            ("Verriere_Complet_9x16.mp4", DUREE_COMPLET, PLAN_COMPLET,
             [(TITRE, 110, 14), (SOUS_TITRE, 54, 4)], [(TEXTE_FIN_COMPLET, 84, 2)])):
        intro, fin = (3.0, 4.0) if duree <= 60 else (4.0, 6.0)
        plan = plan_de_montage(clips, duree, plan_moy, intro, fin)
        etape = "2/3" if nom.startswith("Teaser") else "3/3"
        print(f"{etape}  {nom} : {len(plan)} plans, {sum(p['duree'] for p in plan):.0f} s")
        chemin = assembler(plan, nom, txt_debut, txt_fin, musique, sortie)
        resume.append(f"\n{nom}\n" + "\n".join(
            f"  {os.path.basename(p['clip']['chemin'])}  de {p['debut']:.1f}s  pendant {p['duree']:.1f}s"
            for p in plan))
        print(f"    -> {chemin}")

    with open(os.path.join(sortie, "selection.txt"), "w", encoding="utf-8") as fh:
        fh.write("Plans retenus (dans l'ordre du montage)\n" + "\n".join(resume))
    print(f"\nTerminé ! Les vidéos sont dans : {sortie}\n")


if __name__ == "__main__":
    main()
