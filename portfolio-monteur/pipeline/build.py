"""Construit un montage à partir de projects/<id>.json.

    python3 pipeline/build.py <id> [--no-track] [--no-proxy]

Produit dans public/<id>/ : proxys vidéo (étalonné + brut), mix.wav (voix nettoyée, musique
qui s'efface sous la voix, bruitages, master -14 LUFS), props.json (montage pour Remotion).
"""
import argparse
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import PUBLIC, ROOT, SOURCES, SR, WORK, load_audio, norm_word, probe, read_json, run, write_json, write_wav  # noqa: E402

FILLERS = {'euh', 'heu', 'euhh', 'heuu', 'euuh', 'hum', 'hmm', 'mmh', 'mh', 'hein'}
VIDEO_EXT = ('.mp4', '.mkv', '.webm', '.mov', '.m4v')

GRADES = {
    'none': [],
    # chaud et propre : contraste doux, peau flatteuse, noirs denses
    'warm': ['eq=contrast=1.07:saturation=1.07:gamma=0.98', 'colorbalance=rs=0.015:bs=-0.03:rh=0.03:bh=-0.03',
             "curves=all='0/0.02 0.25/0.22 0.5/0.5 0.78/0.81 1/0.98'"],
    # cinéma : ombres froides, hautes lumières chaudes, saturation retenue
    'cine': ['eq=contrast=1.14:saturation=0.86:gamma=0.97', 'colorbalance=rs=-0.05:gs=-0.01:bs=0.06:rh=0.06:gh=0.01:bh=-0.05',
             "curves=all='0/0.03 0.2/0.16 0.5/0.5 0.8/0.84 1/0.97'"],
    # noir & blanc contrasté
    'mono': ['hue=s=0', 'eq=contrast=1.22:gamma=0.95', "curves=all='0/0.02 0.3/0.24 0.7/0.76 1/0.98'"],
}


def source_path(name):
    return next(p for p in SOURCES.glob(f'{name}.*') if p.suffix.lower() in VIDEO_EXT)


def words_for(name, fixes):
    ws = read_json(WORK / name / 'words.json')
    for w in ws:
        k = norm_word(w['w'])
        if k in fixes:
            w['w'] = fixes[k] + (w['w'][-1] if w['w'][-1] in ',.!?…' else '')
    return ws


def energy_db(audio, hop=0.01):
    n = int(SR * hop)
    m = len(audio) // n
    rms = np.sqrt(np.mean(audio[: m * n].reshape(m, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def cut_range(words, src, ra, rb, cfg, fps):
    """Découpe [ra, rb] en plans en retirant blancs, hésitations et passages exclus."""
    max_gap = cfg.get('maxGap', 0.3)
    pad_in, pad_out = cfg.get('pad', [0.04, 0.07])
    drops = cfg.get('drop', [])
    fillers = cfg.get('fillers', True)
    audio = load_audio(src, max(0, ra - 0.5), rb - ra + 1.0)
    a0 = max(0, ra - 0.5)
    e = energy_db(audio)
    thr = np.percentile(e, 92) - 28
    loud = lambda t: e[min(len(e) - 1, max(0, int((t - a0) / 0.01)))] > thr  # noqa: E731

    ws = [w for w in words if w['s'] >= ra - 0.03 and w['e'] <= rb + 0.03]
    runs, cur = [], None
    for w in ws:
        bad = (fillers and norm_word(w['w']) in FILLERS) or any(w['s'] < d1 and w['e'] > d0 for d0, d1 in drops)
        if bad:
            if cur:
                runs.append(cur)
            cur = None
            continue
        if cur and w['s'] - cur['e'] > max_gap:
            runs.append(cur)
            cur = None
        if not cur:
            cur = {'s': w['s'], 'e': w['e'], 'words': []}
        cur['words'].append(w)
        cur['e'] = w['e']
    if cur:
        runs.append(cur)

    clips = []
    for r in runs:
        a, b = r['s'], r['e']
        lo, hi = max(ra, a - 0.25), min(rb, b + 0.35)
        while a - 0.01 > lo and loud(a - 0.01):
            a -= 0.01
        while b + 0.01 < hi and loud(b):
            b += 0.01
        a, b = max(ra, a - pad_in), min(rb, b + pad_out)
        if clips and a - clips[-1]['b'] < 0.09:
            clips[-1]['b'] = b
            clips[-1]['words'] += r['words']
        else:
            clips.append({'a': a, 'b': b, 'words': list(r['words'])})
    for c in clips:
        n = max(1, round((c['b'] - c['a']) * fps))
        c['b'] = c['a'] + n / fps
        c['frames'] = n
    return clips


def make_proxy(src, a, b, out, height, grade, sharpen=False):
    if out.exists() and out.stat().st_mtime > src.stat().st_mtime:
        return
    vf = [f'scale=-2:{height}:flags=lanczos'] + GRADES[grade]
    if sharpen:
        vf.append('unsharp=5:5:0.45:5:5:0')
    vf.append('format=yuv420p')
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-i', str(src), '-t', f'{b - a:.3f}', '-vf', ','.join(vf),
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-g', '8', '-bf', '0',
         '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
         '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', str(out)])


def anchor(at, words_out, src_map, default=0.0):
    """Convertit une ancre en temps de sortie : nombre, {word, n, offset}, {src, offset}."""
    if at is None:
        return default
    if isinstance(at, (int, float)):
        return float(at)
    off = at.get('offset', 0.0)
    if 'word' in at:
        target = norm_word(at['word'])
        n = at.get('n', 1)
        hits = [w for w in words_out if norm_word(w['w']) == target]
        if len(hits) < n:
            raise ValueError(f'mot introuvable : {at}')
        return hits[n - 1]['s'] + off
    if 'src' in at:
        for c in src_map:
            if c['abs_a'] <= at['src'] < c['abs_b'] and c.get('source') == at.get('source', c.get('source')):
                return c['start'] + at['src'] - c['abs_a'] + off
        raise ValueError(f'instant source hors montage : {at}')
    raise ValueError(f'ancre inconnue : {at}')


# ------------------------------------------------------------------ audio

def ffilter(x, chain):
    tmp = WORK / '_tmp_in.wav'
    tmp2 = WORK / '_tmp_out.wav'
    write_wav(tmp, x)
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp), '-af', chain, '-ar', str(SR), str(tmp2)])
    y = load_audio(tmp2, channels=1 if np.asarray(x).ndim == 1 else 2)
    return y


VOICE_CHAIN = ('highpass=f=75,afftdn=nr=8:nf=-48,equalizer=f=220:t=q:w=1.1:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.2,'
               'equalizer=f=10000:t=h:g=1.5,acompressor=threshold=-22dB:ratio=2.8:attack=6:release=140:makeup=3,'
               'deesser=i=0.35,alimiter=limit=0.89:level=false')


def build_voice(clips_audio, total, fps):
    out = np.zeros(int(round(total * SR)) + SR)
    fade = int(0.005 * SR)
    for c in clips_audio:
        x = load_audio(c['path'], c['abs_a'], c['frames'] / fps)
        x = x[: int(round(c['frames'] / fps * SR))]
        if len(x) > 2 * fade:
            x[:fade] *= np.linspace(0, 1, fade)
            x[-fade:] *= np.linspace(1, 0, fade)
        i = int(round(c['start'] * SR))
        out[i: i + len(x)] += x
    out = out[: int(round(total * SR))]
    if np.max(np.abs(out)) < 1e-6:
        return out
    return ffilter(out, VOICE_CHAIN)


def load_music(cfg, total):
    path = PUBLIC / cfg['file']
    x = load_audio(path, cfg.get('offset', 0.0), None, channels=2)
    need = int(total * SR)
    while len(x) < need:
        x = np.concatenate([x, load_audio(path, cfg.get('loop', 0.0), None, channels=2)])
    x = x[:need] * 10 ** (cfg.get('gain', -14) / 20)
    fi, fo = int(cfg.get('fadeIn', 0.05) * SR), int(cfg.get('fadeOut', 1.5) * SR)
    x[:fi] *= np.linspace(0, 1, fi)[:, None]
    x[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    return x


def duck(music, voice, depth_db=-10):
    env = np.abs(voice)
    win = int(0.04 * SR)
    env = np.sqrt(np.convolve(env ** 2, np.ones(win) / win, mode='same'))
    active = (env > 10 ** (-38 / 20)).astype(float)
    # attaque 60 ms, relâche 450 ms
    a, r = math.exp(-1 / (0.06 * SR)), math.exp(-1 / (0.45 * SR))
    g = np.empty_like(active)
    s = 0.0
    for i, v in enumerate(active[:: 48]):
        s = (a if v > s else r) ** 48 * s + (1 - (a if v > s else r) ** 48) * v
        g[i * 48: (i + 1) * 48] = s
    gain = 10 ** (depth_db * g / 20)
    return music * gain[: len(music), None]


def place(buf, x, t, gain_db):
    i = int(round(t * SR))
    if i >= len(buf):
        return
    x = x * 10 ** (gain_db / 20)
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    buf[i: i + n] += x[:n]


def auto_sfx(gfx, broll, clips, total, rules):
    ev = []
    for g in gfx:
        s, e = g['start'], g['end']
        t = g['type']
        if t == 'hook':
            ev += [('impact', s, -15), ('whoosh', s + 0.02, -15)]
        elif t == 'chart':
            ev += [('swoosh', s - 0.05, -13), ('shimmer', s + 1.75, -19)]
        elif t == 'counter':
            ev += [('swoosh', s - 0.05, -14)] + [('tick', s + 0.08 + 0.045 * k * (1 + k * 0.08), -24) for k in range(14)] + [('pop', s + 1.15, -15)]
        elif t == 'icon':
            ev += [('pop', s + 0.02, -13)]
        elif t == 'slam':
            ev += [('impact', s, -14), ('whoosh', s - 0.12, -17)]
        elif t == 'lower':
            ev += [('swoosh', s, -17)]
        elif t == 'quote':
            ev += [('shimmer', s, -20)]
        elif t == 'leak':
            ev += [('whoosh', s, -17)]
        elif t == 'flash':
            ev += [('impact', s, -13)]
        elif t == 'end':
            ev += [('riser', s - 1.6, -17), ('impact', s, -12)]
    for b in broll:
        ev += [('whoosh' if b.get('mode') != 'card' else 'swoosh', b['start'] - 0.12, -16)]
    if rules.get('punchClick'):
        for c in clips:
            if c.get('punch'):
                ev += [('click', c['start'], -22)]
    return ev


def master(mix, out):
    tmp = WORK / '_premaster.wav'
    write_wav(tmp, np.clip(mix, -1, 1))
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(tmp), '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    import json as _j
    txt = r.stderr[r.stderr.rfind('{'): r.stderr.rfind('}') + 1]
    m = _j.loads(txt)
    chain = (f"loudnorm=I=-14:TP=-1.2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
             f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp), '-af', chain, '-ar', str(SR), '-c:a', 'pcm_s16le', str(out)])
    return float(m['input_i'])


# ------------------------------------------------------------------ montage

def build(pid, do_track=True):
    P = read_json(ROOT / 'projects' / f'{pid}.json')
    out = PUBLIC / pid
    out.mkdir(parents=True, exist_ok=True)
    fmt = P.get('format', '9:16')
    W, H = (1080, 1920) if fmt == '9:16' else (1920, 1080)
    default_src = P.get('source')
    first = probe(source_path(default_src or P['ranges'][0][0]))
    fps = P.get('fps') or (25 if abs(first['fps'] - 25) < 0.5 else 30)
    cut_cfg = P.get('cut', {})
    fixes = {norm_word(k): v for k, v in P.get('fixes', {}).items()}
    kwmap = {norm_word(k): v for k, v in P.get('keywords', {}).items()}
    grade = P.get('grade', 'warm')

    clips, words_out, tracks, src_map = [], [], {}, []
    t = 0.0
    for ri, rng in enumerate(P['ranges']):
        if isinstance(rng, dict) and 'gap' in rng:
            t += rng['gap']
            continue
        if isinstance(rng[0], str):
            name, ra, rb = rng[0], float(rng[1]), float(rng[2])
        else:
            name, ra, rb = default_src, float(rng[0]), float(rng[1])
        src = source_path(name)
        info = probe(src)
        ws = words_for(name, fixes)
        parts = cut_range(ws, src, ra, rb, cut_cfg, fps) if not P.get('noCut') else [
            {'a': ra, 'b': ra + round((rb - ra) * fps) / fps, 'frames': round((rb - ra) * fps), 'words': [w for w in ws if ra <= w['s'] < rb]}]
        # proxy couvrant la plage (+ marge) ; hauteur selon le format et la source
        pa, pb = max(0, parts[0]['a'] - 0.5), parts[-1]['b'] + 0.5 + (P.get('end', {}).get('dur', 0) if ri == len(P['ranges']) - 1 else 0)
        ph = min(info['height'], 2160 if fmt == '9:16' else 1440)
        key = f'{name}_{ri}'
        gpath, rpath = out / f'{key}.mp4', out / f'{key}_raw.mp4'
        make_proxy(src, pa, pb, gpath, ph, grade, sharpen=info['height'] <= 1080 and fmt == '9:16')
        if P.get('raw', False):
            make_proxy(src, pa, pb, rpath, ph, 'none')
        if do_track:
            tracks[key] = __import__('facetrack').track(src, pa, pb)
        for c in parts:
            c.update(start=t, end=t + c['frames'] / fps, source=name, abs_a=c['a'], abs_b=c['b'], path=src)
            vw, vh = (info['height'], info['width']) if info.get('rotation') in (90, -90, 270) else (info['width'], info['height'])
            clips.append({'src': f'{pid}/{key}.mp4', 'srcIn': round(c['a'] - pa, 4), 'start': round(t, 4), 'end': round(c['end'], 4),
                          'track': key if do_track else None, 'w': vw, 'h': vh, '_abs': c['a'], '_src': name})
            for w in c['words']:
                k = norm_word(w['w'])
                lvl = kwmap.get(k, 1 if any(ch.isdigit() for ch in k) or '€' in w['w'] or '%' in w['w'] else 0)
                words_out.append({'w': w['w'], 's': round(t + w['s'] - c['a'], 3), 'e': round(t + w['e'] - c['a'], 3), 'kw': lvl})
            src_map.append(c)
            t = c['end']
        srcW, srcH = info['width'], info['height']
        if info.get('rotation') in (90, -90, 270):
            srcW, srcH = srcH, srcW

    for i in range(1, len(words_out)):
        if words_out[i]['s'] < words_out[i - 1]['e']:
            words_out[i - 1]['e'] = words_out[i]['s']
    voice_end = t

    # fin : on prolonge le dernier plan sous la carte de fin
    end = P.get('end')
    if end:
        clips[-1]['end'] = round(clips[-1]['end'] + end['dur'], 4)
        t += end['dur']
    total = round(t * fps) / fps

    # zooms : on change de cadrage à chaque coupe (masque le saut), poussée lente sur les plans longs
    zc = P.get('zoom', {})
    pattern = zc.get('pattern', [1.0, 1.16, 1.04, 1.26] if fmt == '9:16' else [1.0, 1.2, 1.06, 1.3])
    push = zc.get('push', 0.05)
    every = zc.get('punchEvery', 3)
    for i, c in enumerate(clips):
        z = pattern[i % len(pattern)]
        d = c['end'] - c['start']
        c['zoom'] = z
        if d > 2.0:
            c['keys'] = [[0, z], [round(d, 3), round(z * (1 + push), 4)]]
        c['punch'] = bool(i and every and i % every == 0)
    for em in zc.get('emph', []):
        te = anchor(em['at'], words_out, src_map)
        c = next(c for c in clips if c['start'] <= te < c['end'])
        rel = te - c['start']
        z0 = c['zoom']
        c['keys'] = [[0, z0], [round(max(0, rel - 0.02), 3), z0], [round(rel + em.get('ease', 0.22), 3), em['zoom']]]

    def resolve(items):
        res = []
        for g in items:
            g = dict(g)
            s = anchor(g.pop('at', 0), words_out, src_map)
            if 'until' in g:
                e = anchor(g.pop('until'), words_out, src_map)
            else:
                e = s + g.pop('dur', 2.0)
            g['start'], g['end'] = round(s, 3), round(min(e, total), 3)
            res.append(g)
        return res

    gfx = resolve(P.get('gfx', []))
    if end:
        gfx.append({'type': 'end', 'start': round(voice_end + end.get('lead', 0.1), 3), 'end': total,
                    **{k: v for k, v in end.items() if k not in ('dur', 'lead')}})
    broll = resolve(P.get('broll', []))
    for b in broll:
        b.setdefault('srcIn', 0)

    # ---------------------------------------------------------------- son
    voice = build_voice(src_map, total, fps)
    mix = np.stack([voice, voice], axis=1) * 10 ** (P.get('voiceGain', 0) / 20)
    if P.get('music'):
        mus = load_music(P['music'], total)
        mus = duck(mus, voice, P['music'].get('duck', -11))
        mix[: len(mus)] += mus
    bank = {}
    events = auto_sfx(gfx, broll, clips, total, P.get('sfxRules', {})) if P.get('sfx', 'auto') == 'auto' else []
    for s in P.get('sfxExtra', []):
        events.append((s['name'], anchor(s['at'], words_out, src_map), s.get('gain', -14)))
    for name, ts, gdb in events:
        if name not in bank:
            bank[name] = load_audio(PUBLIC / 'sfx' / f'{name}.wav', channels=2)
        place(mix, bank[name], ts, gdb + P.get('sfxGain', 0))
    loud = master(mix, out / 'mix.wav')

    for c in clips:
        c.pop('_abs', None)
        c.pop('_src', None)
    edit = {
        'id': pid, 'fps': fps, 'width': W, 'height': H, 'duration': total, 'srcW': srcW, 'srcH': srcH,
        'clips': clips, 'words': words_out, 'broll': broll, 'gfx': gfx, 'tracks': tracks,
        'audio': f'{pid}/mix.wav', 'theme': P.get('theme', {}),
        'meta': {'title': P.get('title'), 'cuts': len(clips) - 1, 'words': len(words_out), 'voiceEnd': voice_end,
                 'sources': sorted({c['source'] for c in src_map}),
                 'rush': round(sum(abs(c['abs_b'] - c['abs_a']) for c in src_map), 2)},
    }
    props = {'edit': edit, **P.get('props', {})}
    write_json(out / 'props.json', props)
    print(f'✔ {pid} : {total:.1f} s, {len(clips)} plans, {len(words_out)} mots, {len(gfx)} animations, '
          f'{len(broll)} b-roll, voix+mix {loud:.1f} LUFS → normalisé -14 LUFS')
    return props


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('id')
    ap.add_argument('--no-track', action='store_true')
    a = ap.parse_args()
    build(a.id, do_track=not a.no_track)
