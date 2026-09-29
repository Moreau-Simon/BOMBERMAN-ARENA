/**
 * @module InputManager
 * @description Capture les entrées clavier du joueur.
 * Émet des événements "Key Down" et "Key Up" pour que le serveur
 * gère un mouvement continu physique.
 */

import { EventBus } from './EventBus';

/** Mapping touche → direction */
const KEY_MAP: Record<string, 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'> = {
  ArrowUp:    'UP',
  ArrowDown:  'DOWN',
  ArrowLeft:  'LEFT',
  ArrowRight: 'RIGHT',
  z: 'UP',
  s: 'DOWN',
  q: 'LEFT',
  d: 'RIGHT',
};

export class InputManager {
  /** Touches actuellement enfoncées pour éviter de spammer le serveur. */
  private keysDown: Set<string> = new Set();

  constructor(private eventBus: EventBus) {
    this.setupKeyboardListeners();
  }

  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ignorer les répétitions dues au maintien enfoncé
      if (e.repeat) return;
      
      const direction = KEY_MAP[e.key];
      if (direction) {
        this.keysDown.add(direction);
        this.eventBus.emit('input:move', { direction, state: true });
      }

      if (e.key === ' ') {
        this.eventBus.emit('input:bomb', undefined as unknown as void);
      }

      if (e.key === 'F3' || e.key === 'f3') {
        this.eventBus.emit('input:toggle_debug', undefined as unknown as void);
      }
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      const direction = KEY_MAP[e.key];
      if (direction && this.keysDown.has(direction)) {
        this.keysDown.delete(direction);
        this.eventBus.emit('input:move', { direction, state: false });
      }
    });
  }
}
