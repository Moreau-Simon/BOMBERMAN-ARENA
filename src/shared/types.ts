// Définition des types partagés entre le Serveur et le Client

export type Position = {
  x: number;
  y: number;
};

export type PlayerState = {
  id: string;
  position: Position;
  isAlive: boolean;
};

// Messages WebSocket
export type WsMessage = 
  | { type: 'MOVE'; payload: { direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' } }
  | { type: 'PLACE_BOMB' }
  | { type: 'POSITION_UPDATED'; payload: { id: string; position: Position } };
