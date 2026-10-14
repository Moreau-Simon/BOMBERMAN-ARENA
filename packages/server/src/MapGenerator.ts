/**
 * @module MapGenerator
 * @description Génère les cartes de jeu Bomberman.
 * Responsabilité unique (SRP) : créer et manipuler la structure de la carte.
 *
 * La carte BlockBuster (stage 01) de Super Bomberman 3 est une grille
 * classique avec murs indestructibles tous les 2 cases.
 */

import { GameMap, CellType } from '@bomberman-arena/shared';
import { MAP_WIDTH, MAP_HEIGHT, SPAWN_POSITIONS } from '@bomberman-arena/shared';

/**
 * Génère la carte initiale du jeu.
 * - Les murs indestructibles sont placés aux indices impairs (x ET y impairs).
 * - Les zones de spawn (coins) sont protégées : pas de caisses.
 * - Les caisses destructibles sont placées aléatoirement sur les cases restantes.
 *
 * @param destructibleDensity Probabilité (0-1) de placer une caisse sur une case vide. Défaut : 0.7
 * @returns La matrice 2D représentant le plateau de jeu.
 */
export function generateMap(destructibleDensity: number = 0.7): GameMap {
  const map: GameMap = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Murs indestructibles : une case sur deux (indices impairs)
      if (x % 2 !== 0 && y % 2 !== 0) {
        row.push(1);
      } else {
        row.push(0);
      }
    }
    map.push(row);
  }

  // Placement aléatoire des caisses destructibles
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x] !== 0) continue; // Déjà un mur
      if (isSpawnProtected(x, y)) continue; // Zone de spawn protégée

      if (Math.random() < destructibleDensity) {
        map[y][x] = 2; // Caisse destructible
      }
    }
  }

  return map;
}

/**
 * Vérifie si une case fait partie d'une zone de spawn protégée.
 * Chaque zone de spawn est un carré de 3 cases autour du coin.
 * @param x Coordonnée X de la case.
 * @param y Coordonnée Y de la case.
 * @returns true si la case est protégée.
 */
function isSpawnProtected(x: number, y: number): boolean {
  for (const spawn of SPAWN_POSITIONS) {
    const dx = Math.abs(x - spawn.x);
    const dy = Math.abs(y - spawn.y);
    // Les 3 cases autour du spawn sont protégées (le L en coin)
    if (dx + dy <= 2 && dx <= 1 && dy <= 1) {
      return true;
    }
  }
  return false;
}
