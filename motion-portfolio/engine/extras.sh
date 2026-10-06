#!/usr/bin/env bash
# Couvertures (posters JPG) + showreel 45 s à partir des trois rendus.
set -euo pipefail
cd "$(dirname "$0")/../renders"
mkdir -p posters
poster() { ffmpeg -hide_banner -loglevel error -y -ss "$2" -i "$1.mp4" -frames:v 1 -q:v 2 "posters/$1.jpg"; }
poster 01-kinetic 8.6
poster 02-liquid 14.9
poster 03-shapes 4.27
# showreel : les trois pièces bout à bout, en version légère (< 30 Mo) pour le partage.
# Réencodé en deux passes (les réglages x264 des trois pièces diffèrent).
REEL=(-filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]"
  -c:v libx264 -preset slow -tune film -x264-params aq-mode=3 -b:v 4600k -maxrate 7000k -bufsize 9200k -pix_fmt yuv420p
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
IN=(-i 01-kinetic.mp4 -i 02-liquid.mp4 -i 03-shapes.mp4)
ffmpeg -hide_banner -loglevel error -y "${IN[@]}" "${REEL[@]}" -pass 1 -passlogfile .reelpass -an -f mp4 /dev/null
ffmpeg -hide_banner -loglevel error -y "${IN[@]}" "${REEL[@]}" -pass 2 -passlogfile .reelpass -c:a aac -b:a 192k -movflags +faststart showreel-45s.mp4
rm -f .reelpass*
ls -la . posters
