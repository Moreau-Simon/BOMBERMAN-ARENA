import { AnimationManager } from './animation';

export function initBombermanAnimations(animManager: AnimationManager) {
    const bombermanPath = 'models/mobs/SNES - Super Bomberman 3 - Playable Characters - Bomberman-2.png';

    // Les dimensions typiques d'une frame de Bomberman dans ce sprite sheet
    const frameWidth = 16;
    const frameHeight = 24;

    // L'espacement horizontal entre deux frames sur le spritesheet (dépend du "rip", souvent 1 ou 2 pixels)
    // D'après l'image, les frames sont très proches, on suppose un espacement minime.
    const gapX = 2; 

    // Les coordonnées de départ (x, y) pour le bloc du Bomberman blanc (en haut à gauche)
    const startX = 5; 
    const startY = 4;
    
    // La hauteur de chaque ligne d'animation (pour passer à la ligne suivante)
    const rowHeight = 32;

    // --- Ligne 1 : Mouvement BAS (Down) ---
    // Les 3 premières frames correspondent à la marche vers le bas (pied droit, centre/idle, pied gauche)
    animManager.bindMobMovement('bomberman', 'down', {
        imagePath: bombermanPath,
        frames: AnimationManager.generateFrames(startX, startY, frameWidth, frameHeight, 3, gapX),
        frameRateMs: 150
    });

    // L'état "idle" (sans bouger) est souvent la frame centrale de l'animation de marche vers le bas
    // C'est donc la frame 2 (index 1) de la première ligne.
    animManager.bindMobMovement('bomberman', 'idle', {
        imagePath: bombermanPath,
        frames: [
            { x: startX + (frameWidth + gapX), y: startY, width: frameWidth, height: frameHeight }
        ],
        frameRateMs: 1000 // Inutile pour une seule frame, mais pour la cohérence
    });

    // --- Ligne 2 : Mouvement HAUT (Up) ---
    animManager.bindMobMovement('bomberman', 'up', {
        imagePath: bombermanPath,
        frames: AnimationManager.generateFrames(startX, startY + rowHeight, frameWidth, frameHeight, 3, gapX),
        frameRateMs: 150
    });

    // --- Ligne 3 : Mouvement DROITE (Right) ---
    animManager.bindMobMovement('bomberman', 'right', {
        imagePath: bombermanPath,
        frames: AnimationManager.generateFrames(startX, startY + 2 * rowHeight, frameWidth, frameHeight, 3, gapX),
        frameRateMs: 150
    });

    // --- Ligne 4 : Mouvement GAUCHE (Left) ---
    // (Dans certains spritesheets de Bomberman, il marche à gauche sur la ligne 4,
    // si ce n'est pas le cas, on peut aussi utiliser un effet miroir sur le sprite de droite, mais prenons la ligne 4)
    animManager.bindMobMovement('bomberman', 'left', {
        imagePath: bombermanPath,
        frames: AnimationManager.generateFrames(startX, startY + 3 * rowHeight, frameWidth, frameHeight, 3, gapX),
        frameRateMs: 150
    });

    // --- Ligne 5 : Mouvement MORT (Die) ---
    // L'animation de mort de bomberman prend souvent plus de frames (ex: 4 ou 5)
    animManager.bindMobMovement('bomberman', 'die', {
        imagePath: bombermanPath,
        frames: AnimationManager.generateFrames(startX, startY + 4 * rowHeight, frameWidth, frameHeight, 5, gapX),
        frameRateMs: 200
    });

    console.log("Animations de Bomberman initialisées !");
}
