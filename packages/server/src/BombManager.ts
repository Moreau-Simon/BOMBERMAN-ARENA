/**
 * @module BombManager
 * @description Gestion du cycle de vie des bombes.
 * Responsabilité unique (SRP) : poser des bombes, les faire exploser,
 * et calculer les zones d'explosion.
 *
 * Les durées sont exprimées en ticks et non en millisecondes :
 * une bombe explose au tick prévu, quel que soit le temps réel écoulé.
 */

import { BombState, ExplosionState, Position, GameMap, CrateState } from '@bomberman-arena/shared';
import { BOMB_TIMER_TICKS, BOMB_RANGE, EXPLOSION_DURATION_TICKS, MAP_WIDTH, MAP_HEIGHT } from '@bomberman-arena/shared';
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
   * @param tick Tick courant de la partie.
   * @param range Portée de l'explosion.
   * @returns La bombe créée, ou null si une bombe existe déjà à cette position.
   */
  placeBomb(ownerId: string, position: Position, tick: number, range: number = BOMB_RANGE): BombState | null {
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
      placedAtTick: tick,
    };

    this.bombs.set(bomb.id, bomb);
    return bomb;
  }

  /**
   * Met à jour les bombes : détecte celles qui doivent exploser.
   * Appelé à chaque tick de la game loop.
   * @param map La carte actuelle (pour détruire les caisses).
   * @param tick Le tick courant.
   * @param crates État des caisses, avec leur résistance.
   * @returns Les explosions, les propriétaires des bombes et les caisses détruites.
   */
  update(
    map: GameMap,
    tick: number,
    crates: CrateState[] = []
  ): { explosions: ExplosionState[]; explodedOwners: string[]; destroyedCrates: Array<{ position: Position; ownerId: string }> } {
    const newExplosions: ExplosionState[] = [];
    const explodedOwners: string[] = [];
    const destroyedCrates: Array<{ position: Position; ownerId: string }> = [];

    for (const [id, bomb] of this.bombs.entries()) {
      if (tick - bomb.placedAtTick >= BOMB_TIMER_TICKS) {
        // La bombe explose !
        const affected = this.calculateExplosion(bomb, map, tick, crates, destroyedCrates);
        newExplosions.push(...affected);
        explodedOwners.push(bomb.ownerId);
        this.bombs.delete(id);
      }
    }

    // Ajouter les nouvelles explosions à la liste active
    this.explosions.push(...newExplosions);

    // Nettoyer les explosions expirées
    this.explosions = this.explosions.filter(e => tick - e.startedAtTick < EXPLOSION_DURATION_TICKS);

    return { explosions: newExplosions, explodedOwners, destroyedCrates };
  }

  /**
   * Calcule les cases touchées par l'explosion d'une bombe.
   * L'explosion se propage en croix (haut, bas, gauche, droite)
   * et s'arrête sur la première caisse rencontrée. Une caisse perd 1 PV ;
   * elle n'est retirée de la carte qu'à 0 PV.
   *
   * @param bomb La bombe qui explose.
   * @param map La carte du jeu.
   * @param tick Le tick courant.
   * @param crates État des caisses.
   * @param destroyedCrates Liste remplie des caisses tombées à 0 PV.
   * @returns Liste des positions touchées par l'explosion.
   */
  private calculateExplosion(
    bomb: BombState,
    map: GameMap,
    tick: number,
    crates: CrateState[],
    destroyedCrates: Array<{ position: Position; ownerId: string }>
  ): ExplosionState[] {
    const positions: ExplosionState[] = [];

    // Centre de l'explosion
    positions.push({ position: { ...bomb.position }, startedAtTick: tick });

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

        // Caisse destructible : l'explosion s'arrête dessus, même si elle résiste
        if (map[y][x] === 2) {
          const crate = crates.find((c) => c.x === x && c.y === y);
          if (!crate || --crate.hp <= 0) {
            map[y][x] = 0;
            destroyedCrates.push({ position: { x, y }, ownerId: bomb.ownerId });
          }
          positions.push({ position: { x, y }, startedAtTick: tick });
          break;
        }

        // Case vide : l'explosion continue
        positions.push({ position: { x, y }, startedAtTick: tick });
      }
    }

    return positions;
  }

  /** Retire toutes les bombes et explosions (nouvelle manche). */
  clear(): void {
    this.bombs.clear();
    this.explosions = [];
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
    const px = Math.floor(pos.x);
    const py = Math.floor(pos.y);
    return this.explosions.some(e =>
      e.position.x === px && e.position.y === py
    );
  }
}
