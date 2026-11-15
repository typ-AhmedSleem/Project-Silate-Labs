/**
 * CameraController
 * Manages user webcam stream lifecycle and HTMLVideoElement playback.
 */
export class CameraController {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private _isRunning: boolean = false;

  constructor(videoElement: HTMLVideoElement) {
    this.video = videoElement;
  }

  /**
   * Requests camera access and connects the stream to the video element.
   */
  public async start(): Promise<void> {
    if (this._isRunning) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Webcam access (getUserMedia) is not supported by this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this._isRunning = true;
    } catch (err: any) {
      this.stop();
      throw new Error(`Failed to access camera: ${err.message || err}`);
    }
  }

  /**
   * Stops the camera stream tracks and detaches from video element.
   */
  public stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this._isRunning = false;
  }

  public getVideo(): HTMLVideoElement {
    return this.video;
  }

  public isRunning(): boolean {
    return this._isRunning;
  }
}
