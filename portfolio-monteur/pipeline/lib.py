"""Outils communs : chemins, ffprobe, lecture/écriture audio via ffmpeg."""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'sources'
WORK = ROOT / 'work'
PUBLIC = ROOT / 'public'
SR = 48000


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f'échec : {" ".join(map(str, cmd))}\n{r.stderr[-3000:]}')
    return r.stdout


def probe(path):
    out = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    v = next((s for s in out['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in out['streams'] if s['codec_type'] == 'audio'), None)
    info = {'duration': float(out['format']['duration'])}
    if v:
        num, den = map(int, v['avg_frame_rate'].split('/'))
        info.update(width=int(v['width']), height=int(v['height']), fps=num / den if den else 30.0, vcodec=v['codec_name'])
        rot = 0
        for sd in v.get('side_data_list', []):
            rot = int(sd.get('rotation', rot))
        info['rotation'] = rot
    info['has_audio'] = a is not None
    return info


def load_audio(path, start=0.0, dur=None, sr=SR, channels=1):
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{start:.4f}', '-i', str(path)]
    if dur is not None:
        cmd += ['-t', f'{dur:.4f}']
    cmd += ['-vn', '-ac', str(channels), '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    return a.reshape(-1, channels) if channels > 1 else a


def write_wav(path, data, sr=SR):
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data = data[:, None]
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def read_json(p):
    return json.loads(Path(p).read_text(encoding='utf-8'))


def write_json(p, obj, indent=None):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(obj, ensure_ascii=False, indent=indent), encoding='utf-8')


def norm_word(w):
    return w.lower().strip(' .,;:!?…"«»“”()[]—–-').replace('’', "'")
