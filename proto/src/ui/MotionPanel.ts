export class MotionPanel {
  private panel: HTMLElement;
  private toggleBtn: HTMLElement | null;
  private closeBtn: HTMLElement | null;

  // Indicators
  private cameraIndicator: HTMLElement | null;
  private modelIndicator: HTMLElement | null;
  private latencyIndicator: HTMLElement | null;

  // Video & Controls
  public readonly videoEl: HTMLVideoElement;
  public readonly canvasEl: HTMLCanvasElement;
  private countdownEl: HTMLElement | null;
  private cameraToggleBtn: HTMLButtonElement | null;

  // Tabs
  private tabButtons: NodeListOf<HTMLButtonElement>;
  private tabContents: NodeListOf<HTMLElement>;

  // Capture Controls
  private captureStatusEl: HTMLElement | null;
  private captureStartBtn: HTMLButtonElement | null;
  private captureStopBtn: HTMLButtonElement | null;
  private captureSaveBtn: HTMLButtonElement | null;
  private captureSavePathInput: HTMLInputElement | null;
  private capturedFramesCountEl: HTMLElement | null;

  // Sync Controls
  private syncStatusEl: HTMLElement | null;
  private syncToggleBtn: HTMLButtonElement | null;

  // Play Controls
  private playLoadBtn: HTMLButtonElement | null;
  private playFileInput: HTMLInputElement | null;
  private playInfoEl: HTMLElement | null;
  private playFramesCountEl: HTMLElement | null;
  private playProgressSlider: HTMLInputElement | null;
  private playCurrentFrameEl: HTMLElement | null;
  private playSpeedSlider: HTMLInputElement | null;
  private playSpeedValue: HTMLElement | null;
  private playControlsGroup: HTMLElement | null;
  private playStartBtn: HTMLButtonElement | null;
  private playStopBtn: HTMLButtonElement | null;

  // Video File Player Controls
  private videoFileInput: HTMLInputElement | null;
  private videoLoadBtn: HTMLButtonElement | null;
  private videoPlayerSection: HTMLElement | null;
  private videoPreviewContainer: HTMLElement | null;
  private videoUnloadBtn: HTMLButtonElement | null;
  private videoFilenameEl: HTMLElement | null;
  private videoTimeEl: HTMLElement | null;
  private videoProgressSlider: HTMLInputElement | null;
  private videoPlayBtn: HTMLButtonElement | null;
  private videoLoopBtn: HTMLButtonElement | null;
  private videoObjectUrl: string | null = null;
  private videoTimeUpdateHandler: (() => void) | null = null;

  // Callbacks
  private onCameraToggleCb?: () => void;
  private onCaptureStartCb?: () => void;
  private onCaptureStopCb?: () => void;
  private onCaptureSaveCb?: (savePath: string) => void;
  private onSyncToggleCb?: () => void;
  private onPlayLoadCb?: () => void;
  private onPlayStartCb?: () => void;
  private onPlayStopCb?: () => void;
  private onPlaySeekCb?: (frame: number) => void;
  private onPlaySpeedChangeCb?: (speed: number) => void;
  private onPlayFileSelectedCb?: (file: File) => void;
  private onVideoFileLoadedCb?: (file: File) => void;
  private onVideoUnloadCb?: () => void;

  private isCollapsed: boolean = true;
  private countdownTimer: number | null = null;

  constructor() {
    this.panel = document.getElementById('motion-panel') as HTMLElement;
    this.toggleBtn = document.getElementById('motion-toggle-btn');
    this.closeBtn = document.getElementById('motion-close-btn');

    this.cameraIndicator = document.getElementById('camera-status-indicator');
    this.modelIndicator = document.getElementById('model-status-indicator');
    this.latencyIndicator = document.getElementById('model-latency-indicator');

    this.videoEl = document.getElementById('camera-video') as HTMLVideoElement;
    this.canvasEl = document.getElementById('landmark-canvas') as HTMLCanvasElement;
    this.countdownEl = document.getElementById('capture-countdown');
    this.cameraToggleBtn = document.getElementById('camera-toggle-btn') as HTMLButtonElement | null;

    this.tabButtons = document.querySelectorAll('.motion-tab');
    this.tabContents = document.querySelectorAll('.motion-tab-content');

    this.captureStatusEl = document.getElementById('capture-status');
    this.captureStartBtn = document.getElementById('capture-start-btn') as HTMLButtonElement | null;
    this.captureStopBtn = document.getElementById('capture-stop-btn') as HTMLButtonElement | null;
    this.captureSaveBtn = document.getElementById('capture-save-btn') as HTMLButtonElement | null;
    this.captureSavePathInput = document.getElementById('capture-save-path') as HTMLInputElement | null;
    this.capturedFramesCountEl = document.getElementById('captured-frames-count');

    this.syncStatusEl = document.getElementById('sync-status');
    this.syncToggleBtn = document.getElementById('sync-toggle-btn') as HTMLButtonElement | null;

    this.playLoadBtn = document.getElementById('play-load-btn') as HTMLButtonElement | null;
    this.playFileInput = document.getElementById('play-file-input') as HTMLInputElement | null;
    this.playInfoEl = document.getElementById('play-info');
    this.playFramesCountEl = document.getElementById('play-frames-count');
    this.playProgressSlider = document.getElementById('play-progress-slider') as HTMLInputElement | null;
    this.playCurrentFrameEl = document.getElementById('play-current-frame');
    this.playSpeedSlider = document.getElementById('play-speed-slider') as HTMLInputElement | null;
    this.playSpeedValue = document.getElementById('play-speed-value');
    this.playControlsGroup = document.getElementById('play-controls-group');
    this.playStartBtn = document.getElementById('play-start-btn') as HTMLButtonElement | null;
    this.playStopBtn = document.getElementById('play-stop-btn') as HTMLButtonElement | null;

    // Video File Player
    this.videoFileInput = document.getElementById('video-file-input') as HTMLInputElement | null;
    this.videoLoadBtn = document.getElementById('video-load-btn') as HTMLButtonElement | null;
    this.videoPlayerSection = document.getElementById('video-player-section');
    this.videoPreviewContainer = document.getElementById('video-preview-container');
    this.videoUnloadBtn = document.getElementById('video-unload-btn') as HTMLButtonElement | null;
    this.videoFilenameEl = document.getElementById('video-filename');
    this.videoTimeEl = document.getElementById('video-time');
    this.videoProgressSlider = document.getElementById('video-progress-slider') as HTMLInputElement | null;
    this.videoPlayBtn = document.getElementById('video-play-btn') as HTMLButtonElement | null;
    this.videoLoopBtn = document.getElementById('video-loop-btn') as HTMLButtonElement | null;

    this.initEvents();
  }

  private initEvents(): void {
    // Panel toggle / close
    this.toggleBtn?.addEventListener('click', () => this.toggle());
    this.closeBtn?.addEventListener('click', () => this.toggle(true));

    // Tab switching
    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return;

        this.tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        this.tabContents.forEach((content) => {
          content.classList.toggle('active', content.id === `tab-${targetTab}`);
        });
      });
    });

    // Camera toggle
    this.cameraToggleBtn?.addEventListener('click', () => {
      this.onCameraToggleCb?.();
    });

    // Capture controls
    this.captureStartBtn?.addEventListener('click', () => {
      this.onCaptureStartCb?.();
    });

    this.captureStopBtn?.addEventListener('click', () => {
      this.onCaptureStopCb?.();
    });

    this.captureSaveBtn?.addEventListener('click', () => {
      const path = this.captureSavePathInput?.value.trim() || '/assets/motions/captured';
      this.onCaptureSaveCb?.(path);
    });

    // Sync controls
    this.syncToggleBtn?.addEventListener('click', () => {
      this.onSyncToggleCb?.();
    });

    // Play controls
    this.playLoadBtn?.addEventListener('click', () => {
      if (this.playFileInput) {
        this.playFileInput.value = '';
        this.playFileInput.click();
      }
      this.onPlayLoadCb?.();
    });

    this.playFileInput?.addEventListener('change', () => {
      const file = this.playFileInput?.files?.[0];
      if (file) {
        this.onPlayFileSelectedCb?.(file);
      }
    });

    this.playStartBtn?.addEventListener('click', () => {
      this.onPlayStartCb?.();
    });

    this.playStopBtn?.addEventListener('click', () => {
      this.onPlayStopCb?.();
    });

    this.playProgressSlider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.onPlaySeekCb?.(val);
    });

    this.playSpeedSlider?.addEventListener('input', (e) => {
      const speed = parseFloat((e.target as HTMLInputElement).value);
      if (this.playSpeedValue) {
        this.playSpeedValue.textContent = `${speed.toFixed(1)}×`;
      }
      this.onPlaySpeedChangeCb?.(speed);
    });

    // Video File Player events
    this.videoLoadBtn?.addEventListener('click', () => {
      if (this.videoFileInput) {
        this.videoFileInput.value = '';
        this.videoFileInput.click();
      }
    });

    this.videoFileInput?.addEventListener('change', () => {
      const file = this.videoFileInput?.files?.[0];
      if (file) this.loadVideoFile(file);
    });

    this.videoUnloadBtn?.addEventListener('click', () => {
      this.unloadVideo();
      this.onVideoUnloadCb?.();
    });

    this.videoPlayBtn?.addEventListener('click', () => {
      if (this.videoEl.paused) {
        this.videoEl.play();
        this.videoPlayBtn!.textContent = '⏸ Pause Video';
      } else {
        this.videoEl.pause();
        this.videoPlayBtn!.textContent = '▶ Play Video';
      }
    });

    this.videoLoopBtn?.addEventListener('click', () => {
      this.videoEl.loop = !this.videoEl.loop;
      this.videoLoopBtn!.textContent = `🔁 Loop: ${this.videoEl.loop ? 'On' : 'Off'}`;
      this.videoLoopBtn!.classList.toggle('active', this.videoEl.loop);
    });

    this.videoProgressSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (isFinite(this.videoEl.duration)) {
        this.videoEl.currentTime = val;
      }
    });
  }

  public toggle(forceCollapse?: boolean): void {
    if (forceCollapse !== undefined) {
      this.isCollapsed = forceCollapse;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }

    if (this.panel) {
      this.panel.classList.toggle('collapsed', this.isCollapsed);
    }
  }

  public setCameraStatus(active: boolean): void {
    if (this.cameraIndicator) {
      const dot = this.cameraIndicator.querySelector('.indicator-dot');
      const label = this.cameraIndicator.querySelector('.indicator-label');
      if (dot) {
        dot.className = `indicator-dot ${active ? 'green' : 'red'}`;
      }
      if (label) {
        label.textContent = `Camera: ${active ? 'On' : 'Off'}`;
      }
    }

    if (this.cameraToggleBtn) {
      if (active) {
        this.cameraToggleBtn.textContent = '⏹ Stop Camera & Model';
        this.cameraToggleBtn.classList.remove('btn-secondary');
        this.cameraToggleBtn.classList.add('btn-danger');
      } else {
        this.cameraToggleBtn.textContent = '▶ Start Camera & Model';
        this.cameraToggleBtn.classList.remove('btn-danger');
        this.cameraToggleBtn.classList.add('btn-secondary');
      }
    }
  }

  public setModelStatus(status: 'off' | 'loading' | 'ready' | 'error'): void {
    if (this.modelIndicator) {
      const dot = this.modelIndicator.querySelector('.indicator-dot');
      const label = this.modelIndicator.querySelector('.indicator-label');
      let colorClass = 'red';
      let text = 'Model: Off';

      if (status === 'loading') {
        colorClass = 'amber';
        text = 'Model: Loading...';
      } else if (status === 'ready') {
        colorClass = 'green';
        text = 'Model: Ready';
      } else if (status === 'error') {
        colorClass = 'red';
        text = 'Model: Error';
      }

      if (dot) dot.className = `indicator-dot ${colorClass}`;
      if (label) label.textContent = text;
    }

    const canOperate = status === 'ready';
    if (this.captureStartBtn && this.captureStatusEl?.textContent?.includes('Idle')) {
      this.captureStartBtn.disabled = !canOperate;
    }
    if (this.syncToggleBtn) {
      this.syncToggleBtn.disabled = !canOperate;
    }
  }

  public setLatency(ms: number): void {
    if (this.latencyIndicator) {
      const label = this.latencyIndicator.querySelector('.indicator-label');
      if (label) {
        label.textContent = `⏱ ${ms}ms`;
      }
    }
  }

  public setCaptureState(state: 'idle' | 'countdown' | 'recording'): void {
    if (this.captureStatusEl) {
      if (state === 'idle') {
        this.captureStatusEl.textContent = '⏹ Idle';
        this.captureStatusEl.className = 'stat-value';
      } else if (state === 'countdown') {
        this.captureStatusEl.textContent = '⏳ Preparing...';
        this.captureStatusEl.className = 'stat-value amber';
      } else if (state === 'recording') {
        this.captureStatusEl.textContent = '⏺ Recording...';
        this.captureStatusEl.className = 'stat-value red';
      }
    }

    if (this.captureStartBtn) {
      this.captureStartBtn.disabled = state !== 'idle';
    }
    if (this.captureStopBtn) {
      this.captureStopBtn.disabled = state !== 'recording';
    }
  }

  public setCapturedFramesCount(count: number): void {
    if (this.capturedFramesCountEl) {
      this.capturedFramesCountEl.textContent = count.toString();
    }
  }

  public setSaveEnabled(enabled: boolean): void {
    if (this.captureSaveBtn) {
      this.captureSaveBtn.disabled = !enabled;
    }
  }

  public showCountdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.countdownEl) {
        resolve();
        return;
      }

      if (this.countdownTimer) {
        window.clearInterval(this.countdownTimer);
      }

      let current = seconds;
      this.countdownEl.textContent = current.toString();
      this.countdownEl.classList.remove('hidden');

      this.countdownTimer = window.setInterval(() => {
        current--;
        if (current > 0) {
          if (this.countdownEl) this.countdownEl.textContent = current.toString();
        } else {
          if (this.countdownTimer) window.clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          if (this.countdownEl) this.countdownEl.classList.add('hidden');
          resolve();
        }
      }, 1000);
    });
  }

  // Sync state
  public setSyncState(active: boolean): void {
    if (this.syncStatusEl) {
      this.syncStatusEl.textContent = active ? '⏺ Active (Live)' : '⏹ Inactive';
      this.syncStatusEl.className = `stat-value ${active ? 'green' : ''}`;
    }
    if (this.syncToggleBtn) {
      this.syncToggleBtn.textContent = active ? '⏹ Stop Sync' : '▶ Start Sync';
      this.syncToggleBtn.classList.toggle('btn-danger', active);
      this.syncToggleBtn.classList.toggle('btn-primary', !active);
    }
  }

  // Playback state
  public setMotionData(frameCount: number): void {
    if (this.playInfoEl) this.playInfoEl.classList.remove('hidden');
    if (this.playControlsGroup) this.playControlsGroup.classList.remove('hidden');
    if (this.playFramesCountEl) this.playFramesCountEl.textContent = frameCount.toString();
    if (this.playProgressSlider) {
      this.playProgressSlider.max = Math.max(0, frameCount - 1).toString();
      this.playProgressSlider.value = '0';
    }
    if (this.playCurrentFrameEl) {
      this.playCurrentFrameEl.textContent = `0 / ${frameCount}`;
    }
  }

  public setPlayProgress(current: number, total: number): void {
    if (this.playProgressSlider) {
      this.playProgressSlider.value = current.toString();
    }
    if (this.playCurrentFrameEl) {
      this.playCurrentFrameEl.textContent = `${current} / ${total}`;
    }
  }

  public setPlayState(state: 'idle' | 'playing' | 'paused'): void {
    if (this.playStartBtn) {
      if (state === 'playing') {
        this.playStartBtn.textContent = '⏸ Pause';
      } else {
        this.playStartBtn.textContent = '▶ Play';
      }
    }
  }

  // Video file management
  private loadVideoFile(file: File): void {
    this.unloadVideo();

    this.videoObjectUrl = URL.createObjectURL(file);
    this.videoEl.srcObject = null; // detach camera stream
    this.videoEl.src = this.videoObjectUrl;
    this.videoEl.muted = true;
    this.videoEl.playsInline = true;

    // Un-mirror for file playback
    this.videoPreviewContainer?.classList.add('video-file-mode');

    if (this.videoFilenameEl) this.videoFilenameEl.textContent = file.name;
    this.videoPlayerSection?.classList.remove('hidden');

    // Wait for metadata to set slider range
    this.videoEl.onloadedmetadata = () => {
      if (this.videoProgressSlider && isFinite(this.videoEl.duration)) {
        this.videoProgressSlider.max = this.videoEl.duration.toString();
        this.videoProgressSlider.value = '0';
      }
      this.updateVideoTime();
    };

    // Track time updates
    this.videoTimeUpdateHandler = () => this.updateVideoTime();
    this.videoEl.addEventListener('timeupdate', this.videoTimeUpdateHandler);

    this.videoEl.addEventListener('ended', () => {
      if (this.videoPlayBtn) this.videoPlayBtn.textContent = '▶ Play Video';
    }, { once: false });

    this.onVideoFileLoadedCb?.(file);
  }

  public unloadVideo(): void {
    if (this.videoTimeUpdateHandler) {
      this.videoEl.removeEventListener('timeupdate', this.videoTimeUpdateHandler);
      this.videoTimeUpdateHandler = null;
    }
    this.videoEl.pause();
    if (this.videoObjectUrl) {
      URL.revokeObjectURL(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }
    this.videoEl.removeAttribute('src');
    this.videoEl.srcObject = null;
    this.videoPreviewContainer?.classList.remove('video-file-mode');
    this.videoPlayerSection?.classList.add('hidden');
    if (this.videoPlayBtn) this.videoPlayBtn.textContent = '▶ Play Video';
    if (this.videoFilenameEl) this.videoFilenameEl.textContent = 'No video loaded';
    if (this.videoTimeEl) this.videoTimeEl.textContent = '0:00 / 0:00';
    if (this.videoProgressSlider) {
      this.videoProgressSlider.max = '100';
      this.videoProgressSlider.value = '0';
    }
  }

  private updateVideoTime(): void {
    const cur = this.videoEl.currentTime || 0;
    const dur = this.videoEl.duration || 0;
    if (this.videoTimeEl) {
      this.videoTimeEl.textContent = `${this.fmtTime(cur)} / ${this.fmtTime(dur)}`;
    }
    if (this.videoProgressSlider && isFinite(dur)) {
      this.videoProgressSlider.value = cur.toString();
    }
  }

  private fmtTime(s: number): string {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  public isVideoFileMode(): boolean {
    return this.videoObjectUrl !== null;
  }

  // Callback bindings
  public onCameraToggle(cb: () => void): void { this.onCameraToggleCb = cb; }
  public onCaptureStart(cb: () => void): void { this.onCaptureStartCb = cb; }
  public onCaptureStop(cb: () => void): void { this.onCaptureStopCb = cb; }
  public onCaptureSave(cb: (path: string) => void): void { this.onCaptureSaveCb = cb; }
  public onSyncToggle(cb: () => void): void { this.onSyncToggleCb = cb; }
  public onPlayLoad(cb: () => void): void { this.onPlayLoadCb = cb; }
  public onPlayStart(cb: () => void): void { this.onPlayStartCb = cb; }
  public onPlayStop(cb: () => void): void { this.onPlayStopCb = cb; }
  public onPlaySeek(cb: (frame: number) => void): void { this.onPlaySeekCb = cb; }
  public onPlaySpeedChange(cb: (speed: number) => void): void { this.onPlaySpeedChangeCb = cb; }
  public onPlayFileSelected(cb: (file: File) => void): void { this.onPlayFileSelectedCb = cb; }
  public onVideoFileLoaded(cb: (file: File) => void): void { this.onVideoFileLoadedCb = cb; }
  public onVideoUnload(cb: () => void): void { this.onVideoUnloadCb = cb; }
}
