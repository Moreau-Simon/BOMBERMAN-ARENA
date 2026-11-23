import { BonusManager } from '../BonusManager';
import { PlayerManager } from '../PlayerManager';

describe('BonusManager', () => {
  it('applique les bonus permanents et affiche leurs icônes', () => {
    const player = new PlayerManager().addPlayer('Test')!;
    const bonuses = new BonusManager();

    bonuses.apply(player, 'CHAMPIGNON', 0);
    bonuses.apply(player, 'EPIS_MAIS', 0);
    bonuses.apply(player, 'PLUME', 0);
    bonuses.apply(player, 'MIEL', 0);

    expect(player.maxBombs).toBe(2);
    expect(player.rangeBonus).toBe(1);
    expect(player.speed).toBeCloseTo(1.2);
    expect(player.hp).toBe(2);
    expect(player.maxHp).toBe(2);
    expect(player.effects).toEqual(['CHAMPIGNON', 'EPIS_MAIS', 'PLUME', 'MIEL']);
  });

  it('applique le méga-bonus de la caisse spéciale', () => {
    const player = new PlayerManager().addPlayer('Test')!;
    const bonuses = new BonusManager();

    bonuses.apply(player, 'TREFLE', 0);

    expect(player.maxBombs).toBe(3);
    expect(player.rangeBonus).toBe(2);
  });

  it('respecte les plafonds et ignore un bonus inutile', () => {
    const player = new PlayerManager().addPlayer('Test')!;
    const bonuses = new BonusManager();

    for (let i = 0; i < 10; i++) bonuses.apply(player, 'CHAMPIGNON', 0);
    bonuses.apply(player, 'BRIQUE', 0);
    bonuses.apply(player, 'MIEL', 0);
    bonuses.apply(player, 'MIEL', 0);

    expect(player.maxBombs).toBe(5);
    expect(player.rangeBonus).toBe(0);
    expect(player.effects).not.toContain('BRIQUE');
    expect(player.maxHp).toBe(2);
    expect(player.effects.filter((id) => id === 'MIEL')).toHaveLength(1);
  });

  it('applique un malus de vitesse puis le retire après 5 secondes', () => {
    const player = new PlayerManager().addPlayer('Test')!;
    const bonuses = new BonusManager();

    bonuses.apply(player, 'PLUME', 0);
    bonuses.apply(player, 'SAC_POUBELLE', 10);

    expect(player.speed).toBeCloseTo(1);
    expect(player.effects).toContain('SAC_POUBELLE');

    bonuses.update(player, 109);
    expect(player.speed).toBeCloseTo(1);
    expect(player.effects).toContain('SAC_POUBELLE');

    bonuses.update(player, 110);
    expect(player.speed).toBeCloseTo(1.2);
    expect(player.effects).not.toContain('SAC_POUBELLE');
  });
});
