/**
 * @module ClientRenderer
 * @description Point d'entrée du renderer Electron.
 *
 * Initialise tous les managers en les branchant sur un EventBus unique.
 * C'est la "composition root" du client : l'unique endroit où
 * les dépendances sont injectées.
 *
 * Architecture Event Bus :
 * ┌─────────────────┐     ┌──────────────────┐
 * │  InputManager   │────▶│                  │
 * └─────────────────┘     │                  │
 * ┌─────────────────┐     │    EventBus      │     ┌──────────────────┐
 * │ NetworkManager  │◀───▶│   (Médiateur)    │────▶│  GameRenderer    │
 * └─────────────────┘     │                  │     └──────────────────┘
 * ┌─────────────────┐     │                  │
 * │   UIManager     │◀────│                  │
 * └─────────────────┘     └──────────────────┘
 */

import { EventBus } from './EventBus';
import { InputManager } from './InputManager';
// import { NetworkManager } from './NetworkManager'; // désactivé en mode local
import { GameRenderer } from './GameRenderer';
import { UIManager } from './UIManager';
import { LocalGameEngine } from './LocalGameEngine';

// ─── Initialisation ───────────────────────────────────────────────────

/** Bus d'événements unique partagé par tous les modules. */
const eventBus = new EventBus();

/** Capture des entrées clavier. */
const inputManager = new InputManager(eventBus);

/** Moteur de jeu local (sans serveur). */
const localGameEngine = new LocalGameEngine(eventBus);

/** Rendu canvas. */
const gameRenderer = new GameRenderer(eventBus);

/** Gestion de l'UI (écran d'accueil, HUD). */
const uiManager = new UIManager(eventBus);

console.log('🎮 [Bomberman Arena] Client initialisé — EventBus prêt');
