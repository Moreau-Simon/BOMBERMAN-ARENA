/**
 * @module types
 * @description Types métier partagés entre le client et le serveur.
 */

import { MapTheme } from './constants';
import { BonusId } from './bonuses';

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
  name?: string;
  isHost?: boolean;
  position: Position;
  velocity: Position; // Nouveau : Vecteur de vitesse actuel
  direction: Direction;
  isAlive: boolean;
  isReady: boolean;
  bombCount: number;
  maxBombs: number;
  speed: number;
  hp: number;
  maxHp: number;
  rangeBonus: number;
  speedBonus: number;
  speedMalus: number;
  effects: BonusId[];
  effectExpiries: Partial<Record<BonusId, number>>;
  invulnerableUntilTick: number;
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
  placedAtTick: number;
}

export interface ExplosionState {
  position: Position;
  startedAtTick: number;
}

export type CrateAnimState = 'INTACT' | 'BURNING' | 'GROUND' | 'DESTROYING';

export interface CrateState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  animState: CrateAnimState;
  stateChangedAt?: number;
  bonusId?: BonusId;
}

export interface GameState {
  map: GameMap;
  players: PlayerState[];
  bombs: BombState[];
  explosions: ExplosionState[];
  crates?: CrateState[];
  phase: 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';
  tick: number;
  theme?: MapTheme;
}
