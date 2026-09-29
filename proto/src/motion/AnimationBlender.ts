import * as THREE from 'three';

export type EasingFunction = (t: number) => number;

export class AnimationBlender {
  public static readonly DEFAULT_TRANSITION_MS = 180;

  // Easing Library
  public static linear: EasingFunction = (t: number) => t;

  public static easeInQuad: EasingFunction = (t: number) => t * t;

  public static easeOutQuad: EasingFunction = (t: number) => 1 - (1 - t) * (1 - t);

  public static easeInOutQuad: EasingFunction = (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  public static easeInOutCubic: EasingFunction = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  public static easeOutCubic: EasingFunction = (t: number) =>
    1 - Math.pow(1 - t, 3);

  /**
   * Slerp interpolation between two Quaternions using specified easing function.
   */
  public static slerp(
    qa: THREE.Quaternion,
    qb: THREE.Quaternion,
    progress: number,
    easing: EasingFunction = AnimationBlender.easeInOutCubic,
    target: THREE.Quaternion = new THREE.Quaternion()
  ): THREE.Quaternion {
    const t = Math.max(0, Math.min(1, progress));
    const easedT = easing(t);
    return target.slerpQuaternions(qa, qb, easedT);
  }

  /**
   * Lerp interpolation between two Vector3 positions using specified easing function.
   */
  public static lerp(
    va: THREE.Vector3,
    vb: THREE.Vector3,
    progress: number,
    easing: EasingFunction = AnimationBlender.easeInOutCubic,
    target: THREE.Vector3 = new THREE.Vector3()
  ): THREE.Vector3 {
    const t = Math.max(0, Math.min(1, progress));
    const easedT = easing(t);
    return target.lerpVectors(va, vb, easedT);
  }

  /**
   * Converts Euler degrees/radians or Quaternion target to Quaternion.
   */
  public static toQuaternion(
    rot: THREE.Quaternion | THREE.Euler | { x: number; y: number; z: number; isDegrees?: boolean }
  ): THREE.Quaternion {
    if (rot instanceof THREE.Quaternion) {
      return rot.clone();
    }
    if (rot instanceof THREE.Euler) {
      return new THREE.Quaternion().setFromEuler(rot);
    }
    const DEG2RAD = Math.PI / 180;
    const isDeg = rot.isDegrees !== false;
    const euler = new THREE.Euler(
      isDeg ? rot.x * DEG2RAD : rot.x,
      isDeg ? rot.y * DEG2RAD : rot.y,
      isDeg ? rot.z * DEG2RAD : rot.z,
      'XYZ'
    );
    return new THREE.Quaternion().setFromEuler(euler);
  }
}
