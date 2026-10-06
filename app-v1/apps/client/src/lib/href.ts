import type { Href } from "expo-router";

/**
 * Routes construites dynamiquement (paramètres, retours après paiement) ou appartenant à d'autres
 * parties de l'app : un seul point de conversion vers le type `Href` d'Expo Router.
 */
export const href = (path: string): Href => path as Href;
