/**
 * @module NetworkManager
 * @description Gère la connexion WebSocket avec le serveur.
 * Responsabilité unique (SRP) : envoyer/recevoir des messages réseau.
 *
 * Ce module fait le pont entre le protocole WebSocket et le bus d'événements.
 * Il n'a AUCUNE connaissance du rendu graphique (principe d'inversion de dépendance).
 *
 * Flux :
 * - EventBus('input:move') → NetworkManager → WebSocket → Serveur
 * - Serveur → WebSocket → NetworkManager → EventBus('state:update')
 */

import { EventBus } from './EventBus';
import { ClientMessage, ServerMessage, SERVER_PORT } from '@bomberman-arena/shared';

export class NetworkManager {
  private ws: WebSocket | null = null;
  private playerId: string | null = null;

  constructor(private eventBus: EventBus) {
    this.subscribeToEvents();
  }

  /**
   * S'abonne aux événements du bus pour les traduire en messages réseau.
   */
  private subscribeToEvents(): void {
    // Input → WebSocket
    this.eventBus.on('input:move', (payload: any) => {
      this.send({ 
        type: 'CLIENT_INPUT', 
        payload: {
          direction: payload.direction,
          state: payload.state
        }
      });
    });

    this.eventBus.on('input:bomb', () => {
      this.send({ type: 'CLIENT_PLACE_BOMB' });
    });

    // UI → Join
    this.eventBus.on('ui:play', (payload) => {
      this.connect(payload.playerName, payload.serverIp);
    });
  }

  /**
   * Établit la connexion WebSocket et envoie un message de join.
   * @param playerName Nom du joueur.
   * @param serverIp Adresse IP du serveur WebSocket (défaut: localhost).
   */
  connect(playerName: string, serverIp?: string): void {
    const host = serverIp && serverIp.trim() !== '' ? serverIp.trim() : 'localhost';
    const url = `ws://${host}:${SERVER_PORT}`;
    console.log(`[NetworkManager] Connexion à ${url}...`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[NetworkManager] Connecté !');
      this.send({ type: 'CLIENT_JOIN', payload: { playerName } });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.handleServerMessage(message);
      } catch (err) {
        console.error('[NetworkManager] Message invalide:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[NetworkManager] Déconnecté');
      this.eventBus.emit('network:disconnected', undefined as unknown as void);
    };

    this.ws.onerror = () => {
      this.eventBus.emit('network:error', { message: 'Connexion perdue' });
    };
  }

  /**
   * Traite un message reçu du serveur et l'émet sur le bus d'événements.
   * @param message Le message serveur parsé.
   */
  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'SERVER_WELCOME':
        this.playerId = message.payload.playerId;
        this.eventBus.emit('network:connected', { playerId: this.playerId });
        this.eventBus.emit('ui:show_game', undefined as unknown as void);
        break;

      case 'SERVER_STATE_UPDATE':
        this.eventBus.emit('state:update', message.payload);
        break;

      case 'SERVER_GAME_START':
        this.eventBus.emit('game:start', undefined as unknown as void);
        break;

      case 'SERVER_PLAYER_JOINED':
        this.eventBus.emit('network:player_joined', message.payload);
        break;

      case 'SERVER_ERROR':
        this.eventBus.emit('network:error', message.payload);
        break;
    }
  }

  /**
   * Envoie un message au serveur via WebSocket.
   * @param message Le message client à envoyer.
   */
  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /** L'ID du joueur assigné par le serveur. */
  getPlayerId(): string | null {
    return this.playerId;
  }
}
