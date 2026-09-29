import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AppCamera } from './Camera.js';
import { AppLighting } from './Lighting.js';
import { AppRenderer } from './Renderer.js';

export interface Updatable {
  update(delta: number): void;
}

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly appCamera: AppCamera;
  public readonly appLighting: AppLighting;
  public readonly appRenderer: AppRenderer;
  public readonly controls: OrbitControls;

  private clock: THREE.Clock;
  private updatables: Set<Updatable> = new Set();
  private isRunning: boolean = false;
  private container: HTMLElement;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e131b);
    // Subtle fog to blend distant ground smoothly
    this.scene.fog = new THREE.FogExp2(0x0e131b, 0.12);

    // 2. Camera setup
    this.appCamera = new AppCamera(width, height);

    // 3. Renderer setup
    this.appRenderer = new AppRenderer(canvas, width, height);

    // 4. Lighting setup
    this.appLighting = new AppLighting(this.scene);

    // 5. OrbitControls setup
    this.controls = new OrbitControls(this.appCamera.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    // Humanoid center-of-mass focus (~1m high)
    this.controls.target.set(0, 1.0, 0);
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 6.0;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.02; // Don't go below floor
    this.controls.update();

    // 6. Ground & Grid setup
    this.createGround();

    // 7. Clock & Resize listener
    this.clock = new THREE.Clock();
    window.addEventListener('resize', this.onResize);
  }

  private createGround(): void {
    // Subtle circular ground plane that receives shadows
    const groundGeometry = new THREE.CircleGeometry(5, 64);
    groundGeometry.rotateX(-Math.PI / 2);

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x161d26,
      roughness: 0.9,
      metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    ground.position.y = 0;
    this.scene.add(ground);

    // Grid helper for spatial reference
    const grid = new THREE.GridHelper(10, 20, 0x303e4d, 0x1d2733);
    grid.position.y = 0.001; // Slightly above ground to prevent z-fighting
    this.scene.add(grid);
  }

  public registerUpdatable(updatable: Updatable): void {
    this.updatables.add(updatable);
  }

  public unregisterUpdatable(updatable: Updatable): void {
    this.updatables.delete(updatable);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  public stop(): void {
    this.isRunning = false;
    this.clock.stop();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    // Update orbit controls
    this.controls.update();

    // Update all registered components (e.g. Avatar mixer / procedural motion)
    for (const item of this.updatables) {
      item.update(delta);
    }

    // Render frame
    this.appRenderer.render(this.scene, this.appCamera.camera);
  };

  private onResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.appCamera.resize(width, height);
    this.appRenderer.resize(width, height);
  };
}
