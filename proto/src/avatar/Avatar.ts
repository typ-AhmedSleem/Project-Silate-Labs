import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FacialController } from './FacialController.js';

export interface SkeletonTreeNode {
  name: string;
  type: string;
  children: SkeletonTreeNode[];
}

export interface AvatarLoadResult {
  bones: string[];
  boneTree: SkeletonTreeNode;
  clips: string[];
  morphTargets: string[];
  activeClip: string | null;
}

export class Avatar {
  public model?: THREE.Group;
  public mixer?: THREE.AnimationMixer;
  public skeletonHelper?: THREE.SkeletonHelper;
  public readonly facialController: FacialController;

  private scene: THREE.Scene;
  private bonesMap: Map<string, THREE.Object3D> = new Map();
  private allBones: THREE.Bone[] = [];
  private clipsMap: Map<string, THREE.AnimationClip> = new Map();
  private morphTargetsList: string[] = [];
  private activeAction?: THREE.AnimationAction;
  private activeClipName: string | null = null;
  private isProceduralIdle: boolean = false;
  private proceduralIdleTime: number = 0;
  private idleEnabled: boolean = true;

  // Track initial rotations for procedural idle to avoid drifting
  private baseRotations: Map<string, THREE.Euler> = new Map();

  constructor(scene: THREE.Scene, logger?: (msg: string) => void) {
    this.scene = scene;
    this.facialController = new FacialController(logger);
  }

  /**
   * Attempts to load the humanoid GLB model from predefined candidate URLs.
   */
  public async load(url = 'assets/model/humanoid.glb'): Promise<AvatarLoadResult> {
    const loader = new GLTFLoader();

    // Candidate paths to accommodate Vite's publicDir serving assets at root
    const candidateUrls = [
      '/model/humanoid.glb',
      url,
      `/${url.replace(/^\/+/, '')}`
    ];

    let gltf: any = null;
    let loadError: Error | null = null;

    for (const candidate of candidateUrls) {
      try {
        gltf = await new Promise((resolve, reject) => {
          loader.load(candidate, resolve, undefined, reject);
        });
        if (gltf) break;
      } catch (err: any) {
        loadError = err;
      }
    }

    if (!gltf) {
      throw loadError || new Error(`Failed to load avatar model from ${url}`);
    }

    const model = gltf.scene as THREE.Group;
    this.model = model;

    // Enable shadows and gather morph targets
    model.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.morphTargetDictionary) {
          for (const key of Object.keys(mesh.morphTargetDictionary)) {
            if (!this.morphTargetsList.includes(key)) {
              this.morphTargetsList.push(key);
            }
          }
        }
      }

      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone;
        this.allBones.push(bone);
        this.bonesMap.set(bone.name, bone);
        // Also map without common prefixes like "mixamorig" or "mixamorig:" for flexible lookups
        const strippedName = bone.name.replace(/^mixamorig[:_]?/i, '');
        if (strippedName !== bone.name) {
          this.bonesMap.set(strippedName, bone);
        }
        this.baseRotations.set(bone.name, bone.rotation.clone());
      }
    });

    // Add model to scene
    this.scene.add(model);

    // Setup SkeletonHelper for debug visualization (Task 6.2)
    this.skeletonHelper = new THREE.SkeletonHelper(model);
    this.skeletonHelper.visible = false;
    this.scene.add(this.skeletonHelper);

    // Setup Animation Mixer
    this.mixer = new THREE.AnimationMixer(model);

    // Catalog animation clips
    if (gltf.animations && gltf.animations.length > 0) {
      for (const clip of gltf.animations) {
        this.clipsMap.set(clip.name, clip);
      }
    }

    // Determine initial idle animation
    this.initIdleAnimation(gltf.animations || []);

    // Build hierarchy tree
    const rootBone = this.findRootBone(model);
    const boneTree = rootBone
      ? this.buildBoneHierarchy(rootBone)
      : { name: 'Root (none)', type: 'Object3D', children: [] };

    return {
      bones: this.allBones.map((b) => b.name),
      boneTree,
      clips: Array.from(this.clipsMap.keys()),
      morphTargets: [...this.morphTargetsList],
      activeClip: this.activeClipName
    };
  }

  private initIdleAnimation(clips: THREE.AnimationClip[]): void {
    if (!this.mixer) return;

    if (clips.length > 0) {
      // Look for clip named "idle" or containing "idle", or use first clip
      const idleClip =
        clips.find((c) => /idle/i.test(c.name)) ||
        clips[0];

      if (idleClip) {
        const action = this.mixer.clipAction(idleClip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        this.activeAction = action;
        this.activeClipName = idleClip.name;
        this.isProceduralIdle = false;
        return;
      }
    }

    // Fallback: procedural idle animation
    this.isProceduralIdle = true;
    this.activeClipName = 'Procedural Idle';
  }

  public playAnimation(name: string): boolean {
    if (!this.mixer) return false;

    // Search exact or case-insensitive
    let clip = this.clipsMap.get(name);
    if (!clip) {
      for (const [key, val] of this.clipsMap.entries()) {
        if (key.toLowerCase() === name.toLowerCase()) {
          clip = val;
          break;
        }
      }
    }

    if (!clip) return false;

    const newAction = this.mixer.clipAction(clip);
    if (this.activeAction && this.activeAction !== newAction) {
      this.activeAction.fadeOut(0.3);
      newAction.reset().fadeIn(0.3).play();
    } else {
      newAction.reset().play();
    }

    this.activeAction = newAction;
    this.activeClipName = clip.name;
    this.isProceduralIdle = false;
    return true;
  }

  public getBone(name: string): THREE.Object3D | undefined {
    // Direct lookup
    if (this.bonesMap.has(name)) {
      return this.bonesMap.get(name);
    }
    // Case-insensitive lookup
    const lower = name.toLowerCase();
    for (const [key, bone] of this.bonesMap.entries()) {
      if (key.toLowerCase() === lower) {
        return bone;
      }
    }
    return undefined;
  }

  public getBones(): THREE.Bone[] {
    return this.allBones;
  }

  public getClips(): string[] {
    return Array.from(this.clipsMap.keys());
  }

  public getMorphTargets(): string[] {
    return this.morphTargetsList;
  }

  public getActiveClip(): string | null {
    return this.activeClipName;
  }

  public setIdleEnabled(enabled: boolean): void {
    this.idleEnabled = enabled;

    if (this.activeAction) {
      this.activeAction.paused = !enabled;
    }

    if (!enabled) {
      // Reset bones to base rotations so avatar stands completely still with no movement
      for (const [boneName, baseRot] of this.baseRotations.entries()) {
        const bone = this.getBone(boneName);
        if (bone) {
          bone.rotation.copy(baseRot);
        }
      }
    }
  }

  public isIdleEnabled(): boolean {
    return this.idleEnabled;
  }

  public setSkeletonHelperVisible(visible: boolean): void {
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = visible;
    }
  }

  public isSkeletonHelperVisible(): boolean {
    return this.skeletonHelper?.visible ?? false;
  }

  public setMorphTarget(name: string, value: number): void {
    // Facial morphs are deferred per specification
    this.facialController.setMorph(name, value);
  }

  public update(delta: number): void {
    if (this.idleEnabled) {
      if (this.mixer) {
        this.mixer.update(delta);
      }

      if (this.isProceduralIdle) {
        this.updateProceduralIdle(delta);
      }
    }

    // Update skeleton visualization lines if active
    if (this.skeletonHelper && this.skeletonHelper.visible) {
      this.skeletonHelper.update();
    }
  }

  private updateProceduralIdle(delta: number): void {
    this.proceduralIdleTime += delta;
    const t = this.proceduralIdleTime;

    // Subtle breathing oscillation (period ~3.5s)
    const breath = Math.sin(t * 1.8) * 0.025;
    const sway = Math.cos(t * 0.9) * 0.015;

    const spine = this.getBone('Spine') || this.getBone('Spine1');
    if (spine) {
      const base = this.baseRotations.get(spine.name);
      if (base) {
        spine.rotation.x = base.x + breath * 0.6;
        spine.rotation.y = base.y + sway * 0.3;
      }
    }

    const chest = this.getBone('Spine2') || this.getBone('Chest');
    if (chest) {
      const base = this.baseRotations.get(chest.name);
      if (base) {
        chest.rotation.x = base.x + breath;
      }
    }

    const head = this.getBone('Head');
    if (head) {
      const base = this.baseRotations.get(head.name);
      if (base) {
        head.rotation.x = base.x + Math.sin(t * 0.8) * 0.02;
        head.rotation.y = base.y + Math.cos(t * 0.6) * 0.03;
      }
    }
  }

  private findRootBone(model: THREE.Object3D): THREE.Object3D | null {
    let root: THREE.Object3D | null = null;
    model.traverse((child) => {
      if ((child as THREE.Bone).isBone && !root) {
        // Find topmost bone
        let current = child;
        while (current.parent && (current.parent as THREE.Bone).isBone) {
          current = current.parent;
        }
        root = current;
      }
    });
    return root;
  }

  private buildBoneHierarchy(bone: THREE.Object3D): SkeletonTreeNode {
    const node: SkeletonTreeNode = {
      name: bone.name.replace("mixamorig1", ""),
      type: (bone as THREE.Bone).isBone ? 'Bone' : 'Object3D',
      children: []
    };

    for (const child of bone.children) {
      if ((child as THREE.Bone).isBone || child.type === 'Bone') {
        node.children.push(this.buildBoneHierarchy(child));
      }
    }

    return node;
  }
}
