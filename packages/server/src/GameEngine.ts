/**
 * @module GameEngine
 * @description Moteur de jeu principal (Game Loop).
 * C'est le chef d'orchestre côté serveur : il coordonne
 * le PlayerManager, le BombManager, le CollisionSystem
 * et la MapGenerator pour faire tourner la partie.
 *
 * Architecture : Serveur Autoritaire
 * - Seul le serveur calcule l'état du jeu
 * - Les clients envoient des intentions, le serveur les valide
 * - L'état est broadcasté à chaque tick
 */

import {
  GameState,
  Direction,
  ClientMessage,
} from '@bomberman-arena/shared';
import { TICK_RATE_MS, PLAYER_SPEED, PHYSICS_DT } from '@bomberman-arena/shared';
import { generateMap } from './MapGenerator';
import { PlayerManager } from './PlayerManager';
import { BombManager } from './BombManager';
import { resolveMovement } from './CollisionSystem';

/** Callback appelé à chaque tick avec le nouvel état du jeu. */
export type OnTickCallback = (state: GameState) => void;

/**
 * Moteur de jeu Bomberman Arena.
 * Gère la boucle de jeu (game loop) et coordonne tous les sous-systèmes.
 */
export class GameEngine {
  private playerManager = new PlayerManager();
  private bombManager = new BombManager();
  private state: GameState;
  private loopInterval: ReturnType<typeof setInterval> | null = null;
  private onTick: OnTickCallback | null = null;

  constructor() {
    this.state = {
      map: generateMap(),
      players: [],
      bombs: [],
      explosions: [],
      phase: 'WAITING',
      tick: 0,
    };
  }

  /**
   * Enregistre le callback appelé à chaque tick.
   * Utilisé par le serveur WebSocket pour broadcaster l'état.
   * @param callback Fonction recevant le GameState à chaque tick.
   */
  setOnTick(callback: OnTickCallback): void {
    this.onTick = callback;
  }

  /**
   * Ajoute un joueur à la partie.
   * @param playerName Nom choisi par le joueur.
   * @returns L'ID du joueur, ou null si la partie est pleine.
   */
  addPlayer(playerName: string): string | null {
    const player = this.playerManager.addPlayer(playerName);
    if (!player) return null;

    this.state.players = this.playerManager.getAllPlayers();
    return player.id;
  }

  /**
   * Retire un joueur de la partie.
   * @param playerId ID du joueur à retirer.
   */
  removePlayer(playerId: string): void {
    this.playerManager.removePlayer(playerId);
    this.state.players = this.playerManager.getAllPlayers();
  }

  /**
   * Traite un message reçu d'un client.
   * Le serveur autoritaire valide chaque action avant de l'appliquer.
   *
   * @param playerId ID du joueur qui a envoyé le message.
   * @param message Le message client parsé.
   */
  handleClientMessage(playerId: string, message: ClientMessage): void {
    switch (message.type) {
      case 'CLIENT_INPUT':
        this.playerManager.updateInput(playerId, message.payload.direction, message.payload.state);
        break;
      case 'CLIENT_PLACE_BOMB':
        this.handlePlaceBomb(playerId);
        break;
      // CLIENT_JOIN est géré directement par le serveur WebSocket
    }
  }

  /**
   * Traite une intention de pose de bombe.
   * La position doit être arrondie à l'entier le plus proche pour coller à la grille.
   */
  private handlePlaceBomb(playerId: string): void {
    const player = this.playerManager.getPlayer(playerId);
    if (!player || !player.isAlive) return;

    if (player.bombCount >= player.maxBombs) return;

    // Arrondir la position flottante à la case la plus proche
    const gridPos = {
      x: Math.floor(player.position.x),
      y: Math.floor(player.position.y),
    };

    const bomb = this.bombManager.placeBomb(playerId, gridPos);
    if (bomb) {
      player.bombCount++;
    }
  }

  /**
   * Démarre la boucle de jeu.
   * Exécutée à intervalles réguliers (TICK_RATE_MS).
   */
  start(): void {
    if (this.loopInterval) return; // Déjà en cours

    this.state.phase = 'PLAYING';
    console.log(`[GameEngine] Boucle de jeu démarrée (tick rate: ${TICK_RATE_MS}ms)`);

    this.loopInterval = setInterval(() => {
      this.tick();
    }, TICK_RATE_MS);
  }

  private tick(): void {
    this.state.tick++;

    // 0. Application de la physique (Mouvement Continu)
    for (const player of this.playerManager.getAllPlayers()) {
      if (!player.isAlive) continue;

      let vx = 0;
      let vy = 0;

      if (player.activeInputs.UP) vy -= PLAYER_SPEED;
      if (player.activeInputs.DOWN) vy += PLAYER_SPEED;
      if (player.activeInputs.LEFT) vx -= PLAYER_SPEED;
      if (player.activeInputs.RIGHT) vx += PLAYER_SPEED;

      // Normalisation en diagonale pour ne pas aller plus vite
      if (vx !== 0 && vy !== 0) {
        const length = Math.sqrt(vx * vx + vy * vy);
        vx = (vx / length) * PLAYER_SPEED;
        vy = (vy / length) * PLAYER_SPEED;
      }

      player.velocity = { x: vx, y: vy };

      // Déplacement calculé avec delta time (PHYSICS_DT)
      const moveX = vx * PHYSICS_DT;
      const moveY = vy * PHYSICS_DT;

      if (moveX !== 0 || moveY !== 0) {
        const newPos = resolveMovement(player.position, moveX, moveY, this.state.map);
        this.playerManager.setPosition(player.id, newPos);
      }
    }

    // 1. Mise à jour des bombes
    const { explosions: newExplosions, explodedOwners } = this.bombManager.update(this.state.map);

    // 1b. Rendre les bombes au joueur quand elles explosent
    for (const ownerId of explodedOwners) {
      const player = this.playerManager.getPlayer(ownerId);
      if (player && player.bombCount > 0) {
        player.bombCount--;
      }
    }

    // 2. Vérification : un joueur est-il touché par une explosion ?
    for (const player of this.playerManager.getAllPlayers()) {
      if (!player.isAlive) continue;

      if (this.bombManager.isPositionExploding(player.position)) {
        this.playerManager.killPlayer(player.id);
      }
    }

    // 3. Fin de partie ? (1 seul joueur vivant ou 0)
    if (this.state.phase === 'PLAYING' && this.playerManager.aliveCount <= 1 && this.playerManager.count > 1) {
      this.state.phase = 'GAME_OVER';
    }

    // 4. Mise à jour de l'état global
    this.state.players = this.playerManager.getAllPlayers();
    this.state.bombs = this.bombManager.getAllBombs();
    this.state.explosions = this.bombManager.getActiveExplosions();

    // 5. Broadcast
    if (this.onTick) {
      this.onTick({ ...this.state });
    }
  }

  /**
   * Arrête la boucle de jeu.
   */
  stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
      console.log('[GameEngine] Boucle de jeu arrêtée.');
    }
  }

  /** Récupère l'état actuel du jeu (snapshot). */
  getState(): GameState {
    return { ...this.state };
  }
}
