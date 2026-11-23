/**
 * @module MapGenerator
 * @description Génère les cartes de jeu Bomberman.
 * Responsabilité unique (SRP) : créer et manipuler la structure de la carte.
 *
 * La carte BlockBuster (stage 01) de Super Bomberman 3 est une grille
 * classique avec murs indestructibles tous les 2 cases.
 */

import { GameMap, CellType, CrateState, MapTheme, BonusId } from '@bomberman-arena/shared';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  DESTRUCTIBLE_DENSITY,
  REINFORCED_CRATE_CHANCE,
  drawBonus,
  SPECIAL_BONUS_BY_THEME,
} from '@bomberman-arena/shared';

/**
 * Génère la carte initiale du jeu.
 * - Les murs indestructibles sont placés aux indices impairs (x ET y impairs).
 * - Les zones de spawn (coins) sont protégées : pas de caisses.
 * - Les caisses destructibles sont placées aléatoirement sur les cases restantes.
 *
 * @param destructibleDensity Probabilité (0-1) de placer une caisse sur une case vide.
 * @returns La matrice 2D représentant le plateau de jeu.
 */
export function generateMap(destructibleDensity: number = DESTRUCTIBLE_DENSITY): GameMap {
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

  // Placement des caisses destructibles (poubelles)
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x] !== 0) continue; // Déjà un mur
      if (isSpawnProtected(x, y)) continue; // Zone de spawn protégée

      if (destructibleDensity >= 1.0 || Math.random() < destructibleDensity) {
        map[y][x] = 2; // Caisse destructible
      }
    }
  }

  return map;
}

/**
 * Crée l'état des caisses d'une manche : 1 caisse spéciale à 3 PV,
 * une partie des caisses renforcées à 2 PV, le reste à 1 PV.
 * Deux caisses donnant un objet ne sont jamais côte à côte.
 */
export function generateCrateStates(
  map: GameMap,
  theme: MapTheme,
  random: () => number = Math.random
): CrateState[] {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x] === 2) cells.push({ x, y });
    }
  }
  if (cells.length === 0) return [];

  const specialIndex = Math.min(cells.length - 1, Math.floor(random() * cells.length));
  const bonusCells = new Set<string>([cellKey(cells[specialIndex].x, cells[specialIndex].y)]);
  const crates: CrateState[] = new Array(cells.length);

  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index];

    if (index === specialIndex) {
      crates[index] = createCrate(cell, 3, SPECIAL_BONUS_BY_THEME[theme]);
      continue;
    }

    let maxHp = random() < REINFORCED_CRATE_CHANCE ? 2 : 1;
    if (maxHp === 2 && hasAdjacentBonus(cell.x, cell.y, bonusCells)) {
      maxHp = 1;
    }

    let bonusId: BonusId | undefined;
    if (maxHp === 2) {
      bonusId = drawBonus(theme, random);
      bonusCells.add(cellKey(cell.x, cell.y));
    }

    crates[index] = createCrate(cell, maxHp, bonusId);
  }

  return crates;
}

function createCrate(
  cell: { x: number; y: number },
  maxHp: number,
  bonusId?: BonusId
): CrateState {
  return {
    x: cell.x,
    y: cell.y,
    hp: maxHp,
    maxHp,
    animState: 'INTACT',
    bonusId,
  };
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function hasAdjacentBonus(x: number, y: number, bonusCells: Set<string>): boolean {
  return (
    bonusCells.has(cellKey(x - 1, y)) ||
    bonusCells.has(cellKey(x + 1, y)) ||
    bonusCells.has(cellKey(x, y - 1)) ||
    bonusCells.has(cellKey(x, y + 1))
  );
}

/** Génère ensemble la carte et les caisses d'une nouvelle manche. */
export function createRoundMap(
  theme: MapTheme,
  random: () => number = Math.random
): { map: GameMap; crates: CrateState[] } {
  const map = generateMap();
  return { map, crates: generateCrateStates(map, theme, random) };
}

/**
 * Vérifie si une case fait partie d'une zone de spawn protégée (L de 3 cases libres à chaque coin).
 * @param x Coordonnée X de la case.
 * @param y Coordonnée Y de la case.
 * @returns true si la case est protégée.
 */
function isSpawnProtected(x: number, y: number): boolean {
  // Coin haut-gauche
  if ((x <= 1 && y === 0) || (x === 0 && y <= 1)) return true;

  // Coin haut-droite
  if ((x >= MAP_WIDTH - 2 && y === 0) || (x === MAP_WIDTH - 1 && y <= 1)) return true;

  // Coin bas-gauche
  if ((x <= 1 && y === MAP_HEIGHT - 1) || (x === 0 && y >= MAP_HEIGHT - 2)) return true;

  // Coin bas-droite
  if ((x >= MAP_WIDTH - 2 && y === MAP_HEIGHT - 1) || (x === MAP_WIDTH - 1 && y >= MAP_HEIGHT - 2)) return true;

  return false;
}
