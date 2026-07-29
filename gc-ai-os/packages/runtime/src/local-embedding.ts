import type { EmbeddingProvider } from "@gc-ai-os/memory";

const DIMENSIONS = 64;

/**
 * Placeholder d'embedding local, sans appel réseau : hache chaque mot
 * dans un vecteur à dimension fixe (sac de mots haché). Ce n'est PAS un
 * embedding sémantique réel — deux phrases synonymes mais sans mots
 * communs ne seront pas rapprochées. Suffisant pour faire fonctionner le
 * pipeline de mémoire de bout en bout hors-ligne ; à remplacer par un
 * vrai fournisseur d'embeddings (OpenAI/Anthropic/modèle local) dès que
 * la recherche sémantique devient un besoin réel (voir
 * docs/gc-ai-os/04-memoire.md).
 */
export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const vector = new Array(DIMENSIONS).fill(0);
    const words = text.toLowerCase().match(/[a-zà-ÿ0-9]+/g) ?? [];
    for (const word of words) {
      const bucket = hash(word) % DIMENSIONS;
      vector[bucket] += 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }
}

function hash(word: string): number {
  let h = 0;
  for (let i = 0; i < word.length; i++) {
    h = (h * 31 + word.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
