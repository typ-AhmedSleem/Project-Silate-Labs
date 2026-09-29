import * as THREE from 'three';

export class AppCamera {
  public readonly camera: THREE.PerspectiveCamera;

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Position camera to frame full/upper body of typical 1.6-1.8m humanoid
    this.camera.position.set(0, 1.35, 2.6);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
