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
  ClientMessage,
} from '@bomberman-arena/shared';
import {
  TICK_RATE_MS,
  PLAYER_SPEED,
  PHYSICS_DT,
  BOMB_RANGE,
  INVULNERABILITY_TICKS,
  randomTheme,
} from '@bomberman-arena/shared';
import { createRoundMap } from './MapGenerator';
import { PlayerManager } from './PlayerManager';
import { BombManager } from './BombManager';
import { BonusManager } from './BonusManager';
import { resolveMovement } from './CollisionSystem';

/** Fréquence de réveil de la boucle : plusieurs réveils peuvent couvrir un tick. */
const LOOP_INTERVAL_MS = 16;

/** Nombre maximum de ticks rattrapés par réveil, pour éviter la spirale. */
const MAX_STEPS_PER_WAKE = 5;

/** Callback appelé à chaque tick avec le nouvel état du jeu. */
export type OnTickCallback = (state: GameState) => void;

/**
 * Moteur de jeu Bomberman Arena.
 * Gère la boucle de jeu (game loop) et coordonne tous les sous-systèmes.
 */
export class GameEngine {
  private playerManager = new PlayerManager();
  private bombManager = new BombManager();
  private bonusManager = new BonusManager();
  private state: GameState;
  private loopInterval: ReturnType<typeof setInterval> | null = null;
  private onTick: OnTickCallback | null = null;
  private lastWakeAt = 0;
  private accumulator = 0;

  constructor() {
    const round = createRoundMap('URBAN');
    this.state = {
      map: round.map,
      crates: round.crates,
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
   * @param isHost Indique si le joueur est l'hôte.
   * @returns L'ID du joueur, ou null si la partie est pleine.
   */
  addPlayer(playerName: string, isHost: boolean = false): string | null {
    const player = this.playerManager.addPlayer(playerName, isHost);
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

    // Plus assez de joueurs pour continuer : la manche se termine
    if (this.state.phase === 'PLAYING' && this.playerManager.count <= 1) {
      this.state.phase = 'GAME_OVER';
      this.stop();
    }

    // Plus personne : le prochain joueur doit arriver dans un lobby propre,
    // pas sur la carte de la partie qui vient de se terminer.
    if (this.playerManager.count === 0) {
      this.resetRound();
    }
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
      case 'CLIENT_READY':
        this.playerManager.setReady(playerId);
        break;
      // CLIENT_JOIN est géré directement par le serveur WebSocket
    }
  }

  /**
   * Traite une intention de pose de bombe.
   * La position doit être arrondie à l'entier le plus proche pour coller à la grille.
   */
  private handlePlaceBomb(playerId: string): void {
    if (this.state.phase !== 'PLAYING') return;

    const player = this.playerManager.getPlayer(playerId);
    if (!player || !player.isAlive) return;

    if (player.bombCount >= player.maxBombs) return;

    // Arrondir la position flottante à la case la plus proche
    const gridPos = {
      x: Math.floor(player.position.x),
      y: Math.floor(player.position.y),
    };

    const bomb = this.bombManager.placeBomb(
      playerId,
      gridPos,
      this.state.tick,
      BOMB_RANGE + player.rangeBonus
    );
    if (bomb) {
      player.bombCount++;
    }
  }

  /**
   * Démarre la boucle de jeu.
   * Après une fin de partie, la manche est d'abord remise à zéro.
   */
  start(): void {
    if (this.loopInterval) return; // Déjà en cours

    this.playerManager.resetForNewRound();
    this.playerManager.clearReady();
    this.bombManager.clear();

    const theme = randomTheme();
    const round = createRoundMap(theme);

    this.state = {
      map: round.map,
      crates: round.crates,
      players: this.playerManager.getAllPlayers(),
      bombs: [],
      explosions: [],
      phase: 'PLAYING',
      tick: 0,
      theme,
    };
    console.log(`[GameEngine] Boucle de jeu démarrée (tick rate: ${TICK_RATE_MS}ms, thème: ${theme})`);

    this.lastWakeAt = Date.now();
    this.accumulator = 0;
    this.loopInterval = setInterval(() => this.step(), LOOP_INTERVAL_MS);
  }

  /**
   * Un réveil de la boucle : exécute autant de ticks fixes que le temps
   * écoulé le permet, sans jamais dépasser MAX_STEPS_PER_WAKE.
   */
  private step(): void {
    const now = Date.now();
    this.accumulator += now - this.lastWakeAt;
    this.lastWakeAt = now;

    let steps = 0;
    while (this.accumulator >= TICK_RATE_MS && steps < MAX_STEPS_PER_WAKE) {
      this.tick();
      this.accumulator -= TICK_RATE_MS;
      steps++;
    }

    // Retard trop important : on abandonne le temps accumulé au lieu de courir après
    if (steps === MAX_STEPS_PER_WAKE) {
      this.accumulator = 0;
    }

    if (this.state.phase === 'GAME_OVER') {
      this.stop();
    }
  }

  /** Remet la partie dans son état d'avant-manche. */
  private resetRound(): void {
    this.playerManager.resetForNewRound();
    this.bombManager.clear();
    const round = createRoundMap('URBAN');
    this.state = {
      map: round.map,
      crates: round.crates,
      players: this.playerManager.getAllPlayers(),
      bombs: [],
      explosions: [],
      phase: 'WAITING',
      tick: 0,
    };
  }

  /**
   * Un pas de simulation. Public pour permettre de rejouer une partie
   * tick par tick dans les tests, sans dépendre de l'horloge.
   */
  tick(): void {
    this.state.tick++;

    // 0. Application de la physique (Mouvement Continu)
    for (const player of this.playerManager.getAllPlayers()) {
      if (!player.isAlive) continue;

      this.bonusManager.update(player, this.state.tick);
      const speed = PLAYER_SPEED * player.speed;

      let vx = 0;
      let vy = 0;

      if (player.activeInputs.UP) vy -= speed;
      if (player.activeInputs.DOWN) vy += speed;
      if (player.activeInputs.LEFT) vx -= speed;
      if (player.activeInputs.RIGHT) vx += speed;

      // Normalisation en diagonale pour ne pas aller plus vite
      if (vx !== 0 && vy !== 0) {
        const length = Math.sqrt(vx * vx + vy * vy);
        vx = (vx / length) * speed;
        vy = (vy / length) * speed;
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
    const crates = this.state.crates ?? [];
    const { explodedOwners, destroyedCrates } = this.bombManager.update(
      this.state.map,
      this.state.tick,
      crates
    );

    // 1b. Rendre les bombes au joueur quand elles explosent
    for (const ownerId of explodedOwners) {
      const player = this.playerManager.getPlayer(ownerId);
      if (player && player.bombCount > 0) {
        player.bombCount--;
      }
    }

    // 1c. Une caisse détruite donne directement son objet au poseur de la bombe
    for (const destroyed of destroyedCrates) {
      const crate = crates.find(
        (c) => c.x === destroyed.position.x && c.y === destroyed.position.y
      );
      if (!crate?.bonusId) continue;

      const owner = this.playerManager.getPlayer(destroyed.ownerId);
      if (owner && owner.isAlive) {
        this.bonusManager.apply(owner, crate.bonusId, this.state.tick);
      }
    }
    if (destroyedCrates.length > 0) {
      this.state.crates = crates.filter(
        (crate) => !destroyedCrates.some(
          (d) => d.position.x === crate.x && d.position.y === crate.y
        )
      );
    }

    // 2. Vérification : un joueur est-il touché par une explosion ?
    for (const player of this.playerManager.getAllPlayers()) {
      if (!player.isAlive) continue;

      if (this.bombManager.isPositionExploding(player.position)) {
        this.playerManager.hitPlayer(player.id, this.state.tick, INVULNERABILITY_TICKS);
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

  /** Vérifie si tous les joueurs sont prêts. */
  allPlayersReady(): boolean {
    return this.playerManager.allReady();
  }
}
