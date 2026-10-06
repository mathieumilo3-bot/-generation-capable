#!/usr/bin/env bash
# Couvertures (posters JPG) + showreel 45 s à partir des trois rendus.
set -euo pipefail
cd "$(dirname "$0")/../renders"
mkdir -p posters
poster() { ffmpeg -hide_banner -loglevel error -y -ss "$2" -i "$1.mp4" -frames:v 1 -q:v 2 "posters/$1.jpg"; }
poster 01-kinetic 8.6
poster 02-liquid 14.9
poster 03-shapes 4.45
printf "file '01-kinetic.mp4'\nfile '02-liquid.mp4'\nfile '03-shapes.mp4'\n" > .reel.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i .reel.txt -c copy -movflags +faststart showreel-45s.mp4
rm .reel.txt
ls -la . posters
