import { PlayerManager } from '../PlayerManager';
import { SPAWN_POSITIONS } from '@bomberman-arena/shared';

describe('PlayerManager', () => {
  it('remet les joueurs en état de départ pour une nouvelle manche', () => {
    const players = new PlayerManager();
    const alice = players.addPlayer('Alice')!;
    const bob = players.addPlayer('Bob')!;

    players.killPlayer(alice.id);
    players.setReady(alice.id);
    players.updateInput(alice.id, 'UP', true);

    players.resetForNewRound();

    expect(alice.isAlive).toBe(true);
    expect(alice.isReady).toBe(false);
    expect(alice.position).toEqual(SPAWN_POSITIONS[0]);
    expect(bob.position).toEqual(SPAWN_POSITIONS[1]);
    expect(alice.activeInputs.UP).toBe(false);
    expect(alice.bombCount).toBe(0);
  });

  it('nettoie le pseudo et le tronque à 12 caractères', () => {
    const players = new PlayerManager();
    const player = players.addPlayer('  unnombeaucouptroplong  ')!;
    expect(player.name).toBe('unnombeaucou');
  });

  it('donne un nom par défaut quand le pseudo est vide', () => {
    const players = new PlayerManager();
    expect(players.addPlayer('   ')!.name).toBe('JOUEUR 1');
  });

  it('annule les drapeaux prêts au début d\'une manche', () => {
    const players = new PlayerManager();
    const player = players.addPlayer('Alice')!;
    players.setReady(player.id);

    players.clearReady();

    expect(player.isReady).toBe(false);
    expect(players.allReady()).toBe(false);
  });
});
