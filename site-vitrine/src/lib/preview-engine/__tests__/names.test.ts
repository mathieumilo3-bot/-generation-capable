import { describe, expect, it } from "vitest";
import { isCleanSentence } from "../assets";
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
