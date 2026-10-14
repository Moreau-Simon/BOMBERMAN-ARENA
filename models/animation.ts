export type Movement = 'up' | 'down' | 'left' | 'right' | 'idle' | 'die';

// Représente une zone de découpe dans le fichier .png
export interface SpriteRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SpriteConfig {
    imagePath: string;
    frames: SpriteRect[]; // Liste des découpes pour créer l'animation (ex: 3 frames pour marcher)
    frameRateMs?: number; // Temps entre chaque frame en millisecondes (ex: 150ms)
}

export class AnimationManager {
    private mobAnimations: Map<string, Map<Movement, SpriteConfig>> = new Map();
    private bombEffects: Map<string, SpriteConfig> = new Map();

    /**
     * Helper pour générer facilement les rectangles d'une animation en ligne.
     * Très utile pour les spritesheets où les frames d'une action sont côte à côte.
     */
    public static generateFrames(startX: number, startY: number, width: number, height: number, frameCount: number, gapX: number = 0): SpriteRect[] {
        const frames: SpriteRect[] = [];
        for (let i = 0; i < frameCount; i++) {
            frames.push({
                x: startX + i * (width + gapX),
                y: startY,
                width: width,
                height: height
            });
        }
        return frames;
    }

    public bindMobMovement(entityId: string, movement: Movement, spriteConfig: SpriteConfig): void {
        if (!this.mobAnimations.has(entityId)) {
            this.mobAnimations.set(entityId, new Map<Movement, SpriteConfig>());
        }
        this.mobAnimations.get(entityId)!.set(movement, spriteConfig);
    }

    public getMobAnimation(entityId: string, movement: Movement): SpriteConfig | undefined {
        const entityAnims = this.mobAnimations.get(entityId);
        return entityAnims ? entityAnims.get(movement) : undefined;
    }

    public bindBombEffect(effectType: string, spriteConfig: SpriteConfig): void {
        this.bombEffects.set(effectType, spriteConfig);
    }

    public getBombEffect(effectType: string): SpriteConfig | undefined {
        return this.bombEffects.get(effectType);
    }
}
