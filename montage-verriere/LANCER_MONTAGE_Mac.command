#!/bin/bash
cd "$(dirname "$0")"
echo "Préparation des outils vidéo (une seule fois)..."
python3 -m pip install --user --quiet --disable-pip-version-check imageio-ffmpeg pillow 2>/dev/null \
  || python3 -m pip install --user --quiet --break-system-packages imageio-ffmpeg pillow
python3 montage_verriere.py "$@"
read -p "Appuie sur Entrée pour fermer."
