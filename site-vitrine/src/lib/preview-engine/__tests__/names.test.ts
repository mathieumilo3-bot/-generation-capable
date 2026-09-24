import { describe, expect, it } from "vitest";
import { isCleanSentence, stripGluedHeading } from "../assets";
import { cleanName, displayCase } from "../profile";

describe("public names", () => {
  it.each([
    ["A A T P SARL — Trojani.P", "Trojani.P"],
    ["CEGRI SAS - Electricien Paris, Montataire, Oise", "CEGRI"],
    ["Toiture Martin | Accueil", "Toiture Martin"],
    ["SAS LE FRANC", "LE FRANC"],
    ["Menuiserie Piau", "Menuiserie Piau"],
  ])("%s → %s", (raw, expected) => {
    expect(cleanName(raw)).toBe(expected);
  });

  it("title-cases the registry's commercial name", () => {
    expect(displayCase(cleanName("TROJANI.P"))).toBe("Trojani.P");
  });
});

describe("quotable sentences", () => {
  it.each([
    "Isolation par l'extérieur (ITE) Isolation combles Isolation murs et cloison sèche",
    "Traditionnelle Fermette Bâtiment professionnel Plancher Préau Réno Etanchéité",
    "Cuisine / salle de bain Escalier Porte / Verrière Parquet / Lambris Autres.",
    "Installée à St Christophe-du-Ligneron depuis 2021, elle intervient sur le secteur de Challans et",
  ])("refuses menus, lists and cut excerpts: %s", (text) => {
    expect(isCleanSentence(text, 20, 260)).toBe(false);
  });

  it("accepts real prose", () => {
    expect(isCleanSentence("La réfection complète de votre toiture en ardoise ou en tuile, de la charpente à la finition.", 20, 260)).toBe(true);
  });
});

describe("stripGluedHeading", () => {
  it("drops a heading glued to its paragraph", () => {
    expect(stripGluedHeading("Peinture intérieure et extérieure Des murs intérieurs aux façades extérieures, nous utilisons des peintures durables.")).toBe(
      "Des murs intérieurs aux façades extérieures, nous utilisons des peintures durables."
    );
    expect(stripGluedHeading("Nos services de plomberie L’entreprise intervient pour tous vos travaux.")).toBe("L’entreprise intervient pour tous vos travaux.");
  });
  it("keeps real sentences and place names whole", () => {
    for (const sentence of [
      "Nous intervenons au cœur de La Rochelle et dans les communes voisines.",
      "Chez CaPP, nous savons que le choix du revêtement compte.",
      "Artisan couvreur installé près de Le Mans depuis plusieurs années.",
    ]) {
      expect(stripGluedHeading(sentence)).toBe(sentence);
    }
  });
});
