import * as THREE from 'three';
import { SkeletonController } from '../avatar/SkeletonController.js';

export interface CoordRow {
  container: HTMLElement;
  x: HTMLInputElement;
  y: HTMLInputElement;
  z: HTMLInputElement;
}

export interface HeadRow {
  container: HTMLElement;
  rotation: HTMLInputElement;
  tilt: HTMLInputElement;
}

export class SkeletonPanel {
  private panel: HTMLElement;
  private toggleBtn: HTMLElement | null;
  private closeBtn: HTMLButtonElement;
  private contentEl: HTMLElement;
  private isCollapsed: boolean = true;

  // Cached DOM rows keyed by label
  private headRow!: HeadRow;
  private coordRows: Map<string, CoordRow> = new Map();

  // Associated 3D SkeletonController for live avatar bones reading & editing
  private skeletonController: SkeletonController | null = null;

  // Reusable THREE temporary objects for math calculations without allocation
  private tempWorldPos = new THREE.Vector3();
  private tempEuler = new THREE.Euler();

  // Throttle counter for DOM updates during animation ticks
  private frameCount: number = 0;

  constructor() {
    this.panel = document.createElement('aside');
    this.panel.id = 'skeleton-panel';
    this.panel.className = 'skeleton-panel collapsed';

    this.panel.innerHTML = `
      <div class="skeleton-header">
        <div class="skel-header-title">
          <h2>Skeleton Panel</h2>
          <span class="skel-badge">Editable</span>
        </div>
        <button class="icon-btn skeleton-close-btn" title="Close Skeleton Panel">✕</button>
      </div>
      <div class="skeleton-content"></div>
    `;

    this.closeBtn = this.panel.querySelector('.skeleton-close-btn')! as HTMLButtonElement;
    this.contentEl = this.panel.querySelector('.skeleton-content')! as HTMLElement;

    this.buildRows();

    document.getElementById('app')?.appendChild(this.panel);

    this.toggleBtn = document.getElementById('skeleton-toggle-btn');
    if (!this.toggleBtn) {
      const statusBar = document.querySelector('.status-bar');
      if (statusBar) {
        const btn = document.createElement('button');
        btn.id = 'skeleton-toggle-btn';
        btn.className = 'btn btn-ghost';
        btn.title = 'Toggle Skeleton Panel';
        btn.textContent = '🦴 Skeleton';
        const debugBtn = document.getElementById('debug-toggle-btn');
        if (debugBtn) {
          statusBar.insertBefore(btn, debugBtn);
        } else {
          statusBar.appendChild(btn);
        }
        this.toggleBtn = btn;
      }
    }

    this.closeBtn.addEventListener('click', () => this.toggle(true));
    this.toggleBtn?.addEventListener('click', () => this.toggle());
  }

  public setSkeletonController(controller: SkeletonController | null): void {
    this.skeletonController = controller;
    if (this.skeletonController) {
      this.syncFromAvatarBones(true);
    }
  }

  public toggle(forceCollapse?: boolean): void {
    this.isCollapsed = forceCollapse !== undefined ? forceCollapse : !this.isCollapsed;
    this.panel.classList.toggle('collapsed', this.isCollapsed);
    if (!this.isCollapsed && this.skeletonController) {
      this.syncFromAvatarBones(true);
    }
  }

  /**
   * Called on every frame tick (implements SceneManager Updatable interface).
   * Reads the current coordinates directly from the avatar's 3D bones and displays them.
   */
  public update(_delta?: number): void {
    if (this.isCollapsed || !this.skeletonController) return;

    // Refresh every 2 frames for smooth 30-60fps display without excessive DOM thrashing
    this.frameCount++;
    if (this.frameCount % 2 !== 0) return;

    this.syncFromAvatarBones(false);
  }

  /**
   * Reads 3D world positions of avatar bones and updates the panel fields.
   */
  private syncFromAvatarBones(force: boolean): void {
    if (!this.skeletonController) return;

    // 1. Head: rotation (pitch/yaw in degrees) + tilt (roll in degrees)
    const headBone = this.skeletonController.getBone('Head');
    if (headBone) {
      this.tempEuler.setFromQuaternion(headBone.quaternion, 'YXZ');
      const pitchDeg = THREE.MathUtils.radToDeg(this.tempEuler.x);
      const yawDeg = THREE.MathUtils.radToDeg(this.tempEuler.y);
      const rollDeg = THREE.MathUtils.radToDeg(this.tempEuler.z);

      if (force || document.activeElement !== this.headRow.rotation) {
        this.headRow.rotation.value = `${pitchDeg.toFixed(1)}° / ${yawDeg.toFixed(1)}°`;
      }
      if (force || document.activeElement !== this.headRow.tilt) {
        this.headRow.tilt.value = `${rollDeg.toFixed(1)}°`;
      }
    }

    // 2. Arms (Shoulder, Arm/Elbow, Hand/Wrist)
    const armBones = [
      { label: 'L Shoulder', boneName: 'LeftShoulder' },
      { label: 'L Elbow', boneName: 'LeftForeArm' },
      { label: 'L Wrist', boneName: 'LeftHand' },
      { label: 'R Shoulder', boneName: 'RightShoulder' },
      { label: 'R Elbow', boneName: 'RightForeArm' },
      { label: 'R Wrist', boneName: 'RightHand' },
    ];

    for (const { label, boneName } of armBones) {
      const bone = this.skeletonController.getBone(boneName);
      if (bone) {
        bone.getWorldPosition(this.tempWorldPos);
        this.setVec3UI(label, this.tempWorldPos, force);
      }
    }

    // 3. Hands & Fingers (Wrist + 5 fingers x 4 landmarks each)
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const;
    for (const side of ['L', 'R'] as const) {
      const prefix = side === 'L' ? 'LeftHand' : 'RightHand';

      // Hand wrist bone
      const handBone = this.skeletonController.getBone(side === 'L' ? 'LeftHand' : 'RightHand');
      if (handBone) {
        handBone.getWorldPosition(this.tempWorldPos);
        this.setVec3UI(`${side} Hand Wrist`, this.tempWorldPos, force);
      }

      // 4 joints for each finger
      for (const finger of fingers) {
        for (let j = 1; j <= 4; j++) {
          const rowLabel = `${side} ${finger} ${j}`;
          const boneName = `${prefix}${finger}${j}`;
          const bone = this.skeletonController.getBone(boneName);
          if (bone) {
            bone.getWorldPosition(this.tempWorldPos);
            this.setVec3UI(rowLabel, this.tempWorldPos, force);
          }
        }
      }
    }
  }

  // ─── DOM Building ──────────────────────────

  private buildRows(): void {
    // HEAD section
    this.addGroupHeader('Head');
    this.headRow = this.createHeadRow();
    this.contentEl.appendChild(this.headRow.container);

    // ARMS
    this.addGroupHeader('Left Arm');
    this.addCoordRow('L Shoulder', 'LeftShoulder');
    this.addCoordRow('L Elbow', 'LeftForeArm');
    this.addCoordRow('L Wrist', 'LeftHand');

    this.addGroupHeader('Right Arm');
    this.addCoordRow('R Shoulder', 'RightShoulder');
    this.addCoordRow('R Elbow', 'RightForeArm');
    this.addCoordRow('R Wrist', 'RightHand');

    // HANDS
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const;

    for (const side of ['L', 'R'] as const) {
      const label = side === 'L' ? 'Left Hand' : 'Right Hand';
      const prefix = side === 'L' ? 'LeftHand' : 'RightHand';
      this.addGroupHeader(label);

      this.addCoordRow(`${side} Hand Wrist`, side === 'L' ? 'LeftHand' : 'RightHand');

      for (const finger of fingers) {
        for (let j = 1; j <= 4; j++) {
          const boneName = `${prefix}${finger}${j}`;
          this.addCoordRow(`${side} ${finger} ${j}`, boneName);
        }
      }
    }
  }

  private addGroupHeader(title: string): void {
    const h = document.createElement('div');
    h.className = 'skel-group-header';
    h.textContent = title;
    this.contentEl.appendChild(h);
  }

  private addCoordRow(label: string, boneName: string): void {
    const row = this.createCoordRow(label, boneName);
    this.coordRows.set(label, row);
    this.contentEl.appendChild(row.container);
  }

  private createCoordRow(label: string, boneName: string): CoordRow {
    const container = document.createElement('div');
    container.className = 'skel-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'skel-bone-name';
    nameEl.textContent = label;
    container.appendChild(nameEl);

    const inputs = document.createElement('div');
    inputs.className = 'skel-inputs';

    const emitChange = () => {
      if (!this.skeletonController) return;
      const bone = this.skeletonController.getBone(boneName);
      if (!bone) return;

      const targetWorld = new THREE.Vector3(
        parseFloat(x.input.value) || 0,
        parseFloat(y.input.value) || 0,
        parseFloat(z.input.value) || 0
      );

      // Convert target world position into bone's parent local space
      if (bone.parent) {
        bone.parent.updateWorldMatrix(true, false);
        bone.position.copy(bone.parent.worldToLocal(targetWorld));
      } else {
        bone.position.copy(targetWorld);
      }
      bone.updateMatrixWorld(true);
    };

    const x = this.makeInput('X', emitChange);
    const y = this.makeInput('Y', emitChange);
    const z = this.makeInput('Z', emitChange);

    inputs.appendChild(x.wrapper);
    inputs.appendChild(y.wrapper);
    inputs.appendChild(z.wrapper);
    container.appendChild(inputs);

    return { container, x: x.input, y: y.input, z: z.input };
  }

  private createHeadRow(): HeadRow {
    const container = document.createElement('div');
    container.className = 'skel-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'skel-bone-name';
    nameEl.textContent = 'Head';
    container.appendChild(nameEl);

    const inputs = document.createElement('div');
    inputs.className = 'skel-inputs';

    const emitHead = () => {
      if (!this.skeletonController) return;
      const headBone = this.skeletonController.getBone('Head');
      if (!headBone) return;

      let pitchDeg = 0;
      let yawDeg = 0;
      const rotVal = rot.input.value.replace(/°/g, '').trim();
      if (rotVal.includes('/')) {
        const parts = rotVal.split('/');
        pitchDeg = parseFloat(parts[0]) || 0;
        yawDeg = parseFloat(parts[1]) || 0;
      } else {
        const num = parseFloat(rotVal) || 0;
        pitchDeg = num;
        yawDeg = num;
      }

      const rollDeg = parseFloat(tilt.input.value.replace(/°/g, '').trim()) || 0;

      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(pitchDeg),
        THREE.MathUtils.degToRad(yawDeg),
        THREE.MathUtils.degToRad(rollDeg),
        'YXZ'
      );
      headBone.quaternion.setFromEuler(euler);
      headBone.updateMatrixWorld(true);
    };

    const rot = this.makeHeadValuesInput('Rot (P/Y)', emitHead, '0.0° / 0.0°');
    const tilt = this.makeHeadValuesInput('Tilt (R)', emitHead, '0.0°');

    inputs.appendChild(rot.wrapper);
    inputs.appendChild(tilt.wrapper);
    container.appendChild(inputs);

    return { container, rotation: rot.input, tilt: tilt.input };
  }

  private makeInput(
    label: string,
    onChange?: () => void,
    defaultValue: string = '0.000'
  ): { wrapper: HTMLElement; input: HTMLInputElement } {
    const wrapper = document.createElement('label');
    wrapper.className = 'skel-field';

    const span = document.createElement('span');
    span.className = 'skel-field-label';
    span.textContent = label;

    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.001'
    input.className = 'skel-field-input editable';
    input.readOnly = false;
    input.value = defaultValue;

    if (onChange) {
      input.addEventListener('input', () => onChange());
      input.addEventListener('change', () => onChange());
    }

    wrapper.appendChild(span);
    wrapper.appendChild(input);

    return { wrapper, input };
  }

  private makeHeadValuesInput(
    label: string,
    onChange?: () => void,
    defaultValue: string = '0.000'
  ): { wrapper: HTMLElement; input: HTMLInputElement } {
    const wrapper = document.createElement('label');
    wrapper.className = 'skel-field';

    const span = document.createElement('span');
    span.className = 'skel-field-label';
    span.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'skel-field-input editable';
    input.readOnly = false;
    input.value = defaultValue;

    if (onChange) {
      input.addEventListener('input', () => onChange());
      input.addEventListener('change', () => onChange());
    }

    wrapper.appendChild(span);
    wrapper.appendChild(input);

    return { wrapper, input };
  }

  private setVec3UI(label: string, v: THREE.Vector3, force: boolean): void {
    const row = this.coordRows.get(label);
    if (!row) return;

    if (force || document.activeElement !== row.x) {
      row.x.value = v.x.toFixed(3);
    }
    if (force || document.activeElement !== row.y) {
      row.y.value = v.y.toFixed(3);
    }
    if (force || document.activeElement !== row.z) {
      row.z.value = v.z.toFixed(3);
    }
  }
}
