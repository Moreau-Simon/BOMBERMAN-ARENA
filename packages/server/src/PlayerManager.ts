/**
 * @module PlayerManager
 * @description Gestion des joueurs connectés.
 * Responsabilité unique (SRP) : ajouter, retirer et mettre à jour les joueurs.
 */

import { PlayerState, Position, Direction } from '@bomberman-arena/shared';
import { SPAWN_POSITIONS, MAX_PLAYERS } from '@bomberman-arena/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Classe gérant le cycle de vie des joueurs dans la partie.
 * Chaque joueur reçoit un ID unique et une position de spawn.
 */
export class PlayerManager {
  private players: Map<string, PlayerState> = new Map();

  /**
   * Ajoute un nouveau joueur à la partie.
   * @param playerName Nom choisi par le joueur.
   * @returns L'état initial du joueur, ou null si la partie est pleine.
   */
  addPlayer(playerName: string): PlayerState | null {
    if (this.players.size >= MAX_PLAYERS) {
      return null;
    }

    const id = uuidv4();
    const spawnIndex = this.players.size;
    const player: PlayerState = {
      id,
      position: { ...SPAWN_POSITIONS[spawnIndex] },
      velocity: { x: 0, y: 0 },
      direction: 'DOWN',
      isAlive: true,
      bombCount: 0,
      maxBombs: 1,
      speed: 1,
      activeInputs: { UP: false, DOWN: false, LEFT: false, RIGHT: false },
    };

    this.players.set(id, player);
    return player;
  }

  /**
   * Retire un joueur de la partie.
   * @param playerId ID du joueur à retirer.
   */
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  /**
   * Met à jour l'état d'une touche directionnelle pour un joueur.
   */
  updateInput(playerId: string, direction: Direction, state: boolean): void {
    const player = this.players.get(playerId);
    if (player && player.isAlive) {
      player.activeInputs[direction] = state;
      // Met à jour la direction visuelle si on appuie sur la touche
      if (state) {
        player.direction = direction;
      }
    }
  }

  /**
   * Force une nouvelle position absolue (après calcul de collision).
   */
  setPosition(playerId: string, position: Position): void {
    const player = this.players.get(playerId);
    if (player && player.isAlive) {
      player.position = position;
    }
  }

  /**
   * Marque un joueur comme mort.
   * @param playerId ID du joueur.
   */
  killPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isAlive = false;
    }
  }

  /** Récupère un joueur par son ID. */
  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.get(playerId);
  }

  /** Récupère tous les joueurs sous forme de tableau. */
  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  /** Nombre de joueurs actuellement connectés. */
  get count(): number {
    return this.players.size;
  }

  /** Nombre de joueurs encore en vie. */
  get aliveCount(): number {
    return this.getAllPlayers().filter(p => p.isAlive).length;
  }
}
