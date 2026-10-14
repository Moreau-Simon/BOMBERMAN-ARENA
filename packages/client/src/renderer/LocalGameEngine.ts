import { EventBus } from './EventBus';
import {
  MAP_HEIGHT, MAP_WIDTH, TICK_RATE_MS, PHYSICS_DT,
  PLAYER_SPEED, SPAWN_POSITIONS, PLAYER_HITBOX_W, PLAYER_HITBOX_H,
  CORNER_ASSIST_THRESHOLD, BOMB_TIMER_MS, BOMB_RANGE,
  randomTheme, MapTheme,
} from '@bomberman-arena/shared';

export class LocalGameEngine {
  private playerName = 'PLAYER';
  private currentTheme: MapTheme = 'URBAN';
  private gameState: any | null = null;
  private loopHandle: ReturnType<typeof setInterval> | null = null;
  private bombIdCounter = 0;

  private static readonly THEME_MESSAGES: Record<MapTheme, string> = {
    URBAN:       'Bienvenue dans ce chaos.\nSeuls les plus forts survivront.',
    COUNTRYSIDE: 'Bienvenue à la campagne.\nLe calme sera votre meilleur allié.',
  };

  constructor(private eventBus: EventBus) {
    this.eventBus.on('ui:play', (payload: { playerName: string }) => {
      this.playerName = payload.playerName;
    });

    this.eventBus.on('lobby:ready', () => {
      this.currentTheme = randomTheme();
      const message = LocalGameEngine.THEME_MESSAGES[this.currentTheme] ?? 'Bonne chance !';
      this.eventBus.emit('lobby:intro_start', { theme: this.currentTheme, message });
    });

    this.eventBus.on('lobby:intro_end', () => {
      this.startGame();
    });

    this.eventBus.on('game:quit', () => {
      if (this.loopHandle) {
        clearInterval(this.loopHandle);
        this.loopHandle = null;
      }
      this.gameState = null;
      this.bombIdCounter = 0;
      console.log('[LocalGameEngine] Partie arrêtée suite à game:quit');
    });

    // Mouvement
    this.eventBus.on('input:move', (payload: { direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'; state: boolean }) => {
      if (!this.gameState) return;
      const player = this.gameState.players[0];
      if (player) player.activeInputs[payload.direction] = payload.state;
    });

    // Pose de bombe (touche espace)
    this.eventBus.on('input:bomb', () => {
      if (!this.gameState) return;
      const player = this.gameState.players[0];
      if (!player || !player.isAlive) return;
      if (player.bombCount >= player.maxBombs) return;

      const col = Math.round(player.position.x - 0.5);
      const row = Math.round(player.position.y - 0.5);

      // Pas deux bombes sur la même case
      const already = this.gameState.bombs.some((b: any) => b.position.x === col && b.position.y === row);
      if (already) return;

      const bombId = `bomb-${++this.bombIdCounter}`;
      const bomb = {
        id: bombId,
        ownerId: player.id,
        position: { x: col, y: row },
        range: BOMB_RANGE,
        placedAt: Date.now(),
      };

      player.bombCount++;
      this.gameState.bombs.push(bomb);
      console.log(`[LocalGameEngine] Bombe posée en (${col},${row})`);

      // Explosion après BOMB_TIMER_MS
      setTimeout(() => this.explodeBomb(bombId), BOMB_TIMER_MS);
    });
  }

  // ── Explosion ───────────────────────────────────────────────────────
  private explodeBomb(bombId: string): void {
    if (!this.gameState) return;
    const bombIdx = this.gameState.bombs.findIndex((b: any) => b.id === bombId);
    if (bombIdx === -1) return;

    const bomb = this.gameState.bombs[bombIdx];
    this.gameState.bombs.splice(bombIdx, 1);

    // Libérer le compteur du joueur
    const owner = this.gameState.players.find((p: any) => p.id === bomb.ownerId);
    if (owner) owner.bombCount = Math.max(0, owner.bombCount - 1);

    const { x: cx, y: cy } = bomb.position;
    const cells: { x: number; y: number }[] = [{ x: cx, y: cy }];

    // Propager dans les 4 directions
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    for (const { dx, dy } of dirs) {
      for (let i = 1; i <= bomb.range; i++) {
        const nx = cx + dx * i;
        const ny = cy + dy * i;
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) break;
        const cell = this.gameState.map[ny][nx];
        if (cell === 1) break; // mur indestructible : stoppe
        cells.push({ x: nx, y: ny });
        if (cell === 2) {
          this.gameState.map[ny][nx] = 0; // détruire la caisse
          break; // stoppe après la caisse
        }
      }
    }

    // Ajouter les explosions
    const now = Date.now();
    for (const cell of cells) {
      this.gameState.explosions.push({ position: cell, startedAt: now });
    }

    // Tuer les joueurs touchés
    for (const player of this.gameState.players) {
      if (!player.isAlive) continue;
      const px = Math.round(player.position.x - 0.5);
      const py = Math.round(player.position.y - 0.5);
      if (cells.some(c => c.x === px && c.y === py)) {
        player.isAlive = false;
        console.log(`[LocalGameEngine] ${player.name} éliminé !`);
      }
    }

    // Retirer les explosions après 600ms
    setTimeout(() => {
      if (!this.gameState) return;
      this.gameState.explosions = this.gameState.explosions.filter(
        (e: any) => Date.now() - e.startedAt < 600,
      );
    }, 600);
  }

  // ── Démarrage ───────────────────────────────────────────────────────
  private startGame(): void {
    if (this.loopHandle) clearInterval(this.loopHandle);

    const map: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (y % 2 === 1 && x % 2 === 1) {
          row.push(1); // pilier indestructible
        } else {
          const nearSpawn =
            (x <= 1 && y <= 1) ||
            (x >= MAP_WIDTH - 2 && y <= 1) ||
            (x <= 1 && y >= MAP_HEIGHT - 2) ||
            (x >= MAP_WIDTH - 2 && y >= MAP_HEIGHT - 2);
          row.push(nearSpawn ? 0 : 2); // caisse partout sauf spawns
        }
      }
      map.push(row);
    }

    const spawn = { x: 1, y: 1 };
    const player = {
      id: 'local-player',
      name: this.playerName,
      position:  { x: spawn.x, y: spawn.y },
      velocity:  { x: 0, y: 0 },
      direction: 'DOWN' as const,
      isAlive:   true,
      bombCount: 0,
      maxBombs:  1,
      speed:     PLAYER_SPEED,
      activeInputs: { UP: false, DOWN: false, LEFT: false, RIGHT: false },
    };

    this.gameState = {
      map, players: [player], bombs: [], explosions: [],
      phase: 'PLAYING', tick: 0, theme: this.currentTheme,
    };

    this.eventBus.emit('state:update', this.gameState);
    this.eventBus.emit('game:start', { theme: this.currentTheme } as any);
    this.loopHandle = setInterval(() => this.tick(), TICK_RATE_MS);
  }

  // ── Game loop ───────────────────────────────────────────────────────
  private tick(): void {
    if (!this.gameState) return;
    this.gameState.tick++;
    for (const player of this.gameState.players) {
      if (!player.isAlive) continue;
      this.updatePlayer(player, this.gameState.map);
    }
    this.eventBus.emit('state:update', { ...this.gameState, players: [...this.gameState.players] });
  }

  // ── Physique joueur ─────────────────────────────────────────────────
  private updatePlayer(player: any, map: number[][]): void {
    const { UP, DOWN, LEFT, RIGHT } = player.activeInputs;
    let dx = 0, dy = 0;
    if (LEFT)  dx -= 1;
    if (RIGHT) dx += 1;
    if (UP)    dy -= 1;
    if (DOWN)  dy += 1;

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) { dx /= len; dy /= len; }

    if      (dx < 0) player.direction = 'LEFT';
    else if (dx > 0) player.direction = 'RIGHT';
    else if (dy < 0) player.direction = 'UP';
    else if (dy > 0) player.direction = 'DOWN';

    const speed = player.speed * PHYSICS_DT;
    let nx = player.position.x + dx * speed;
    let ny = player.position.y + dy * speed;

    const hw = PLAYER_HITBOX_W / 2;
    const hh = PLAYER_HITBOX_H / 2;

    if (dx !== 0) {
      const edgeX = dx > 0 ? nx + hw : nx - hw;
      const col = Math.floor(edgeX);
      const rowTop    = Math.floor(ny - hh + 0.01);
      const rowBottom = Math.floor(ny + hh - 0.01);
      if (this.isSolid(map, col, rowTop) || this.isSolid(map, col, rowBottom)) {
        const centerRow = Math.round(ny);
        const diff = centerRow - ny;
        if (Math.abs(diff) < CORNER_ASSIST_THRESHOLD) ny += diff * 0.3;
        nx = player.position.x;
      }
    }

    if (dy !== 0) {
      const edgeY = dy > 0 ? ny + hh : ny - hh;
      const row = Math.floor(edgeY);
      const colLeft  = Math.floor(nx - hw + 0.01);
      const colRight = Math.floor(nx + hw - 0.01);
      if (this.isSolid(map, colLeft, row) || this.isSolid(map, colRight, row)) {
        const centerCol = Math.round(nx);
        const diff = centerCol - nx;
        if (Math.abs(diff) < CORNER_ASSIST_THRESHOLD) nx += diff * 0.3;
        ny = player.position.y;
      }
    }

    player.position.x = nx;
    player.position.y = ny;
    player.velocity.x = dx * speed;
    player.velocity.y = dy * speed;
  }

  private isSolid(map: number[][], col: number, row: number): boolean {
    if (row < 0 || row >= MAP_HEIGHT || col < 0 || col >= MAP_WIDTH) return true;
    return map[row][col] !== 0;
  }
}
