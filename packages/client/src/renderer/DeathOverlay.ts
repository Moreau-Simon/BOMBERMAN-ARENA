import { EventBus } from './EventBus';

export interface DeathOverlayOptions {
  isSolo: boolean;
  onQuit: () => void;
  onSpectate?: () => void;
}

/**
 * DeathOverlay : affiche un overlay plein écran lors de la mort du personnage.
 * Si le joueur est seul, il doit obligatoirement quitter.
 * S'il y a d'autres joueurs, il a le choix entre quitter ou regarder la fin de la partie.
 */
export class DeathOverlay {
  private overlayEl: HTMLDivElement;
  private isDestroyed = false;

  constructor(
    private eventBus: EventBus,
    private options: DeathOverlayOptions
  ) {
    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'death-overlay';
    this.overlayEl.style.position = 'fixed';
    this.overlayEl.style.top = '0';
    this.overlayEl.style.left = '0';
    this.overlayEl.style.width = '100%';
    this.overlayEl.style.height = '100%';
    this.overlayEl.style.background = 'rgba(0, 0, 0, 0.88)';
    this.overlayEl.style.backdropFilter = 'blur(6px)';
    this.overlayEl.style.display = 'flex';
    this.overlayEl.style.flexDirection = 'column';
    this.overlayEl.style.alignItems = 'center';
    this.overlayEl.style.justifyContent = 'center';
    this.overlayEl.style.zIndex = '1000';
    this.overlayEl.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    this.overlayEl.style.color = '#ffffff';
    this.overlayEl.style.textAlign = 'center';
    this.overlayEl.style.padding = '2rem';
    this.overlayEl.style.opacity = '0';
    this.overlayEl.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

    // Titre principal
    const title = document.createElement('h1');
    title.innerText = "T'ES MORT !";
    title.style.margin = '0 0 12px 0';
    title.style.fontSize = '2.8rem';
    title.style.fontWeight = '900';
    title.style.color = '#ff4757';
    title.style.letterSpacing = '3px';
    title.style.textShadow = '0 0 25px rgba(255, 71, 87, 0.6), 0 4px 10px rgba(0, 0, 0, 0.7)';
    this.overlayEl.appendChild(title);

    // Message descriptif / explicatif
    const desc = document.createElement('p');
    desc.style.margin = '0 0 32px 0';
    desc.style.fontSize = '1.25rem';
    desc.style.color = '#ced6e0';
    desc.style.maxWidth = '550px';
    desc.style.lineHeight = '1.6';

    if (this.options.isSolo) {
      desc.innerText = "Tu étais tout seul dans la partie.";
    } else {
      desc.innerText = "Tu as été éliminé ! Clique sur Continuer pour regarder la partie se finir, ou sur Quitter.";
    }
    this.overlayEl.appendChild(desc);

    // Conteneur des boutons
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '20px';
    btnContainer.style.justifyContent = 'center';
    btnContainer.style.flexWrap = 'wrap';

    // Option spectateur en réseau pour continuer à regarder la partie se finir
    if (!this.options.isSolo && this.options.onSpectate) {
      const btnSpectate = document.createElement('button');
      btnSpectate.id = 'btn-death-spectate';
      btnSpectate.innerText = 'CONTINUER';
      this.styleButton(btnSpectate, '#3742fa', '#2f3542', 'rgba(55, 66, 250, 0.45)');
      btnSpectate.addEventListener('click', () => {
        this.fadeOutAndRemove(() => {
          this.options.onSpectate?.();
        });
      });
      btnContainer.appendChild(btnSpectate);
    }

    // Bouton Quitter
    const btnQuit = document.createElement('button');
    btnQuit.id = 'btn-death-quit';
    btnQuit.innerText = 'QUITTER';
    this.styleButton(btnQuit, '#ff4757', '#c0392b', 'rgba(255, 71, 87, 0.45)');
    btnQuit.addEventListener('click', () => {
      this.fadeOutAndRemove(() => {
        this.options.onQuit();
      });
    });
    btnContainer.appendChild(btnQuit);

    this.overlayEl.appendChild(btnContainer);

    document.body.appendChild(this.overlayEl);

    // Déclenchement de l'animation d'apparition
    requestAnimationFrame(() => {
      this.overlayEl.style.opacity = '1';
    });
  }

  /**
   * Applique les styles modernes et les effets de survol aux boutons.
   */
  private styleButton(btn: HTMLButtonElement, color1: string, color2: string, shadowColor: string): void {
    btn.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
    btn.style.color = '#ffffff';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    btn.style.borderRadius = '8px';
    btn.style.padding = '14px 28px';
    btn.style.fontSize = '1.05rem';
    btn.style.fontWeight = '700';
    btn.style.cursor = 'pointer';
    btn.style.letterSpacing = '1px';
    btn.style.boxShadow = `0 4px 15px ${shadowColor}`;
    btn.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px) scale(1.03)';
      btn.style.boxShadow = `0 6px 20px ${shadowColor}`;
      btn.style.filter = 'brightness(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.boxShadow = `0 4px 15px ${shadowColor}`;
      btn.style.filter = 'brightness(1)';
    });
  }

  private fadeOutAndRemove(callback?: () => void): void {
    if (this.isDestroyed) return;
    this.overlayEl.style.opacity = '0';
    setTimeout(() => {
      this.destroy();
      callback?.();
    }, 400);
  }

  /**
   * Supprime proprement l'overlay du DOM.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
  }
}
