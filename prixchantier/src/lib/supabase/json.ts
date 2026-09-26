import type { Json } from "./database.types";

/** Valeur JSON non nulle (colonnes jsonb NOT NULL). */
export type JsonValue = NonNullable<Json>;
