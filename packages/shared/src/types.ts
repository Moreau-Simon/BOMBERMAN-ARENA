/**
 * @module types
 * @description Types métier partagés entre le client et le serveur.
 */

/** Coordonnées d'une entité sur la grille (maintenant en flottants). */
export interface Position {
  x: number;
  y: number;
}

/** Direction vers laquelle le sprite doit regarder. */
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type CellType = 0 | 1 | 2;
export type GameMap = CellType[][];

/** État d'un joueur, tel que transmis aux clients. */
export interface PlayerState {
  id: string;
  position: Position;
  velocity: Position; // Nouveau : Vecteur de vitesse actuel
  direction: Direction;
  isAlive: boolean;
  bombCount: number;
  maxBombs: number;
  speed: number;
  /** Touches actuellement enfoncées par ce joueur (géré par le serveur) */
  activeInputs: {
    UP: boolean;
    DOWN: boolean;
    LEFT: boolean;
    RIGHT: boolean;
  };
}

export interface BombState {
  id: string;
  ownerId: string;
  position: Position; // La position restera entière (grille) pour les bombes
  range: number;
  placedAt: number;
}

export interface ExplosionState {
  position: Position;
  startedAt: number;
}

export interface GameState {
  map: GameMap;
  players: PlayerState[];
  bombs: BombState[];
  explosions: ExplosionState[];
  phase: 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';
  tick: number;
}
