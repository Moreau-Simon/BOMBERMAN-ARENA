/**
 * @module validation
 * @description Validation des messages reçus sur le réseau.
 * Le serveur ne fait jamais confiance à ce que le client envoie :
 * tout message passe par `parseClientMessage` avant d'atteindre le moteur.
 */

import { ClientMessage } from './protocol';
import { Direction } from './types';

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse et valide un message client brut.
 * @param raw Le contenu texte reçu sur la WebSocket.
 * @returns Le message typé, ou null s'il est malformé.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(data)) return null;

  switch (data.type) {
    case 'CLIENT_INPUT': {
      const payload = data.payload;
      if (!isRecord(payload)) return null;
      if (!DIRECTIONS.includes(payload.direction as Direction)) return null;
      if (typeof payload.state !== 'boolean') return null;

      return {
        type: 'CLIENT_INPUT',
        payload: {
          direction: payload.direction as Direction,
          state: payload.state,
        },
      };
    }

    case 'CLIENT_PLACE_BOMB':
      return { type: 'CLIENT_PLACE_BOMB' };

    case 'CLIENT_READY':
      return { type: 'CLIENT_READY' };

    case 'CLIENT_JOIN': {
      const payload = data.payload;
      if (!isRecord(payload)) return null;
      if (typeof payload.playerName !== 'string') return null;
      if (payload.isHost !== undefined && typeof payload.isHost !== 'boolean') return null;

      return {
        type: 'CLIENT_JOIN',
        payload: {
          playerName: payload.playerName,
          isHost: payload.isHost as boolean | undefined,
        },
      };
    }

    default:
      return null;
  }
}
