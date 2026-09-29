import { generateMap, movePlayer, MAP_WIDTH, MAP_HEIGHT, Position } from './game';

describe('Game Engine - Map Generation', () => {
  it('doit générer une carte avec les bonnes dimensions', () => {
    const map = generateMap();
    expect(map.length).toBe(MAP_HEIGHT);
    expect(map[0].length).toBe(MAP_WIDTH);
  });

  it('doit placer des murs indestructibles une case sur deux (indices impairs)', () => {
    const map = generateMap();
    expect(map[1][1]).toBe(1);
    expect(map[0][0]).toBe(0);
    expect(map[3][3]).toBe(1);
  });
});

describe('Game Engine - Player Movement (Collisions)', () => {
  const map = generateMap(); // On utilise une carte standard pour tester

  it('doit permettre au joueur de bouger sur une case vide', () => {
    const startPos: Position = { x: 0, y: 0 };
    // A droite de (0,0) il n'y a pas de mur, c'est vide
    const newPos = movePlayer(startPos, 'RIGHT', map);
    
    // Le joueur doit arriver en x: 1, y: 0
    expect(newPos).toEqual({ x: 1, y: 0 });
  });

  it('doit bloquer le joueur si la destination est un mur indestructible', () => {
    // Le joueur est en (1,0) (case vide). Il veut descendre en (1,1).
    // Or, en (1,1) il y a un mur fixe (indice impair).
    const startPos: Position = { x: 1, y: 0 };
    const newPos = movePlayer(startPos, 'DOWN', map);
    
    // Le joueur doit être bloqué et rester à sa position de départ (1,0)
    expect(newPos).toEqual({ x: 1, y: 0 });
  });

  it('doit empêcher le joueur de sortir de la carte (hors limites)', () => {
    const startPos: Position = { x: 0, y: 0 };
    // Le joueur essaie de sortir de l'écran par la gauche
    const newPos = movePlayer(startPos, 'LEFT', map);
    
    // Le joueur doit être bloqué et rester en (0,0)
    expect(newPos).toEqual({ x: 0, y: 0 });
  });
});
