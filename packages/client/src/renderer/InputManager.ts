/**
 * @module InputManager
 * @description Capture les entrées clavier du joueur.
 * Émet des événements "Key Down" et "Key Up" pour que le serveur
 * gère un mouvement continu physique.
 */

import { EventBus } from './EventBus';

interface InputTarget {
  playerIndex: number;
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
}

const MOVE_MAP: Record<string, InputTarget> = {
  // ZQSD
  z: { playerIndex: 0, direction: 'UP' },
  Z: { playerIndex: 0, direction: 'UP' },
  s: { playerIndex: 0, direction: 'DOWN' },
  S: { playerIndex: 0, direction: 'DOWN' },
  q: { playerIndex: 0, direction: 'LEFT' },
  Q: { playerIndex: 0, direction: 'LEFT' },
  d: { playerIndex: 0, direction: 'RIGHT' },
  D: { playerIndex: 0, direction: 'RIGHT' },

  // Flèches directionnelles
  ArrowUp:    { playerIndex: 0, direction: 'UP' },
  ArrowDown:  { playerIndex: 0, direction: 'DOWN' },
  ArrowLeft:  { playerIndex: 0, direction: 'LEFT' },
  ArrowRight: { playerIndex: 0, direction: 'RIGHT' },
};

const BOMB_KEYS: Record<string, number> = {
  ' ': 0,         // Espace
  Enter: 0,       // Entrée
  Numpad0: 0,     // 0 Pavé numérique
  '0': 0,         // Touche 0
};

export class InputManager {
  /** Touches actuellement enfoncées. */
  private keysDown: Set<string> = new Set();

  constructor(private eventBus: EventBus) {
    this.setupKeyboardListeners();
    this.eventBus.on('game:quit', () => {
      this.keysDown.clear();
    });
  }

  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ignorer les répétitions dues au maintien enfoncé
      if (e.repeat) return;
      
      const target = MOVE_MAP[e.key];
      if (target) {
        const keyId = `${target.playerIndex}_${target.direction}`;
        this.keysDown.add(keyId);
        this.eventBus.emit('input:move', {
          playerIndex: target.playerIndex,
          direction: target.direction,
          state: true,
        });
      }

      if (BOMB_KEYS[e.key] !== undefined) {
        const playerIndex = BOMB_KEYS[e.key];
        this.eventBus.emit('input:bomb', { playerIndex });
      }

      if (e.key === 'F3' || e.key === 'f3') {
        this.eventBus.emit('input:toggle_debug', undefined);
      }
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      const target = MOVE_MAP[e.key];
      if (target) {
        const keyId = `${target.playerIndex}_${target.direction}`;
        if (this.keysDown.has(keyId)) {
          this.keysDown.delete(keyId);
          this.eventBus.emit('input:move', {
            playerIndex: target.playerIndex,
            direction: target.direction,
            state: false,
          });
        }
      }
    });
  }
}
