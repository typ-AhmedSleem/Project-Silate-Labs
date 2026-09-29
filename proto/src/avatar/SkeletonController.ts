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
}
