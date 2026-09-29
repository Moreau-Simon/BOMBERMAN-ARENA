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
} from '@bomberman-arena/shared';
import { GameEngine } from './GameEngine';

const wss = new WebSocketServer({ port: SERVER_PORT });
const engine = new GameEngine();

/** Map associant chaque WebSocket à l'ID du joueur. */
const clientMap = new Map<WebSocket, string>();
let gameStartTimeout: NodeJS.Timeout | null = null;

console.log(`🎮 [Bomberman Arena] Serveur démarré sur le port ${SERVER_PORT}`);
console.log('   En attente de joueurs...');

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
  console.log('🔌 Nouvelle connexion WebSocket');

  ws.on('message', (data: Buffer) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'CLIENT_JOIN': {
          const playerId = engine.addPlayer(message.payload.playerName);

          if (!playerId) {
            sendToClient(ws, {
              type: 'SERVER_ERROR',
              payload: { message: 'Partie pleine !' },
            });
            return;
          }

          clientMap.set(ws, playerId);
          console.log(`✅ Joueur "${message.payload.playerName}" rejoint (ID: ${playerId})`);

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

          // Lancer le décompte de 30s dès que le 1er joueur se connecte
          if (!gameStartTimeout && engine.getState().phase === 'WAITING') {
            console.log('⏳ Premier joueur rejoint. Lancement de la partie dans 30 secondes...');
            gameStartTimeout = setTimeout(() => {
              console.log('🚀 Lancement de la partie !');
              broadcast({ type: 'SERVER_GAME_START' });
              engine.start();
              gameStartTimeout = null;
            }, 30000);
          }

          // Si la salle est pleine (ex: 4 joueurs), lancer immédiatement
          if (clientMap.size >= 4 && gameStartTimeout) {
            clearTimeout(gameStartTimeout);
            gameStartTimeout = null;
            console.log('🚀 Salle pleine ! Lancement immédiat de la partie !');
            broadcast({ type: 'SERVER_GAME_START' });
            engine.start();
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
    } catch (err) {
      console.error('❌ Message invalide reçu :', err);
    }
  });

  ws.on('close', () => {
    const playerId = clientMap.get(ws);
    if (playerId) {
      engine.removePlayer(playerId);
      clientMap.delete(ws);
      console.log(`🔌 Joueur déconnecté (ID: ${playerId})`);
    }
  });

  ws.on('error', (err) => {
    console.error('❌ Erreur WebSocket :', err);
  });
});
