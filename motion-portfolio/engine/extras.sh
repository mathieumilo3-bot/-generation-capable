#!/usr/bin/env bash
# Couvertures (posters JPG) + showreel 45 s à partir des trois rendus.
set -euo pipefail
cd "$(dirname "$0")/../renders"
mkdir -p posters
poster() { ffmpeg -hide_banner -loglevel error -y -ss "$2" -i "$1.mp4" -frames:v 1 -q:v 2 "posters/$1.jpg"; }
poster 01-kinetic 8.6
poster 02-liquid 14.9
poster 03-shapes 4.27
# showreel : les trois pièces bout à bout (réencodé, car leurs réglages x264 diffèrent)
ffmpeg -hide_banner -loglevel error -y -i 01-kinetic.mp4 -i 02-liquid.mp4 -i 03-shapes.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 18 -tune film -x264-params aq-mode=3 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 320k -movflags +faststart showreel-45s.mp4
ls -la . posters
