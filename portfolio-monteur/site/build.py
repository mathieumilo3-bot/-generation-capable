"""Génère le site portfolio à partir des montages rendus.

    python3 site/build.py            → site/dist/ (page Artifact + médias)  et  site/dist-netlify/ (page complète)

Lit site/config.json (profil, contacts) et site/projects.json (projets, textes), et les stats
réelles de chaque montage dans public/<id>/props.json. Les vidéos sont réencodées pour le web
(≤ 14 Mo chacune) avec leur affiche.
"""
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / 'pipeline'))
from lib import PUBLIC, probe  # noqa: E402

DIST = HERE / 'dist'
MEDIA = DIST / 'media'
MAX_BYTES = 14.2 * 1024 * 1024

e = html.escape


def encode(src, dst, crf=21, max_rate='3.2M', audio=True, width=None):
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        return
    dur = probe(src)['duration']
    vf = ['format=yuv420p'] if not width else [f'scale={width}:-2:flags=lanczos', 'format=yuv420p']
    base = ['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-vf', ','.join(vf), '-c:v', 'libx264', '-preset', 'slow',
            '-profile:v', 'high', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
    aud = ['-c:a', 'aac', '-b:a', '128k'] if audio else ['-an']
    subprocess.run(base + ['-crf', str(crf), '-maxrate', max_rate, '-bufsize', '6M'] + aud + ['-movflags', '+faststart', str(dst)], check=True)
    if dst.stat().st_size > MAX_BYTES:  # deux passes au débit qui tient dans la limite
        kbps = int((MAX_BYTES * 8 / dur) / 1000 - (140 if audio else 0))
        log = str(DIST / 'x264')
        subprocess.run(base + ['-b:v', f'{kbps}k', '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', '/dev/null'], check=True)
        subprocess.run(base + ['-b:v', f'{kbps}k', '-pass', '2', '-passlogfile', log] + aud + ['-movflags', '+faststart', str(dst)], check=True)
        for f in DIST.glob('x264*'):
            f.unlink()


def poster(src, t, dst, width=900):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', str(src), '-frames:v', '1',
                    '-vf', f'scale={width}:-2:flags=lanczos', '-q:v', '3', str(dst)], check=True)


def mmss(s):
    s = round(s)
    return f'{s // 60}:{s % 60:02d}'


def human_min(s):
    s = round(s)
    return f'{s // 60} min {s % 60:02d}' if s >= 60 else f'{s} s'


def strip_svg(ap):
    """Bande rush → montage, à la même échelle de temps (le montage est plus court)."""
    edit = ap['edit']
    s0, s1 = ap['srcMin'], ap['srcMax']
    span = s1 - s0
    wave = ap['wave']
    voice = [c for c in edit['clips'] if c['start'] < edit['meta']['voiceEnd']]
    kept = [(c['srcIn'], c['srcIn'] + c['end'] - c['start']) for c in voice]
    W, H = 1000, 46
    bw = W / len(wave)
    bars = []
    for i, v in enumerate(wave):
        t = s0 + (i + 0.5) / len(wave) * span
        keep = any(a <= t < b for a, b in kept)
        h = max(2.0, v * (H - 12))
        bars.append(f'<rect x="{i * bw + 0.5:.1f}" y="{(H - h) / 2:.1f}" width="{max(1, bw - 1.4):.1f}" height="{h:.1f}" rx="1" '
                    f'fill="{"var(--accent)" if keep else "var(--cut)"}" opacity="{0.95 if keep else 0.55}"/>')
    rush = f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">{"".join(bars)}</svg>'
    pieces = []
    for c in voice:
        a, b = c['srcIn'], c['srcIn'] + c['end'] - c['start']
        x_to = c['start'] / span * W
        x_from = (a - s0) / span * W
        idx = [i for i in range(len(wave)) if a <= s0 + (i + 0.5) / len(wave) * span < b]
        inner = []
        for i in idx:
            v = wave[i]
            h = max(2.0, v * (H - 12))
            x = x_to + (s0 + (i + 0.5) / len(wave) * span - 0.5 * span / len(wave) - a) / span * W
            inner.append(f'<rect x="{x:.1f}" y="{(H - h) / 2:.1f}" width="{max(1, bw - 1.4):.1f}" height="{h:.1f}" rx="1" fill="var(--accent)"/>')
        pieces.append(f'<g data-x="{x_to:.1f}" data-from="{x_from:.1f}">{"".join(inner)}</g>')
    end_x = edit['meta']['voiceEnd'] / span * W
    reel = (f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" id="lane-reel" aria-hidden="true">{"".join(pieces)}'
            f'<line x1="{end_x:.1f}" x2="{end_x:.1f}" y1="0" y2="{H}" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>')
    m = edit['meta']
    return f'''<section class="strip" aria-label="Du rush au montage">
    <div class="wrap">
      <div class="strip-head">
        <strong>{human_min(span)} de rush → {human_min(m['voiceEnd'])} de reel</strong>
        <span class="mono">{m['cuts']} coupes · {m['words']} mots sous-titrés · son à -14 LUFS</span>
      </div>
      <div class="lanes">
        <span class="lane-label">RUSH</span><div class="lane">{rush}</div>
        <span class="lane-label">REEL</span><div class="lane">{reel}</div>
      </div>
      <div class="legend mono"><span><i style="background:var(--accent)"></i>gardé</span><span><i style="background:var(--cut);opacity:.7"></i>coupé : blancs, hésitations, redites</span></div>
    </div>
  </section>'''


def shots_html(p, src):
    """Découpage : un photogramme par temps fort ; un clic relance la vidéo d'ouverture à cet instant."""
    cells = []
    for i, (t, label) in enumerate(p['shots']):
        f = MEDIA / f"{p['id']}-shot{i}.jpg"
        poster(src, t, f, width=360)
        cells.append(f'<button class="shot" type="button" data-seek="{t}" aria-label="Lire depuis {mmss(t)} : {e(label)}">'
                     f'<img src="media/{f.name}" alt="" loading="lazy" width="360" height="640">'
                     f'<span><b>{mmss(t)}</b><i>{e(label)}</i></span></button>')
    return (f'<figure class="shots-wrap"><div class="shots">{"".join(cells)}</div>'
            f'<figcaption class="mono">Découpage · clique un plan pour le revoir en haut</figcaption></figure>')


def project_html(p, idx, hero=None):
    pid = p['id']
    meta = json.loads((PUBLIC / pid / 'props.json').read_text())['edit']['meta'] if (PUBLIC / pid / 'props.json').exists() else {}
    src = ROOT / 'renders' / f"{p.get('render', pid)}.mp4"
    dst = MEDIA / f'{pid}.mp4'
    encode(src, dst, crf=p.get('crf', 21), max_rate=p.get('maxRate', '3.2M'))
    poster(src, p.get('poster', 2.0), MEDIA / f'{pid}.jpg', width=900 if p['kind'] == 'phone' else 1280)
    dur = probe(dst)['duration']
    vid = f'v-{pid}'
    if pid == hero and p.get('shots'):
        media = shots_html(p, src)  # la vidéo joue déjà en ouverture : ici, son découpage
    elif p['kind'] == 'phone':
        media = (f'<div class="phone"><video id="{vid}" data-auto src="media/{pid}.mp4" poster="media/{pid}.jpg" muted loop playsinline preload="none"></video>'
                 f'<button class="sound" type="button" aria-pressed="false" data-for="{vid}">Activer le son</button></div>')
    else:
        media = (f'<div class="frame"><video id="{vid}" data-auto src="media/{pid}.mp4" poster="media/{pid}.jpg" muted loop playsinline preload="none"></video>'
                 f'<button class="sound" type="button" aria-pressed="false" data-for="{vid}">Activer le son</button></div>')
    specs = p.get('specs') or [
        ['Durée', mmss(dur)],
        ['Rush', human_min(meta['rush']) if meta.get('rush') else '—'],
        ['Coupes', str(meta.get('cuts', '—'))],
        ['Mots animés', str(meta.get('words', '—'))],
    ]
    spec_html = ''.join(f'<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in specs)
    tags = ''.join(f'<li>{e(t)}</li>' for t in p['tags'])
    return dur, f'''<article class="proj{' wide' if p['kind'] != 'phone' else ''}">
          <div class="proj-media">{media}</div>
          <div class="proj-text">
            <p class="mono">{e(p['format'])}</p>
            <h3>{e(p['title'])}</h3>
            <p>{e(p['desc'])}</p>
            <dl class="specs">{spec_html}</dl>
            <ul class="tags">{tags}</ul>
            <p class="credit">{e(p['credit'])}</p>
          </div>
        </article>'''


def before_after_html(cfg):
    ba = cfg.get('beforeAfter')
    if not ba:
        return ''
    encode(ROOT / 'renders' / f"{ba['before']}.mp4", MEDIA / 'ba-avant.mp4', crf=24, max_rate='2M', audio=False)
    if not (MEDIA / f"{ba['after']}.mp4").exists():
        encode(ROOT / 'renders' / f"{ba['after']}.mp4", MEDIA / f"{ba['after']}.mp4")
    points = ''.join(f'<li><b>{i + 1:02d}</b><span>{e(t)}</span></li>' for i, t in enumerate(ba['points']))
    return f'''<section class="block" id="avant-apres">
    <div class="wrap">
      <div class="sec-head">
        <p class="mono">Glisse le curseur</p>
        <h2>Avant, <em>après</em></h2>
        <p>{e(ba['intro'])}</p>
      </div>
      <div class="ba-wrap">
        <div style="display:grid;gap:14px;justify-items:center">
          <div class="ba" id="ba" style="--pos:50%">
            <video class="after" src="media/{ba['after']}.mp4" poster="media/{ba['after']}.jpg" muted loop playsinline preload="none"></video>
            <video class="before" src="media/ba-avant.mp4" muted loop playsinline preload="none"></video>
            <span class="tag l">AVANT</span><span class="tag r">APRÈS</span>
            <div class="handle"><span>⇆</span></div>
          </div>
          <label class="mono" for="ba-pos" style="font-size:11px">Position du curseur</label>
          <input class="ba-range" type="range" id="ba-pos" min="0" max="100" value="50">
        </div>
        <div class="ba-side">
          <p class="mono">Ce qui change entre les deux</p>
          <ul>{points}</ul>
        </div>
      </div>
    </div>
  </section>'''


def channels_html(c):
    items = []
    for key, label in (('email', 'E-mail'), ('instagram', 'Instagram'), ('whatsapp', 'WhatsApp'), ('telephone', 'Téléphone')):
        v = c.get(key)
        if v:
            items.append(f'<div class="channel"><div><span class="mono">{label}</span><strong>{e(v)}</strong></div>'
                         f'<button class="copy" type="button" data-copy="{e(v)}">Copier</button></div>')
    return ''.join(items)


def main():
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default=str(HERE / 'config.json'))
    ap.add_argument('--projects', default=str(HERE / 'projects.json'))
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text())
    projects = json.loads(Path(a.projects).read_text())
    if DIST.exists():
        for f in DIST.glob('*.html'):
            f.unlink()
    MEDIA.mkdir(parents=True, exist_ok=True)
    hero = cfg['hero']
    total = 0.0
    rows = []
    ratios = []
    for i, p in enumerate(projects):
        if p.get('pending'):
            continue
        d, h = project_html(p, i, hero)
        total += d
        rows.append(h)
        r = '9:16' if p['kind'] == 'phone' else '16:9'
        if r not in ratios:
            ratios.append(r)
    if not (MEDIA / f'{hero}.mp4').exists():
        encode(ROOT / 'renders' / f'{hero}.mp4', MEDIA / f'{hero}.mp4')
        poster(ROOT / 'renders' / f'{hero}.mp4', 1.0, MEDIA / f'{hero}.jpg')
    strip = ''
    if cfg.get('strip') and (PUBLIC / cfg['strip'] / 'avantapres.json').exists():
        strip = strip_svg(json.loads((PUBLIC / cfg['strip'] / 'avantapres.json').read_text()))
    name = (cfg.get('name') or '').strip()
    if cfg.get('heroLines'):
        lines = cfg['heroLines']
    else:
        parts = name.split(' ', 1)
        lines = parts if len(parts) == 2 else [name]
    name_lines = ''.join(f'<span>{e(x)}</span>' for x in lines)
    year = str(cfg.get('year', 2026))
    n = len(rows)
    footer = [f"<p>© {year}{' ' + e(name) if name else ''}.{' ' + e(cfg['disclaimer']) if cfg.get('disclaimer') else ''}</p>"]
    if cfg.get('credits'):
        footer.append(f"<p>{e(cfg['credits'])}</p>")
    ba_html = before_after_html(cfg)
    page = (HERE / 'template.html').read_text()
    rep = {
        '{{TITLE}}': e(cfg.get('title', name)),
        '{{BRAND}}': e(cfg.get('brand', name)),
        '{{NAME_LINES}}': name_lines,
        '{{EYEBROW}}': e(cfg.get('eyebrow', f'Portfolio {year} · France')),
        '{{THESIS}}': e(cfg['thesis']),
        '{{HERO_VIDEO}}': f'media/{hero}.mp4',
        '{{HERO_POSTER}}': f'media/{hero}.jpg',
        '{{STRIP}}': strip,
        '{{PROJECTS_EYEBROW}}': f"{n} projet{'s' if n > 1 else ''} · {' et '.join(ratios)}",
        '{{PROJECTS_INTRO}}': e(cfg['projectsIntro']),
        '{{PROJECTS}}': '\n        '.join(rows),
        '{{BEFORE_AFTER}}': ba_html,
        '{{NAV_BA}}': '<a href="#avant-apres">Avant / Après</a>\n' if ba_html else '',
        '{{CHANNELS}}': channels_html(cfg.get('contact', {})),
        '{{FOOTER}}': '\n    '.join(footer),
        '{{TOTAL_RUNTIME}}': f'{total:.2f}',
    }
    for k, v in rep.items():
        page = page.replace(k, v)
    (DIST / 'index.html').write_text(page, encoding='utf-8')
    # version autonome (Netlify, hébergement classique)
    net = HERE / 'dist-netlify'
    if net.exists():
        shutil.rmtree(net)
    shutil.copytree(DIST, net, ignore=shutil.ignore_patterns('x264*'))
    (net / 'index.html').write_text('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
                                    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                                    '<meta name="robots" content="noindex">\n</head>\n<body>\n' + page + '\n</body>\n</html>\n', encoding='utf-8')
    sizes = {f.name: round(f.stat().st_size / 1048576, 1) for f in sorted(MEDIA.iterdir())}
    print(f'✔ site/dist/index.html · {len(rows)} projets · durée totale {total:.0f} s')
    print('  médias (Mo) :', sizes)


if __name__ == '__main__':
    main()
