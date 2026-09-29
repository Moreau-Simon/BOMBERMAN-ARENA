/**
 * @module EventBus
 * @description Bus d'événements central du client Bomberman Arena.
 *
 * Ce pattern découple totalement les 3 couches du client :
 * - InputManager (capture clavier) → émet des événements
 * - NetworkManager (WebSocket) → émet et écoute des événements
 * - GameRenderer (Canvas) → écoute des événements pour le rendu
 *
 * Avantages :
 * - Testabilité : on peut mocker le réseau et tester le rendu seul
 * - Flexibilité : ajouter un composant = écouter/émettre sur le bus
 * - Découplage : aucun module ne connaît directement un autre
 *
 * @example
 * // Émettre un événement
 * eventBus.emit('input:move', { direction: 'UP' });
 *
 * // Écouter un événement
 * eventBus.on('state:update', (state) => render(state));
 */

/** Map des événements disponibles avec leurs types de payload. */
export interface EventMap {
  // ─── Événements d'input (clavier → réseau) ────────────────────
  'input:move': { direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', state: boolean };
  'input:bomb': void;
  'input:toggle_debug': void;

  // ─── Événements réseau → rendu ────────────────────────────────
  'network:connected': { playerId: string };
  'network:disconnected': void;
  'network:error': { message: string };
  'network:player_joined': { playerId: string; playerName: string };

  // ─── Événements d'état du jeu ─────────────────────────────────
  'state:update': import('@bomberman-arena/shared').GameState;
  'game:start': void;
  'game:over': void;

  // ─── Événements UI ────────────────────────────────────────────
  'ui:play': { playerName: string; serverIp?: string };
  'ui:show_game': void;
}

type EventKey = keyof EventMap;
type EventCallback<K extends EventKey> = (payload: EventMap[K]) => void;

/**
 * Bus d'événements typé.
 * Toutes les communications internes du client passent par ce bus.
 */
export class EventBus {
  private listeners: Map<EventKey, Set<EventCallback<any>>> = new Map();

  /**
   * Abonne un callback à un type d'événement.
   * @param event Le nom de l'événement.
   * @param callback La fonction à appeler quand l'événement est émis.
   * @returns Une fonction pour se désabonner.
   */
  on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Retourne une fonction pour se désabonner
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Émet un événement, notifiant tous les abonnés.
   * @param event Le nom de l'événement.
   * @param payload Les données associées à l'événement.
   */
  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventBus] Erreur dans le handler de '${event}':`, err);
        }
      }
    }
  }

  /**
   * Abonne un callback qui ne s'exécutera qu'une seule fois.
   * @param event Le nom de l'événement.
   * @param callback La fonction à appeler une seule fois.
   */
  once<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      callback(payload);
    });
  }

  /** Supprime tous les abonnements (utile pour les tests). */
  clear(): void {
    this.listeners.clear();
  }
}
