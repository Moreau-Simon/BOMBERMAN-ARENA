import { generateMap, generateCrateStates } from '../MapGenerator';
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

    // Coin haut-droite : (12,0), (11,0), (12,1) doivent être vides
    expect(map[0][MAP_WIDTH - 1]).toBe(0);
    expect(map[0][MAP_WIDTH - 2]).toBe(0);
    expect(map[1][MAP_WIDTH - 1]).toBe(0);

    // Coin bas-gauche : (0,10), (1,10), (0,9) doivent être vides
    expect(map[MAP_HEIGHT - 1][0]).toBe(0);
    expect(map[MAP_HEIGHT - 1][1]).toBe(0);
    expect(map[MAP_HEIGHT - 2][0]).toBe(0);

    // Coin bas-droite : (12,10), (11,10), (12,9) doivent être vides
    expect(map[MAP_HEIGHT - 1][MAP_WIDTH - 1]).toBe(0);
    expect(map[MAP_HEIGHT - 1][MAP_WIDTH - 2]).toBe(0);
    expect(map[MAP_HEIGHT - 2][MAP_WIDTH - 1]).toBe(0);
  });

  it('doit laisser des trous avec la densité par défaut', () => {
    // 4 coins protégés = 12 cases vides garanties par carte, soit 60 sur 5 cartes.
    // Un plafond à 80 ne passe que si le tirage laisse de vrais trous en plus.
    const emptyCells = Array.from({ length: 5 }, () => generateMap())
      .reduce((total, map) => total + map.flat().filter((cell) => cell === 0).length, 0);

    expect(emptyCells).toBeGreaterThan(80);
  });

  it('génère une seule caisse spéciale avec son bonus de thème', () => {
    const crates = generateCrateStates(generateMap(1), 'CAMPAGNE', () => 0);

    expect(crates.filter((crate) => crate.maxHp === 3)).toHaveLength(1);
    expect(crates.find((crate) => crate.maxHp === 3)?.bonusId).toBe('TREFLE');
    expect(crates.find((crate) => crate.maxHp === 2)?.bonusId).toBe('CHAMPIGNON');
  });

  it('ne place jamais deux caisses bonus côte à côte', () => {
    const crates = generateCrateStates(generateMap(1), 'CAMPAGNE', () => 0);
    const bonusCells = new Set(
      crates.filter((crate) => crate.bonusId).map((crate) => `${crate.x},${crate.y}`)
    );

    expect(bonusCells.size).toBeGreaterThan(1);
    for (const cell of bonusCells) {
      const [x, y] = cell.split(',').map(Number);
      expect(bonusCells.has(`${x + 1},${y}`)).toBe(false);
      expect(bonusCells.has(`${x - 1},${y}`)).toBe(false);
      expect(bonusCells.has(`${x},${y + 1}`)).toBe(false);
      expect(bonusCells.has(`${x},${y - 1}`)).toBe(false);
    }
  });

  it('ne donne aucun bonus aux caisses normales', () => {
    const crates = generateCrateStates(generateMap(1), 'CAMPAGNE', () => 0.99);
    const normalCrates = crates.filter((crate) => crate.maxHp === 1);

    expect(normalCrates.length).toBeGreaterThan(0);
    expect(normalCrates.every((crate) => crate.bonusId === undefined)).toBe(true);
  });
});
