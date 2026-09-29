import { WebSocketServer } from 'ws';
// Import direct depuis le dossier shared, pas besoin de compiler shared séparément !
import { WsMessage } from '../shared/types';

const port = 8080;
const wss = new WebSocketServer({ port });

console.log(`Serveur prêt sur le port ${port}`);

wss.on('connection', (ws) => {
  console.log('Un joueur est connecté !');

  ws.on('message', (data) => {
    // Exemple basique
    console.log(`Message reçu : ${data}`);
  });
});
