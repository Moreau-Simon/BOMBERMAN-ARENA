import {
  BonusId,
  BONUSES,
  PlayerState,
  TICK_RATE_MS,
  MAX_BOMBS,
  MAX_RANGE_BONUS,
  MAX_SPEED_BONUS,
  MIN_SPEED_MULTIPLIER,
  MAX_SPEED_MULTIPLIER,
  MAX_HP,
} from '@bomberman-arena/shared';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class BonusManager {
  /** Applique un bonus ou un malus à un joueur. */
  apply(player: PlayerState, bonusId: BonusId, tick: number): void {
    const bonus = BONUSES[bonusId];
    let changed = false;

    if (bonus.effect.bombs) {
      const next = clamp(player.maxBombs + bonus.effect.bombs, 1, MAX_BOMBS);
      changed ||= next !== player.maxBombs;
      player.maxBombs = next;
    }

    if (bonus.effect.range) {
      const next = clamp(player.rangeBonus + bonus.effect.range, 0, MAX_RANGE_BONUS);
      changed ||= next !== player.rangeBonus;
      player.rangeBonus = next;
    }

    if (bonus.effect.hp && player.hp < MAX_HP) {
      player.hp = Math.min(MAX_HP, player.hp + bonus.effect.hp);
      player.maxHp = Math.max(player.maxHp, player.hp);
      changed = true;
    }

    if (bonus.effect.speed) {
      if (bonus.durationMs) {
        player.speedMalus = bonus.effect.speed;
        player.effectExpiries[bonusId] = tick + Math.ceil(bonus.durationMs / TICK_RATE_MS);
        changed = true;
      } else {
        const next = clamp(player.speedBonus + bonus.effect.speed, 0, MAX_SPEED_BONUS);
        changed ||= next !== player.speedBonus;
        player.speedBonus = next;
      }
    }

    if (changed && !player.effects.includes(bonusId)) {
      player.effects.push(bonusId);
    }

    this.refreshSpeed(player);
  }

  /** Fait expirer les malus temporaires et recalcule la vitesse. */
  update(player: PlayerState, tick: number): void {
    for (const [id, expiry] of Object.entries(player.effectExpiries)) {
      if (expiry === undefined || tick < expiry) continue;

      if (id === 'SAC_POUBELLE') {
        player.speedMalus = 0;
      }
      player.effects = player.effects.filter((effect) => effect !== id);
      delete player.effectExpiries[id as BonusId];
    }

    this.refreshSpeed(player);
  }

  private refreshSpeed(player: PlayerState): void {
    player.speed = clamp(
      1 + player.speedBonus + player.speedMalus,
      MIN_SPEED_MULTIPLIER,
      MAX_SPEED_MULTIPLIER
    );
  }
}
