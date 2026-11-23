/**
 * @module UIManager
 * @description Gère les transitions d'écrans et le HUD.
 *
 * Flux :
 *   Home → (Play) → Lobby → (Ready) → IntroOverlay → Jeu
 */

import { EventBus } from './EventBus';
import { IntroOverlay } from './IntroOverlay';
import { MapCarousel } from './MapCarousel';
import { DeathOverlay } from './DeathOverlay';
import { SettingsMenu } from './SettingsMenu';
import { BonusHud } from './BonusHud';
import { MapTheme } from '@bomberman-arena/shared';

export class UIManager {
  private homeScreen:      HTMLElement;
  private configScreen:    HTMLElement;
  private lobbyScreen:     HTMLElement;
  private gameScreen:      HTMLElement;
  private playerNameInput: HTMLInputElement;
  private serverIpInput:   HTMLInputElement;
  private playerList:      HTMLElement;
  private readyButton:     HTMLButtonElement;
  private hudPlayer:       HTMLElement;
  private hudStatus:       HTMLElement;
  private bonusHud:        BonusHud;

  private introOverlay?:    IntroOverlay;
  private mapCarousel?:     MapCarousel;
  private deathOverlay?:    DeathOverlay;
  private spectatorBanner?: HTMLElement;
  private settingsMenu:     SettingsMenu;

  private localPlayerId:   string | null = null;
  private localPlayerName: string = 'PLAYER';
  private currentTheme:    MapTheme = 'URBAN';
  private isDead:          boolean = false;
  private isSpectating:    boolean = false;

  constructor(private eventBus: EventBus) {
    console.log('[UIManager] Constructeur initialisé');

    this.homeScreen      = document.getElementById('home-screen')!;
    this.configScreen    = document.getElementById('play-config-screen')!;
    this.lobbyScreen     = document.getElementById('lobby-screen')!;
    this.gameScreen      = document.getElementById('game-screen')!;
    this.playerNameInput = document.getElementById('playerName') as HTMLInputElement;
    this.serverIpInput   = document.getElementById('serverIp')   as HTMLInputElement;

    // Pré-remplir le pseudo avec la dernière valeur utilisée
    const savedName = localStorage.getItem('player_name');
    if (savedName) {
      this.playerNameInput.value = savedName;
    }
    this.playerList      = document.getElementById('player-list')!;
    this.readyButton     = document.getElementById('btn-ready')  as HTMLButtonElement;
    this.hudPlayer       = document.getElementById('hud-player')!;
    this.hudStatus       = document.getElementById('hud-status')!;
    this.bonusHud        = new BonusHud();

    // État initial : seul home-screen visible
    this.homeScreen.style.display  = 'flex';
    this.configScreen.style.display = 'none';
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display  = 'none';

    // Initialiser le menu burger de paramètres
    this.settingsMenu = new SettingsMenu(this.eventBus, {
      onQuitGame: () => this.handleQuit(),
      isGameActive: () => this.gameScreen.style.display === 'flex' || this.lobbyScreen.style.display === 'flex',
    });

    this.setupListeners();
    this.subscribeToEvents();
  }

  // ── Écouteurs DOM ────────────────────────────────────────────────────
  private setupListeners(): void {
    // Bouton JOUER : accueil → écran de configuration (pseudo / IP)
    const btnPlay = document.getElementById('btn-play')!;
    const launch = () => {
      const rawIp = this.serverIpInput ? this.serverIpInput.value.trim() : '';
      const ip = rawIp !== '' ? rawIp : 'localhost';
      const isLocalHost = ip.toLowerCase() === 'localhost' || ip === '127.0.0.1';
      const name = this.playerNameInput.value.trim() || 'PLAYER';
      this.localPlayerName = name;
      localStorage.setItem('player_name', name);
      console.log('[UIManager] Play → lobby, joueur =', name, 'isHost =', isLocalHost);
      this.showLobby(name, isLocalHost);
      this.eventBus.emit('ui:play', { playerName: name, serverIp: ip });
    };

    btnPlay.addEventListener('click', () => {
      this.homeScreen.style.display = 'none';
      this.configScreen.style.display = 'flex';
      this.playerNameInput.focus();
      this.playerNameInput.select();
    });

    document.getElementById('btn-confirm-play')!.addEventListener('click', launch);
    document.getElementById('btn-config-back')!.addEventListener('click', () => {
      this.showHome();
    });

    this.playerNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') launch(); });
    this.serverIpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') launch(); });

    // Bouton READY : joueur est prêt
    this.readyButton.addEventListener('click', () => {
      console.log('[UIManager] Ready cliqué');
      this.readyButton.disabled = true;
      this.readyButton.textContent = 'EN ATTENTE...';
      this.eventBus.emit('lobby:ready', undefined);
    });

    // Bouton RETOUR depuis le lobby → accueil
    const btnLobbyBack = document.getElementById('btn-lobby-back');
    if (btnLobbyBack) {
      btnLobbyBack.addEventListener('click', () => {
        console.log('[UIManager] Retour au menu depuis le lobby');
        this.handleQuit();
      });
    }

    // Bouton OPTIONS sur la page d'accueil
    const btnOptions = document.getElementById('btn-options');
    if (btnOptions) {
      btnOptions.addEventListener('click', () => {
        this.settingsMenu.open();
      });
    }

    // Bouton QUITTER sur la page d'accueil
    const btnQuit = document.getElementById('btn-quit');
    if (btnQuit) {
      btnQuit.addEventListener('click', () => {
        try {
          if (typeof window !== 'undefined' && (window as any).require) {
            (window as any).require('electron').ipcRenderer.send('app:quit');
          } else {
            window.close();
          }
        } catch {
          window.close();
        }
      });
    }
  }

  // ── Écouteurs EventBus ───────────────────────────────────────────────
  private subscribeToEvents(): void {
    // Récupérer l'ID réseau du joueur si connecté au serveur
    this.eventBus.on('network:connected', (payload: { playerId: string }) => {
      this.localPlayerId = payload.playerId;
      this.hudStatus.textContent = 'CONNECTÉ';
      this.hudStatus.style.color = '#38ef7d';
    });

    this.eventBus.on('network:player_joined', (payload: any) => {
      console.log('[UIManager] Nouveau joueur rejoint le lobby:', payload.playerName);
      if (this.lobbyScreen.style.display === 'flex') {
        const existing = Array.from(this.playerList.querySelectorAll('li')).map(li => li.textContent);
        if (!existing.includes(payload.playerName)) {
          const item = document.createElement('li');
          item.textContent = payload.playerName;
          this.playerList.appendChild(item);
        }
      }
    });

    this.eventBus.on('network:error', (payload: any) => {
      console.warn('[UIManager] Erreur réseau:', payload?.message);
      this.hudStatus.textContent = 'ERREUR RÉSEAU';
      this.hudStatus.style.color = '#ff4757';
    });

    this.eventBus.on('network:disconnected', () => {
      console.warn('[UIManager] Déconnecté du serveur');
      this.hudStatus.textContent = 'DÉCONNECTÉ';
      this.hudStatus.style.color = '#ff4757';
    });

    // Moteur dit : lancez l'intro
    this.eventBus.on('lobby:intro_start', ({ theme, message }: { theme: any; message: string }) => {
      console.log('[UIManager] Intro overlay → theme:', theme, 'message:', message);
      this.mapCarousel = undefined;
      this.currentTheme = theme ?? 'URBAN';
      this.introOverlay = new IntroOverlay(this.eventBus, message, this.currentTheme, 3000);
    });

    // Intro terminée → afficher le jeu
    this.eventBus.on('lobby:intro_end', () => {
      console.log('[UIManager] Intro terminée → game screen');
      this.introOverlay = undefined;
      this.resetGameState();
      this.showGame();
    });

    // HUD updates
    this.eventBus.on('game:start', (payload) => {
      this.resetGameState();
      this.currentTheme = payload?.theme ?? this.currentTheme;
      this.hudStatus.textContent = 'PLAYING';
      this.hudStatus.style.color = '#ff6b35';

      // Première partie depuis le lobby, ou nouvelle manche depuis l'écran de jeu
      const showIntro = this.lobbyScreen.style.display === 'flex' || this.gameScreen.style.display === 'flex';
      if (showIntro) {
        const theme = this.currentTheme;
        const msg = theme === 'URBAN'
          ? 'Bienvenue dans ce chaos.\nSeuls les plus forts survivront.'
          : 'Bienvenue à la campagne.\nLe calme sera votre meilleur allié.';
        // Le carrousel tourne, puis émet lobby:intro_start sur le thème tiré
        this.mapCarousel = new MapCarousel(this.eventBus, theme, msg);
      }
    });

    this.eventBus.on('state:update', (state: any) => {
      // Synchroniser la liste des joueurs connectés dans le lobby
      if (this.lobbyScreen.style.display === 'flex' && state.players && state.players.length > 0) {
        this.updateLobbyPlayers(state.players);
      }

      const alivePlayers = state.players.filter((p: any) => p.isAlive);
      this.hudPlayer.textContent = `PLAYERS: ${alivePlayers.length}/${state.players.length}`;

      // Trouver notre joueur local
      let localPlayer: any = null;
      if (this.localPlayerId) {
        // En réseau : matcher par ID serveur uniquement
        localPlayer = state.players.find((p: any) => p.id === this.localPlayerId);
      } else {
        // En local (solo) : prendre le joueur local
        localPlayer = state.players.find((p: any) =>
          p.id === 'local-player' || p.id === 'local-player-1'
        ) || state.players[0];
      }

      this.bonusHud.update(localPlayer, state.tick);

      // Détecter la mort du joueur principal
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

      // Si fin de partie (1 seul survivant ou égalité) — bannière pour tous
      if (state.players.length > 1 && alivePlayers.length <= 1 && !document.getElementById('end-game-banner')) {
        this.showEndGameBanner(alivePlayers[0]?.name || 'ÉGALITÉ !');
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
    banner.style.top = '70px';
    banner.style.right = '16px';
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

    const btnRematch = document.createElement('button');
    btnRematch.innerText = 'REJOUER';
    btnRematch.style.background = 'linear-gradient(135deg, #38ef7d, #11998e)';
    btnRematch.style.color = '#fff';
    btnRematch.style.border = 'none';
    btnRematch.style.padding = '8px 16px';
    btnRematch.style.borderRadius = '6px';
    btnRematch.style.cursor = 'pointer';
    btnRematch.style.fontWeight = 'bold';
    btnRematch.addEventListener('click', () => {
      btnRematch.disabled = true;
      btnRematch.innerText = 'EN ATTENTE...';
      btnRematch.style.opacity = '0.6';
      btnRematch.style.cursor = 'default';

      // Le joueur n'est plus mort : il pourra rejouer la manche suivante
      this.clearPlayerOverlays();
      this.eventBus.emit('lobby:ready', undefined);
    });
    endBanner.appendChild(btnRematch);

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
    this.clearPlayerOverlays();
    this.bonusHud.reset();

    if (this.mapCarousel) {
      this.mapCarousel.destroy();
      this.mapCarousel = undefined;
    }

    const endBanner = document.getElementById('end-game-banner');
    if (endBanner && endBanner.parentNode) {
      endBanner.parentNode.removeChild(endBanner);
    }
  }

  /** Retire l'overlay de mort et la bannière spectateur, sans toucher aux écrans. */
  private clearPlayerOverlays(): void {
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
  }

  // ── Transitions ──────────────────────────────────────────────────────
  private showHome(): void {
    this.homeScreen.style.display  = 'flex';
    this.configScreen.style.display = 'none';
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display  = 'none';
    this.settingsMenu.hideBurger();

    this.readyButton.disabled = false;
    this.readyButton.textContent = 'READY';
  }

  private showLobby(playerName: string, isHost: boolean = false): void {
    this.homeScreen.style.display  = 'none';
    this.configScreen.style.display = 'none';
    this.lobbyScreen.style.display = 'flex';
    this.gameScreen.style.display  = 'none';
    this.settingsMenu.hideBurger();
    // Peupler la liste initiale
    const badge = isHost ? ' <span style="color:#ffd32a;font-size:0.85em;">(hôte)</span>' : '';
    this.playerList.innerHTML = `<li>${playerName}${badge}</li>`;
    this.readyButton.disabled = false;
    this.readyButton.textContent = 'READY';
  }

  private updateLobbyPlayers(players: any[]): void {
    if (!players || players.length === 0) return;
    this.playerList.innerHTML = players
      .map((p: any, idx: number) => {
        const name = p.name || `JOUEUR ${idx + 1}`;
        const isHost = !!p.isHost;
        const badge = isHost ? ' <span style="color:#ffd32a;font-size:0.85em;">(hôte)</span>' : '';
        const readyMark = p.isReady ? ' <span style="color:#38ef7d;font-weight:bold;">✔</span>' : '';
        return `<li>${name}${badge}${readyMark}</li>`;
      })
      .join('');
  }

  private showGame(): void {
    this.homeScreen.style.display  = 'none';
    this.configScreen.style.display = 'none';
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display  = 'flex';
    this.gameScreen.className      = this.currentTheme === 'CAMPAGNE' ? 'theme-campagne' : 'theme-urban';
    this.settingsMenu.showBurger();
  }
}

