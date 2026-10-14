import { EventBus } from './EventBus';

/**
 * IntroOverlay : affiche un fond noir semi‑transparent avec un texte d'introduction.
 * Après `durationMs` millisecondes, l'overlay disparaît et un événement `lobby:intro_end`
 * est émis sur l'EventBus.
 */
export class IntroOverlay {
  private overlayEl: HTMLDivElement;
  private timeoutId: number | undefined;

  constructor(private eventBus: EventBus, private message: string, private durationMs: number = 3000) {
    this.overlayEl = document.createElement('div');
    this.overlayEl.style.position = 'fixed';
    this.overlayEl.style.top = '0';
    this.overlayEl.style.left = '0';
    this.overlayEl.style.width = '100%';
    this.overlayEl.style.height = '100%';
    this.overlayEl.style.background = 'rgba(0, 0, 0, 0.85)';
    this.overlayEl.style.display = 'flex';
    this.overlayEl.style.alignItems = 'center';
    this.overlayEl.style.justifyContent = 'center';
    this.overlayEl.style.zIndex = '1000';
    this.overlayEl.style.fontFamily = "'Inter', sans-serif";
    this.overlayEl.style.fontSize = '2rem';
    this.overlayEl.style.color = '#ffffff';
    this.overlayEl.style.textAlign = 'center';
    this.overlayEl.style.padding = '2rem';
    this.overlayEl.style.opacity = '0';
    this.overlayEl.style.transition = 'opacity 0.5s ease';
    this.overlayEl.innerText = this.message;

    document.body.appendChild(this.overlayEl);
    // Fade‑in
    requestAnimationFrame(() => {
      this.overlayEl.style.opacity = '1';
    });

    this.timeoutId = window.setTimeout(() => this.end(), this.durationMs);
  }

  /** Force la fermeture prématurée (au cas où on voudrait l'annuler). */
  public destroy() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
    this.removeOverlay();
  }

  private end() {
    // Fade‑out then remove
    this.overlayEl.style.opacity = '0';
    setTimeout(() => this.removeOverlay(), 500);
    // Notifier le bus
    this.eventBus.emit('lobby:intro_end', undefined);
  }

  private removeOverlay() {
    if (this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
  }
}
