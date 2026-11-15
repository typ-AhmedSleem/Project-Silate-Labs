import { DebugPanel } from './DebugPanel.js';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

/**
 * UI Controller
 * Manages DOM interactions, status bar, playback controls, modal overlays, and toast alerts.
 */
export class UI {
  public readonly debugPanel: DebugPanel;

  private overlayEl: HTMLElement | null;
  private retryBtn: HTMLElement | null;
  private statusDotEl: HTMLElement | null;
  private statusTextEl: HTMLElement | null;
  private phraseInput: HTMLInputElement | null;
  private translateBtn: HTMLButtonElement | null;
  private toastContainer: HTMLElement | null;

  // Playback Control Buttons (Phase 6)
  private pauseBtn: HTMLButtonElement | null;
  private resumeBtn: HTMLButtonElement | null;
  private stopBtn: HTMLButtonElement | null;

  private onRetryCallback?: () => void;
  private onTranslateCallback?: (phrase: string) => void;
  private onPauseCallback?: () => void;
  private onResumeCallback?: () => void;
  private onStopCallback?: () => void;

  constructor() {
    this.debugPanel = new DebugPanel();
    this.overlayEl = document.getElementById('viewport-overlay');
    this.retryBtn = document.getElementById('retry-load-btn');
    this.statusDotEl = document.querySelector('.status-dot');
    this.statusTextEl = document.getElementById('status-text');
    this.phraseInput = document.getElementById('phrase-input') as HTMLInputElement;
    this.translateBtn = document.getElementById('translate-btn') as HTMLButtonElement;
    this.toastContainer = document.getElementById('toast-container');

    this.pauseBtn = document.getElementById('playback-pause-btn') as HTMLButtonElement;
    this.resumeBtn = document.getElementById('playback-resume-btn') as HTMLButtonElement;
    this.stopBtn = document.getElementById('playback-stop-btn') as HTMLButtonElement;

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
        this.showToast('Please enter a phrase to translate (e.g., "hello how are you")', 'warn');
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

    // Playback control event listeners
    this.pauseBtn?.addEventListener('click', () => {
      if (this.onPauseCallback) {
        this.onPauseCallback();
      }
    });

    this.resumeBtn?.addEventListener('click', () => {
      if (this.onResumeCallback) {
        this.onResumeCallback();
      }
    });

    this.stopBtn?.addEventListener('click', () => {
      if (this.onStopCallback) {
        this.onStopCallback();
      }
    });
  }

  /**
   * Registers callback for Translate button click.
   */
  public onTranslate(callback: (phrase: string) => void): void {
    this.onTranslateCallback = callback;
  }

  /**
   * Registers callback for Retry Model button click.
   */
  public onRetry(callback: () => void): void {
    this.onRetryCallback = callback;
  }

  /**
   * Registers playback Pause callback.
   */
  public onPause(callback: () => void): void {
    this.onPauseCallback = callback;
  }

  /**
   * Registers playback Resume callback.
   */
  public onResume(callback: () => void): void {
    this.onResumeCallback = callback;
  }

  /**
   * Registers playback Stop callback.
   */
  public onStop(callback: () => void): void {
    this.onStopCallback = callback;
  }

  /**
   * Updates playback button states according to executor state.
   */
  public setPlaybackState(state: 'idle' | 'playing' | 'paused'): void {
    if (!this.pauseBtn || !this.resumeBtn || !this.stopBtn) return;

    if (state === 'playing') {
      this.pauseBtn.classList.remove('hidden');
      this.pauseBtn.disabled = false;
      this.resumeBtn.classList.add('hidden');
      this.stopBtn.disabled = false;
    } else if (state === 'paused') {
      this.pauseBtn.classList.add('hidden');
      this.resumeBtn.classList.remove('hidden');
      this.resumeBtn.disabled = false;
      this.stopBtn.disabled = false;
    } else {
      // idle or stopped
      this.pauseBtn.classList.remove('hidden');
      this.pauseBtn.disabled = true;
      this.resumeBtn.classList.add('hidden');
      this.resumeBtn.disabled = true;
      this.stopBtn.disabled = true;
    }
  }

  /**
   * Displays a user-friendly toast message.
   */
  public showToast(message: string, type: ToastType = 'info', durationMs: number = 3800): void {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons: Record<ToastType, string> = {
      info: 'ℹ️',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    };

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${icons[type]}</span>
        <span>${message}</span>
      </div>
      <button class="icon-btn" style="padding: 2px 6px; font-size: 12px;" title="Dismiss">✕</button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn?.addEventListener('click', () => {
      this.removeToast(toast);
    });

    this.toastContainer.appendChild(toast);

    if (durationMs > 0) {
      setTimeout(() => {
        this.removeToast(toast);
      }, durationMs);
    }
  }

  private removeToast(toast: HTMLElement): void {
    if (!toast.parentElement) return;
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 220);
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
    this.showToast('Avatar model missing at assets/model/humanoid.glb', 'error', 6000);
    this.debugPanel.log('Avatar model missing: Place your Mixamo .glb at assets/model/humanoid.glb and click Retry', 'warn');
  }

  public hideOverlay(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.add('hidden');
    }
  }
}

