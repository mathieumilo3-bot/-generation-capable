// Pré-télécharge le Chromium géré par Remotion pendant le build de l'image
// Docker, pour que le premier rendu en production n'ait pas besoin d'accès
// réseau ni de temps d'attente supplémentaire.
import { ensureBrowser } from "@remotion/renderer";

await ensureBrowser();
console.log("Chromium Remotion prêt.");
