import {
  DrawingUtils,
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
  HolisticLandmarkerResult
} from '@mediapipe/tasks-vision';

export class LandmarkRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drawingUtils: DrawingUtils;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;
    this.drawingUtils = new DrawingUtils(ctx);
  }

  /**
   * Clears canvas and draws holistic landmark results over the video.
   */
  public draw(result: HolisticLandmarkerResult, videoWidth: number, videoHeight: number): void {
    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
    }

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Face Landmarks
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      for (const landmarks of result.faceLandmarks) {
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
          color: '#C0C0C040',
          lineWidth: 1
        });
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: '#FF3030', lineWidth: 1 });
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: '#FF3030', lineWidth: 1 });
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: '#30FF30', lineWidth: 1 });
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: '#30FF30', lineWidth: 1 });
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: '#E0E0E0', lineWidth: 2 });
        this.drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: '#E0E0E0', lineWidth: 1 });
      }
    }

    // 2. Pose Landmarks
    if (result.poseLandmarks && result.poseLandmarks.length > 0) {
      for (const landmarks of result.poseLandmarks) {
        this.drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#FFFFFF', lineWidth: 2 });
        this.drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', radius: 3 });
      }
    }

    // 3. Left Hand Landmarks
    if (result.leftHandLandmarks && result.leftHandLandmarks.length > 0) {
      for (const landmarks of result.leftHandLandmarks) {
        this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#CC0000', lineWidth: 3 });
        this.drawingUtils.drawLandmarks(landmarks, { color: '#00FF00', lineWidth: 2, radius: 3 });
      }
    }

    // 4. Right Hand Landmarks
    if (result.rightHandLandmarks && result.rightHandLandmarks.length > 0) {
      for (const landmarks of result.rightHandLandmarks) {
        this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00CC00', lineWidth: 3 });
        this.drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 2, radius: 3 });
      }
    }

    this.ctx.restore();
  }

  /**
   * Clears the landmark overlay canvas.
   */
  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
