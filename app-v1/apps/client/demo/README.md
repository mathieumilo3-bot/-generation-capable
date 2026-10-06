# Démo interactive (données simulées)

`index.html` contient le faux backend de démonstration et charge l'export web de l'application.
Il n'est utilisé que pour la démo : aucun paiement ni aucune connexion réels.

Construction : `npx expo export --platform web` avec `EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co`,
puis copier le bundle d'entrée dans `app/entry.js` (en remplaçant `/assets/` par `__BASE__assets/`),
la police `Ionicons.ttf` dans `assets/fonts/`, et une vidéo `demo.mp4` + `poster.jpg` à côté de `index.html`.
