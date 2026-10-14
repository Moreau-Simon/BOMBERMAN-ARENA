/**
 * @module SpriteSheet
 * @description Utilitaire de découpe de spritesheets.
 * Charge une image et permet d'extraire des sous-rectangles
 * pour le rendu des sprites individuels.
 *
 * Utilisé pour extraire les tiles de la map BlockBuster
 * et les animations des personnages depuis les PNG du dossier assets/.
 */

/** Définit un rectangle de découpe dans un spritesheet. */
export interface SpriteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Charge et découpe un spritesheet.
 */
export class SpriteSheet {
  private image: HTMLImageElement;
  private loaded: boolean = false;

  /**
   * @param imagePath Chemin vers l'image du spritesheet.
   */
  constructor(imagePath: string) {
    this.image = new Image();
    this.image.src = imagePath;
    this.image.onload = () => {
      this.loaded = true;
    };
  }

  /**
   * Dessine une portion du spritesheet sur un canvas.
   * @param ctx Le contexte de rendu 2D.
   * @param source Le rectangle source dans le spritesheet.
   * @param destX Position X de destination sur le canvas.
   * @param destY Position Y de destination sur le canvas.
   * @param destWidth Largeur de destination (permet le scaling).
   * @param destHeight Hauteur de destination (permet le scaling).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    source: SpriteRect,
    destX: number,
    destY: number,
    destWidth: number,
    destHeight: number
  ): void {
    if (!this.loaded) return;

    ctx.drawImage(
      this.image,
      source.x, source.y, source.width, source.height,
      destX, destY, destWidth, destHeight
    );
  }

  /**
   * Génère une liste de SpriteRect pour des frames alignées horizontalement.
   * Utile pour les animations de marche.
   *
   * @param startX X du premier sprite.
   * @param startY Y du premier sprite.
   * @param frameWidth Largeur d'une frame.
   * @param frameHeight Hauteur d'une frame.
   * @param frameCount Nombre de frames.
   * @param gapX Espace horizontal entre les frames.
   * @returns Tableau de SpriteRect.
   */
  static generateFrames(
    startX: number,
    startY: number,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    gapX: number = 0
  ): SpriteRect[] {
    const frames: SpriteRect[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push({
        x: startX + i * (frameWidth + gapX),
        y: startY,
        width: frameWidth,
        height: frameHeight,
      });
    }
    return frames;
  }

  /** Indique si l'image est chargée. */
  isLoaded(): boolean {
    return this.loaded;
  }
}
