/**
 * @module PlayerManager
 * @description Gestion des joueurs connectés.
 * Responsabilité unique (SRP) : ajouter, retirer et mettre à jour les joueurs.
 */

import { PlayerState, Position, Direction } from '@bomberman-arena/shared';
import { SPAWN_POSITIONS, MAX_PLAYERS, MAX_PLAYER_NAME_LENGTH } from '@bomberman-arena/shared';
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
   * @param isHost Indique si le joueur est l'hôte (connecté via localhost).
   * @returns L'état initial du joueur, ou null si la partie est pleine.
   */
  addPlayer(playerName: string, isHost: boolean = false): PlayerState | null {
    if (this.players.size >= MAX_PLAYERS) {
      return null;
    }

    const id = uuidv4();
    const spawnIndex = this.players.size;
    const name = (playerName || '').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    const player: PlayerState = {
      id,
      name: name || `JOUEUR ${spawnIndex + 1}`,
      isHost,
      position: { ...SPAWN_POSITIONS[spawnIndex] },
      velocity: { x: 0, y: 0 },
      direction: 'DOWN',
      isAlive: true,
      isReady: false,
      bombCount: 0,
      maxBombs: 1,
      speed: 1,
      hp: 1,
      maxHp: 1,
      rangeBonus: 0,
      speedBonus: 0,
      speedMalus: 0,
      effects: [],
      effectExpiries: {},
      invulnerableUntilTick: 0,
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

  /**
   * Applique un coup à un joueur. L'invincibilité évite de perdre plusieurs PV
   * pendant les ticks où la même flamme reste affichée.
   * @returns true si le joueur meurt de ce coup.
   */
  hitPlayer(playerId: string, tick: number, invulnerabilityTicks: number): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive || tick < player.invulnerableUntilTick) return false;

    player.hp--;
    player.invulnerableUntilTick = tick + invulnerabilityTicks;

    if (player.hp <= 0) {
      player.isAlive = false;
      return true;
    }
    return false;
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

  /** Marque un joueur comme prêt. */
  setReady(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isReady = true;
    }
  }

  /**
   * Remet tous les joueurs en état de départ pour une nouvelle manche.
   * Les positions de spawn suivent l'ordre d'arrivée des joueurs.
   */
  resetForNewRound(): void {
    const players = Array.from(this.players.values());
    players.forEach((player, index) => {
      player.position = { ...SPAWN_POSITIONS[index % SPAWN_POSITIONS.length] };
      player.velocity = { x: 0, y: 0 };
      player.direction = 'DOWN';
      player.isAlive = true;
      player.isReady = false;
      player.bombCount = 0;
      player.maxBombs = 1;
      player.speed = 1;
      player.hp = 1;
      player.maxHp = 1;
      player.rangeBonus = 0;
      player.speedBonus = 0;
      player.speedMalus = 0;
      player.effects = [];
      player.effectExpiries = {};
      player.invulnerableUntilTick = 0;
      player.activeInputs = { UP: false, DOWN: false, LEFT: false, RIGHT: false };
    });
  }

  /** Vérifie si tous les joueurs sont prêts. */
  allReady(): boolean {
    if (this.players.size === 0) return false;
    return this.getAllPlayers().every(p => p.isReady);
  }

  /** Annule l'état prêt de tous les joueurs (début de manche). */
  clearReady(): void {
    for (const player of this.players.values()) {
      player.isReady = false;
    }
  }
}
