import { BombManager } from '../BombManager';
import { generateMap } from '../MapGenerator';
import { BOMB_TIMER_TICKS, EXPLOSION_DURATION_TICKS, GameMap, CrateState } from '@bomberman-arena/shared';

describe('BombManager', () => {
  let bombs: BombManager;
  let map: GameMap;

  beforeEach(() => {
    bombs = new BombManager();
    map = generateMap(0); // Carte sans caisses pour des tests prévisibles
  });

  it('doit exploser exactement au tick prévu', () => {
    bombs.placeBomb('p1', { x: 0, y: 0 }, 0);

    for (let tick = 1; tick < BOMB_TIMER_TICKS; tick++) {
      expect(bombs.update(map, tick).explodedOwners).toHaveLength(0);
    }
    expect(bombs.getAllBombs()).toHaveLength(1);

    expect(bombs.update(map, BOMB_TIMER_TICKS).explodedOwners).toEqual(['p1']);
    expect(bombs.getAllBombs()).toHaveLength(0);
  });

  it('doit détruire une caisse et arrêter l\'explosion derrière elle', () => {
    map[0][2] = 2;
    bombs.placeBomb('p1', { x: 0, y: 0 }, 0, 4);
    bombs.update(map, BOMB_TIMER_TICKS);

    expect(map[0][1]).toBe(0);
    expect(map[0][2]).toBe(0);

    const touched = bombs.getActiveExplosions().map(e => `${e.position.x},${e.position.y}`);
    expect(touched).toContain('1,0');
    expect(touched).toContain('2,0');
    expect(touched).not.toContain('3,0');
  });

  it('fait résister une caisse renforcée à un premier coup', () => {
    map[0][2] = 2;
    const crates: CrateState[] = [
      { x: 2, y: 0, hp: 2, maxHp: 2, animState: 'INTACT' },
    ];

    bombs.placeBomb('p1', { x: 0, y: 0 }, 0, 4);
    const first = bombs.update(map, BOMB_TIMER_TICKS, crates);

    expect(map[0][2]).toBe(2);
    expect(crates[0].hp).toBe(1);
    expect(first.destroyedCrates).toHaveLength(0);

    bombs.placeBomb('p1', { x: 0, y: 0 }, BOMB_TIMER_TICKS, 4);
    const second = bombs.update(map, BOMB_TIMER_TICKS * 2, crates);

    expect(map[0][2]).toBe(0);
    expect(second.destroyedCrates).toEqual([
      { position: { x: 2, y: 0 }, ownerId: 'p1' },
    ]);
  });

  it('ne doit pas poser deux bombes sur la même case', () => {
    expect(bombs.placeBomb('p1', { x: 1, y: 0 }, 0)).not.toBeNull();
    expect(bombs.placeBomb('p2', { x: 1, y: 0 }, 0)).toBeNull();
  });

  it('doit oublier une explosion après sa durée de vie', () => {
    bombs.placeBomb('p1', { x: 0, y: 0 }, 0);
    bombs.update(map, BOMB_TIMER_TICKS);
    expect(bombs.getActiveExplosions().length).toBeGreaterThan(0);

    bombs.update(map, BOMB_TIMER_TICKS + EXPLOSION_DURATION_TICKS);
    expect(bombs.getActiveExplosions()).toHaveLength(0);
  });

  it('doit tout effacer au changement de manche', () => {
    bombs.placeBomb('p1', { x: 0, y: 0 }, 0);
    bombs.update(map, BOMB_TIMER_TICKS);
    bombs.clear();

    expect(bombs.getAllBombs()).toHaveLength(0);
    expect(bombs.getActiveExplosions()).toHaveLength(0);
  });
});
