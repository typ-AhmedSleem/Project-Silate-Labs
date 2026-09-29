import * as THREE from 'three';

export class AppLighting {
  public readonly ambientLight: THREE.AmbientLight;
  public readonly directionalLight: THREE.DirectionalLight;
  public readonly fillLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    // Ambient light for base illumination
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(this.ambientLight);

    // Key directional light with subtle shadow capability
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.directionalLight.position.set(2, 4, 3);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.bias = -0.001;
    scene.add(this.directionalLight);

    // Soft fill light from the opposite side to soften shadows
    this.fillLight = new THREE.DirectionalLight(0x88aaff, 0.8);
    this.fillLight.position.set(-2, 2, -2);
    scene.add(this.fillLight);
  }
}
