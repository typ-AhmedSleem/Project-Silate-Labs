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
      this.applyHandFingers('Right', frame.right_hand);
    }

    if (frame.left_hand) {
      this.applyHandFingers('Left', frame.left_hand);
    }
  }

  /**
   * Applies individual finger bone bend angles to avatar skeleton fingers.
   */
  private applyHandFingers(side: 'Left' | 'Right', hand: { wrist: Vec3; fingers: { thumb: Vec3[]; index: Vec3[]; middle: Vec3[]; ring: Vec3[]; pinky: Vec3[] } }): void {
    const isRight = side === 'Right';
    const prefix = isRight ? 'RightHand' : 'LeftHand';

    // Wrist orientation / rotation tilt
    const curl = this.computeHandCurl(hand);
    if (curl > 0.6) {
      this.controller.rotateBone(`${side}Hand`, { x: 15, y: isRight ? -10 : 10, z: isRight ? -25 : 25, isDegrees: true }, 40);
    } else {
      this.controller.rotateBone(`${side}Hand`, { x: 0, y: isRight ? 5 : -5, z: 0, isDegrees: true }, 40);
    }

    // Finger joint bending
    const fingerDefs: Array<{ name: string; joints: Vec3[] }> = [
      { name: 'Thumb', joints: hand.fingers.thumb },
      { name: 'Index', joints: hand.fingers.index },
      { name: 'Middle', joints: hand.fingers.middle },
      { name: 'Ring', joints: hand.fingers.ring },
      { name: 'Pinky', joints: hand.fingers.pinky },
    ];

    for (const { name, joints } of fingerDefs) {
      if (!joints || joints.length < 4) continue;

      // Finger curl factor based on tip to wrist distance relative to extended finger length
      const tip = joints[3];
      const mcp = joints[0];
      const dWristTip = Math.hypot(tip.x - hand.wrist.x, tip.y - hand.wrist.y, tip.z - hand.wrist.z);
      const dMcpTip = Math.hypot(tip.x - mcp.x, tip.y - mcp.y, tip.z - mcp.z);

      // Higher curlRatio when tip is curled close to MCP or wrist
      let fingerCurl = 0;
      if (name === 'Thumb') {
        fingerCurl = Math.max(0, Math.min(1.0, (0.16 - dWristTip) / 0.08));
      } else {
        fingerCurl = Math.max(0, Math.min(1.0, (0.18 - dMcpTip) / 0.10));
      }

      for (let j = 1; j <= 3; j++) {
        const boneName = `${prefix}${name}${j}`;
        if (name === 'Thumb') {
          const bendX = -15 * fingerCurl;
          const bendY = (isRight ? 15 : -15) * fingerCurl;
          const bendZ = (isRight ? -35 : 35) * fingerCurl;
          const smoothed = this.smooth(boneName, { x: bendX, y: bendY, z: bendZ });
          this.controller.rotateBone(boneName, { ...smoothed, isDegrees: true }, 40);
        } else {
          const maxAngle = j === 1 ? 65 : j === 2 ? 75 : 60;
          const angleX = maxAngle * fingerCurl;
          const smoothed = this.smooth(boneName, { x: angleX, y: 0, z: 0 });
          this.controller.rotateBone(boneName, { ...smoothed, isDegrees: true }, 40);
        }
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
