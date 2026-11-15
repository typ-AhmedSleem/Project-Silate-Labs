import { CapturedFrame } from './LandmarkExtractor.js';

export class MotionCaptureSession {
  private frames: CapturedFrame[] = [];
  private _startTime: number = 0;
  private _isRecording: boolean = false;

  /**
   * Starts a new capture recording session.
   */
  public start(): void {
    this.frames = [];
    this._startTime = performance.now();
    this._isRecording = true;
  }

  /**
   * Appends an extracted frame to the current recording session.
   */
  public addFrame(frame: CapturedFrame): void {
    if (!this._isRecording) return;
    // Normalize timestamp relative to capture start
    frame.ts = Math.round(performance.now() - this._startTime);
    this.frames.push(frame);
  }

  /**
   * Stops recording and returns all captured frames.
   */
  public stop(): CapturedFrame[] {
    this._isRecording = false;
    return this.frames;
  }

  public isRecording(): boolean {
    return this._isRecording;
  }

  public getFrameCount(): number {
    return this.frames.length;
  }

  public getFrames(): CapturedFrame[] {
    return this.frames;
  }

  /**
   * Serializes captured frames to formatted JSON string.
   */
  public toJSON(): string {
    return JSON.stringify(this.frames, null, 2);
  }
}
