import * as THREE from 'three';
import { SkeletonController } from './SkeletonController.js';
import { FacialController } from './FacialController.js';
import { Avatar } from './Avatar.js';

export type BodyChannelName =
  | 'body'
  | 'leftArm'
  | 'rightArm'
  | 'leftHand'
  | 'rightHand'
  | 'fingers'
  | 'head'
  | 'face'
  | 'lips';

export interface RotationTarget {
  x: number;
  y: number;
  z: number;
  isDegrees?: boolean;
}

export type TargetRotation = THREE.Quaternion | THREE.Euler | RotationTarget;

export interface BoneRotationInstruction {
  bone: string;
  rotation: TargetRotation;
  durationMs: number;
  easing?: (t: number) => number;
}

interface ActiveBoneTransition {
  bone: THREE.Bone;
  boneName: string;
  channel: BodyChannelName;
  startQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  duration: number; // in seconds
  elapsed: number;
  easing: (t: number) => number;
  isReturnToIdle: boolean;
  resolve: () => void;
}

export class AvatarController {
  public readonly avatar: Avatar;
  public readonly skeleton: SkeletonController;
  public readonly facial: FacialController;

  private activeTransitions: Map<string, ActiveBoneTransition> = new Map();
  private overriddenBones: Set<string> = new Set();
  private speedMultiplier: number = 1.0;
  private waiters: Set<{ update: (scaledDelta: number) => void }> = new Set();
  private channelStates: Map<BodyChannelName, string> = new Map();
  private onChannelChangeCallback?: (channels: Record<BodyChannelName, string>) => void;
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  constructor(
    avatar: Avatar,
    skeleton: SkeletonController,
    facial: FacialController,
    logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void
  ) {
    this.avatar = avatar;
    this.skeleton = skeleton;
    this.facial = facial;
    this.logger = logger;

    // Initialize default channel states
    const channels: BodyChannelName[] = [
      'body',
      'leftArm',
      'rightArm',
      'leftHand',
      'rightHand',
      'fingers',
      'head',
      'face',
      'lips'
    ];
    channels.forEach((c) => this.channelStates.set(c, 'Idle'));
  }

  public onChannelChange(callback: (channels: Record<BodyChannelName, string>) => void): void {
    this.onChannelChangeCallback = callback;
    this.notifyChannelUpdate();
  }

  public getChannelForBone(boneName: string): BodyChannelName {
    const lower = boneName.toLowerCase();
    if (
      lower.includes('thumb') ||
      lower.includes('index') ||
      lower.includes('middle') ||
      lower.includes('ring') ||
      lower.includes('pinky')
    ) {
      return 'fingers';
    }
    if (lower.includes('head') || lower.includes('neck')) {
      return 'head';
    }
    if (lower.includes('lefthand')) {
      return 'leftHand';
    }
    if (lower.includes('righthand')) {
      return 'rightHand';
    }
    if (lower.includes('leftarm') || lower.includes('leftforearm') || lower.includes('leftshoulder')) {
      return 'leftArm';
    }
    if (lower.includes('rightarm') || lower.includes('rightforearm') || lower.includes('rightshoulder')) {
      return 'rightArm';
    }
    return 'body';
  }

  public setChannelState(channel: BodyChannelName, state: string): void {
    this.channelStates.set(channel, state);
    this.notifyChannelUpdate();
  }

  public getActiveChannels(): Record<BodyChannelName, string> {
    const result = {} as Record<BodyChannelName, string>;
    this.channelStates.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  }

  private notifyChannelUpdate(): void {
    if (this.onChannelChangeCallback) {
      this.onChannelChangeCallback(this.getActiveChannels());
    }
  }

  public setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(3.0, speed));
    if (this.avatar.mixer) {
      this.avatar.mixer.timeScale = this.speedMultiplier;
    }
  }

  public getSpeed(): number {
    return this.speedMultiplier;
  }

  /**
   * Smoothly rotates a single bone to the target quaternion or Euler angles.
   * Frame-driven via update(delta). Never uses setInterval.
   */
  public rotateBone(
    boneName: string,
    target: TargetRotation,
    durationMs: number,
    easing: (t: number) => number = AvatarController.easeInOutCubic
  ): Promise<void> {
    const bone = this.skeleton.requireBone(boneName);
    if (!bone) {
      return Promise.resolve();
    }

    const channel = this.getChannelForBone(bone.name);
    this.setChannelState(channel, `rotating ${bone.name}`);

    const targetQuat = this.toQuaternion(target);
    const durationSec = Math.max(0.01, durationMs / 1000);

    return new Promise((resolve) => {
      // Mark as overridden
      this.overriddenBones.add(bone.name);

      const transition: ActiveBoneTransition = {
        bone,
        boneName: bone.name,
        channel,
        startQuat: bone.quaternion.clone(),
        targetQuat,
        duration: durationSec,
        elapsed: 0,
        easing,
        isReturnToIdle: false,
        resolve: () => {
          this.setChannelState(channel, 'Hold/Ready');
          resolve();
        }
      };

      this.activeTransitions.set(bone.name, transition);
    });
  }

  /**
   * Rotates multiple bones simultaneously and waits until all complete.
   */
  public async rotateBones(instructions: BoneRotationInstruction[]): Promise<void> {
    const promises = instructions.map((inst) =>
      this.rotateBone(inst.bone, inst.rotation, inst.durationMs, inst.easing)
    );
    await Promise.all(promises);
  }

  /**
   * Applies named finger / hand poses:
   * 'open', 'closed', 'point', 'thumb_up', 'peace'
   */
  public async applyHandPose(
    side: 'left' | 'right',
    pose: 'open' | 'closed' | 'point' | 'thumb_up' | 'peace',
    durationMs: number = 300
  ): Promise<void> {
    const targets = this.skeleton.getHandPoseInstructions(side, pose);
    if (targets.length === 0) return;

    this.setChannelState('fingers', `${side} ${pose}`);
    const promises = targets.map((t) =>
      this.rotateBone(t.bone, t.rotation, durationMs)
    );
    await Promise.all(promises);
    this.setChannelState('fingers', `${side} ${pose}`);
  }

  /**
   * Blends all modified bones smoothly back to their neutral / base idle transforms.
   */
  public async returnToNeutral(durationMs = 350): Promise<void> {
    const durationSec = Math.max(0.01, durationMs / 1000);
    const promises: Promise<void>[] = [];

    for (const boneName of this.overriddenBones) {
      const bone = this.skeleton.getBone(boneName);
      if (!bone) continue;

      const channel = this.getChannelForBone(bone.name);
      this.setChannelState(channel, 'Returning');

      const restQuat = this.skeleton.getOriginalRotation(boneName) || new THREE.Quaternion();

      const p = new Promise<void>((resolve) => {
        const transition: ActiveBoneTransition = {
          bone,
          boneName: bone.name,
          channel,
          startQuat: bone.quaternion.clone(),
          targetQuat: restQuat,
          duration: durationSec,
          elapsed: 0,
          easing: AvatarController.easeInOutCubic,
          isReturnToIdle: true,
          resolve: () => {
            this.setChannelState(channel, 'Idle');
            resolve();
          }
        };

        this.activeTransitions.set(bone.name, transition);
      });

      promises.push(p);
    }

    await Promise.all(promises);
    this.overriddenBones.clear();

    // Reset all channels to Idle
    this.channelStates.forEach((_, key) => {
      this.channelStates.set(key, 'Idle');
    });
    this.notifyChannelUpdate();
  }

  /**
   * Frame-driven delay that respects speedMultiplier and animation clock.
   */
  public wait(durationMs: number): Promise<void> {
    const durationSec = Math.max(0, durationMs / 1000);
    if (durationSec === 0) return Promise.resolve();

    return new Promise((resolve) => {
      let elapsed = 0;
      const waiter = {
        update: (scaledDelta: number) => {
          elapsed += scaledDelta;
          if (elapsed >= durationSec) {
            this.waiters.delete(waiter);
            resolve();
          }
        }
      };
      this.waiters.add(waiter);
    });
  }

  /**
   * Frame update loop called by SceneManager on every animation frame.
   */
  public update(delta: number): void {
    const scaledDelta = delta * this.speedMultiplier;

    // 1. Update any frame-driven wait timers
    if (this.waiters.size > 0) {
      for (const waiter of Array.from(this.waiters)) {
        waiter.update(scaledDelta);
      }
    }

    if (this.activeTransitions.size === 0) return;

    const completed: string[] = [];

    for (const [boneName, trans] of this.activeTransitions.entries()) {
      trans.elapsed += scaledDelta;
      const progress = Math.min(1.0, trans.elapsed / trans.duration);
      const easedT = trans.easing(progress);

      // Interpolate rotation using Quaternion.slerp
      trans.bone.quaternion.slerpQuaternions(trans.startQuat, trans.targetQuat, easedT);

      if (progress >= 1.0) {
        completed.push(boneName);
        trans.resolve();
      }
    }

    for (const boneName of completed) {
      this.activeTransitions.delete(boneName);
    }
  }

  /**
   * Applies named base poses or hand poses.
   */
  public async applyPose(poseName: string, durationMs = 300): Promise<void> {
    const lower = poseName.toLowerCase();
    switch (lower) {
      case 'neutral':
      case 'idle':
        await this.returnToNeutral(durationMs);
        break;
      case 'arms_down': {
        const rArm = this.skeleton.getBone('RightArm');
        const lArm = this.skeleton.getBone('LeftArm');
        const tasks: BoneRotationInstruction[] = [];
        if (rArm) {
          tasks.push({ bone: 'RightArm', rotation: { x: 10, y: 0, z: -75, isDegrees: true }, durationMs });
        }
        if (lArm) {
          tasks.push({ bone: 'LeftArm', rotation: { x: 10, y: 0, z: 75, isDegrees: true }, durationMs });
        }
        await this.rotateBones(tasks);
        break;
      }
      case 'open':
      case 'open_hand':
      case 'open_right_hand':
        await this.applyHandPose('right', 'open', durationMs);
        break;
      case 'closed':
      case 'close_hand':
      case 'close_right_hand':
      case 'fist':
        await this.applyHandPose('right', 'closed', durationMs);
        break;
      case 'point':
      case 'point_hand':
        await this.applyHandPose('right', 'point', durationMs);
        break;
      case 'thumb_up':
      case 'thumbs_up':
        await this.applyHandPose('right', 'thumb_up', durationMs);
        break;
      case 'peace':
        await this.applyHandPose('right', 'peace', durationMs);
        break;
      default:
        this.logger?.(`[AvatarController] Unknown pose: ${poseName}`, 'warn');
        break;
    }
  }

  private toQuaternion(target: TargetRotation): THREE.Quaternion {
    if (target instanceof THREE.Quaternion) {
      return target.clone();
    }

    if (target instanceof THREE.Euler) {
      return new THREE.Quaternion().setFromEuler(target);
    }

    const DEG2RAD = Math.PI / 180;
    const isDeg = target.isDegrees !== false;
    const x = isDeg ? target.x * DEG2RAD : target.x;
    const y = isDeg ? target.y * DEG2RAD : target.y;
    const z = isDeg ? target.z * DEG2RAD : target.z;

    const euler = new THREE.Euler(x, y, z, 'XYZ');
    return new THREE.Quaternion().setFromEuler(euler);
  }

  // Common Easing Functions
  public static linear = (t: number) => t;
  public static easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
  public static easeInOutQuad = (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  public static easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
