/**
 * @module protocol
 * @description Protocole de communication WebSocket entre le client et le serveur.
 * Chaque message est typé via un discriminant `type` pour un parsing sûr.
 *
 * Architecture : Serveur Autoritaire
 * - Le client envoie des INTENTIONS (ClientMessage)
 * - Le serveur VALIDE, CALCULE et renvoie l'ÉTAT (ServerMessage)
 */

import { Direction, GameState, Position } from './types';

// ─── Messages envoyés par le CLIENT au serveur ────────────────────────

/** Le joueur appuie ou relâche une touche de direction. */
export interface ClientInputMessage {
  type: 'CLIENT_INPUT';
  payload: {
    direction: Direction;
    state: boolean; // true = KeyDown, false = KeyUp
  };
}

/** Le joueur souhaite poser une bombe. */
export interface ClientPlaceBombMessage {
  type: 'CLIENT_PLACE_BOMB';
}

/** Le joueur rejoint la partie. */
export interface ClientJoinMessage {
  type: 'CLIENT_JOIN';
  payload: { playerName: string };
}

/** Union de tous les messages client possibles. */
export type ClientMessage =
  | ClientInputMessage
  | ClientPlaceBombMessage
  | ClientJoinMessage;

// ─── Messages envoyés par le SERVEUR aux clients ──────────────────────

/** Mise à jour complète de l'état du jeu (envoyé à chaque tick). */
export interface ServerStateUpdateMessage {
  type: 'SERVER_STATE_UPDATE';
  payload: GameState;
}

/** Confirmation de connexion avec l'ID assigné au joueur. */
export interface ServerWelcomeMessage {
  type: 'SERVER_WELCOME';
  payload: { playerId: string; playerName: string };
}

/** Notification d'erreur. */
export interface ServerErrorMessage {
  type: 'SERVER_ERROR';
  payload: { message: string };
}

/** Un joueur a rejoint la partie. */
export interface ServerPlayerJoinedMessage {
  type: 'SERVER_PLAYER_JOINED';
  payload: { playerId: string; playerName: string };
}

/** La partie commence. */
export interface ServerGameStartMessage {
  type: 'SERVER_GAME_START';
}

/** Union de tous les messages serveur possibles. */
export type ServerMessage =
  | ServerStateUpdateMessage
  | ServerWelcomeMessage
  | ServerErrorMessage
  | ServerPlayerJoinedMessage
  | ServerGameStartMessage;
