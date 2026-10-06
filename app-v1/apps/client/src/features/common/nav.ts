import type { Href } from "expo-router";

/** Les routes sont des chaînes calculées (liens profonds, écrans d'autres modules) : un seul point de cast. */
export const href = (path: string): Href => path as Href;
