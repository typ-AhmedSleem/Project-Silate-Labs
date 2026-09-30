import {
  HolisticLandmarker,
  HolisticLandmarkerResult,
  FilesetResolver
} from '@mediapipe/tasks-vision';

export class HolisticLandmarkerService {
  private landmarker: HolisticLandmarker | null = null;
  private _latencyMs: number = 0;
  private _isReady: boolean = false;

  /**
   * Initializes the HolisticLandmarker using WASM fileset and local model file.
   */
  public async initialize(
    modelUrl: string = '/ai/holistic_landmarker.task',
    delegate: 'CPU' | 'GPU' = 'GPU'
  ): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.landmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: delegate
        },
        runningMode: 'VIDEO',
        minFaceDetectionConfidence: 0.5,
        minPoseDetectionConfidence: 0.5,
        minHandLandmarksConfidence: 0.5
      });

      this._isReady = true;
    } catch (err: any) {
      this._isReady = false;
      this.dispose();
      throw new Error(`Failed to initialize Holistic Landmarker: ${err.message || err}`);
    }
  }

  /**
   * Runs inference on the provided video element with the current timestamp.
   */
  public detectFrame(video: HTMLVideoElement, timestampMs: number): HolisticLandmarkerResult | null {
    if (!this.landmarker || !this._isReady) return null;
    if (video.readyState < 2) return null;

    const start = performance.now();
    try {
      const result = this.landmarker.detectForVideo(video, timestampMs);
      this._latencyMs = Math.round(performance.now() - start);
      return result;
    } catch (err) {
      // In case of dropped or corrupt frame
      return null;
    }
  }

  public getLatency(): number {
    return this._latencyMs;
  }

  public isReady(): boolean {
    return this._isReady;
  }

  public dispose(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (_) {
        // Ignore close errors
      }
      this.landmarker = null;
    }
    this._isReady = false;
  }
}
