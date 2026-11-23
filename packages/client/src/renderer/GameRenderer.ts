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
import { GameState, CellType, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, EXPLOSION_DURATION_TICKS } from '@bomberman-arena/shared';
import * as path from 'path';
import * as fs from 'fs';


// ─── Chemin vers les assets ─────────────────────────────────────────
const ASSETS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'assets');

/**
 * Table thème → fichier de tuiles de la map.
 * Pour ajouter un nouveau thème : ajouter la valeur dans MAP_THEMES (shared/constants.ts)
 * ET ajouter ici l'entrée + le fichier PNG dans assets/maps/.
 */
const THEME_TILESETS: Record<string, string> = {
  URBAN:       path.join(ASSETS_DIR, 'maps', 'urbain.png'),
  CAMPAGNE: path.join(ASSETS_DIR, 'maps', 'campagne.png'),
  // FUTURE: FOREST: path.join(ASSETS_DIR, 'maps', 'forest.png'),
};

/**
 * Thèmes dessinés comme une image de carte entière, et non comme une planche
 * de tuiles. `x`/`y` donnent le coin haut-gauche de la première case jouable
 * dans l'image, `pitch` la taille d'une case dans l'image en pixels.
 * Le reste de l'image est du décor, affiché autour de l'arène.
 */
const THEME_ARENAS: Record<string, { x: number; y: number; pitch: number }> = {
  CAMPAGNE: { x: 99, y: 55, pitch: 45 },
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

// ─── Coordonnées exactes des bombes dans items-effects.png ──────────
// Mesurées au pixel près (sprites 16x16 purs, sans décalage) :
const BOMB_FRAMES: SrcRect[] = [
  { x: 4,  y: 7, w: 16, h: 16 }, // Bombe normale
  { x: 19, y: 7, w: 17, h: 16 }, // Bombe pulsation moyenne
  { x: 36, y: 7, w: 16, h: 16 }, // Bombe pulsation large
];

// ─── Coordonnées des 4 frames d'explosion dans items-effects.png ────
// Grille SNES 16x16 de droite à gauche :
const EXPLOSION_FRAMES: SrcRect[] = [
  { x: 144, y: 48, w: 16, h: 16 }, // 0: étincelle initiale
  { x: 112, y: 48, w: 16, h: 16 }, // 1: déploiement
  { x: 80,  y: 48, w: 16, h: 16 }, // 2: flamme pleine
  { x: 48,  y: 48, w: 16, h: 16 }, // 3: dissipation
];

// ─── Coordonnées exactes des 7 sprites de poubelle (poubelle.png) ────
// Mesurées au pixel près d'après le spritesheet source (800x600) :
// Les poubelles reposent toutes à Y = 90 (le sol).
const POUBELLE_FRAMES: SrcRect[] = [
  { x: 49,  y: 45, w: 37, h: 46 }, // 0: poubelle intacte fermée
  { x: 94,  y: 45, w: 35, h: 46 }, // 1: secousse / ouverture 1
  { x: 141, y: 45, w: 34, h: 46 }, // 2: secousse / ouverture 2
  { x: 185, y: 45, w: 34, h: 46 }, // 3: ouverture 3
  { x: 229, y: 55, w: 46, h: 36 }, // 4: écrasement 1
  { x: 284, y: 55, w: 46, h: 36 }, // 5: écrasement 2
  { x: 337, y: 60, w: 46, h: 31 }, // 6: tas de débris au sol
];

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
  /** Planche urbaine, utilisée pour les caisses des thèmes en mode fond de carte. */
  private crateImg!: HTMLImageElement;
  private charImg!: HTMLImageElement;
  private effectsImg!: HTMLImageElement;
  private poubelleImg!: HTMLImageElement;
  private poubelleCanvas: HTMLCanvasElement | null = null;
  private imagesLoaded = 0;
  private readonly totalImages = 5;

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

    // Charger les spritesheets
    this.mapImg = this.loadImage(THEME_TILESETS['URBAN']);
    this.crateImg = this.loadImage(THEME_TILESETS['URBAN']);
    this.charImg = this.loadImage(path.join(ASSETS_DIR, 'mobs', 'bomberman.png'));
    this.effectsImg = this.loadImage(path.join(ASSETS_DIR, 'effects', 'items-effects.png'));
    this.poubelleImg = this.loadImage(path.join(ASSETS_DIR, 'blocks', 'poubelle.png'), () => {
      this.preprocessPoubelleImage();
    });

    this.subscribeToEvents();
    this.startRenderLoop();
  }

  /**
   * Pré-traite poubelle.png : supprime le fond blanc (→ transparent).
   * Stocke le résultat directement dans poubelleCanvas pour un rendu instantané.
   */
  private preprocessPoubelleImage(): void {
    const img = this.poubelleImg;
    if (!img.naturalWidth || !img.naturalHeight) return;

    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cCtx = c.getContext('2d', { willReadFrequently: true });
      if (!cCtx) return;

      cCtx.drawImage(img, 0, 0);
      const imageData = cCtx.getImageData(0, 0, c.width, c.height);
      const data = imageData.data;

      // Remplacer les pixels blancs / quasi-blancs par du transparent
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
          data[i + 3] = 0;
        }
      }

      cCtx.putImageData(imageData, 0, 0);
      this.poubelleCanvas = c;
      console.log('[GameRenderer] 🗑️ Fond blanc de poubelle.png supprimé avec succès !');
    } catch (e) {
      console.warn('[GameRenderer] Preprocessing poubelle échoué, utilisation de l\'original :', e);
    }
  }

  /**
   * Charge une image et incrémente le compteur de chargement.
   * Utilise une Data URI base64 pour éviter le tainting du canvas par Electron / Chromium.
   */
  private loadImage(filePath: string, onLoaded?: () => void): HTMLImageElement {
    const img = new Image();

    img.onload = () => {
      this.imagesLoaded++;
      console.log(`[GameRenderer] ✅ Sprite chargé (${this.imagesLoaded}/${this.totalImages}): ${path.basename(filePath)}`);
      if (onLoaded) onLoaded();
    };
    img.onerror = () => {
      this.imagesLoaded++;
      console.error(`[GameRenderer] ❌ Erreur de chargement: ${filePath}`);
    };

    try {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        const b64 = fs.readFileSync(filePath).toString('base64');
        img.src = `data:${mime};base64,${b64}`;
      } else {
        img.src = filePath;
      }
    } catch {
      img.src = filePath;
    }

    return img;
  }

  /**
   * S'abonne aux événements du bus pour recevoir l'état du jeu.
   */
  private subscribeToEvents(): void {
    this.eventBus.on('state:update', (state) => {
      this.currentState = state;
      if (state.theme && state.theme !== this.currentTheme) {
        this.currentTheme = state.theme;
        this.reloadMapTileset(state.theme);
      }
    });

    // Quand la partie démarre, recharger le tileset selon le thème choisi
    this.eventBus.on('game:start', (payload) => {
      const theme = payload?.theme ?? this.currentState?.theme ?? 'URBAN';
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

  /** Recharge le tileset de la map selon le thème (base64 pour Electron). */
  private reloadMapTileset(theme: string): void {
    const tilesetPath = THEME_TILESETS[theme] ?? THEME_TILESETS['URBAN'];
    this.imagesLoaded--; // on va recharger 1 image
    this.mapImg = this.loadImage(tilesetPath, () => {
      console.log(`[GameRenderer] ✅ Tileset rechargé pour thème "${theme}"`);
    });
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

    // Un thème en mode fond de carte apporte son propre décor : pas de bordure
    if (!THEME_ARENAS[this.currentTheme]) {
      this.renderBorderWalls();
    }
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
   * Dessine la zone jouable : sol vert + blocs + caisses / poubelles.
   * Chaque case est d'abord remplie d'herbe, puis le bloc/caisse
   * est dessiné par-dessus si nécessaire.
   */
  private renderMap(map: CellType[][]): void {
    const arena = THEME_ARENAS[this.currentTheme];
    if (arena) {
      this.renderArenaBackground(arena, map);
      return;
    }

    const isUrban = this.currentTheme === 'URBAN';
    const crates = this.currentState?.crates;

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
          if (isUrban) {
            // En thème urbain : toujours dessiner une poubelle (drawPoubelle gère son propre fallback)
            const crate = crates?.find((c: any) => c.x === x && c.y === y);
            this.drawPoubelle(destX, destY, crate);
          } else {
            // Caisse destructible classique (brique rouge)
            this.drawSprite(this.mapImg, MAP_TILES.DESTRUCTIBLE, destX, destY);
          }
        }
      }
    }
  }

  /**
   * Dessine un thème fourni sous forme d'image de carte entière.
   * L'image est mise à l'échelle pour que ses cases jouables tombent pile
   * sur l'arène ; ce qui déborde reste visible et sert de décor.
   */
  private renderArenaBackground(
    arena: { x: number; y: number; pitch: number },
    map: CellType[][],
  ): void {
    const img = this.mapImg;
    if (!img.complete || !img.naturalWidth) return;

    const scale = TILE_SIZE / arena.pitch;
    const dx = OFFSET_X - arena.x * scale;
    const dy = OFFSET_Y - arena.y * scale;
    this.ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);

    // Les caisses ne sont pas peintes dans l'image : elles sont posées par-dessus
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (map[y][x] !== 2) continue;
        this.drawSprite(
          this.crateImg,
          MAP_TILES.DESTRUCTIBLE,
          OFFSET_X + x * TILE_SIZE,
          OFFSET_Y + y * TILE_SIZE,
        );
      }
    }
  }

  /**
   * Dessine une poubelle urbaine selon son état (intacte, en feu, au sol, ou transition de destruction).
   * Parfaitement centrée horizontalement sur la case 48x48 et posée au sol.
   */
  private drawPoubelle(destX: number, destY: number, crate?: any): void {
    const imgSource: CanvasImageSource = this.poubelleCanvas || this.poubelleImg;
    if (!imgSource) {
      this.ctx.fillStyle = '#5a6a5a';
      this.ctx.fillRect(destX + 8, destY + 6, TILE_SIZE - 16, TILE_SIZE - 10);
      return;
    }

    let frameIndex = 0;
    if (crate) {
      if (crate.animState === 'BURNING') {
        frameIndex = 1 + (Math.floor(Date.now() / 150) % 3);
      } else if (crate.animState === 'GROUND') {
        frameIndex = 4 + (Math.floor(Date.now() / 180) % 3);
      } else if (crate.animState === 'DESTROYING') {
        const elapsed = Date.now() - (crate.stateChangedAt || Date.now());
        const progress = Math.min(1, Math.max(0, elapsed / 450));
        frameIndex = Math.min(6, 1 + Math.floor(progress * 6));
      } else {
        frameIndex = 0;
      }
    }

    frameIndex = Math.min(Math.max(0, frameIndex), POUBELLE_FRAMES.length - 1);
    const frame = POUBELLE_FRAMES[frameIndex];

    // Dimensions réelles du sprite pixel art
    const drawW = frame.w;
    const drawH = frame.h;

    // Centrage horizontal parfait sur la case 48x48
    const drawX = destX + Math.round((TILE_SIZE - drawW) / 2);
    // Alignement au bas de la case pour reposer naturellement sur le sol
    const drawY = destY + (TILE_SIZE - drawH) - 1;

    try {
      this.ctx.drawImage(
        imgSource,
        frame.x, frame.y, frame.w, frame.h,
        drawX, drawY, drawW, drawH,
      );
    } catch {
      // Fallback si l'image n'est pas encore prête
      this.ctx.fillStyle = '#5a6a5a';
      this.ctx.fillRect(destX + 8, destY + 6, TILE_SIZE - 16, TILE_SIZE - 10);
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
        renderPos = { x: player.position.x, y: player.position.y };
      } else {
        renderPos.x += (player.position.x - renderPos.x) * 0.4;
        renderPos.y += (player.position.y - renderPos.y) * 0.4;
      }
      this.lastPositions.set(player.id, renderPos);

      // 2. Détection du mouvement pour l'animation
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

      // pixelX et pixelY sont au centre de la hitbox du joueur
      const pixelX = OFFSET_X + renderPos.x * TILE_SIZE;
      const pixelY = OFFSET_Y + renderPos.y * TILE_SIZE;

      // Centrage horizontal parfait
      const destX = Math.round(pixelX - CHAR_RENDER_W / 2);
      // Pieds posés au sol de la case (1px de marge sur le bas de la tuile)
      const destY = Math.round(pixelY + (TILE_SIZE / 2) - CHAR_RENDER_H - 1);

      this.drawSprite(
        this.charImg,
        { x: srcX, y: srcY, w: srcW, h: srcH },
        destX, destY,
        CHAR_RENDER_W, CHAR_RENDER_H,
        flipH,
      );

      // Indicateur visuel : pseudo du joueur
      const isLocal = this.playerId !== null ? player.id === this.playerId : i === 0;
      if (state.players.length > 1 || isLocal) {
        const tagText = (player.name || '').trim() || `P${i + 1}`;
        const tagColor = isLocal ? '#38ef7d' : '#ff4757';

        // Si le joueur est en haut de la map, afficher en dessous pour ne pas couper
        const nearTop = renderPos.y < 1;
        const tagY = nearTop ? (destY + CHAR_RENDER_H + 12) : (destY - 4);

        this.ctx.save();
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = tagColor;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(tagText, pixelX, tagY);
        this.ctx.fillText(tagText, pixelX, tagY);
        this.ctx.restore();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU DES BOMBES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine les bombes actives avec l'animation de pulsation.
   * Parfaitement centrées dans la case 48x48.
   */
  private renderBombs(state: GameState): void {
    const bombSize = 40; // 40px dans une case 48px = 4px de marge de chaque côté
    for (const bomb of state.bombs) {
      const cellX = OFFSET_X + bomb.position.x * TILE_SIZE;
      const cellY = OFFSET_Y + bomb.position.y * TILE_SIZE;

      const destX = cellX + Math.round((TILE_SIZE - bombSize) / 2);
      const destY = cellY + Math.round((TILE_SIZE - bombSize) / 2);

      // Cycle entre les 3 frames de bombe pour l'effet pulsant
      const bombSrc = BOMB_FRAMES[this.animFrame % BOMB_FRAMES.length];
      this.drawSprite(this.effectsImg, bombSrc, destX, destY, bombSize, bombSize);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU DES EXPLOSIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dessine les explosions actives avec animation de flamme évolutive.
   * Cadrées pleine case sur chaque tuile touchée.
   */
  private renderExplosions(state: GameState): void {
    for (const explosion of state.explosions) {
      const destX = OFFSET_X + explosion.position.x * TILE_SIZE;
      const destY = OFFSET_Y + explosion.position.y * TILE_SIZE;

      // Frame animée selon la progression de l'explosion, en ticks
      const elapsedTicks = Math.max(0, state.tick - explosion.startedAtTick);
      const progress = Math.min(1, elapsedTicks / EXPLOSION_DURATION_TICKS);
      const frameIdx = Math.min(
        EXPLOSION_FRAMES.length - 1,
        Math.floor(progress * EXPLOSION_FRAMES.length)
      );
      const flameSrc = EXPLOSION_FRAMES[frameIdx];

      // Rendu du sprite de flamme pleine tuile
      this.drawSprite(this.effectsImg, flameSrc, destX, destY, TILE_SIZE, TILE_SIZE);

      // Halo de chaleur lumineux
      const alpha = Math.max(0, 0.25 - progress * 0.2);
      this.ctx.fillStyle = `rgba(255, 180, 0, ${alpha})`;
      this.ctx.fillRect(destX, destY, TILE_SIZE, TILE_SIZE);
    }
  }
}
