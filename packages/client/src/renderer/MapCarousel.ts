/**
 * @module MapCarousel
 * @description Carrousel affiché entre le lobby et l'intro : les deux arènes
 * défilent sur une piste qui ralentit, puis s'arrête sur le thème réellement
 * attribué à la manche.
 *
 * Version simple : une seule transition CSS sur translateX, pas de boucle
 * d'animation. Chaque vignette est une mini-arène 13x11 dessinée avec les
 * tuiles du thème.
 */

import { EventBus } from './EventBus';
import { MAP_WIDTH, MAP_HEIGHT, MapTheme } from '@bomberman-arena/shared';
import * as path from 'path';
import * as fs from 'fs';

const ASSETS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'assets');
const URBAN_PATH = path.join(ASSETS_DIR, 'maps', 'urbain.png');
const CAMPAGNE_PATH = path.join(ASSETS_DIR, 'maps', 'campagne.png');

const TILE = 20;
const PANEL_W = MAP_WIDTH * TILE;   // 260
const PANEL_H = MAP_HEIGHT * TILE;  // 220
const GAP = 20;
const PITCH = PANEL_W + GAP;
const VIEWPORT_W = 300;

/** Assez de vignettes pour ne jamais voir de vide sur les bords. */
const PANEL_COUNT = 8;
/** Départ au 3e panneau : il y a de la marge à gauche. */
const START_INDEX = 2;

const SPIN_MS = 2200;
const HOLD_MS = 500;

/** Même cadrage que GameRenderer pour le fond de carte campagne. */
const CAMPAGNE_ARENA = { x: 99, y: 55, pitch: 45 };

const GRASS = { x: 16, y: 16, w: 16, h: 16 };
const WALL = { x: 32, y: 32, w: 16, h: 16 };

const ACCENTS: Record<MapTheme, string> = {
  URBAN: '#ff6b35',
  CAMPAGNE: '#2ed573',
};

const LABELS: Record<MapTheme, string> = {
  URBAN: 'ARÈNE URBAINE',
  CAMPAGNE: 'ARÈNE CAMPAGNE',
};

interface Panel {
  el: HTMLDivElement;
  ctx: CanvasRenderingContext2D;
  theme: MapTheme;
}

export class MapCarousel {
  private overlayEl: HTMLDivElement;
  private stripEl: HTMLDivElement;
  private labelEl: HTMLDivElement;
  private panels: Panel[] = [];
  private timeouts: number[] = [];
  private landingIndex = 4;

  private urbanImg: HTMLImageElement;
  private campagneImg: HTMLImageElement;

  constructor(
    private eventBus: EventBus,
    private theme: MapTheme,
    private message: string,
  ) {
    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'map-carousel-overlay';
    this.overlayEl.style.position = 'fixed';
    this.overlayEl.style.top = '0';
    this.overlayEl.style.left = '0';
    this.overlayEl.style.width = '100%';
    this.overlayEl.style.height = '100%';
    this.overlayEl.style.background = 'rgba(8, 12, 20, 0.65)';
    this.overlayEl.style.backdropFilter = 'blur(5px)';
    this.overlayEl.style.display = 'flex';
    this.overlayEl.style.alignItems = 'center';
    this.overlayEl.style.justifyContent = 'center';
    this.overlayEl.style.zIndex = '1000';
    this.overlayEl.style.fontFamily = "'Inter', sans-serif";
    this.overlayEl.style.textAlign = 'center';
    this.overlayEl.style.opacity = '0';
    this.overlayEl.style.transition = 'opacity 0.3s ease';

    // Même habillage que .lobby-container
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.gap = '20px';
    card.style.background = 'rgba(15, 23, 42, 0.88)';
    card.style.border = '2px solid rgba(255, 211, 42, 0.4)';
    card.style.borderRadius = '16px';
    card.style.padding = '26px 28px';
    card.style.boxShadow = '0 0 35px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 211, 42, 0.2)';

    const title = document.createElement('div');
    title.innerText = "TIRAGE DE L'ARÈNE";
    title.style.fontFamily = "'PressStart', monospace";
    title.style.fontSize = '14px';
    title.style.letterSpacing = '3px';
    title.style.color = '#ffd32a';
    title.style.textShadow = '0 0 15px rgba(255, 211, 42, 0.6)';
    card.appendChild(title);

    // Fenêtre qui masque le débordement de la piste
    const viewport = document.createElement('div');
    viewport.style.position = 'relative';
    viewport.style.width = `${VIEWPORT_W}px`;
    viewport.style.height = `${PANEL_H}px`;
    viewport.style.overflow = 'hidden';
    viewport.style.borderRadius = '10px';
    viewport.style.maskImage = 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)';
    viewport.style.webkitMaskImage = 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)';

    this.stripEl = document.createElement('div');
    this.stripEl.style.display = 'flex';
    this.stripEl.style.gap = `${GAP}px`;
    this.stripEl.style.transform = `translateX(${this.offsetFor(START_INDEX)}px)`;
    viewport.appendChild(this.stripEl);
    card.appendChild(viewport);

    this.labelEl = document.createElement('div');
    this.labelEl.innerText = 'URBAIN  VS  CAMPAGNE';
    this.labelEl.style.fontFamily = "'PressStart', monospace";
    this.labelEl.style.fontSize = '11px';
    this.labelEl.style.letterSpacing = '2px';
    this.labelEl.style.color = '#ced6e0';
    card.appendChild(this.labelEl);

    this.overlayEl.appendChild(card);
    document.body.appendChild(this.overlayEl);

    this.urbanImg = this.loadImage(URBAN_PATH);
    this.campagneImg = this.loadImage(CAMPAGNE_PATH);
    this.buildPanels();
    this.drawAll();

    requestAnimationFrame(() => {
      this.overlayEl.style.opacity = '1';
    });

    this.timeouts.push(window.setTimeout(() => this.spin(), 60));
  }

  public destroy(): void {
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];
    this.removeOverlay();
  }

  /** Une seule transition CSS : départ rapide, longue décélération. */
  private spin(): void {
    this.landingIndex = this.theme === 'CAMPAGNE' ? 5 : 4;

    this.stripEl.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.85, 0.15, 1)`;
    this.stripEl.style.transform = `translateX(${this.offsetFor(this.landingIndex)}px)`;

    this.timeouts.push(window.setTimeout(() => this.reveal(), SPIN_MS + 100));
    this.timeouts.push(window.setTimeout(() => this.finish(), SPIN_MS + 100 + HOLD_MS));
  }

  /** Affiche le résultat et met en avant la vignette gagnante. */
  private reveal(): void {
    this.labelEl.innerText = LABELS[this.theme];
    this.labelEl.style.color = ACCENTS[this.theme];
    this.labelEl.style.textShadow = `0 0 15px ${ACCENTS[this.theme]}99`;

    const winner = this.panels[this.landingIndex];
    if (winner) {
      winner.el.style.borderColor = ACCENTS[this.theme];
      winner.el.style.boxShadow = `0 0 25px ${ACCENTS[this.theme]}80`;
    }
  }

  private finish(): void {
    this.overlayEl.style.opacity = '0';
    this.timeouts.push(window.setTimeout(() => this.removeOverlay(), 300));
    this.eventBus.emit('lobby:intro_start', { theme: this.theme, message: this.message });
  }

  /** Position de la piste pour centrer le panneau `index`. */
  private offsetFor(index: number): number {
    return VIEWPORT_W / 2 - PANEL_W / 2 - index * PITCH;
  }

  private buildPanels(): void {
    for (let i = 0; i < PANEL_COUNT; i++) {
      const el = document.createElement('div');
      el.style.flex = '0 0 auto';
      el.style.width = `${PANEL_W}px`;
      el.style.height = `${PANEL_H}px`;
      el.style.border = '2px solid rgba(206, 214, 224, 0.35)';
      el.style.borderRadius = '10px';
      el.style.overflow = 'hidden';
      el.style.transition = 'border-color 0.2s ease, box-shadow 0.2s ease';

      const canvas = document.createElement('canvas');
      canvas.width = PANEL_W;
      canvas.height = PANEL_H;
      canvas.style.display = 'block';
      canvas.style.imageRendering = 'pixelated';
      el.appendChild(canvas);

      this.stripEl.appendChild(el);
      this.panels.push({
        el,
        ctx: canvas.getContext('2d')!,
        theme: i % 2 === 0 ? 'URBAN' : 'CAMPAGNE',
      });
    }
  }

  private drawAll(): void {
    for (const panel of this.panels) {
      this.drawPanel(panel);
    }
  }

  private drawPanel(panel: Panel): void {
    const ctx = panel.ctx;
    ctx.clearRect(0, 0, PANEL_W, PANEL_H);
    ctx.imageSmoothingEnabled = false;

    if (panel.theme === 'CAMPAGNE') {
      const img = this.campagneImg;
      if (img.complete && img.naturalWidth) {
        const scale = TILE / CAMPAGNE_ARENA.pitch;
        ctx.drawImage(
          img,
          -CAMPAGNE_ARENA.x * scale,
          -CAMPAGNE_ARENA.y * scale,
          img.naturalWidth * scale,
          img.naturalHeight * scale,
        );
      }
    } else {
      const img = this.urbanImg;
      if (!img.complete || !img.naturalWidth) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          this.drawTile(ctx, img, GRASS, x, y);
          if (this.isWall(x, y)) this.drawTile(ctx, img, WALL, x, y);
        }
      }
    }
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    src: { x: number; y: number; w: number; h: number },
    x: number,
    y: number,
  ): void {
    ctx.drawImage(
      img,
      src.x, src.y, src.w, src.h,
      x * TILE, y * TILE, TILE, TILE,
    );
  }

  private isWall(x: number, y: number): boolean {
    return x % 2 !== 0 && y % 2 !== 0;
  }

  /** Charge une image en Data URI, comme GameRenderer, pour éviter le tainting. */
  private loadImage(filePath: string): HTMLImageElement {
    const img = new Image();
    img.onload = () => this.drawAll();

    try {
      if (fs.existsSync(filePath)) {
        img.src = `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
      } else {
        img.src = filePath;
      }
    } catch (e) {
      console.warn('[MapCarousel] Chargement image échoué :', filePath, e);
      img.src = filePath;
    }

    return img;
  }

  private removeOverlay(): void {
    if (this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
  }
}
