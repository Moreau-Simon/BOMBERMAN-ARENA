/**
 * @module GameRenderer
 * @description Moteur de rendu Canvas utilisant les vrais sprites
 * de Super Bomberman 3 (SNES) pour un rendu authentique.
 *
 * Spritesheets utilisées :
 * - blockbuster.png : tuiles de la map BlockBuster (sol, murs, caisses)
 * - bomberman.png   : sprites du personnage jouable (marche, idle)
 * - items-effects.png : bombes et explosions
 *
 * Tous les sprites source font 16x16 (tuiles) ou 16x24 (personnages)
 * et sont upscalés au TILE_SIZE (48px) avec imageSmoothingEnabled = false
 * pour conserver le rendu pixel art net.
 */

import { EventBus } from './EventBus';
import { GameState, CellType, PlayerState, Direction } from '@bomberman-arena/shared';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '@bomberman-arena/shared';
import * as path from 'path';


// ─── Chemin vers les assets ─────────────────────────────────────────
const ASSETS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'assets');

/**
 * Table thème → fichier de tuiles de la map.
 * Pour ajouter un nouveau thème : ajouter la valeur dans MAP_THEMES (shared/constants.ts)
 * ET ajouter ici l'entrée + le fichier PNG dans assets/maps/.
 */
const THEME_TILESETS: Record<string, string> = {
  URBAN:       path.join(ASSETS_DIR, 'maps', 'urbain.png'),
  COUNTRYSIDE: path.join(ASSETS_DIR, 'maps', 'campagne.png'),
  // FUTURE: FOREST: path.join(ASSETS_DIR, 'maps', 'forest.png'),
};


// ─── Coordonnées des tuiles dans blockbuster.png (source 16x16) ────
//
// L'image BlockBuster mesure ~256x225 pixels.
// La carte affichée fait 15x13 tuiles (dont une bordure d'1 tuile).
// En bas de l'image, une bande "palette" contient les tuiles isolées.
//
// Disposition de la carte dans l'image :
//   Col 0      : bordure mur gris
//   Col 1..13  : zone de jeu (13 colonnes)
//   Col 14     : bordure mur gris
//   Row 0      : bordure mur gris
//   Row 1..11  : zone de jeu (11 lignes)
//   Row 12     : bordure mur gris
//
// On extrait les tuiles directement depuis la carte :
//   - Mur bordure     : (0, 0)   → coin haut-gauche
//   - Sol herbe        : (16, 16) → première case jouable
//   - Bloc indestructible : (32, 32) → position (1,1) du jeu = indices impairs
//
// Et depuis la bande palette en bas :
//   - Caisse destructible (brique rouge) : (~17, 209)
// ────────────────────────────────────────────────────────────────────

interface SrcRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAP_TILES: Record<string, SrcRect> = {
  /** Mur de bordure extérieure (gris métallique avec rivets) */
  BORDER:         { x: 0,  y: 0,  w: 16, h: 16 },
  /** Sol en herbe verte (motif croisillons du stage BlockBuster) */
  GRASS:          { x: 16, y: 16, w: 16, h: 16 },
  /** Bloc indestructible (carré gris sur fond vert) */
  INDESTRUCTIBLE: { x: 32, y: 32, w: 16, h: 16 },
  /** Caisse destructible (brique rouge/orange) depuis la palette */
  DESTRUCTIBLE:   { x: 17, y: 209, w: 16, h: 16 },
};

// ─── Coordonnées du Bomberman blanc dans bomberman.png ──────────────
//
// Analyse pixel-par-pixel du spritesheet "Playable Characters - Bomberman-2".
// Image : 347×304 px, fond transparent (alpha = 0).
//
// Les frames du Bomberman blanc sont en haut à gauche.
// L'espacement horizontal est IRRÉGULIER (13-15 px par frame avec des
// gaps de 2-3 px). On utilise donc un tableau de positions X fixes.
//
// 3 rangées d'animation de marche (idle = frame 0 de DOWN) :
//   Rangée 0 (y=10..30) : Marche vers le BAS    — 3 frames utiles
//   Rangée 1 (y=35..55) : Marche vers le HAUT   — 3 frames utiles
//   Rangée 2 (y=60..80) : Marche vers la GAUCHE — 3 frames utiles
//   (Pour la DROITE, on utilise GAUCHE + flip horizontal)
// ────────────────────────────────────────────────────────────────────

/** Hauteur d'une frame (pixels source) — identique pour toutes les directions */
const CHAR_FRAME_H = 21;

/** Nombre de frames d'animation par direction (marche cyclique) */
const CHAR_FRAMES_PER_DIR = 3;

/**
 * Position X et largeur de chaque frame dans le spritesheet.
 * Détectées par analyse automatique des colonnes non-transparentes.
 * Les frames 0, 1, 2 sont les 3 poses de marche du Bomberman blanc.
 */
const CHAR_FRAMES_X: { x: number; w: number }[] = [
  { x: 6,  w: 15 },   // Frame 0 : pose neutre / idle
  { x: 23, w: 14 },   // Frame 1 : pied gauche avancé
  { x: 40, w: 15 },   // Frame 2 : pied droit avancé
];

/** Y de départ de chaque direction dans le spritesheet */
const CHAR_DIR_Y: Record<string, number> = {
  DOWN:  10,    // Rangée 0 : marche vers le BAS
  UP:    35,    // Rangée 1 : marche vers le HAUT
  LEFT:  60,    // Rangée 2 : marche vers la GAUCHE
  RIGHT: 60,    // Même rangée que LEFT (flip horizontal appliqué au rendu)
};

/** Taille de rendu du personnage sur le canvas (upscale pixel art) */
const CHAR_RENDER_W = 42;
const CHAR_RENDER_H = 58;

// ─── Coordonnées des bombes dans items-effects.png ──────────────────
//
// En haut à gauche de l'image, on trouve les sprites de bombes
// (petites sphères noires/bleues). 3 frames pour l'animation
// de "tic-tac" (la bombe pulse).
// ────────────────────────────────────────────────────────────────────

const BOMB_FRAMES: SrcRect[] = [
  { x: 1,  y: 3,  w: 14, h: 15 },
  { x: 18, y: 2,  w: 15, h: 16 },
  { x: 35, y: 1,  w: 16, h: 17 },
];

// ─── Coordonnées des explosions dans items-effects.png ──────────────
//
// Les explosions sont les grandes croix de flammes sur la droite.
// Chaque croix = 1 phase d'animation.
// On découpe les morceaux : centre, bras horizontal, bras vertical,
// et bouts (extrémités).
// ────────────────────────────────────────────────────────────────────

const EXPLOSION_CENTER: SrcRect = { x: 146, y: 52, w: 16, h: 16 };
const EXPLOSION_H: SrcRect = { x: 146, y: 68, w: 16, h: 16 };  // bras horizontal
const EXPLOSION_V: SrcRect = { x: 146, y: 36, w: 16, h: 16 };  // bras vertical

// ─── Dimensions du canvas avec bordures ────────────────────────────
const CANVAS_W = (MAP_WIDTH + 2) * TILE_SIZE;   // 15 * 48 = 720
const CANVAS_H = (MAP_HEIGHT + 2) * TILE_SIZE;  // 13 * 48 = 624
const OFFSET_X = TILE_SIZE;  // Décalage X pour la bordure gauche
const OFFSET_Y = TILE_SIZE;  // Décalage Y pour la bordure haute

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentState: GameState | null = null;
  private playerId: string | null = null;
  private showDebug: boolean = false;
  private currentTheme: string = 'URBAN';

  // ─── Spritesheets ─────────────────────────────────────────────
  private mapImg!: HTMLImageElement;
  private charImg!: HTMLImageElement;
  private effectsImg!: HTMLImageElement;
  private imagesLoaded = 0;
  private readonly totalImages = 3;

  // ─── Animation ────────────────────────────────────────────────
  private animFrame = 0;
  private lastAnimTime = 0;
  private lastPositions: Map<string, { x: number; y: number }> = new Map();
  private playerMoving: Map<string, boolean> = new Map();

  constructor(private eventBus: EventBus) {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Taille du canvas = zone de jeu + 2 tuiles de bordure
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;

    // CRUCIAL : désactiver l'anti-aliasing pour le pixel art
    this.ctx.imageSmoothingEnabled = false;

    // Charger les 3 spritesheets
    this.mapImg = this.loadImage(THEME_TILESETS['URBAN']);
    this.charImg = this.loadImage(path.join(ASSETS_DIR, 'mobs', 'bomberman.png'));
    this.effectsImg = this.loadImage(path.join(ASSETS_DIR, 'effects', 'items-effects.png'));

    this.subscribeToEvents();
    this.startRenderLoop();
  }

  /**
   * Charge une image et incrémente le compteur de chargement.
   */
  private loadImage(filePath: string): HTMLImageElement {
    const img = new Image();
    img.src = filePath;
    img.onload = () => {
      this.imagesLoaded++;
      console.log(`[GameRenderer] ✅ Sprite chargé (${this.imagesLoaded}/${this.totalImages}): ${path.basename(filePath)}`);
    };
    img.onerror = () => {
      console.error(`[GameRenderer] ❌ Erreur de chargement: ${filePath}`);
    };
    return img;
  }

  /**
   * S'abonne aux événements du bus pour recevoir l'état du jeu.
   */
  private subscribeToEvents(): void {
    this.eventBus.on('state:update', (state) => {
      this.currentState = state;
    });

    // Quand la partie démarre, recharger le tileset selon le thème choisi
    this.eventBus.on('game:start', (payload: any) => {
      const theme: string = payload?.theme ?? 'URBAN';
      if (theme !== this.currentTheme) {
        console.log(`[GameRenderer] Changement de thème : ${this.currentTheme} → ${theme}`);
        this.currentTheme = theme;
        this.reloadMapTileset(theme);
      }
      console.log('[GameRenderer] game:start reçu, thème =', theme);
    });

    this.eventBus.on('network:connected', (payload) => {
      this.playerId = payload.playerId;
    });

    this.eventBus.on('input:toggle_debug', () => {
      this.showDebug = !this.showDebug;
    });

    this.eventBus.on('game:quit', () => {
      this.currentState = null;
      this.lastPositions.clear();
      this.playerMoving.clear();
    });
  }

  /** Recharge le tileset de la map selon le thème. */
  private reloadMapTileset(theme: string): void {
    const tilesetPath = THEME_TILESETS[theme] ?? THEME_TILESETS['URBAN'];
    this.imagesLoaded--; // on va recharger 1 image
    const img = new Image();
    img.src = tilesetPath;
    img.onload = () => {
      this.imagesLoaded++;
      console.log(`[GameRenderer] ✅ Tileset rechargé pour thème "${theme}"`);
    };
    img.onerror = () => console.error(`[GameRenderer] ❌ Tileset introuvable pour "${theme}": ${tilesetPath}`);
    this.mapImg = img;
  }

  /**
   * Boucle de rendu à ~60 FPS via requestAnimationFrame.
   */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      // Cycle d'animation : change de frame toutes les 180ms
      if (time - this.lastAnimTime > 180) {
        this.animFrame = (this.animFrame + 1) % CHAR_FRAMES_PER_DIR;
        this.lastAnimTime = time;
      }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS DE DESSIN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine une portion d'un spritesheet sur le canvas.
   * Supporte le flip horizontal (pour le mouvement DROITE).
   */
  private drawSprite(
    img: HTMLImageElement,
    src: SrcRect,
    destX: number,
    destY: number,
    destW: number = TILE_SIZE,
    destH: number = TILE_SIZE,
    flipH: boolean = false,
  ): void {
    if (!img.complete || !img.naturalWidth) return;

    if (flipH) {
      this.ctx.save();
      this.ctx.translate(destX + destW, destY);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, destW, destH);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(img, src.x, src.y, src.w, src.h, destX, destY, destW, destH);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════════

  private render(): void {
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Fond noir pour les zones hors carte
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!this.currentState || this.imagesLoaded < this.totalImages) {
      this.renderLoading();
      return;
    }

    this.renderBorderWalls();
    this.renderMap(this.currentState.map);
    this.renderBombs(this.currentState);
    this.renderExplosions(this.currentState);
    
    // Afficher l'overlay de debug seulement si activé (touche F3)
    if (this.showDebug) {
      this.renderDebugInfo(this.currentState);
    }

    try {
      this.renderPlayers(this.currentState);
    } catch (e: any) {
      this.ctx.fillStyle = 'red';
      this.ctx.font = '14px monospace';
      this.ctx.fillText(`Erreur renderPlayers: ${e.message}`, 20, 100);
    }
  }

  private renderDebugInfo(state: GameState): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 300, 80);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    
    this.ctx.fillText(`Local Player ID: ${this.playerId}`, 15, 25);
    this.ctx.fillText(`Players count: ${state.players.length}`, 15, 40);
    
    if (state.players.length > 0) {
      const p = state.players[0];
      this.ctx.fillText(`P1 Pos: ${p.position?.x}, ${p.position?.y}`, 15, 55);
      this.ctx.fillText(`P1 Alive: ${p.isAlive}`, 15, 70);
    }
  }

  /**
   * Écran de chargement / attente du serveur avec animation du Bomberman.
   */
  private renderLoading(): void {
    const text = this.imagesLoaded < this.totalImages
      ? `Chargement des sprites... (${this.imagesLoaded}/${this.totalImages})`
      : 'En attente du serveur...';

    const centerX = CANVAS_W / 2;
    const centerY = CANVAS_H / 2;

    // Si le sprite du personnage est chargé, on l'affiche animé en train de marcher
    if (this.charImg && this.charImg.complete && this.charImg.naturalWidth > 0) {
      const frameData = CHAR_FRAMES_X[this.animFrame % CHAR_FRAMES_X.length] || CHAR_FRAMES_X[0];
      const srcX = frameData.x;
      const srcY = CHAR_DIR_Y.DOWN;
      const srcW = frameData.w;
      const srcH = CHAR_FRAME_H;

      // Ombre sous les pieds
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY - 15, 24, 8, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Dessiner Bomberman animé (taille mise en valeur)
      const scale = 1.3;
      const drawW = CHAR_RENDER_W * scale;
      const drawH = CHAR_RENDER_H * scale;

      this.drawSprite(
        this.charImg,
        { x: srcX, y: srcY, w: srcW, h: srcH },
        centerX - drawW / 2,
        centerY - drawH - 10,
        drawW,
        drawH,
        false
      );
    }

    this.ctx.fillStyle = '#e94560';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, centerX, centerY + 25);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU DE LA MAP
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine la bordure de murs extérieurs autour de la zone jouable.
   * Reproduit le cadre gris métallique du stage BlockBuster.
   */
  private renderBorderWalls(): void {
    // Rangée du haut et du bas
    for (let x = 0; x < MAP_WIDTH + 2; x++) {
      this.drawSprite(this.mapImg, MAP_TILES.BORDER, x * TILE_SIZE, 0);
      this.drawSprite(this.mapImg, MAP_TILES.BORDER, x * TILE_SIZE, (MAP_HEIGHT + 1) * TILE_SIZE);
    }
    // Colonne gauche et droite (sans les coins, déjà dessinés)
    for (let y = 1; y <= MAP_HEIGHT; y++) {
      this.drawSprite(this.mapImg, MAP_TILES.BORDER, 0, y * TILE_SIZE);
      this.drawSprite(this.mapImg, MAP_TILES.BORDER, (MAP_WIDTH + 1) * TILE_SIZE, y * TILE_SIZE);
    }
  }

  /**
   * Dessine la zone jouable : sol vert + blocs + caisses.
   * Chaque case est d'abord remplie d'herbe, puis le bloc/caisse
   * est dessiné par-dessus si nécessaire.
   */
  private renderMap(map: CellType[][]): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const destX = OFFSET_X + x * TILE_SIZE;
        const destY = OFFSET_Y + y * TILE_SIZE;

        // 1. Toujours dessiner le sol en herbe d'abord
        this.drawSprite(this.mapImg, MAP_TILES.GRASS, destX, destY);

        // 2. Dessiner les obstacles par-dessus
        const cell = map[y][x];
        if (cell === 1) {
          // Bloc indestructible (béton gris)
          this.drawSprite(this.mapImg, MAP_TILES.INDESTRUCTIBLE, destX, destY);
        } else if (cell === 2) {
          // Caisse destructible (brique rouge)
          this.drawSprite(this.mapImg, MAP_TILES.DESTRUCTIBLE, destX, destY);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU DES JOUEURS (Bomberman animé)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine les joueurs avec le vrai sprite Bomberman.
   * Utilise l'interpolation (Exponential Smoothing) pour un rendu fluide.
   */
  private renderPlayers(state: GameState): void {
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (!player.isAlive) continue;

      // 1. Interpolation fluide (Lissage exponentiel)
      let renderPos = this.lastPositions.get(player.id);
      if (!renderPos) {
        // Première fois qu'on voit le joueur, on snap à sa position
        renderPos = { x: player.position.x, y: player.position.y };
      } else {
        // Lissage : on rapproche la position affichée de la vraie position serveur
        // 0.3 est le facteur de lissage (plus proche de 1 = plus rigide, proche de 0 = plus "glissant")
        renderPos.x += (player.position.x - renderPos.x) * 0.4;
        renderPos.y += (player.position.y - renderPos.y) * 0.4;
      }
      this.lastPositions.set(player.id, renderPos);

      // 2. Détection du mouvement pour l'animation (avec fallback de sécurité)
      const vx = player.velocity?.x || 0;
      const vy = player.velocity?.y || 0;
      const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;
      const frame = isMoving ? this.animFrame : 0;
      const direction = player.direction || 'DOWN';
      const flipH = direction === 'RIGHT';

      // Frame source dans le spritesheet
      const frameData = CHAR_FRAMES_X[frame % CHAR_FRAMES_X.length] || CHAR_FRAMES_X[0];
      const srcX = frameData.x;
      const srcY = CHAR_DIR_Y[direction] || CHAR_DIR_Y.DOWN;
      const srcW = frameData.w;
      const srcH = CHAR_FRAME_H;

      // Position de destination : renderPos représente le CENTRE du joueur (ex: 0.5, 0.5).
      // On calcule les pixels du centre, puis on recule de la moitié de la taille du sprite.
      const pixelX = OFFSET_X + renderPos.x * TILE_SIZE;
      const pixelY = OFFSET_Y + renderPos.y * TILE_SIZE;

      // Le Bomberman est plus haut que large, on centre horizontalement
      // et on s'arrange pour que ses pieds (bas du sprite) touchent le bas de sa hitbox.
      const destX = pixelX - CHAR_RENDER_W / 2;
      const destY = pixelY - CHAR_RENDER_H / 2 - 4; // petit ajustement visuel (-4) pour la hauteur

      this.drawSprite(
        this.charImg,
        { x: srcX, y: srcY, w: srcW, h: srcH },
        destX, destY,
        CHAR_RENDER_W, CHAR_RENDER_H,
        flipH,
      );

      // Cadre doré pour le joueur local (centré sur le joueur)
      if (player.id === this.playerId) {
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
          pixelX - TILE_SIZE / 2 + 3,
          pixelY - TILE_SIZE / 2 + 3,
          TILE_SIZE - 6,
          TILE_SIZE - 6,
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU DES BOMBES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine les bombes actives avec l'animation de "tic-tac" (pulsation).
   * Utilise les sprites de bombe de items-effects.png.
   */
  private renderBombs(state: GameState): void {
    for (const bomb of state.bombs) {
      const destX = OFFSET_X + bomb.position.x * TILE_SIZE;
      const destY = OFFSET_Y + bomb.position.y * TILE_SIZE;

      // Cycle entre les 3 frames de bombe pour l'effet pulsant
      const bombSrc = BOMB_FRAMES[this.animFrame % BOMB_FRAMES.length];
      this.drawSprite(this.effectsImg, bombSrc, destX + 4, destY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU DES EXPLOSIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine les explosions actives.
   * Utilise le sprite du centre de l'explosion + un overlay de couleur pulsant.
   */
  private renderExplosions(state: GameState): void {
    for (const explosion of state.explosions) {
      const destX = OFFSET_X + explosion.position.x * TILE_SIZE;
      const destY = OFFSET_Y + explosion.position.y * TILE_SIZE;

      // Sprite d'explosion depuis items-effects.png
      this.drawSprite(this.effectsImg, EXPLOSION_CENTER, destX, destY);

      // Overlay pulsant par-dessus pour l'effet de chaleur
      const alpha = 0.3 + Math.sin(Date.now() / 60) * 0.2;
      this.ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
      this.ctx.fillRect(destX, destY, TILE_SIZE, TILE_SIZE);
    }
  }
}
