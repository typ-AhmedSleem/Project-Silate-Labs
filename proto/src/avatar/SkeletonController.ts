import * as THREE from 'three';

export class SkeletonController {
  private bonesMap: Map<string, THREE.Bone> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private originalRotations: Map<string, THREE.Quaternion> = new Map();
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  // Canonical bone name aliases mapping common alternate names to standard names
  private static readonly ALIASES: Record<string, string[]> = {
    Hips: ['hips', 'pelvis'],
    Spine: ['spine'],
    Spine1: ['spine1', 'lowerchest'],
    Spine2: ['spine2', 'chest', 'upperchest'],
    Neck: ['neck'],
    Head: ['head'],
    LeftShoulder: ['leftshoulder', 'lshoulder', 'shoulder_l'],
    LeftArm: ['leftarm', 'leftupperarm', 'lupperarm', 'arm_l'],
    LeftForeArm: ['leftforearm', 'leftlowerarm', 'llowerarm', 'forearm_l'],
    LeftHand: ['lefthand', 'lhand', 'hand_l'],
    RightShoulder: ['rightshoulder', 'rshoulder', 'shoulder_r'],
    RightArm: ['rightarm', 'rightupperarm', 'rupperarm', 'arm_r'],
    RightForeArm: ['rightforearm', 'rightlowerarm', 'rlowerarm', 'forearm_r'],
    RightHand: ['righthand', 'rhand', 'hand_r'],
  };

  constructor(model: THREE.Object3D, logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void) {
    this.logger = logger;
    this.indexBones(model);
  }

  private indexBones(model: THREE.Object3D): void {
    model.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone;
        this.logger?.("Bone: " + bone.name.replace("mixamorig1", ""));
        this.bonesMap.set(bone.name, bone);
        this.originalRotations.set(bone.name, bone.quaternion.clone());

        // Normalize bone name without prefixes
        const normalized = this.normalizeName(bone.name);
        this.aliasMap.set(normalized.toLowerCase(), bone.name);
      }
    });

    // Setup predefined alias mappings
    for (const [canonical, aliases] of Object.entries(SkeletonController.ALIASES)) {
      for (const alias of aliases) {
        const lowerAlias = alias.toLowerCase();
        if (this.aliasMap.has(lowerAlias)) {
          const actualName = this.aliasMap.get(lowerAlias)!;
          this.aliasMap.set(canonical.toLowerCase(), actualName);
          break;
        }
      }
    }
  }

  private normalizeName(name: string): string {
    // Strip common prefixes: "mixamorig:", "mixamorig", "Armature_"
    return name
      .replace("mixamorig1", "")
      .replace(/^mixamorig[:_]?/i, '')
      .replace(/^armature[:_]?/i, '')
      .replace(/^bip01[:_]?/i, '');
  }

  public getBone(name: string): THREE.Bone | undefined {
    // 1. Direct name match
    if (this.bonesMap.has(name)) {
      return this.bonesMap.get(name);
    }

    // 2. Normalized / alias match
    const lower = name.toLowerCase();
    if (this.aliasMap.has(lower)) {
      const realName = this.aliasMap.get(lower)!;
      return this.bonesMap.get(realName);
    }

    // 3. Fallback normalized search
    const normalizedTarget = this.normalizeName(name).toLowerCase();
    for (const [realName, bone] of this.bonesMap.entries()) {
      if (this.normalizeName(realName).toLowerCase() === normalizedTarget) {
        return bone;
      }
    }

    return undefined;
  }

  public requireBone(name: string): THREE.Bone | null {
    const bone = this.getBone(name);
    if (!bone) {
      const msg = `[SkeletonController] Warning: Referenced bone "${name}" does not exist in avatar skeleton.`;
      console.warn(msg);
      if (this.logger) {
        this.logger(msg, 'warn');
      }
      return null;
    }
    return bone;
  }

  public hasBone(name: string): boolean {
    return this.getBone(name) !== undefined;
  }

  public getOriginalRotation(name: string): THREE.Quaternion | undefined {
    const bone = this.getBone(name);
    if (bone && this.originalRotations.has(bone.name)) {
      return this.originalRotations.get(bone.name)!.clone();
    }
    return undefined;
  }

  public getAllBones(): THREE.Bone[] {
    return Array.from(this.bonesMap.values());
  }

  public getArmBones(side: 'left' | 'right') {
    const prefix = side === 'left' ? 'Left' : 'Right';
    return {
      shoulder: this.getBone(`${prefix}Shoulder`),
      arm: this.getBone(`${prefix}Arm`),
      forearm: this.getBone(`${prefix}ForeArm`),
      hand: this.getBone(`${prefix}Hand`)
    };
  }

  public getHeadBones() {
    return {
      neck: this.getBone('Neck'),
      head: this.getBone('Head')
    };
  }

  public getSpineBones() {
    return {
      hips: this.getBone('Hips'),
      spine: this.getBone('Spine'),
      spine1: this.getBone('Spine1'),
      spine2: this.getBone('Spine2')
    };
  }

  /**
   * Retrieves all finger bones for a given side ('left' or 'right').
   */
  public getFingerBones(side: 'left' | 'right'): THREE.Bone[] {
    const prefix = side === 'left' ? 'LeftHand' : 'RightHand';
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    const bones: THREE.Bone[] = [];

    for (const f of fingerNames) {
      for (let j = 1; j <= 4; j++) {
        const bone = this.getBone(`${prefix}${f}${j}`);
        if (bone) {
          bones.push(bone);
        }
      }
    }
    return bones;
  }

  /**
   * Returns rotation targets for standard named hand poses:
   * 'open', 'closed', 'point', 'thumb_up', 'peace'
   */
  public getHandPoseInstructions(
    side: 'left' | 'right',
    pose: 'open' | 'closed' | 'point' | 'thumb_up' | 'peace'
  ): Array<{ bone: string; rotation: { x: number; y: number; z: number; isDegrees: boolean } | THREE.Quaternion }> {
    const prefix = side === 'left' ? 'LeftHand' : 'RightHand';
    const targets: Array<{ bone: string; rotation: { x: number; y: number; z: number; isDegrees: boolean } | THREE.Quaternion }> = [];
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

    // 1. Open Pose: return all finger bones to rest/original rotations
    if (pose === 'open') {
      const bones = this.getFingerBones(side);
      for (const bone of bones) {
        const rest = this.originalRotations.get(bone.name) || bone.quaternion;
        targets.push({ bone: bone.name, rotation: rest.clone() });
      }
      return targets;
    }

    // 2. Formulated Poses (closed, point, thumb_up, peace)
    const isCurled = (finger: string): boolean => {
      switch (pose) {
        case 'closed':
          return true;
        case 'point':
          return finger !== 'Index';
        case 'thumb_up':
          return finger !== 'Thumb';
        case 'peace':
          return finger !== 'Index' && finger !== 'Middle';
        default:
          return false;
      }
    };

    for (const finger of fingerNames) {
      const curl = isCurled(finger);

      for (let j = 1; j <= 4; j++) {
        const boneName = `${prefix}${finger}${j}`;
        const bone = this.getBone(boneName);
        if (!bone) continue;

        if (curl) {
          if (finger === 'Thumb') {
            // Thumb curled inward
            targets.push({
              bone: bone.name,
              rotation: { x: -15, y: side === 'right' ? 15 : -15, z: side === 'right' ? -35 : 35, isDegrees: true }
            });
          } else {
            // Main finger curled at joints 1, 2, 3
            const angleX = j === 1 ? 65 : j === 2 ? 75 : 60;
            targets.push({
              bone: bone.name,
              rotation: { x: angleX, y: 0, z: 0, isDegrees: true }
            });
          }
        } else {
          // Extended / straight (rest rotation)
          const rest = this.originalRotations.get(bone.name) || bone.quaternion;
          targets.push({ bone: bone.name, rotation: rest.clone() });
        }
      }
    }

    return targets;
  }
}
