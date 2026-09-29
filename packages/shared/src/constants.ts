/**
 * @module constants
 * @description Constantes partagées du jeu Bomberman Arena.
 * Utilisées par le serveur ET le client pour garantir la cohérence.
 */

/** Largeur de la grille de jeu en nombre de cases (doit être impaire). */
export const MAP_WIDTH = 13;

/** Hauteur de la grille de jeu en nombre de cases (doit être impaire). */
export const MAP_HEIGHT = 11;

/** Taille en pixels d'une case sur le rendu client. */
export const TILE_SIZE = 48;

/** Intervalle de la game loop serveur en millisecondes (~16 ticks/seconde). */
export const TICK_RATE_MS = 50;

/** Delta time du serveur en secondes (pour les calculs physiques). */
export const PHYSICS_DT = TICK_RATE_MS / 1000;

/** Vitesse de déplacement du joueur en tuiles/seconde. */
export const PLAYER_SPEED = 4.5;

/** Largeur de la hitbox du joueur en unités de tuile (< 1.0 pour passer dans les couloirs). */
export const PLAYER_HITBOX_W = 0.7;

/** Hauteur de la hitbox du joueur en unités de tuile. */
export const PLAYER_HITBOX_H = 0.7;

/**
 * Seuil de correction de trajectoire pour le "corner assist".
 * Si le joueur est décalé de moins de cette valeur par rapport au centre
 * d'un couloir, il est gentiment poussé vers l'alignement.
 */
export const CORNER_ASSIST_THRESHOLD = 0.35;

/** Délai avant l'explosion d'une bombe en millisecondes. */
export const BOMB_TIMER_MS = 3000;

/** Portée par défaut de l'explosion d'une bombe en nombre de cases. */
export const BOMB_RANGE = 2;

/** Nombre maximum de joueurs dans une partie. */
export const MAX_PLAYERS = 4;

/** Port WebSocket du serveur. */
export const SERVER_PORT = 8080;

/** Positions de spawn des joueurs (centres des cases de coin). */
export const SPAWN_POSITIONS = [
  { x: 0.5, y: 0.5 },
  { x: MAP_WIDTH - 0.5, y: 0.5 },
  { x: 0.5, y: MAP_HEIGHT - 0.5 },
  { x: MAP_WIDTH - 0.5, y: MAP_HEIGHT - 0.5 },
];
