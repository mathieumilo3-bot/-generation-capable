# Site vitrine + tunnel de rendez-vous — Dr Hossame Bakraoui (chirurgien-dentiste, Meknès)

Site statique (HTML/CSS/JS, aucune dépendance). Ouvrir `index.html` ou servir le dossier tel quel.

## Le tunnel (écran d'accueil)
5 étapes : objectif → délai → freins → créneau souhaité → coordonnées, puis une recommandation personnalisée
et un bouton « Confirmer sur WhatsApp » qui envoie la demande pré-remplie. Progression sauvegardée si le visiteur quitte la page,
barre d'action fixe sur mobile, relance douce après 22 s d'inactivité.

## À configurer avant mise en ligne (`script.js`, objet `CONFIG`)
- `WHATSAPP_NUMBER` : numéro du cabinet, format `212XXXXXXXXX`.
- `LEAD_ENDPOINT` (optionnel) : URL qui reçoit chaque demande en JSON (Formspree, Netlify function, Zapier…) pour ne pas dépendre que de WhatsApp.
- `RESPONSE` : délai de réponse annoncé (« dans la journée ») — à confirmer avec le Dr Bakraoui.

## À valider avec le Dr Bakraoui
- Promesses affichées : devis clair avant tout soin, anesthésie adaptée, délai de réponse.
- Photo : `assets/img/hossame-portrait.png` (extraite de son profil Instagram, basse résolution) — à remplacer par un portrait HD.
- Langues : FR par défaut, bouton FR / عربية (textes en attributs `data-ar` et dictionnaire `T` dans `script.js`).
