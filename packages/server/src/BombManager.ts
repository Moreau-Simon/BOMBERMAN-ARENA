/**
 * @module BombManager
 * @description Gestion du cycle de vie des bombes.
 * Responsabilité unique (SRP) : poser des bombes, les faire exploser,
 * et calculer les zones d'explosion.
 *
 * NOTE : Ce module est un placeholder structuré.
 * La logique d'explosion complète sera implémentée ultérieurement.
 */

import { BombState, ExplosionState, Position, GameMap } from '@bomberman-arena/shared';
import { BOMB_TIMER_MS, BOMB_RANGE, MAP_WIDTH, MAP_HEIGHT } from '@bomberman-arena/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Classe gérant les bombes posées sur la carte.
 */
export class BombManager {
  private bombs: Map<string, BombState> = new Map();
  private explosions: ExplosionState[] = [];

  /**
   * Pose une bombe à la position donnée.
   * @param ownerId ID du joueur qui pose la bombe.
   * @param position Position de la bombe sur la grille.
   * @param range Portée de l'explosion.
   * @returns La bombe créée, ou null si une bombe existe déjà à cette position.
   */
  placeBomb(ownerId: string, position: Position, range: number = BOMB_RANGE): BombState | null {
    // Vérifier qu'il n'y a pas déjà une bombe à cette position
    for (const bomb of this.bombs.values()) {
      if (bomb.position.x === position.x && bomb.position.y === position.y) {
        return null;
      }
    }

    const bomb: BombState = {
      id: uuidv4(),
      ownerId,
      position: { ...position },
      range,
      placedAt: Date.now(),
    };

    this.bombs.set(bomb.id, bomb);
    return bomb;
  }

  /**
   * Met à jour les bombes : détecte celles qui doivent exploser.
   * Appelé à chaque tick de la game loop.
   * @param map La carte actuelle (pour détruire les caisses).
   * @returns Un objet avec les explosions et les ownerIds des bombes explosées.
   */
  update(map: GameMap): { explosions: ExplosionState[]; explodedOwners: string[] } {
    const now = Date.now();
    const newExplosions: ExplosionState[] = [];
    const explodedOwners: string[] = [];

    for (const [id, bomb] of this.bombs.entries()) {
      if (now - bomb.placedAt >= BOMB_TIMER_MS) {
        // La bombe explose !
        const affected = this.calculateExplosion(bomb, map);
        newExplosions.push(...affected);
        explodedOwners.push(bomb.ownerId);
        this.bombs.delete(id);
      }
    }

    // Ajouter les nouvelles explosions à la liste active
    this.explosions.push(...newExplosions);

    // Nettoyer les explosions expirées (après 500ms)
    this.explosions = this.explosions.filter(e => now - e.startedAt < 500);

    return { explosions: newExplosions, explodedOwners };
  }

  /**
   * Calcule les cases touchées par l'explosion d'une bombe.
   * L'explosion se propage en croix (haut, bas, gauche, droite)
   * et s'arrête contre les murs indestructibles.
   * Les caisses destructibles sont détruites (mises à 0).
   *
   * @param bomb La bombe qui explose.
   * @param map La carte du jeu.
   * @returns Liste des positions touchées par l'explosion.
   */
  private calculateExplosion(bomb: BombState, map: GameMap): ExplosionState[] {
    const now = Date.now();
    const positions: ExplosionState[] = [];

    // Centre de l'explosion
    positions.push({ position: { ...bomb.position }, startedAt: now });

    // Propagation dans les 4 directions
    const directions = [
      { dx: 0, dy: -1 },  // Haut
      { dx: 0, dy: 1 },   // Bas
      { dx: -1, dy: 0 },  // Gauche
      { dx: 1, dy: 0 },   // Droite
    ];

    for (const { dx, dy } of directions) {
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.position.x + dx * i;
        const y = bomb.position.y + dy * i;

        // Hors carte
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) break;

        // Mur indestructible : l'explosion s'arrête
        if (map[y][x] === 1) break;

        // Caisse destructible : on la détruit et l'explosion s'arrête
        if (map[y][x] === 2) {
          map[y][x] = 0;
          positions.push({ position: { x, y }, startedAt: now });
          break;
        }

        // Case vide : l'explosion continue
        positions.push({ position: { x, y }, startedAt: now });
      }
    }

    return positions;
  }

  /** Récupère toutes les bombes actives. */
  getAllBombs(): BombState[] {
    return Array.from(this.bombs.values());
  }

  /** Récupère toutes les explosions actives. */
  getActiveExplosions(): ExplosionState[] {
    return [...this.explosions];
  }

  /** Vérifie si une position est touchée par une explosion active. */
  isPositionExploding(pos: Position): boolean {
    return this.explosions.some(e =>
      e.position.x === pos.x && e.position.y === pos.y
    );
  }
}
