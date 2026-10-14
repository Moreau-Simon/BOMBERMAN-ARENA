import { EventBus } from './EventBus';

/**
 * IntroOverlay : affiche un overlay cinématique annonçant l'arène tirée au sort
 * (Urbain vs Campagne) avec son message d'introduction avant le début de partie.
 */
export class IntroOverlay {
  private overlayEl: HTMLDivElement;
  private timeoutId: number | undefined;

  constructor(
    private eventBus: EventBus,
    private message: string,
    private theme: string = 'URBAN',
    private durationMs: number = 3000
  ) {
    const isUrban = this.theme === 'URBAN';
    const accentColor = isUrban ? '#ff6b35' : '#2ed573';
    const arenaTitle = isUrban ? 'ARÈNE URBAINE' : 'ARÈNE CAMPAGNE';
    const arenaSub = isUrban ? 'ZONE INDUSTRIELLE DOWNTOWN' : 'ZONE NATURE & PRAIRIES';

    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'arena-intro-overlay';
    this.overlayEl.style.position = 'fixed';
    this.overlayEl.style.top = '0';
    this.overlayEl.style.left = '0';
    this.overlayEl.style.width = '100%';
    this.overlayEl.style.height = '100%';
    this.overlayEl.style.background = isUrban
      ? 'radial-gradient(circle at center, rgba(27, 38, 59, 0.94) 0%, rgba(8, 13, 20, 0.98) 100%)'
      : 'radial-gradient(circle at center, rgba(22, 51, 36, 0.94) 0%, rgba(6, 20, 13, 0.98) 100%)';
    this.overlayEl.style.backdropFilter = 'blur(10px)';
    this.overlayEl.style.display = 'flex';
    this.overlayEl.style.flexDirection = 'column';
    this.overlayEl.style.alignItems = 'center';
    this.overlayEl.style.justifyContent = 'center';
    this.overlayEl.style.gap = '18px';
    this.overlayEl.style.zIndex = '1000';
    this.overlayEl.style.fontFamily = "'Inter', sans-serif";
    this.overlayEl.style.textAlign = 'center';
    this.overlayEl.style.padding = '2rem';
    this.overlayEl.style.opacity = '0';
    this.overlayEl.style.transition = 'opacity 0.4s ease';

    // Badge de l'arène
    const badge = document.createElement('div');
    badge.innerText = arenaTitle;
    badge.style.fontFamily = "'PressStart', monospace";
    badge.style.fontSize = '1.3rem';
    badge.style.letterSpacing = '3px';
    badge.style.color = accentColor;
    badge.style.padding = '12px 24px';
    badge.style.borderRadius = '12px';
    badge.style.background = `rgba(${isUrban ? '255, 107, 53' : '46, 213, 115'}, 0.15)`;
    badge.style.border = `2px solid ${accentColor}`;
    badge.style.boxShadow = `0 0 30px ${accentColor}55`;
    this.overlayEl.appendChild(badge);

    // Sous-titre arène
    const sub = document.createElement('div');
    sub.innerText = arenaSub;
    sub.style.fontSize = '0.85rem';
    sub.style.color = '#ced6e0';
    sub.style.letterSpacing = '4px';
    sub.style.fontWeight = 'bold';
    this.overlayEl.appendChild(sub);

    // Message d'ambiance
    const msgEl = document.createElement('p');
    msgEl.innerText = this.message;
    msgEl.style.fontSize = '1.4rem';
    msgEl.style.color = '#ffffff';
    msgEl.style.maxWidth = '600px';
    msgEl.style.lineHeight = '1.6';
    msgEl.style.margin = '10px 0 0 0';
    msgEl.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.7)';
    this.overlayEl.appendChild(msgEl);

    document.body.appendChild(this.overlayEl);

    // Fade-in
    requestAnimationFrame(() => {
      this.overlayEl.style.opacity = '1';
    });

    this.timeoutId = window.setTimeout(() => this.end(), this.durationMs);
  }

  public destroy(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
    this.removeOverlay();
  }

  private end(): void {
    this.overlayEl.style.opacity = '0';
    setTimeout(() => this.removeOverlay(), 400);
    this.eventBus.emit('lobby:intro_end', undefined);
  }

  private removeOverlay(): void {
    if (this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
  }
}
