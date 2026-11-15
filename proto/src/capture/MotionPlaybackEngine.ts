import { AvatarController } from '../avatar/AvatarController.js';
import { CapturedFrame } from './LandmarkExtractor.js';
import { MotionSyncDriver } from './MotionSyncDriver.js';

export class MotionPlaybackEngine {
  private controller: AvatarController;
  private syncDriver: MotionSyncDriver;
  private frames: CapturedFrame[] = [];
  private currentFrameIndex: number = 0;
  private _isPlaying: boolean = false;
  private speed: number = 1.0;

  private animFrameId: number | null = null;
  private playbackStartTime: number = 0;
  private playbackStartOffsetMs: number = 0;

  private onProgressCb?: (current: number, total: number) => void;
  private onStateChangeCb?: (state: 'idle' | 'playing' | 'paused') => void;

  constructor(controller: AvatarController) {
    this.controller = controller;
    this.syncDriver = new MotionSyncDriver(controller);
    // Lower smoothing alpha slightly during playback for crisp animation replay
    this.syncDriver.setSmoothing(0.5);
  }

  public loadFrames(frames: CapturedFrame[]): void {
    this.stop();
    this.frames = frames;
    this.currentFrameIndex = 0;
    this.onProgressCb?.(0, this.frames.length);
  }

  public play(): void {
    if (this._isPlaying || this.frames.length === 0) return;

    this._isPlaying = true;
    this.syncDriver.start();
    this.controller.avatar.stopIdle();
    this.onStateChangeCb?.('playing');

    const initialFrameTs = this.frames[this.currentFrameIndex]?.ts ?? 0;
    this.playbackStartOffsetMs = initialFrameTs;
    this.playbackStartTime = performance.now();

    const loop = (now: number) => {
      if (!this._isPlaying) return;

      const elapsedMs = (now - this.playbackStartTime) * this.speed;
      const targetTs = this.playbackStartOffsetMs + elapsedMs;

      // Find the frame closest to or at targetTs
      while (
        this.currentFrameIndex < this.frames.length - 1 &&
        this.frames[this.currentFrameIndex + 1].ts <= targetTs
      ) {
        this.currentFrameIndex++;
      }

      const frame = this.frames[this.currentFrameIndex];
      if (frame) {
        this.syncDriver.applyFrame(frame);
        this.onProgressCb?.(this.currentFrameIndex + 1, this.frames.length);
      }

      // Check if reached end
      if (this.currentFrameIndex >= this.frames.length - 1) {
        this.stop();
        return;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onStateChangeCb?.('paused');
  }

  public async stop(): Promise<void> {
    this._isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.currentFrameIndex = 0;
    await this.syncDriver.stop();
    this.onProgressCb?.(0, this.frames.length);
    this.onStateChangeCb?.('idle');
  }

  public seekTo(index: number): void {
    if (this.frames.length === 0) return;
    const clamped = Math.max(0, Math.min(this.frames.length - 1, index));
    this.currentFrameIndex = clamped;

    const frame = this.frames[clamped];
    if (frame) {
      if (!this.syncDriver.isActive()) {
        this.syncDriver.start();
      }
      this.syncDriver.applyFrame(frame);
    }

    this.onProgressCb?.(this.currentFrameIndex + 1, this.frames.length);

    if (this._isPlaying) {
      this.playbackStartOffsetMs = this.frames[this.currentFrameIndex]?.ts ?? 0;
      this.playbackStartTime = performance.now();
    }
  }

  public setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, Math.min(3.0, multiplier));
    if (this._isPlaying) {
      // Recalibrate start offset and time to avoid timeline jumping
      this.playbackStartOffsetMs = this.frames[this.currentFrameIndex]?.ts ?? 0;
      this.playbackStartTime = performance.now();
    }
  }

  public isPlaying(): boolean {
    return this._isPlaying;
  }

  public getFrameCount(): number {
    return this.frames.length;
  }

  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  public onProgress(cb: (current: number, total: number) => void): void {
    this.onProgressCb = cb;
  }

  public onStateChange(cb: (state: 'idle' | 'playing' | 'paused') => void): void {
    this.onStateChangeCb = cb;
  }
}
