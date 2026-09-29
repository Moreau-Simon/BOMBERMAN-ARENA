/**
 * Type représentant l'état d'une case sur la carte.
 * 0 = Vide (franchissable)
 * 1 = Mur indestructible
 * 2 = Mur destructible (caisse)
 */
export type CellType = 0 | 1 | 2;

/**
 * Type représentant la carte du jeu sous forme de matrice 2D.
 */
export type GameMap = CellType[][];

// Dimensions standards d'une grille Bomberman (doivent être impaires)
export const MAP_WIDTH = 13;
export const MAP_HEIGHT = 11;

/**
 * Génère la carte initiale du jeu avec les murs indestructibles.
 * Les murs indestructibles sont placés une case sur deux (uniquement sur les indices impairs).
 * @returns {GameMap} La matrice 2D représentant le plateau de jeu.
 */
export function generateMap(): GameMap {
  const map: GameMap = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      
      // On place un mur fixe une case sur deux, sans toucher aux bords
      if (x % 2 !== 0 && y % 2 !== 0) {
        row.push(1); // Mur fixe
      } else {
        row.push(0); // Case vide
      }
      
    }
    map.push(row);
  }

  return map;
}

// --- NOUVEAUTÉ : DÉPLACEMENTS ET COLLISIONS ---

export type Position = { x: number; y: number };
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/**
 * Tente de déplacer un joueur dans une direction donnée.
 * Vérifie les limites de la carte et les collisions avec les murs.
 * 
 * @param currentPos La position actuelle du joueur.
 * @param direction La direction souhaitée.
 * @param map La carte actuelle pour vérifier les murs.
 * @returns La nouvelle position si le mouvement est valide, sinon la position d'origine.
 */
export function movePlayer(currentPos: Position, direction: Direction, map: GameMap): Position {
  // On copie la position actuelle pour ne pas modifier l'originale directement
  const newPos = { x: currentPos.x, y: currentPos.y };

  // On simule le déplacement
  if (direction === 'UP') newPos.y -= 1;
  else if (direction === 'DOWN') newPos.y += 1;
  else if (direction === 'LEFT') newPos.x -= 1;
  else if (direction === 'RIGHT') newPos.x += 1;

  // 1. Vérification des limites de la carte (ne pas sortir de l'écran)
  if (newPos.x < 0 || newPos.x >= MAP_WIDTH || newPos.y < 0 || newPos.y >= MAP_HEIGHT) {
    return currentPos; // Mouvement refusé, on renvoie l'ancienne position
  }

  // 2. Vérification des collisions avec un mur indestructible (1)
  if (map[newPos.y][newPos.x] === 1) {
    return currentPos; // Mouvement refusé (mur en béton)
  }

  // Plus tard : on ajoutera la vérification pour les caisses destructibles (2) et les bombes !

  // Si tout est bon, le joueur peut avancer
  return newPos;
}
