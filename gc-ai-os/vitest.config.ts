import { defineConfig } from "vitest/config";

/**
 * Suite de tests de GC AI OS.
 *
 * Périmètre volontairement resserré sur les modules dont une régression
 * casse le système en silence : arbitrage, scoring, ordonnancement,
 * permissions, validation de blueprints. Ce sont les endroits où une
 * erreur ne lève aucune exception — elle produit simplement une mauvaise
 * décision, ce qui est bien pire.
 *
 * Ce qui n'est délibérément pas testé ici : les appels réseau réels
 * (Anthropic, Stripe) et le rendu Next.js. Les premiers sont couverts par
 * des tests d'intégration à écrire quand une clé sera disponible, le
 * second par le build de production qui échoue déjà en cas de rupture.
 */
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
});
