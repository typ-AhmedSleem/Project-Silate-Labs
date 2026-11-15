import { SkeletonTreeNode, AvatarLoadResult } from '../avatar/Avatar.js';

export class DebugPanel {
  private panel: HTMLElement;
  private closeBtn: HTMLElement | null;
  private toggleBtn: HTMLElement | null;
  private modelStatusEl: HTMLElement | null;
  private bonesCountEl: HTMLElement | null;
  private clipsCountEl: HTMLElement | null;
  private morphsCountEl: HTMLElement | null;
  private activeClipEl: HTMLElement | null;
  private appStateEl: HTMLElement | null;
  private clipsBadgeEl: HTMLElement | null;
  private morphsBadgeEl: HTMLElement | null;
  private clipsListEl: HTMLElement | null;
  private skeletonTreeEl: HTMLElement | null;
  private morphsListEl: HTMLElement | null;
  private logConsoleEl: HTMLElement | null;
  private clearLogsBtn: HTMLElement | null;
  private toggleSkeletonBtn: HTMLElement | null;
  private speedSliderEl: HTMLInputElement | null;
  private speedValueEl: HTMLElement | null;
  private activeGestureBadgeEl: HTMLElement | null;
  private gestureButtons: NodeListOf<HTMLButtonElement>;

  // Idle & Skeleton Animation Switches
  private idleToggleEl: HTMLInputElement | null;
  private idleBadgeEl: HTMLElement | null;
  private skeletonOverlayToggleEl: HTMLInputElement | null;

  // Pipeline Inspector Elements
  private pipelineStatusBadgeEl: HTMLElement | null;
  private pipelineTokensEl: HTMLElement | null;
  private pipelineFilesEl: HTMLElement | null;
  private pipelineResolvedEl: HTMLElement | null;
  private pipelineExecutionEl: HTMLElement | null;
  private pipelineProgressEl: HTMLElement | null;
  private pipelineSequenceFlowEl: HTMLElement | null;

  private isCollapsed: boolean = false;
  private onSpeedChangeCallback?: (speed: number) => void;
  private onGestureTriggerCallback?: (gesture: string) => void;
  private onIdleToggleCallback?: (enabled: boolean) => void;
  private onSkeletonToggleCallback?: (enabled: boolean) => void;

  constructor() {
    this.panel = document.getElementById('debug-panel') as HTMLElement;
    this.closeBtn = document.getElementById('debug-close-btn');
    this.toggleBtn = document.getElementById('debug-toggle-btn');
    this.modelStatusEl = document.getElementById('debug-model-status');
    this.bonesCountEl = document.getElementById('debug-bones-count');
    this.clipsCountEl = document.getElementById('debug-clips-count');
    this.morphsCountEl = document.getElementById('debug-morphs-count');
    this.activeClipEl = document.getElementById('debug-active-clip');
    this.appStateEl = document.getElementById('debug-app-state');
    this.clipsBadgeEl = document.getElementById('clips-badge');
    this.morphsBadgeEl = document.getElementById('morphs-badge');
    this.clipsListEl = document.getElementById('debug-clips-list');
    this.skeletonTreeEl = document.getElementById('debug-skeleton-tree');
    this.morphsListEl = document.getElementById('debug-morphs-list');
    this.logConsoleEl = document.getElementById('debug-logs');
    this.clearLogsBtn = document.getElementById('clear-logs-btn');
    this.toggleSkeletonBtn = document.getElementById('toggle-skeleton-btn');
    this.speedSliderEl = document.getElementById('speed-slider') as HTMLInputElement;
    this.speedValueEl = document.getElementById('speed-value');
    this.activeGestureBadgeEl = document.getElementById('active-gesture-badge');
    this.gestureButtons = document.querySelectorAll('.btn-gesture');

    this.idleToggleEl = document.getElementById('idle-animation-toggle') as HTMLInputElement;
    this.idleBadgeEl = document.getElementById('idle-badge');
    this.skeletonOverlayToggleEl = document.getElementById('skeleton-overlay-toggle') as HTMLInputElement;

    this.pipelineStatusBadgeEl = document.getElementById('pipeline-status-badge');
    this.pipelineTokensEl = document.getElementById('pipeline-tokens');
    this.pipelineFilesEl = document.getElementById('pipeline-files');
    this.pipelineResolvedEl = document.getElementById('pipeline-resolved');
    this.pipelineExecutionEl = document.getElementById('pipeline-execution');
    this.pipelineProgressEl = document.getElementById('pipeline-progress');
    this.pipelineSequenceFlowEl = document.getElementById('pipeline-sequence-flow');

    this.initEvents();
  }

  private initEvents(): void {
    this.closeBtn?.addEventListener('click', () => this.toggle(true));
    this.toggleBtn?.addEventListener('click', () => this.toggle());
    this.clearLogsBtn?.addEventListener('click', () => this.clearLogs());

    this.toggleSkeletonBtn?.addEventListener('click', () => {
      const details = this.skeletonTreeEl?.querySelectorAll('details');
      if (!details || details.length === 0) return;
      const allOpen = Array.from(details).every((d) => d.open);
      details.forEach((d) => (d.open = !allOpen));
    });

    // Idle toggle listener
    this.idleToggleEl?.addEventListener('change', () => {
      const enabled = this.idleToggleEl?.checked ?? true;
      this.setIdleBadge(enabled);
      if (this.onIdleToggleCallback) {
        this.onIdleToggleCallback(enabled);
      }
    });

    // Skeleton overlay toggle listener (Task 6.2)
    this.skeletonOverlayToggleEl?.addEventListener('change', () => {
      const enabled = this.skeletonOverlayToggleEl?.checked ?? false;
      if (this.onSkeletonToggleCallback) {
        this.onSkeletonToggleCallback(enabled);
      }
    });

    // Speed slider listener
    this.speedSliderEl?.addEventListener('input', () => {
      const val = parseFloat(this.speedSliderEl?.value || '1.0');
      if (this.speedValueEl) {
        this.speedValueEl.textContent = `${val.toFixed(1)}×`;
      }
      if (this.onSpeedChangeCallback) {
        this.onSpeedChangeCallback(val);
      }
    });

    // Gesture buttons listeners
    this.gestureButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gesture = btn.getAttribute('data-gesture');
        if (gesture && this.onGestureTriggerCallback) {
          this.onGestureTriggerCallback(gesture);
        }
      });
    });
  }

  public onSpeedChange(callback: (speed: number) => void): void {
    this.onSpeedChangeCallback = callback;
  }

  public onGestureTrigger(callback: (gesture: string) => void): void {
    this.onGestureTriggerCallback = callback;
  }

  public onIdleToggle(callback: (enabled: boolean) => void): void {
    this.onIdleToggleCallback = callback;
  }

  public onSkeletonToggle(callback: (enabled: boolean) => void): void {
    this.onSkeletonToggleCallback = callback;
  }

  public setSkeletonToggleState(enabled: boolean): void {
    if (this.skeletonOverlayToggleEl) {
      this.skeletonOverlayToggleEl.checked = enabled;
    }
  }

  public setPipelineProgress(elapsedMs: number, totalDurationMs: number): void {
    if (!this.pipelineProgressEl) return;
    const elapsedSec = (elapsedMs / 1000).toFixed(1);
    const totalSec = (totalDurationMs / 1000).toFixed(1);
    const percent = totalDurationMs > 0 ? Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100)) : 0;
    this.pipelineProgressEl.textContent = `${elapsedSec}s / ${totalSec}s (${percent}%)`;
  }

  public setIdleBadge(enabled: boolean): void {
    if (this.idleBadgeEl) {
      this.idleBadgeEl.textContent = enabled ? 'Idle: ON' : 'Idle: OFF';
      this.idleBadgeEl.style.color = enabled ? '#7ee787' : '#8b949e';
    }
  }

  public setActiveGesture(name: string): void {
    if (this.activeGestureBadgeEl) {
      this.activeGestureBadgeEl.textContent = name;
    }

    this.gestureButtons.forEach((btn) => {
      if (btn.getAttribute('data-gesture') === name) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  public setPipelineStatus(data: {
    status?: string;
    tokens?: string[];
    files?: string[];
    resolved?: string;
    execution?: string;
  }): void {
    if (data.status && this.pipelineStatusBadgeEl) {
      this.pipelineStatusBadgeEl.textContent = data.status;
    }
    if (data.tokens && this.pipelineTokensEl) {
      this.pipelineTokensEl.textContent = data.tokens.length > 0 ? `[${data.tokens.join(', ')}]` : 'None';
    }
    if (data.files && this.pipelineFilesEl) {
      this.pipelineFilesEl.textContent = data.files.length > 0 ? data.files.join(', ') : 'None';
    }
    if (data.resolved !== undefined && this.pipelineResolvedEl) {
      this.pipelineResolvedEl.textContent = data.resolved;
    }
    if (data.execution !== undefined && this.pipelineExecutionEl) {
      this.pipelineExecutionEl.textContent = data.execution;
    }
  }

  public setSequenceFlow(words: Array<{ word: string; status?: 'pending' | 'active' | 'completed' | 'skipped' }>): void {
    if (!this.pipelineSequenceFlowEl) return;
    if (words.length === 0) {
      this.pipelineSequenceFlowEl.innerHTML = '<span class="empty-hint">Standby</span>';
      return;
    }

    const html = words.map((item, idx) => {
      const statusClass = item.status || 'pending';
      const arrow = idx < words.length - 1 ? '<span class="seq-arrow">→</span>' : '';
      const prefix = statusClass === 'active' ? '▶ ' : statusClass === 'skipped' ? '⚠ ' : '';
      return `<span class="seq-chip ${statusClass}" data-word="${item.word}">${prefix}${item.word}</span>${arrow}`;
    }).join(' ');

    this.pipelineSequenceFlowEl.innerHTML = html;
  }

  public updateActiveSequenceWord(activeWord: string): void {
    if (!this.pipelineSequenceFlowEl) return;
    const cleanActive = activeWord.toLowerCase();
    const chips = this.pipelineSequenceFlowEl.querySelectorAll('.seq-chip');

    let passedActive = false;
    chips.forEach((chip) => {
      const w = chip.getAttribute('data-word')?.toLowerCase() || '';
      if (chip.classList.contains('skipped')) return;

      if (w === cleanActive) {
        chip.className = 'seq-chip active';
        chip.innerHTML = `▶ ${w}`;
        passedActive = true;
      } else if (!passedActive) {
        chip.className = 'seq-chip completed';
        chip.innerHTML = `✓ ${w}`;
      } else {
        chip.className = 'seq-chip pending';
        chip.innerHTML = `${w}`;
      }
    });
  }

  public completeSequenceFlow(): void {
    if (!this.pipelineSequenceFlowEl) return;
    const chips = this.pipelineSequenceFlowEl.querySelectorAll('.seq-chip');
    chips.forEach((chip) => {
      if (chip.classList.contains('skipped')) return;
      const w = chip.getAttribute('data-word');
      chip.className = 'seq-chip completed';
      chip.innerHTML = `✓ ${w}`;
    });
  }

  public updateChannels(channels: Record<string, string>): void {
    const keys = ['body', 'head', 'leftArm', 'rightArm', 'leftHand', 'rightHand', 'fingers', 'face', 'lips'];
    let activeCount = 0;

    for (const key of keys) {
      const state = channels[key] || 'Idle';
      const el = document.getElementById(`ch-${key}`);
      const chip = document.querySelector(`.channel-chip[data-channel="${key}"]`);

      if (el) {
        el.textContent = state;
        if (state !== 'Idle') {
          el.className = 'channel-state active';
          activeCount++;
        } else {
          el.className = 'channel-state';
        }
      }

      if (chip) {
        if (state !== 'Idle') {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      }
    }

    const badge = document.getElementById('active-channels-count');
    if (badge) {
      badge.textContent = activeCount > 0 ? `${activeCount} Active` : '9 Channels';
      badge.style.color = activeCount > 0 ? 'var(--accent-cyan)' : 'inherit';
    }
  }

  public toggle(forceCollapse?: boolean): void {
    if (forceCollapse !== undefined) {
      this.isCollapsed = forceCollapse;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }

    if (this.isCollapsed) {
      this.panel.classList.add('collapsed');
    } else {
      this.panel.classList.remove('collapsed');
    }
  }

  public setAppState(state: string): void {
    if (this.appStateEl) {
      this.appStateEl.textContent = state;
    }
  }

  public setModelStatus(status: string): void {
    if (this.modelStatusEl) {
      this.modelStatusEl.textContent = status;
    }
  }

  public setActiveClip(clip: string | null): void {
    if (this.activeClipEl) {
      this.activeClipEl.textContent = clip || 'None';
    }
  }

  public updateModelData(data: AvatarLoadResult): void {
    if (this.bonesCountEl) this.bonesCountEl.textContent = data.bones.length.toString();
    if (this.clipsCountEl) this.clipsCountEl.textContent = data.clips.length.toString();
    if (this.morphsCountEl) this.morphsCountEl.textContent = data.morphTargets.length.toString();
    if (this.clipsBadgeEl) this.clipsBadgeEl.textContent = data.clips.length.toString();
    if (this.morphsBadgeEl) this.morphsBadgeEl.textContent = data.morphTargets.length.toString();
    if (this.activeClipEl) this.activeClipEl.textContent = data.activeClip || 'None';

    // 1. Render Clips
    if (this.clipsListEl) {
      this.clipsListEl.innerHTML = '';
      if (data.clips.length === 0) {
        this.clipsListEl.innerHTML = '<li class="empty-hint">No clips found (using procedural idle)</li>';
      } else {
        data.clips.forEach((clipName) => {
          const li = document.createElement('li');
          li.textContent = clipName;
          if (clipName === data.activeClip) {
            li.style.color = '#7ee787';
            li.style.fontWeight = 'bold';
            li.textContent += ' (active)';
          }
          this.clipsListEl?.appendChild(li);
        });
      }
    }

    // 2. Render Morph Targets
    if (this.morphsListEl) {
      this.morphsListEl.innerHTML = '';
      if (data.morphTargets.length === 0) {
        this.morphsListEl.innerHTML = '<li class="empty-hint">No morph targets on model</li>';
      } else {
        data.morphTargets.forEach((target) => {
          const li = document.createElement('li');
          li.textContent = target;
          this.morphsListEl?.appendChild(li);
        });
      }
    }

    // 3. Render Skeleton Tree
    if (this.skeletonTreeEl) {
      this.skeletonTreeEl.innerHTML = '';
      const treeHtml = this.renderSkeletonNode(data.boneTree, true);
      this.skeletonTreeEl.innerHTML = treeHtml;
    }

    this.log(`Avatar loaded: ${data.bones.length} bones, ${data.clips.length} clips, ${data.morphTargets.length} morph targets`, 'success');
  }

  private renderSkeletonNode(node: SkeletonTreeNode, isRoot = false): string {
    if (!node.children || node.children.length === 0) {
      return `<div class="tree-node"><span class="tree-node-label">🦴 ${node.name}</span></div>`;
    }

    return `
      <details ${isRoot ? 'open' : ''} class="tree-node">
        <summary class="tree-node-label">🦴 ${node.name} (${node.children.length})</summary>
        <div style="padding-left: 10px;">
          ${node.children.map((c) => this.renderSkeletonNode(c)).join('')}
        </div>
      </details>
    `;
  }

  public log(msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    if (!this.logConsoleEl) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const time = new Date().toTimeString().split(' ')[0];
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;

    this.logConsoleEl.appendChild(entry);
    this.logConsoleEl.scrollTop = this.logConsoleEl.scrollHeight;
  }

  public clearLogs(): void {
    if (this.logConsoleEl) {
      this.logConsoleEl.innerHTML = '';
    }
  }
}
