import { EventBus } from './EventBus';

export interface SettingsMenuOptions {
  onQuitGame?: () => void;
  isGameActive?: () => boolean;
}

// ─── SVG Icônes Lucide officielles ──────────────────────────────────
const LUCIDE_ICONS = {
  menu: `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" x2="20" y1="12" y2="12"/>
      <line x1="4" x2="20" y1="6" y2="6"/>
      <line x1="4" x2="20" y1="18" y2="18"/>
    </svg>`,
  x: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>`,
  volume2: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>`,
  volumeX: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="22" x2="16" y1="9" y2="15"/>
      <line x1="16" x2="22" y1="9" y2="15"/>
    </svg>`,
  keyboard: `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/>
      <path d="M6 12h.001"/><path d="M18 12h.001"/><path d="M10 12h4"/>
    </svg>`,
  logOut: `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" x2="9" y1="12" y2="12"/>
    </svg>`,
};

/**
 * SettingsMenu : gère l'icône burger Lucide en haut à droite (affichée uniquement en jeu)
 * et le modal des paramètres (Volume sonore, Aide contrôles, Quitter le jeu).
 */
export class SettingsMenu {
  private burgerBtn: HTMLButtonElement;
  private overlayEl: HTMLDivElement;
  private isOpened = false;
  private ipcRenderer: any = null;

  private currentVolume = 80; // 0 à 100

  constructor(
    private eventBus: EventBus,
    private options?: SettingsMenuOptions
  ) {
    this.loadVolume();
    this.initIpc();
    this.burgerBtn = this.createBurgerButton();
    this.overlayEl = this.createOverlay();
    this.setupShortcuts();

    document.body.appendChild(this.burgerBtn);
    document.body.appendChild(this.overlayEl);
  }

  private loadVolume(): void {
    const saved = localStorage.getItem('sfx_volume');
    if (saved !== null) {
      const val = parseInt(saved, 10);
      if (!isNaN(val)) this.currentVolume = Math.max(0, Math.min(100, val));
    }
  }

  private initIpc(): void {
    try {
      if (typeof window !== 'undefined' && (window as any).require) {
        this.ipcRenderer = (window as any).require('electron').ipcRenderer;
      } else if (typeof require !== 'undefined') {
        this.ipcRenderer = require('electron').ipcRenderer;
      }
    } catch {
      this.ipcRenderer = null;
    }
  }

  // ── Bouton burger avec icône Lucide ──────────────────────────────────
  private createBurgerButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'burger-settings-btn';
    btn.title = 'Paramètres (Échap)';
    btn.style.position = 'fixed';
    btn.style.top = '16px';
    btn.style.right = '16px';
    btn.style.zIndex = '1500';
    btn.style.width = '44px';
    btn.style.height = '44px';
    btn.style.borderRadius = '10px';
    btn.style.background = 'rgba(22, 33, 62, 0.9)';
    btn.style.border = '2px solid rgba(255, 107, 53, 0.5)';
    btn.style.backdropFilter = 'blur(6px)';
    btn.style.cursor = 'pointer';
    btn.style.display = 'none'; // Masqué par défaut (visible seulement en jeu)
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.padding = '0';
    btn.style.color = '#ff6b35';
    btn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4)';
    btn.style.transition = 'all 0.25s ease';

    // Injection du SVG Lucide Menu
    btn.innerHTML = LUCIDE_ICONS.menu;

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#ff6b35';
      btn.style.transform = 'scale(1.08)';
      btn.style.boxShadow = '0 0 16px rgba(255, 107, 53, 0.6)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(255, 107, 53, 0.5)';
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4)';
    });

    btn.addEventListener('click', () => {
      this.toggle();
    });

    return btn;
  }

  // ── Overlay Modal Paramètres ─────────────────────────────────────────
  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(10, 14, 26, 0.85)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2000';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';

    // Carte centrale
    const card = document.createElement('div');
    card.style.background = 'linear-gradient(145deg, #16213e 0%, #0f3460 100%)';
    card.style.border = '2px solid #ff6b35';
    card.style.borderRadius = '16px';
    card.style.padding = '32px 28px';
    card.style.width = '90%';
    card.style.maxWidth = '420px';
    card.style.boxShadow = '0 0 35px rgba(255, 107, 53, 0.35), 0 10px 40px rgba(0, 0, 0, 0.7)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '20px';
    card.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

    // 1. En-tête
    const header = document.createElement('div');
    header.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.innerText = 'PARAMÈTRES';
    title.style.margin = '0 0 4px 0';
    title.style.fontSize = '1.5rem';
    title.style.fontWeight = '900';
    title.style.color = '#ff6b35';
    title.style.letterSpacing = '3px';
    title.style.textShadow = '0 0 15px rgba(255, 107, 53, 0.5)';
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.innerText = 'BOMBERMAN ARENA';
    subtitle.style.margin = '0';
    subtitle.style.fontSize = '0.72rem';
    subtitle.style.color = '#e94560';
    subtitle.style.letterSpacing = '3px';
    header.appendChild(subtitle);
    card.appendChild(header);

    // 2. Section Volume Sonore
    const volumeSection = this.createVolumeSection();
    card.appendChild(volumeSection);

    // 3. Section Aide / Commandes
    const controlsSection = this.createControlsSection();
    card.appendChild(controlsSection);

    // 4. Groupe de boutons d'action
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.flexDirection = 'column';
    btnGroup.style.gap = '10px';
    btnGroup.style.marginTop = '4px';

    // Bouton Quitter le Jeu
    const btnQuitApp = document.createElement('button');
    btnQuitApp.innerHTML = `${LUCIDE_ICONS.logOut}<span>QUITTER LE JEU</span>`;
    this.styleActionButton(btnQuitApp, '#ff4757');
    btnQuitApp.addEventListener('click', () => this.quitApplication());
    btnGroup.appendChild(btnQuitApp);

    // Bouton Reprendre
    const btnResume = document.createElement('button');
    btnResume.innerHTML = `${LUCIDE_ICONS.x}<span>REPRENDRE</span>`;
    this.styleActionButton(btnResume, '#ffffff', true);
    btnResume.addEventListener('click', () => this.close());
    btnGroup.appendChild(btnResume);

    card.appendChild(btnGroup);
    overlay.appendChild(card);

    // Clic en dehors pour fermer
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    return overlay;
  }

  // ── Section Volume avec Slider ───────────────────────────────────────
  private createVolumeSection(): HTMLDivElement {
    const box = document.createElement('div');
    box.style.background = 'rgba(15, 20, 35, 0.6)';
    box.style.border = '1px solid rgba(255, 107, 53, 0.3)';
    box.style.borderRadius = '12px';
    box.style.padding = '14px 16px';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '10px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';

    const titleLeft = document.createElement('div');
    titleLeft.style.display = 'flex';
    titleLeft.style.alignItems = 'center';
    titleLeft.style.gap = '8px';
    titleLeft.style.color = '#ff6b35';
    titleLeft.style.fontWeight = '700';
    titleLeft.style.fontSize = '0.85rem';
    titleLeft.style.letterSpacing = '1px';

    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = this.currentVolume === 0 ? LUCIDE_ICONS.volumeX : LUCIDE_ICONS.volume2;
    iconSpan.style.display = 'flex';
    titleLeft.appendChild(iconSpan);

    const titleText = document.createElement('span');
    titleText.innerText = 'VOLUME AUDIO';
    titleLeft.appendChild(titleText);
    header.appendChild(titleLeft);

    const valLabel = document.createElement('span');
    valLabel.innerText = `${this.currentVolume}%`;
    valLabel.style.color = '#e0e0e0';
    valLabel.style.fontWeight = '700';
    valLabel.style.fontSize = '0.85rem';
    header.appendChild(valLabel);
    box.appendChild(header);

    // Slider range
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = this.currentVolume.toString();
    slider.style.width = '100%';
    slider.style.cursor = 'pointer';
    slider.style.accentColor = '#ff6b35';

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value, 10);
      this.currentVolume = val;
      valLabel.innerText = `${val}%`;
      iconSpan.innerHTML = val === 0 ? LUCIDE_ICONS.volumeX : LUCIDE_ICONS.volume2;
      localStorage.setItem('sfx_volume', val.toString());
    });

    box.appendChild(slider);
    return box;
  }

  // ── Section Aide aux Contrôles ───────────────────────────────────────
  private createControlsSection(): HTMLDivElement {
    const box = document.createElement('div');
    box.style.background = 'rgba(15, 20, 35, 0.6)';
    box.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    box.style.borderRadius = '12px';
    box.style.padding = '14px 16px';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '10px';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';
    title.style.color = '#4ecca3';
    title.style.fontWeight = '700';
    title.style.fontSize = '0.85rem';
    title.style.letterSpacing = '1px';
    title.innerHTML = `${LUCIDE_ICONS.keyboard}<span>COMMANDES DE JEU</span>`;
    box.appendChild(title);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    list.style.fontSize = '0.8rem';
    list.style.color = '#ced6e0';

    const items = [
      { action: 'Déplacement', keys: 'Z / Q / S / D  ou  Flèches' },
      { action: 'Poser une bombe', keys: 'ESPACE' },
      { action: 'Menu / Pause', keys: 'ÉCHAP' },
    ];

    for (const item of items) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';

      const actionSpan = document.createElement('span');
      actionSpan.innerText = item.action;
      row.appendChild(actionSpan);

      const keyBadge = document.createElement('span');
      keyBadge.innerText = item.keys;
      keyBadge.style.background = 'rgba(255, 255, 255, 0.1)';
      keyBadge.style.border = '1px solid rgba(255, 255, 255, 0.25)';
      keyBadge.style.borderRadius = '5px';
      keyBadge.style.padding = '3px 8px';
      keyBadge.style.fontWeight = '700';
      keyBadge.style.color = '#ffffff';
      keyBadge.style.fontFamily = "'Courier New', monospace";
      keyBadge.style.fontSize = '0.75rem';
      row.appendChild(keyBadge);

      list.appendChild(row);
    }

    box.appendChild(list);
    return box;
  }

  // ── Style générique des boutons d'action ─────────────────────────────
  private styleActionButton(
    btn: HTMLButtonElement,
    color: string,
    isSecondary: boolean = false
  ): void {
    btn.style.width = '100%';
    btn.style.padding = '12px 18px';
    btn.style.fontSize = '0.9rem';
    btn.style.fontWeight = '700';
    btn.style.letterSpacing = '1px';
    btn.style.borderRadius = '10px';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.gap = '10px';
    btn.style.border = isSecondary ? '1px solid rgba(255, 255, 255, 0.2)' : `2px solid ${color}`;
    btn.style.background = isSecondary ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 20, 35, 0.7)';
    btn.style.color = isSecondary ? '#ced6e0' : color;
    btn.style.transition = 'all 0.2s ease';
    btn.style.fontFamily = "'Inter', sans-serif";

    btn.addEventListener('mouseenter', () => {
      btn.style.background = isSecondary ? 'rgba(255, 255, 255, 0.15)' : color;
      btn.style.color = isSecondary ? '#ffffff' : '#0f172a';
      btn.style.transform = 'translateY(-2px)';
      if (!isSecondary) btn.style.boxShadow = `0 6px 18px ${color}55`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background = isSecondary ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 20, 35, 0.7)';
      btn.style.color = isSecondary ? '#ced6e0' : color;
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
    });
  }

  // ── Raccourcis clavier ───────────────────────────────────────────────
  private setupShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.burgerBtn.style.display === 'flex' || this.isOpened) {
          e.preventDefault();
          this.toggle();
        }
      }
    });
  }

  // ── Gestion de l'affichage du burger ─────────────────────────────────
  public showBurger(): void {
    this.burgerBtn.style.display = 'flex';
  }

  public hideBurger(): void {
    this.burgerBtn.style.display = 'none';
    this.close();
  }

  // ── Ouverture / Fermeture du modal ───────────────────────────────────
  public open(): void {
    this.isOpened = true;
    this.overlayEl.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlayEl.style.opacity = '1';
    });
  }

  public close(): void {
    this.isOpened = false;
    this.overlayEl.style.opacity = '0';
    setTimeout(() => {
      if (!this.isOpened) {
        this.overlayEl.style.display = 'none';
      }
    }, 250);
  }

  public toggle(): void {
    if (this.isOpened) {
      this.close();
    } else {
      this.open();
    }
  }

  // ── Quitter l'application ────────────────────────────────────────────
  public quitApplication(): void {
    if (this.ipcRenderer) {
      this.ipcRenderer.send('app:quit');
    } else {
      window.close();
    }
  }
}
