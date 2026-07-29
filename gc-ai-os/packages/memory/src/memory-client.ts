import { randomUUID } from "node:crypto";
import type { MemoryEntry, MemoryEntryDraft, MemoryScope } from "@gc-ai-os/shared-types";

export interface MemoryRepository {
  findLatest(
    scope: MemoryScope,
    title: string,
    projectId?: string,
    agentId?: string,
  ): Promise<MemoryEntry | undefined>;
  insert(entry: MemoryEntry, embedding: number[]): Promise<void>;
  markSuperseded(id: string, supersededBy: string): Promise<void>;
  searchByEmbedding(
    embedding: number[],
    filters: { scope?: MemoryScope; projectId?: string },
    limit: number,
  ): Promise<MemoryEntry[]>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

/**
 * Client de mémoire (voir docs/gc-ai-os/04-memoire.md). Garantit la règle
 * de versionnement : aucune entrée n'est éditée en place, une écriture
 * crée toujours une nouvelle version et marque l'ancienne comme
 * `supersededBy`.
 */
export class MemoryClient {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly embeddings: EmbeddingProvider,
  ) {}

  async write(draft: MemoryEntryDraft, createdBy: string): Promise<MemoryEntry> {
    const previous = await this.repository.findLatest(
      draft.scope,
      draft.title,
      draft.projectId,
      draft.agentId,
    );

    const entry: MemoryEntry = {
      ...draft,
      id: randomUUID(),
      createdBy,
      createdAt: new Date().toISOString(),
      version: (previous?.version ?? 0) + 1,
      supersededBy: null,
    };

    const embedding = await this.embeddings.embed(`${entry.title}\n${entry.content}`);
    await this.repository.insert(entry, embedding);

    if (previous) {
      await this.repository.markSuperseded(previous.id, entry.id);
    }

    return entry;
  }

  async search(
    queryText: string,
    filters: { scope?: MemoryScope; projectId?: string } = {},
    limit = 10,
  ): Promise<MemoryEntry[]> {
    const embedding = await this.embeddings.embed(queryText);
    return this.repository.searchByEmbedding(embedding, filters, limit);
  }
}
