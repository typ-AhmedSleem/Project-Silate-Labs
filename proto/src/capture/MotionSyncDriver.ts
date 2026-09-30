import { AvatarController } from '../avatar/AvatarController.js';
import { CapturedFrame, Vec3 } from './LandmarkExtractor.js';

interface BoneAngles {
  x: number;
  y: number;
  z: number;
}

export class MotionSyncDriver {
  private controller: AvatarController;
  private _isActive: boolean = false;
  private smoothingAlpha: number = 0.32; // EMA smoothing factor (0 = no update, 1 = raw)

  // Stored smoothed angles per bone (in degrees)
  private smoothedAngles: Map<string, BoneAngles> = new Map();

  constructor(controller: AvatarController) {
    this.controller = controller;
  }

  /**
   * Starts live synchronization: stops IDLE animation to prevent interference.
   */
  public start(): void {
    this._isActive = true;
    this.smoothedAngles.clear();
    this.controller.avatar.stopIdle();
  }

  /**
   * Stops synchronization: smoothly returns avatar to neutral and resumes IDLE.
   */
  public async stop(): Promise<void> {
    if (!this._isActive) return;
    this._isActive = false;
    this.smoothedAngles.clear();
    await this.controller.returnToNeutral(250);
    this.controller.avatar.resumeIdle();
  }

  public isActive(): boolean {
    return this._isActive;
  }

  public setSmoothing(alpha: number): void {
    this.smoothingAlpha = Math.max(0.05, Math.min(1.0, alpha));
  }

  /**
   * Applies an extracted landmark frame to the avatar skeleton with EMA smoothing.
   */
  public applyFrame(frame: CapturedFrame): void {
    if (!this._isActive) return;

    // 1. Head orientation
    if (frame.head) {
      // rx: pitch, ry: yaw, rz: roll
      const rawPitch = Math.max(-25, Math.min(25, frame.head.rx * 25));
      const rawYaw = Math.max(-45, Math.min(45, -frame.head.ry * 35));
      const rawRoll = Math.max(-20, Math.min(20, -frame.head.rz * 25));

      const smoothed = this.smooth('Head', { x: rawPitch, y: rawYaw, z: rawRoll });
      this.controller.rotateBone('Head', { ...smoothed, isDegrees: true }, 30);
    }

    // 2. Right Arm & Forearm
    if (frame.rightArm) {
      const { shoulder, elbow, wrist } = frame.rightArm;

      // Vector shoulder -> elbow
      const dx = elbow.x - shoulder.x;
      const dy = elbow.y - shoulder.y;
      const dz = elbow.z - shoulder.z;

      // Lateral abduction (raise sideways): Mixamo right arm raises on negative Z
      // When arm hangs down, dy is ~0.2-0.3, dx is small.
      const lateralAngle = Math.atan2(Math.abs(dx), Math.max(0.01, dy)) * (180 / Math.PI);
      const armZ = -Math.min(85, lateralAngle * 1.1);

      // Forward pitch: Mixamo right arm raises forward on negative X
      const forwardAngle = Math.atan2(-dz, Math.max(0.01, dy)) * (180 / Math.PI);
      const armX = -Math.max(0, Math.min(90, forwardAngle * 1.5));

      const smoothedArm = this.smooth('RightArm', { x: armX, y: 0, z: armZ });
      this.controller.rotateBone('RightArm', { ...smoothedArm, isDegrees: true }, 30);

      // Elbow flexion (forearm bend)
      const elbowFlex = this.computeElbowBend(shoulder, elbow, wrist);
      // RightForeArm bends on negative Z
      const foreArmZ = -Math.min(110, elbowFlex);
      const smoothedForeArm = this.smooth('RightForeArm', { x: 0, y: 20, z: foreArmZ });
      this.controller.rotateBone('RightForeArm', { ...smoothedForeArm, isDegrees: true }, 30);
    }

    // 3. Left Arm & Forearm
    if (frame.leftArm) {
      const { shoulder, elbow, wrist } = frame.leftArm;

      const dx = elbow.x - shoulder.x;
      const dy = elbow.y - shoulder.y;
      const dz = elbow.z - shoulder.z;

      // Lateral abduction: Mixamo left arm raises on positive Z
      const lateralAngle = Math.atan2(Math.abs(dx), Math.max(0.01, dy)) * (180 / Math.PI);
      const armZ = Math.min(85, lateralAngle * 1.1);

      // Forward pitch: Mixamo left arm raises forward on negative X
      const forwardAngle = Math.atan2(-dz, Math.max(0.01, dy)) * (180 / Math.PI);
      const armX = -Math.max(0, Math.min(90, forwardAngle * 1.5));

      const smoothedArm = this.smooth('LeftArm', { x: armX, y: 0, z: armZ });
      this.controller.rotateBone('LeftArm', { ...smoothedArm, isDegrees: true }, 30);

      // Elbow flexion: LeftForeArm bends on positive Z
      const elbowFlex = this.computeElbowBend(shoulder, elbow, wrist);
      const foreArmZ = Math.min(110, elbowFlex);
      const smoothedForeArm = this.smooth('LeftForeArm', { x: 0, y: -20, z: foreArmZ });
      this.controller.rotateBone('LeftForeArm', { ...smoothedForeArm, isDegrees: true }, 30);
    }

    // 4. Hands & Fingers
    if (frame.right_hand) {
      const curl = this.computeHandCurl(frame.right_hand);
      if (curl > 0.6) {
        this.controller.rotateBone('RightHand', { x: 15, y: -10, z: -25, isDegrees: true }, 40);
      } else {
        this.controller.rotateBone('RightHand', { x: 0, y: 5, z: 0, isDegrees: true }, 40);
      }
    }

    if (frame.left_hand) {
      const curl = this.computeHandCurl(frame.left_hand);
      if (curl > 0.6) {
        this.controller.rotateBone('LeftHand', { x: 15, y: 10, z: 25, isDegrees: true }, 40);
      } else {
        this.controller.rotateBone('LeftHand', { x: 0, y: -5, z: 0, isDegrees: true }, 40);
      }
    }
  }

  /**
   * Applies Exponential Moving Average (EMA) to prevent stutters and sudden jumps.
   */
  private smooth(boneName: string, target: BoneAngles): BoneAngles {
    const prev = this.smoothedAngles.get(boneName);
    if (!prev) {
      this.smoothedAngles.set(boneName, { ...target });
      return target;
    }

    const alpha = this.smoothingAlpha;
    const smoothed: BoneAngles = {
      x: prev.x * (1 - alpha) + target.x * alpha,
      y: prev.y * (1 - alpha) + target.y * alpha,
      z: prev.z * (1 - alpha) + target.z * alpha
    };

    this.smoothedAngles.set(boneName, smoothed);
    return smoothed;
  }

  /**
   * Computes elbow angle in degrees between upper arm and forearm.
   */
  private computeElbowBend(shoulder: Vec3, elbow: Vec3, wrist: Vec3): number {
    const v1 = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y, z: shoulder.z - elbow.z };
    const v2 = { x: wrist.x - elbow.x, y: wrist.y - elbow.y, z: wrist.z - elbow.z };

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    if (mag1 === 0 || mag2 === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleRad = Math.acos(cosAngle);
    // When arm is straight, angle is ~180 deg. Bend is 180 - angle.
    return Math.max(0, 180 - (angleRad * (180 / Math.PI)));
  }

  /**
   * Computes hand curl ratio from 0.0 (open) to 1.0 (closed fist).
   */
  private computeHandCurl(hand: { wrist: Vec3; fingers: { index: Vec3[]; middle: Vec3[]; ring: Vec3[]; pinky: Vec3[] } }): number {
    const { wrist, fingers } = hand;
    const tips = [
      fingers.index[3],
      fingers.middle[3],
      fingers.ring[3],
      fingers.pinky[3]
    ].filter(Boolean);

    if (tips.length === 0) return 0;

    let totalDist = 0;
    for (const tip of tips) {
      const dx = tip.x - wrist.x;
      const dy = tip.y - wrist.y;
      const dz = tip.z - wrist.z;
      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const avgDist = totalDist / tips.length;
    // Normalized distance typically ~0.35 when open, ~0.15 when closed
    const curl = Math.max(0, Math.min(1.0, (0.35 - avgDist) / 0.20));
    return curl;
  }
}
