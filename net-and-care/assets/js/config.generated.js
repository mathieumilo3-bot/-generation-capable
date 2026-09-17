/* FICHIER GÉNÉRÉ — ne pas modifier à la main.
   Source : net-and-care/site.config.json · Régénérer : npm run build:netcare */
window.NETCARE = {
  "tel": "+33600000000",
  "telAffichage": "06 00 00 00 00",
  "whatsapp": "33600000000",
  "email": "contact@netandcare.fr",
  "endpoint": "/.netlify/functions/netcare-devis",
  "zones": {
    "communes": [
      "Cannes",
      "Le Cannet",
      "Mandelieu-la-Napoule",
      "Mougins",
      "Théoule-sur-Mer",
      "Antibes",
      "Juan-les-Pins",
      "Vallauris",
      "Golfe-Juan",
      "Biot",
      "Grasse",
      "Mouans-Sartoux",
      "Valbonne",
      "Pégomas",
      "Auribeau-sur-Siagne",
      "Villeneuve-Loubet",
      "Cagnes-sur-Mer",
      "Saint-Laurent-du-Var"
    ],
    "zone2": [
      "Villeneuve-Loubet",
      "Cagnes-sur-Mer",
      "Saint-Laurent-du-Var"
    ]
  },
  "tarifs": {
    "devise": "€",
    "amplitude": 0.12,
    "arrondi": 5,
    "prestations": {
      "canape": {
        "base": 39,
        "parPlace": 28,
        "min": 79
      },
      "fauteuil": {
        "base": 0,
        "parUnite": 45,
        "min": 45
      },
      "chaise": {
        "base": 0,
        "parUnite": 15,
        "min": 60
      },
      "matelas": {
        "base": 49,
        "parPlace": 20,
        "min": 69
      },
      "tapis": {
        "base": 0,
        "parM2": 18,
        "min": 60
      },
      "moquette": {
        "base": 0,
        "parM2": 7,
        "min": 120
      },
      "chantier": {
        "base": 0,
        "parM2": 6,
        "min": 250
      }
    },
    "etat": {
      "leger": 1,
      "normal": 1.12,
      "important": 1.3,
      "taches": 1.45
    },
    "options": {
      "acariens": 25,
      "impermeabilisation": 35,
      "urgence": 30
    },
    "deplacementZone2": 20
  },
  "delais": {
    "rappel": "moins de 2 h en journée",
    "intervention": "sous 48 h",
    "sechage": "4 à 6 h",
    "_noteCourt": "Versions courtes, utilisées dans le bandeau de chiffres où seule une valeur brève reste lisible.",
    "interventionCourt": "48 h",
    "sechageCourt": "4 à 6 h"
  }
};
