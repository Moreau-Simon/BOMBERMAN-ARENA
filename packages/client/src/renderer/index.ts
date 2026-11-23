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
import { NetworkManager } from './NetworkManager';
import { GameRenderer } from './GameRenderer';
import { UIManager } from './UIManager';

// ─── Initialisation ───────────────────────────────────────────────────

/** Bus d'événements unique partagé par tous les modules. */
const eventBus = new EventBus();

// Chaque module s'abonne au bus depuis son constructeur : l'instance n'a pas
// besoin d'être conservée ici, le bus garde ses callbacks en vie.
new InputManager(eventBus);
new NetworkManager(eventBus);
new GameRenderer(eventBus);
new UIManager(eventBus);

console.log('🎮 [Bomberman Arena] Client initialisé — NetworkManager actif');
