import { BonusId, BONUSES, bonusImageUrl, PlayerState } from '@bomberman-arena/shared';

export class BonusHud {
  private element: HTMLElement;
  private displayedKey = '';

  constructor() {
    this.element = document.getElementById('hud-bonuses')!;
  }

  update(player: PlayerState | null | undefined, tick: number): void {
    const counts = new Map<BonusId, number>();

    if (player) {
      for (const id of player.effects) {
        const expiry = player.effectExpiries[id];
        if (expiry !== undefined && expiry <= tick) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    const key = Array.from(counts.entries())
      .map(([id, count]) => `${id}x${count}${player?.effectExpiries[id] ? 't' : 'p'}`)
      .join('|');
    if (key === this.displayedKey) return;
    this.displayedKey = key;

    this.element.replaceChildren();
    for (const [id, count] of counts) {
      this.element.appendChild(this.createBonus(id, count, !!player?.effectExpiries[id]));
    }
  }

  reset(): void {
    this.displayedKey = '';
    this.element.replaceChildren();
  }

  private createBonus(id: BonusId, count: number, temporary: boolean): HTMLSpanElement {
    const bonus = BONUSES[id];

    const wrapper = document.createElement('span');
    wrapper.className = 'hud-bonus';

    const img = document.createElement('img');
    img.src = bonusImageUrl(id);
    img.alt = '';
    img.title = `${bonus.label} — ${bonus.description}`;
    if (temporary) img.classList.add('temporary');
    wrapper.appendChild(img);

    if (count > 1) {
      const badge = document.createElement('span');
      badge.className = 'hud-bonus-count';
      badge.innerText = String(count);
      wrapper.appendChild(badge);
    }

    return wrapper;
  }
}
