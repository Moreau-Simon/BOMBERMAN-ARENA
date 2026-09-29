import { generateMap } from '../MapGenerator';
import { MAP_WIDTH, MAP_HEIGHT } from '@bomberman-arena/shared';

describe('MapGenerator', () => {
  it('doit générer une carte avec les bonnes dimensions', () => {
    const map = generateMap();
    expect(map.length).toBe(MAP_HEIGHT);
    expect(map[0].length).toBe(MAP_WIDTH);
  });

  it('doit placer des murs indestructibles aux indices impairs', () => {
    const map = generateMap();
    expect(map[1][1]).toBe(1);
    expect(map[3][3]).toBe(1);
    expect(map[3][5]).toBe(1);
  });

  it('ne doit pas placer de mur aux indices pairs', () => {
    const map = generateMap(0); // densité 0 = pas de caisses
    expect(map[0][0]).toBe(0);
    expect(map[2][2]).toBe(0);
  });

  it('doit protéger les zones de spawn', () => {
    const map = generateMap(1.0); // densité maximale
    // Coin haut-gauche : (0,0), (1,0), (0,1) doivent être vides
    expect(map[0][0]).toBe(0);
    expect(map[0][1]).toBe(0);
    expect(map[1][0]).toBe(0);
  });
});
