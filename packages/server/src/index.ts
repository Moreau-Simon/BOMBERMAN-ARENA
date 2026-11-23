/**
 * @module ServerEntryPoint
 * @description Point d'entrée du serveur Bomberman Arena.
 *
 * Architecture :
 * - Serveur WebSocket pour la communication temps réel
 * - GameEngine pour la logique de jeu (serveur autoritaire)
 * - Le serveur est la seule source de vérité
 *
 * Flux :
 * 1. Un client se connecte via WebSocket
 * 2. Il envoie un message CLIENT_JOIN pour rejoindre
 * 3. Le serveur l'ajoute au GameEngine et lui renvoie un WELCOME
 * 4. À chaque tick, le serveur broadcast l'état à tous les clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import {
  ClientMessage,
  ServerMessage,
  SERVER_PORT,
  parseClientMessage,
} from '@bomberman-arena/shared';
import { GameEngine } from './GameEngine';

/** Intervalle du contrôle de connexion (ping/pong). */
const HEARTBEAT_MS = 30_000;

const wss = new WebSocketServer({ port: SERVER_PORT });
const engine = new GameEngine();

/** Map associant chaque WebSocket à l'ID du joueur. */
const clientMap = new Map<WebSocket, string>();

/** Indique si une socket a répondu au dernier ping. */
const socketAlive = new WeakMap<WebSocket, boolean>();

console.log(`[Bomberman Arena] Serveur démarré sur le port ${SERVER_PORT}`);
console.log('   En attente de joueurs...');

const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    const socket = client as WebSocket;
    if (socketAlive.get(socket) === false) {
      socket.terminate();
      continue;
    }
    socketAlive.set(socket, false);
    socket.ping();
  }
}, HEARTBEAT_MS);
heartbeat.unref();

/**
 * Envoie un message typé à un client WebSocket.
 * @param ws Le WebSocket du client destinataire.
 * @param message Le message serveur à envoyer.
 */
function sendToClient(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast un message à tous les clients connectés.
 * @param message Le message serveur à diffuser.
 */
function broadcast(message: ServerMessage): void {
  for (const client of wss.clients) {
    sendToClient(client as WebSocket, message);
  }
}

// ─── Callback du GameEngine : broadcast l'état à chaque tick ──────────
engine.setOnTick((state) => {
  broadcast({
    type: 'SERVER_STATE_UPDATE',
    payload: state,
  });
});

// ─── Gestion des connexions WebSocket ─────────────────────────────────
wss.on('connection', (ws: WebSocket) => {
  console.log(' Joueur connecté');
  socketAlive.set(ws, true);
  ws.on('pong', () => socketAlive.set(ws, true));

  ws.on('message', (data: Buffer) => {
    const message: ClientMessage | null = parseClientMessage(data.toString());
    if (!message) {
      sendToClient(ws, {
        type: 'SERVER_ERROR',
        payload: { message: 'Message invalide' },
      });
      return;
    }

    switch (message.type) {
      case 'CLIENT_JOIN': {
        if (clientMap.has(ws)) return;

        const isHost = !!message.payload.isHost;
        const playerId = engine.addPlayer(message.payload.playerName, isHost);

        if (!playerId) {
          sendToClient(ws, {
            type: 'SERVER_ERROR',
            payload: { message: 'Partie pleine !' },
          });
          return;
        }

        clientMap.set(ws, playerId);
        console.log(` Joueur "${message.payload.playerName}" rejoint (ID: ${playerId})`);

        // Envoyer le welcome au joueur
        sendToClient(ws, {
          type: 'SERVER_WELCOME',
          payload: { playerId, playerName: message.payload.playerName },
        });

        // Notifier les autres joueurs
        broadcast({
          type: 'SERVER_PLAYER_JOINED',
          payload: { playerId, playerName: message.payload.playerName },
        });

        // Un joueur qui arrive en cours de partie ne doit pas rester au lobby.
        // Après une fin de partie, il repasse par le lobby : c'est READY qui
        // relance une manche, avec une nouvelle carte.
        const state = engine.getState();
        if (state.phase === 'PLAYING') {
          sendToClient(ws, {
            type: 'SERVER_GAME_START',
            payload: { theme: state.theme ?? 'URBAN' },
          });
        }

        // Envoyer l'état actuel au nouveau joueur pour qu'il voie le lobby
        broadcast({
          type: 'SERVER_STATE_UPDATE',
          payload: engine.getState(),
        });
        break;
      }

      case 'CLIENT_READY': {
        const playerId = clientMap.get(ws);
        if (playerId) {
          engine.handleClientMessage(playerId, message);
          console.log(` Joueur ${playerId} est READY`);

          // Broadcast l'état mis à jour (pour que tous voient les ✔ dans le lobby)
          broadcast({
            type: 'SERVER_STATE_UPDATE',
            payload: engine.getState(),
          });

          // Si tous les joueurs sont prêts, lancer la partie (ou la manche suivante)
          const phase = engine.getState().phase;
          const canStart = phase === 'WAITING' || phase === 'GAME_OVER';
          if (canStart && engine.allPlayersReady()) {
            console.log(' Tous les joueurs sont prêts ! Lancement de la partie !');
            engine.start();
            broadcast({
              type: 'SERVER_GAME_START',
              payload: { theme: engine.getState().theme ?? 'URBAN' },
            });
          }
        }
        break;
      }

      case 'CLIENT_INPUT':
      case 'CLIENT_PLACE_BOMB': {
        const playerId = clientMap.get(ws);
        if (playerId) {
          engine.handleClientMessage(playerId, message);
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const playerId = clientMap.get(ws);
    if (!playerId) return;

    engine.removePlayer(playerId);
    clientMap.delete(ws);
    console.log(` Joueur déconnecté (ID: ${playerId})`);

    // Sans ce broadcast, les autres gardent un joueur fantôme jusqu'au prochain tick
    broadcast({
      type: 'SERVER_STATE_UPDATE',
      payload: engine.getState(),
    });
  });

  ws.on('error', (err) => {
    console.error(' Erreur WebSocket :', err);
  });
});
