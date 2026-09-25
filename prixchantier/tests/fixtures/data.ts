/**
 * Données anonymisées d'un DPGF CVC / plomberie / électricité réaliste.
 * Servent à générer les fixtures (scripts/generate-fixtures.ts) et
 * d'oracle aux tests : chaque ligne attendue est connue exactement.
 */

export type FixtureLine = { code: string; designation: string; unit: string; qty: number };
export type FixtureLot = { lot: string; sections: { title: string; lines: FixtureLine[] }[] };

export const DPGF_LOTS: FixtureLot[] = [
  {
    lot: "LOT 10 - CHAUFFAGE VENTILATION CLIMATISATION",
    sections: [
      {
        title: "10.1 Production de chaleur",
        lines: [
          { code: "10.1.1", designation: "Pompe à chaleur air/eau 45 kW, fluide R32, régulation intégrée", unit: "U", qty: 2 },
          { code: "10.1.2", designation: "Ballon tampon 500 L calorifugé", unit: "U", qty: 1 },
          { code: "10.1.3", designation: "Vase d'expansion 80 L 3 bar", unit: "U", qty: 2 },
          { code: "10.1.4", designation: "Circulateur double à vitesse variable DN40", unit: "U", qty: 2 },
          { code: "10.1.5", designation: "Pot à boues magnétique DN50", unit: "U", qty: 1 },
          { code: "10.1.6", designation: "Soupape de sécurité 3 bar DN25", unit: "U", qty: 4 },
          { code: "10.1.7", designation: "Mise en service et réglages production", unit: "Ens", qty: 1 },
        ],
      },
      {
        title: "10.2 Réseaux hydrauliques",
        lines: [
          { code: "10.2.1", designation: "Tube acier noir DN20 y compris supports", unit: "ml", qty: 120 },
          { code: "10.2.2", designation: "Tube acier noir DN25 y compris supports", unit: "ml", qty: 95 },
          { code: "10.2.3", designation: "Tube acier noir DN32 y compris supports", unit: "ml", qty: 60 },
          { code: "10.2.4", designation: "Tube acier noir DN40 y compris supports", unit: "ml", qty: 45 },
          { code: "10.2.5", designation: "Tube multicouche 16x2 sous gaine", unit: "ml", qty: 340 },
          { code: "10.2.6", designation: "Tube multicouche 20x2 sous gaine", unit: "ml", qty: 180 },
          { code: "10.2.7", designation: "Vanne d'équilibrage DN20", unit: "U", qty: 14 },
          { code: "10.2.8", designation: "Vanne d'équilibrage DN25", unit: "U", qty: 8 },
          { code: "10.2.9", designation: "Vanne d'isolement à boisseau sphérique DN32", unit: "U", qty: 12 },
          { code: "10.2.10", designation: "Calorifuge coquille élastomère 19 mm DN20 à DN40", unit: "ml", qty: 320 },
          { code: "10.2.11", designation: "Purgeur automatique d'air", unit: "U", qty: 16 },
          { code: "10.2.12", designation: "Collecteur de distribution 6 départs", unit: "U", qty: 3 },
        ],
      },
      {
        title: "10.3 Émission",
        lines: [
          { code: "10.3.1", designation: "Radiateur acier panneau type 22 H600 L800", unit: "U", qty: 18 },
          { code: "10.3.2", designation: "Radiateur acier panneau type 22 H600 L1200", unit: "U", qty: 12 },
          { code: "10.3.3", designation: "Robinet thermostatique avec tête", unit: "U", qty: 30 },
          { code: "10.3.4", designation: "Ventilo-convecteur plafonnier 4 tubes 2,5 kW", unit: "U", qty: 10 },
          { code: "10.3.5", designation: "Sèche-serviettes électrique 750 W", unit: "U", qty: 6 },
        ],
      },
      {
        title: "10.4 Ventilation",
        lines: [
          { code: "10.4.1", designation: "Centrale de traitement d'air double flux 3000 m3/h", unit: "U", qty: 1 },
          { code: "10.4.2", designation: "Gaine acier galvanisé circulaire Ø160", unit: "ml", qty: 150 },
          { code: "10.4.3", designation: "Gaine acier galvanisé circulaire Ø250", unit: "ml", qty: 80 },
          { code: "10.4.4", designation: "Gaine rectangulaire 400x300", unit: "m²", qty: 45 },
          { code: "10.4.5", designation: "Bouche d'extraction autoréglable 30 m3/h", unit: "U", qty: 24 },
          { code: "10.4.6", designation: "Diffuseur plafonnier 600x600", unit: "U", qty: 16 },
          { code: "10.4.7", designation: "Clapet coupe-feu circulaire Ø250", unit: "U", qty: 6 },
          { code: "10.4.8", designation: "Silencieux circulaire Ø250 L900", unit: "U", qty: 2 },
          { code: "10.4.9", designation: "Isolation laine minérale gaines 25 mm", unit: "m²", qty: 60 },
        ],
      },
      {
        title: "10.5 Régulation",
        lines: [
          { code: "10.5.1", designation: "Armoire de régulation et automate", unit: "Ens", qty: 1 },
          { code: "10.5.2", designation: "Sonde de température ambiance", unit: "U", qty: 12 },
          { code: "10.5.3", designation: "Vanne 3 voies motorisée DN32", unit: "U", qty: 2 },
          { code: "10.5.4", designation: "Essais, DOE et formation exploitant", unit: "Ft", qty: 1 },
        ],
      },
    ],
  },
  {
    lot: "LOT 11 - PLOMBERIE SANITAIRE",
    sections: [
      {
        title: "11.1 Production ECS",
        lines: [
          { code: "11.1.1", designation: "Chauffe-eau thermodynamique 270 L", unit: "U", qty: 2 },
          { code: "11.1.2", designation: "Groupe de sécurité 3/4", unit: "U", qty: 2 },
          { code: "11.1.3", designation: "Mitigeur thermostatique centralisé DN25", unit: "U", qty: 1 },
        ],
      },
      {
        title: "11.2 Distribution EF / ECS",
        lines: [
          { code: "11.2.1", designation: "Tube cuivre écroui 14/16", unit: "ml", qty: 210 },
          { code: "11.2.2", designation: "Tube cuivre écroui 20/22", unit: "ml", qty: 130 },
          { code: "11.2.3", designation: "Tube PER 16 prégainé", unit: "ml", qty: 260 },
          { code: "11.2.4", designation: "Réducteur de pression DN20", unit: "U", qty: 3 },
          { code: "11.2.5", designation: "Compteur divisionnaire eau froide DN15", unit: "U", qty: 8 },
          { code: "11.2.6", designation: "Clapet anti-retour EA DN20", unit: "U", qty: 3 },
        ],
      },
      {
        title: "11.3 Évacuations",
        lines: [
          { code: "11.3.1", designation: "Tube PVC évacuation Ø40", unit: "ml", qty: 90 },
          { code: "11.3.2", designation: "Tube PVC évacuation Ø100", unit: "ml", qty: 75 },
          { code: "11.3.3", designation: "Colonne de chute PVC Ø100 isolée phonique", unit: "ml", qty: 36 },
          { code: "11.3.4", designation: "Siphon de sol inox 150x150", unit: "U", qty: 4 },
        ],
      },
      {
        title: "11.4 Appareils sanitaires",
        lines: [
          { code: "11.4.1", designation: "WC suspendu avec bâti-support et plaque de commande", unit: "U", qty: 12 },
          { code: "11.4.2", designation: "Lavabo céramique 60 cm avec mitigeur", unit: "U", qty: 14 },
          { code: "11.4.3", designation: "Receveur de douche extra-plat 90x90", unit: "U", qty: 4 },
          { code: "11.4.4", designation: "Mitigeur douche thermostatique avec barre de douche", unit: "U", qty: 4 },
          { code: "11.4.5", designation: "Évier inox 2 bacs avec mitigeur", unit: "U", qty: 2 },
          { code: "11.4.6", designation: "Urinoir céramique avec robinet temporisé", unit: "U", qty: 3 },
        ],
      },
    ],
  },
  {
    lot: "LOT 12 - ÉLECTRICITÉ COURANTS FORTS ET FAIBLES",
    sections: [
      {
        title: "12.1 Distribution",
        lines: [
          { code: "12.1.1", designation: "Tableau général basse tension 250 A", unit: "U", qty: 1 },
          { code: "12.1.2", designation: "Tableau divisionnaire 4 rangées équipé", unit: "U", qty: 3 },
          { code: "12.1.3", designation: "Câble U1000 R2V 3G2,5 mm²", unit: "ml", qty: 1800 },
          { code: "12.1.4", designation: "Câble U1000 R2V 3G1,5 mm²", unit: "ml", qty: 1400 },
          { code: "12.1.5", designation: "Câble U1000 R2V 5G10 mm²", unit: "ml", qty: 120 },
          { code: "12.1.6", designation: "Chemin de câbles fil 200 mm", unit: "ml", qty: 160 },
          { code: "12.1.7", designation: "Conduit ICTA Ø20", unit: "ml", qty: 900 },
        ],
      },
      {
        title: "12.2 Appareillage et éclairage",
        lines: [
          { code: "12.2.1", designation: "Prise de courant 2P+T 16 A", unit: "U", qty: 140 },
          { code: "12.2.2", designation: "Interrupteur simple allumage", unit: "U", qty: 60 },
          { code: "12.2.3", designation: "Luminaire LED encastré 600x600 36 W", unit: "U", qty: 85 },
          { code: "12.2.4", designation: "Downlight LED 12 W IP44", unit: "U", qty: 40 },
          { code: "12.2.5", designation: "Bloc autonome d'éclairage de sécurité", unit: "U", qty: 22 },
          { code: "12.2.6", designation: "Détecteur de présence plafonnier", unit: "U", qty: 18 },
        ],
      },
      {
        title: "12.3 Courants faibles",
        lines: [
          { code: "12.3.1", designation: "Baie de brassage 19 pouces 42U", unit: "U", qty: 1 },
          { code: "12.3.2", designation: "Câble catégorie 6A F/FTP", unit: "ml", qty: 2400 },
          { code: "12.3.3", designation: "Prise RJ45 catégorie 6A", unit: "U", qty: 96 },
          { code: "12.3.4", designation: "Recette et certification du réseau VDI", unit: "Ft", qty: 1 },
        ],
      },
    ],
  },
];

export const ALL_LINES: FixtureLine[] = DPGF_LOTS.flatMap((l) => l.sections.flatMap((s) => s.lines));
