"""Transcription mot à mot (faster-whisper) → work/<nom>/words.json + transcript.txt

    python3 pipeline/transcribe.py <nom> [--model large-v3-turbo] [--start s --end s]
"""
import argparse
import time

from faster_whisper import WhisperModel

from lib import SOURCES, WORK, write_json

ap = argparse.ArgumentParser()
ap.add_argument('name')
ap.add_argument('--model', default='large-v3-turbo')
ap.add_argument('--start', type=float, default=None)
ap.add_argument('--end', type=float, default=None)
args = ap.parse_args()

src = next(p for p in SOURCES.glob(f'{args.name}.*') if p.suffix.lower() in ('.mp4', '.mkv', '.webm', '.mov', '.m4v'))
out = WORK / args.name
out.mkdir(parents=True, exist_ok=True)
t0 = time.time()
model = WhisperModel(args.model, device='cpu', compute_type='int8', cpu_threads=4)
clip = None
if args.start is not None:
    clip = [args.start, args.end] if args.end is not None else [args.start]
segments, info = model.transcribe(
    str(src),
    language='fr',
    word_timestamps=True,
    vad_filter=True,
    vad_parameters={'min_silence_duration_ms': 300},
    beam_size=5,
    condition_on_previous_text=False,
    clip_timestamps=clip or '0',
    initial_prompt='Tony Jazz, entrepreneur, investissement, liberté financière, immobilier, bourse, mindset.',
)
words, lines = [], []
for seg in segments:
    lines.append(f'[{int(seg.start // 60):02d}:{seg.start % 60:05.2f} → {int(seg.end // 60):02d}:{seg.end % 60:05.2f}] {seg.text.strip()}')
    for w in seg.words or []:
        txt = w.word.strip()
        if txt:
            words.append({'w': txt, 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability, 3)})
    print(lines[-1], flush=True)
write_json(out / 'words.json', words)
(out / 'transcript.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'{len(words)} mots, {info.duration:.0f} s d’audio, {time.time() - t0:.0f} s de calcul')
