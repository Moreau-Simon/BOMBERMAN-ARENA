import { GameEngine } from '../GameEngine';
import { BOMB_RANGE, BOMB_TIMER_TICKS } from '@bomberman-arena/shared';

describe('GameEngine', () => {
  it('termine la manche quand il ne reste plus qu un joueur', () => {
    const engine = new GameEngine();
    const alice = engine.addPlayer('Alice')!;
    const bob = engine.addPlayer('Bob')!;
    engine.start();

    engine.removePlayer(bob);

    expect(engine.getState().phase).toBe('GAME_OVER');
    expect(engine.getState().players).toHaveLength(1);

    engine.removePlayer(alice);
  });

  it('revient en attente quand le dernier joueur part', () => {
    const engine = new GameEngine();
    const alice = engine.addPlayer('Alice')!;
    engine.start();

    engine.removePlayer(alice);

    expect(engine.getState().phase).toBe('WAITING');
    expect(engine.getState().players).toHaveLength(0);
    expect(engine.getState().bombs).toHaveLength(0);
  });

  it('pose une bombe avec la portée bonus du joueur', () => {
    const engine = new GameEngine();
    const alice = engine.addPlayer('Alice')!;
    engine.start();
    engine.stop();

    engine.getState().players[0].rangeBonus = 2;
    engine.handleClientMessage(alice, { type: 'CLIENT_PLACE_BOMB' });
    engine.tick();

    expect(engine.getState().bombs[0].range).toBe(BOMB_RANGE + 2);
    engine.removePlayer(alice);
  });

  it('meurt sur sa propre bombe quand il est à un PV', () => {
    const engine = new GameEngine();
    const alice = engine.addPlayer('Alice')!;
    engine.start();
    engine.stop();

    engine.handleClientMessage(alice, { type: 'CLIENT_PLACE_BOMB' });
    for (let tick = 0; tick <= BOMB_TIMER_TICKS; tick++) engine.tick();

    expect(engine.getState().players[0].hp).toBe(0);
    expect(engine.getState().players[0].isAlive).toBe(false);
    engine.removePlayer(alice);
  });

  it('perd un seul PV quand le joueur en a deux', () => {
    const engine = new GameEngine();
    const alice = engine.addPlayer('Alice')!;
    engine.start();
    engine.stop();

    const player = engine.getState().players[0];
    player.hp = 2;
    player.maxHp = 2;

    engine.handleClientMessage(alice, { type: 'CLIENT_PLACE_BOMB' });
    for (let tick = 0; tick <= BOMB_TIMER_TICKS; tick++) engine.tick();

    expect(engine.getState().players[0].hp).toBe(1);
    expect(engine.getState().players[0].isAlive).toBe(true);
    engine.removePlayer(alice);
  });
});
