/**
 * @module UIManager
 * @description Gère les transitions d'écrans et le HUD.
 * Responsabilité unique (SRP) : manipuler le DOM pour l'UI.
 *
 * Ce module gère :
 * - L'écran d'accueil (menu, saisie du nom)
 * - La transition vers l'écran de jeu
 * - Le HUD en cours de partie
 */

import { EventBus } from './EventBus';

export class UIManager {
  private homeScreen: HTMLElement;
  private gameScreen: HTMLElement;
  private playerNameInput: HTMLInputElement;
  private serverIpInput: HTMLInputElement;
  private hudPlayer: HTMLElement;
  private hudStatus: HTMLElement;

  constructor(private eventBus: EventBus) {
    // Récupération des éléments DOM
    this.homeScreen = document.getElementById('home-screen')!;
    this.gameScreen = document.getElementById('game-screen')!;
    this.playerNameInput = document.getElementById('playerName') as HTMLInputElement;
    this.serverIpInput = document.getElementById('serverIp') as HTMLInputElement;
    this.hudPlayer = document.getElementById('hud-player')!;
    this.hudStatus = document.getElementById('hud-status')!;

    this.setupUIListeners();
    this.subscribeToEvents();
  }

  /**
   * Configure les écouteurs DOM (boutons du menu).
   */
  private setupUIListeners(): void {
    const btnPlay = document.getElementById('btn-play')!;

    btnPlay.addEventListener('click', () => {
      const name = this.playerNameInput.value.trim() || 'PLAYER';
      const ip = this.serverIpInput ? (this.serverIpInput.value.trim() || 'localhost') : 'localhost';
      this.eventBus.emit('ui:play', { playerName: name, serverIp: ip });
    });

    // Permettre de lancer avec Entrée
    this.playerNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnPlay.click();
      }
    });
  }

  /**
   * S'abonne aux événements du bus pour mettre à jour l'UI.
   */
  private subscribeToEvents(): void {
    this.eventBus.on('ui:show_game', () => {
      this.showGameScreen();
    });

    this.eventBus.on('network:connected', (payload) => {
      this.hudStatus.textContent = 'CONNECTED';
      this.hudStatus.style.color = '#4ecca3';
    });

    this.eventBus.on('network:disconnected', () => {
      this.hudStatus.textContent = 'DISCONNECTED';
      this.hudStatus.style.color = '#e94560';
    });

    this.eventBus.on('network:error', (payload) => {
      this.hudStatus.textContent = `ERROR: ${payload.message}`;
      this.hudStatus.style.color = '#e94560';
    });

    this.eventBus.on('network:player_joined', (payload) => {
      console.log(`[UI] Joueur rejoint : ${payload.playerName}`);
    });

    this.eventBus.on('game:start', () => {
      this.hudStatus.textContent = 'PLAYING';
      this.hudStatus.style.color = '#ff6b35';
    });

    this.eventBus.on('state:update', (state) => {
      // Mettre à jour le HUD avec les infos de la partie
      this.hudPlayer.textContent = `PLAYERS: ${state.players.filter(p => p.isAlive).length}/${state.players.length}`;
    });
  }

  /**
   * Transition de l'écran d'accueil vers l'écran de jeu.
   */
  private showGameScreen(): void {
    this.homeScreen.classList.add('hidden');
    this.gameScreen.classList.add('active');
  }
}
