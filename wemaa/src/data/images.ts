/**
 * Toutes les images du site sont centralisées ici.
 *
 * ⚠️ CE SONT DES PHOTOS DE DÉMONSTRATION (banque d'images libres, via Unsplash).
 * Pour la mise en production, remplacer chaque URL par une vraie photographie
 * Wemaa Services (mariages, réceptions, événements réalisés par l'agence).
 * Il suffit de changer la valeur de la clé correspondante ci-dessous —
 * aucun composant n'a besoin d'être modifié.
 */

const unsplash = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

export interface PortfolioImage {
  id: string;
  src: string;
  category: string;
  alt: string;
}

const portfolio: PortfolioImage[] = [
  { id: "p1", src: unsplash("photo-1519741497674-611481863552", 1400), category: "Mariage", alt: "Table de mariage dressée avec bougies et fleurs" },
  { id: "p2", src: unsplash("photo-1511795409834-ef04bbd61622", 1400), category: "Réception", alt: "Réception élégante en salle" },
  { id: "p3", src: unsplash("photo-1511578314322-379afb476865", 1400), category: "Événement professionnel", alt: "Salle de conférence préparée pour un séminaire" },
  { id: "p4", src: unsplash("photo-1522673607200-164d1b6ce486", 1400), category: "Décoration", alt: "Décoration florale de table événementielle" },
  { id: "p5", src: unsplash("photo-1414235077428-338989a2e8c0", 1400), category: "Dîner", alt: "Dîner de gala aux lumières chaleureuses" },
  { id: "p6", src: unsplash("photo-1591604466107-ec97de577aff", 1400), category: "Cérémonie", alt: "Allée de cérémonie fleurie" },
  { id: "p7", src: unsplash("photo-1470753937643-efeb931202a9", 1400), category: "Événement professionnel", alt: "Feu d'artifice lors d'un événement" },
  { id: "p8", src: unsplash("photo-1543007630-9710e4a00a20", 1400), category: "Dîner", alt: "Table dressée avec accents dorés" },
  { id: "p9", src: unsplash("photo-1606216794074-735e91aa2c92", 1400), category: "Décoration", alt: "Arche florale de cérémonie" },
];

export const images = {
  heroBackground: unsplash("photo-1519741497674-611481863552", 2400),

  serviceMariages: unsplash("photo-1519225421980-6c1f4d95cffc", 1200),
  serviceProfessionnels: unsplash("photo-1511578314322-379afb476865", 1200),
  serviceCoordination: unsplash("photo-1478146059778-26028b07395a", 1200),
  servicePersonnel: unsplash("photo-1519167758481-83f550bb49b3", 1200),

  teamPhoto: unsplash("photo-1556125574-d7f27ec36a06", 1800),

  ctaFinal: unsplash("photo-1465495976277-4387d4b0b4c6", 2400),
  ctaMid: unsplash("photo-1606216794074-735e91aa2c92", 1800),

  portfolio,
} as const;
