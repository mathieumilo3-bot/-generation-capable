"""Télécharge une vidéo publique (YouTube, TikTok, Instagram…) dans sources/<nom>.mp4.

    python3 pipeline/fetch.py <url> <nom> [--max 2160]
"""
import argparse
import json
import sys

from yt_dlp import YoutubeDL

from lib import SOURCES, probe

ap = argparse.ArgumentParser()
ap.add_argument('url')
ap.add_argument('name')
ap.add_argument('--max', type=int, default=2160)
args = ap.parse_args()

SOURCES.mkdir(parents=True, exist_ok=True)
opts = {
    'format': f'bv*[height<={args.max}]+ba/b[height<={args.max}]/b',
    'merge_output_format': 'mp4',
    'outtmpl': str(SOURCES / f'{args.name}.%(ext)s'),
    'noplaylist': True,
    'quiet': True,
    'no_warnings': False,
    'js_runtimes': {'node': {}},
    'remote_components': ['ejs:github'],
}
with YoutubeDL(opts) as y:
    info = y.extract_info(args.url, download=True)
meta = {k: info.get(k) for k in ('id', 'title', 'uploader', 'channel', 'upload_date', 'duration', 'webpage_url', 'license', 'view_count')}
(SOURCES / f'{args.name}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
p = probe(SOURCES / f'{args.name}.mp4')
print(json.dumps({**meta, **p}, ensure_ascii=False))
sys.exit(0)
