import { resolveMovement } from '../CollisionSystem';
import { generateMap } from '../MapGenerator';
import { GameMap } from '@bomberman-arena/shared';

describe('CollisionSystem', () => {
  let map: GameMap;

  beforeEach(() => {
    map = generateMap(0); // Carte sans caisses pour des tests prévisibles
  });

  it('doit autoriser le déplacement sur une case libre', () => {
    const startPos = { x: 0.5, y: 0.5 };
    const newPos = resolveMovement(startPos, 0.1, 0, map);
    expect(newPos.x).toBeCloseTo(0.6);
    expect(newPos.y).toBeCloseTo(0.5);
  });

  it('doit bloquer le déplacement vers un mur indestructible', () => {
    // Mur en (1, 1). Si le joueur est en (0.5, 1.5) et essaie d'aller à droite vers (1.5, 1.5)
    const startPos = { x: 0.5, y: 1.5 };
    const newPos = resolveMovement(startPos, 0.4, 0, map);
    // Doit être bloqué par la hitbox du mur en x=1
    expect(newPos.x).toBeLessThan(0.7);
  });

  it('doit empêcher le joueur de sortir des limites de la carte', () => {
    const startPos = { x: 0.35, y: 0.5 }; // Bord gauche
    const newPos = resolveMovement(startPos, -0.2, 0, map);
    expect(newPos.x).toBeGreaterThanOrEqual(0.35); // La hitbox (0.7 de large, donc minX=0) bloque
  });
});
