Dossier vidéo du tunnel vsl.html
================================

Le lecteur vidéo de vsl.html est entièrement fonctionnel (lecture/pause,
progression, plein écran, verrouillage de la candidature à 100% de lecture,
reprise de la progression via localStorage) mais il n'a pas de vidéo réelle
tant que ces deux fichiers ne sont pas déposés ici :

  assets/vsl/generation-capable-vsl.mp4   — la présentation (VSL)
  assets/vsl/poster.jpg                   — image affichée avant lecture

Recommandations :
  - Format vidéo : MP4 (H.264 + AAC), 1080p suffit largement pour du mobile.
  - Compresse la vidéo avant de la déposer (HandBrake, ou un service comme
    Bunny Stream / Mux / Cloudflare Stream si le fichier dépasse ~150-200 Mo :
    dans ce cas, remplace simplement le chemin du <source> dans vsl.html par
    l'URL mp4 fournie par le service, l'intégration <video> reste identique).
  - L'image poster doit avoir le même ratio que la vidéo (16:9) pour éviter
    tout effet de recadrage.

Une fois les fichiers en place, supprime ce README (il n'est pas servi au
public — /assets/vsl/*.mp4 et *.jpg sont référencés depuis vsl.html, ce
fichier .txt ne l'est jamais).
