/**
 * @module UIManager
 * @description Gère les transitions d'écrans et le HUD.
 *
 * Flux :
 *   Home → (Play) → Lobby → (Ready) → IntroOverlay → Jeu
 */

import { EventBus } from './EventBus';
import { IntroOverlay } from './IntroOverlay';
import { DeathOverlay } from './DeathOverlay';

export class UIManager {
  private homeScreen:      HTMLElement;
  private lobbyScreen:     HTMLElement;
  private gameScreen:      HTMLElement;
  private playerNameInput: HTMLInputElement;
  private serverIpInput:   HTMLInputElement;
  private playerList:      HTMLElement;
  private readyButton:     HTMLButtonElement;
  private hudPlayer:       HTMLElement;
  private hudStatus:       HTMLElement;

  private introOverlay?:    IntroOverlay;
  private deathOverlay?:    DeathOverlay;
  private spectatorBanner?: HTMLElement;

  private localPlayerId:   string | null = null;
  private localPlayerName: string = 'PLAYER';
  private isDead:          boolean = false;
  private isSpectating:    boolean = false;

  constructor(private eventBus: EventBus) {
    console.log('[UIManager] Constructeur initialisé');

    this.homeScreen      = document.getElementById('home-screen')!;
    this.lobbyScreen     = document.getElementById('lobby-screen')!;
    this.gameScreen      = document.getElementById('game-screen')!;
    this.playerNameInput = document.getElementById('playerName') as HTMLInputElement;
    this.serverIpInput   = document.getElementById('serverIp')   as HTMLInputElement;
    this.playerList      = document.getElementById('player-list')!;
    this.readyButton     = document.getElementById('btn-ready')  as HTMLButtonElement;
    this.hudPlayer       = document.getElementById('hud-player')!;
    this.hudStatus       = document.getElementById('hud-status')!;

    // État initial : seul home-screen visible
    this.homeScreen.style.display  = 'flex';
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display  = 'none';

    this.setupListeners();
    this.subscribeToEvents();
  }

  // ── Écouteurs DOM ────────────────────────────────────────────────────
  private setupListeners(): void {
    // Bouton PLAY : home → lobby
    const btnPlay = document.getElementById('btn-play')!;
    const launch = () => {
      const name = this.playerNameInput.value.trim() || 'PLAYER';
      const ip   = this.serverIpInput ? (this.serverIpInput.value.trim() || 'localhost') : 'localhost';
      this.localPlayerName = name;
      console.log('[UIManager] Play → lobby, joueur =', name);
      this.showLobby(name);
      this.eventBus.emit('ui:play', { playerName: name, serverIp: ip });
    };
    btnPlay.addEventListener('click', launch);
    this.playerNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') launch(); });

    // Bouton READY : joueur est prêt
    this.readyButton.addEventListener('click', () => {
      console.log('[UIManager] Ready cliqué');
      this.readyButton.disabled = true;
      this.readyButton.textContent = '⏳ EN ATTENTE...';
      this.eventBus.emit('lobby:ready', undefined);
    });
  }

  // ── Écouteurs EventBus ───────────────────────────────────────────────
  private subscribeToEvents(): void {
    // Récupérer l'ID réseau du joueur si connecté au serveur
    this.eventBus.on('network:connected', (payload: { playerId: string }) => {
      this.localPlayerId = payload.playerId;
    });

    // Moteur dit : lancez l'intro
    this.eventBus.on('lobby:intro_start', ({ message }: { theme: any; message: string }) => {
      console.log('[UIManager] Intro overlay → message:', message);
      this.introOverlay = new IntroOverlay(this.eventBus, message, 3000);
    });

    // Intro terminée → afficher le jeu
    this.eventBus.on('lobby:intro_end', () => {
      console.log('[UIManager] Intro terminée → game screen');
      this.introOverlay = undefined;
      this.resetGameState();
      this.showGame();
    });

    // HUD updates
    this.eventBus.on('game:start', () => {
      this.resetGameState();
      this.hudStatus.textContent = 'PLAYING';
      this.hudStatus.style.color = '#ff6b35';
    });

    this.eventBus.on('state:update', (state: any) => {
      const alivePlayers = state.players.filter((p: any) => p.isAlive);
      this.hudPlayer.textContent = `PLAYERS: ${alivePlayers.length}/${state.players.length}`;

      // Trouver notre joueur local
      const localPlayer = state.players.find((p: any) =>
        (this.localPlayerId && p.id === this.localPlayerId) ||
        p.id === 'local-player' ||
        p.name === this.localPlayerName
      ) || (state.players.length === 1 ? state.players[0] : null);

      // Détecter la mort du joueur
      if (localPlayer && !localPlayer.isAlive && !this.isDead) {
        this.isDead = true;
        const otherPlayers = state.players.filter((p: any) => p !== localPlayer);
        const isSolo = otherPlayers.length === 0;

        console.log(`[UIManager] Mort détectée pour ${localPlayer.name} ! Solo=${isSolo}`);
        this.deathOverlay = new DeathOverlay(this.eventBus, {
          isSolo,
          onQuit: () => this.handleQuit(),
          onSpectate: () => this.handleSpectate(),
        });
      }

      // Si le joueur est en mode spectateur, vérifier si la partie s'est terminée
      if (this.isSpectating && state.players.length > 1) {
        if (alivePlayers.length <= 1 && !document.getElementById('end-game-banner')) {
          this.showEndGameBanner(alivePlayers[0]?.name);
        }
      }
    });
  }

  // ── Mode Spectateur & Fin de partie ──────────────────────────────────
  private handleSpectate(): void {
    console.log('[UIManager] Mode spectateur activé');
    this.isSpectating = true;
    this.deathOverlay = undefined;
    this.hudStatus.textContent = 'SPECTATEUR';
    this.hudStatus.style.color = '#3742fa';
    this.showSpectatorBanner();
  }

  private showSpectatorBanner(): void {
    if (this.spectatorBanner && this.spectatorBanner.parentNode) {
      this.spectatorBanner.parentNode.removeChild(this.spectatorBanner);
    }

    const banner = document.createElement('div');
    banner.id = 'spectator-banner';
    banner.style.position = 'fixed';
    banner.style.top = '16px';
    banner.style.right = '20px';
    banner.style.zIndex = '500';
    banner.style.background = 'rgba(15, 20, 30, 0.85)';
    banner.style.border = '1px solid rgba(55, 66, 250, 0.4)';
    banner.style.backdropFilter = 'blur(4px)';
    banner.style.padding = '8px 16px';
    banner.style.borderRadius = '8px';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.gap = '14px';
    banner.style.fontFamily = "'Inter', sans-serif";
    banner.style.fontSize = '0.9rem';
    banner.style.color = '#ffffff';
    banner.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4)';

    const label = document.createElement('span');
    label.innerText = 'MODE SPECTATEUR';
    label.style.fontWeight = '700';
    label.style.color = '#70a1ff';
    banner.appendChild(label);

    const btnQuit = document.createElement('button');
    btnQuit.innerText = 'Quitter';
    btnQuit.style.background = '#ff4757';
    btnQuit.style.color = '#ffffff';
    btnQuit.style.border = 'none';
    btnQuit.style.padding = '5px 12px';
    btnQuit.style.borderRadius = '5px';
    btnQuit.style.cursor = 'pointer';
    btnQuit.style.fontWeight = 'bold';
    btnQuit.style.fontSize = '0.85rem';
    btnQuit.style.transition = 'background 0.2s ease';
    btnQuit.addEventListener('mouseenter', () => btnQuit.style.background = '#ff6b81');
    btnQuit.addEventListener('mouseleave', () => btnQuit.style.background = '#ff4757');
    btnQuit.addEventListener('click', () => this.handleQuit());
    banner.appendChild(btnQuit);

    document.body.appendChild(banner);
    this.spectatorBanner = banner;
  }

  private showEndGameBanner(winnerName?: string): void {
    const endBanner = document.createElement('div');
    endBanner.id = 'end-game-banner';
    endBanner.style.position = 'fixed';
    endBanner.style.bottom = '30px';
    endBanner.style.left = '50%';
    endBanner.style.transform = 'translateX(-50%)';
    endBanner.style.zIndex = '600';
    endBanner.style.background = 'rgba(20, 24, 36, 0.95)';
    endBanner.style.border = '1px solid #ffd32a';
    endBanner.style.borderRadius = '10px';
    endBanner.style.padding = '14px 28px';
    endBanner.style.display = 'flex';
    endBanner.style.alignItems = 'center';
    endBanner.style.gap = '20px';
    endBanner.style.boxShadow = '0 0 25px rgba(255, 211, 42, 0.3)';
    endBanner.style.fontFamily = "'Inter', sans-serif";

    const msg = document.createElement('span');
    msg.style.color = '#ffd32a';
    msg.style.fontWeight = 'bold';
    msg.style.fontSize = '1.1rem';
    msg.innerText = winnerName ? `Fin de partie ! Vainqueur : ${winnerName}` : 'Fin de partie !';
    endBanner.appendChild(msg);

    const btnQuit = document.createElement('button');
    btnQuit.innerText = 'QUITTER LE MATCH';
    btnQuit.style.background = '#ff4757';
    btnQuit.style.color = '#fff';
    btnQuit.style.border = 'none';
    btnQuit.style.padding = '8px 16px';
    btnQuit.style.borderRadius = '6px';
    btnQuit.style.cursor = 'pointer';
    btnQuit.style.fontWeight = 'bold';
    btnQuit.addEventListener('click', () => {
      if (endBanner.parentNode) endBanner.parentNode.removeChild(endBanner);
      this.handleQuit();
    });
    endBanner.appendChild(btnQuit);

    document.body.appendChild(endBanner);
  }

  // ── Quitter la partie ────────────────────────────────────────────────
  private handleQuit(): void {
    console.log('[UIManager] Quitter la partie');
    this.resetGameState();
    this.eventBus.emit('game:quit', undefined);
    this.showHome();
  }

  private resetGameState(): void {
    this.isDead = false;
    this.isSpectating = false;

    if (this.deathOverlay) {
      this.deathOverlay.destroy();
      this.deathOverlay = undefined;
    }

    if (this.spectatorBanner && this.spectatorBanner.parentNode) {
      this.spectatorBanner.parentNode.removeChild(this.spectatorBanner);
      this.spectatorBanner = undefined;
    }

    const endBanner = document.getElementById('end-game-banner');
    if (endBanner && endBanner.parentNode) {
      endBanner.parentNode.removeChild(endBanner);
    }
  }

  // ── Transitions ──────────────────────────────────────────────────────
  private showHome(): void {
    this.homeScreen.style.display  = 'flex';
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display  = 'none';

    this.readyButton.disabled = false;
    this.readyButton.textContent = '✔ READY';
  }

  private showLobby(playerName: string): void {
    this.homeScreen.style.display  = 'none';
    this.lobbyScreen.style.display = 'flex';
    this.gameScreen.style.display  = 'none';
    // Peupler la liste
    this.playerList.innerHTML = `<li>${playerName}</li>`;
    this.readyButton.disabled = false;
    this.readyButton.textContent = '✔ READY';
  }

  private showGame(): void {
    this.homeScreen.style.display  = 'none';
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display  = 'flex';
  }
}

