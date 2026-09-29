/**
 * @module CollisionSystem
 * @description Système de détection de collisions AABB (Axis-Aligned Bounding Box).
 * 
 * Permet un mouvement fluide avec glissement sur les murs et une assistance
 * dans les coins (corner assist) pour faciliter l'entrée dans les couloirs étroits.
 */

import { Position, GameMap } from '@bomberman-arena/shared';
import { MAP_WIDTH, MAP_HEIGHT, PLAYER_HITBOX_W, PLAYER_HITBOX_H, CORNER_ASSIST_THRESHOLD } from '@bomberman-arena/shared';

/**
 * Box de collision 2D
 */
interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Crée la hitbox d'un joueur autour de sa position centrale.
 */
function getPlayerHitbox(pos: Position): AABB {
  return {
    minX: pos.x - PLAYER_HITBOX_W / 2,
    minY: pos.y - PLAYER_HITBOX_H / 2,
    maxX: pos.x + PLAYER_HITBOX_W / 2,
    maxY: pos.y + PLAYER_HITBOX_H / 2,
  };
}

/**
 * Crée la hitbox d'une tuile (case de la grille).
 */
function getTileHitbox(tx: number, ty: number): AABB {
  return {
    minX: tx,
    minY: ty,
    maxX: tx + 1,
    maxY: ty + 1,
  };
}

/**
 * Vérifie si deux AABB se chevauchent.
 */
function isOverlapping(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY
  );
}

/**
 * Vérifie si une hitbox entre en collision avec le décor de la carte.
 */
function checkMapCollision(hitbox: AABB, map: GameMap): boolean {
  // Limites de la carte
  if (hitbox.minX < 0 || hitbox.maxX > MAP_WIDTH || hitbox.minY < 0 || hitbox.maxY > MAP_HEIGHT) {
    return true;
  }

  // Indices de la grille touchés par la hitbox
  const startX = Math.floor(hitbox.minX);
  const endX = Math.floor(hitbox.maxX - 0.0001); // évite l'index out of bounds sur les bords exacts
  const startY = Math.floor(hitbox.minY);
  const endY = Math.floor(hitbox.maxY - 0.0001);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
        if (map[y][x] !== 0) { // Mur ou caisse
          const tileHitbox = getTileHitbox(x, y);
          if (isOverlapping(hitbox, tileHitbox)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Assistance de coin (Corner Assist)
 * Si le joueur heurte un mur mais qu'il est presque aligné avec un couloir adjacent,
 * on le "pousse" doucement vers ce couloir pour fluidifier le mouvement.
 */
function applyCornerAssist(
  pos: Position,
  velX: number,
  velY: number,
  map: GameMap
): Position {
  const newPos = { ...pos };

  // Si on avance verticalement et qu'on est bloqué
  if (velY !== 0 && velX === 0) {
    const tileX = Math.floor(pos.x);
    const centerX = tileX + 0.5;
    const diffX = pos.x - centerX;
    
    // Si on est légèrement décalé par rapport au centre de la case
    if (Math.abs(diffX) > 0 && Math.abs(diffX) < CORNER_ASSIST_THRESHOLD) {
      // Pousser vers le centre
      newPos.x -= Math.sign(diffX) * 0.1;
    }
  }

  // Si on avance horizontalement et qu'on est bloqué
  if (velX !== 0 && velY === 0) {
    const tileY = Math.floor(pos.y);
    const centerY = tileY + 0.5;
    const diffY = pos.y - centerY;
    
    if (Math.abs(diffY) > 0 && Math.abs(diffY) < CORNER_ASSIST_THRESHOLD) {
      // Pousser vers le centre
      newPos.y -= Math.sign(diffY) * 0.1;
    }
  }

  return newPos;
}

/**
 * Tente de déplacer le joueur avec une vélocité donnée.
 * Applique la physique "sliding" (résolution d'axes indépendants) et le "corner assist".
 *
 * @param pos Position actuelle (flottants)
 * @param velX Vélocité en X appliquée à cette frame
 * @param velY Vélocité en Y appliquée à cette frame
 * @param map Carte du jeu
 * @returns La nouvelle position valide
 */
export function resolveMovement(
  pos: Position,
  velX: number,
  velY: number,
  map: GameMap
): Position {
  let newX = pos.x;
  let newY = pos.y;
  let collidedX = false;
  let collidedY = false;

  // 1. Essayer le mouvement en X
  if (velX !== 0) {
    const testX = pos.x + velX;
    if (!checkMapCollision(getPlayerHitbox({ x: testX, y: pos.y }), map)) {
      newX = testX;
    } else {
      collidedX = true;
    }
  }

  // 2. Essayer le mouvement en Y
  if (velY !== 0) {
    const testY = pos.y + velY;
    // Utiliser newX pour permettre le mouvement en diagonale "glissant"
    if (!checkMapCollision(getPlayerHitbox({ x: newX, y: testY }), map)) {
      newY = testY;
    } else {
      collidedY = true;
    }
  }

  // 3. Appliquer l'assistance de coin (Corner Assist) si bloqué sur un axe
  if (collidedX || collidedY) {
    const assisted = applyCornerAssist({ x: newX, y: newY }, velX, velY, map);
    // Vérifier que l'assistance ne nous pousse pas dans un mur
    if (!checkMapCollision(getPlayerHitbox(assisted), map)) {
      return assisted;
    }
  }

  return { x: newX, y: newY };
}
