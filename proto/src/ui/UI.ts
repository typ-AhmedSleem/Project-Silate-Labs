import { DebugPanel } from './DebugPanel.js';

export class UI {
  public readonly debugPanel: DebugPanel;

  private overlayEl: HTMLElement | null;
  private retryBtn: HTMLElement | null;
  private statusDotEl: HTMLElement | null;
  private statusTextEl: HTMLElement | null;
  private phraseInput: HTMLInputElement | null;
  private translateBtn: HTMLButtonElement | null;

  private onRetryCallback?: () => void;
  private onTranslateCallback?: (phrase: string) => void;

  constructor() {
    this.debugPanel = new DebugPanel();
    this.overlayEl = document.getElementById('viewport-overlay');
    this.retryBtn = document.getElementById('retry-load-btn');
    this.statusDotEl = document.querySelector('.status-dot');
    this.statusTextEl = document.getElementById('status-text');
    this.phraseInput = document.getElementById('phrase-input') as HTMLInputElement;
    this.translateBtn = document.getElementById('translate-btn') as HTMLButtonElement;

    this.initEvents();
  }

  private initEvents(): void {
    this.retryBtn?.addEventListener('click', () => {
      this.hideOverlay();
      this.setStatus('Retrying avatar load...', 'loading');
      if (this.onRetryCallback) {
        this.onRetryCallback();
      }
    });

    this.translateBtn?.addEventListener('click', () => {
      const phrase = this.phraseInput?.value.trim();
      if (!phrase) {
        this.debugPanel.log('Please enter a phrase to translate', 'warn');
        return;
      }
      if (this.onTranslateCallback) {
        this.onTranslateCallback(phrase);
      }
    });

    this.phraseInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.translateBtn?.click();
      }
    });
  }

  public onTranslate(callback: (phrase: string) => void): void {
    this.onTranslateCallback = callback;
  }

  public onRetry(callback: () => void): void {
    this.onRetryCallback = callback;
  }

  public setStatus(text: string, state: 'loading' | 'ready' | 'error' = 'ready'): void {
    if (this.statusTextEl) {
      this.statusTextEl.textContent = text;
    }

    if (this.statusDotEl) {
      this.statusDotEl.className = 'status-dot';
      if (state === 'ready') {
        this.statusDotEl.classList.add('active');
        this.debugPanel.setAppState('IDLE');
      } else if (state === 'error') {
        this.statusDotEl.classList.add('error');
        this.debugPanel.setAppState('ERROR');
      } else {
        this.debugPanel.setAppState('LOADING');
      }
    }
  }

  public showMissingModelOverlay(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('hidden');
    }
    this.setStatus('Model not found at assets/model/humanoid.glb', 'error');
    this.debugPanel.setModelStatus('File missing');
    this.debugPanel.log('Avatar model missing: Place your Mixamo .glb at assets/model/humanoid.glb and click Retry', 'warn');
  }

  public hideOverlay(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.add('hidden');
    }
  }
}
