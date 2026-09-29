import { AvatarController } from '../avatar/AvatarController.js';

export type GestureFunction = (controller: AvatarController) => Promise<void>;

export class GestureLibrary {
  private static registry: Map<string, GestureFunction> = new Map();

  public static register(name: string, fn: GestureFunction): void {
    this.registry.set(name.toLowerCase(), fn);
  }

  public static async execute(name: string, controller: AvatarController): Promise<boolean> {
    const fn = this.registry.get(name.toLowerCase());
    if (!fn) {
      console.warn(`[GestureLibrary] Gesture "${name}" not found.`);
      return false;
    }
    await fn(controller);
    return true;
  }

  public static getAvailableGestures(): string[] {
    return Array.from(this.registry.keys());
  }

  // --- Predefined Procedural Gestures ---

  /**
   * Raise Right Hand:
   * Upper arm raises forward and slightly out; forearm bends at elbow ~90 degrees.
   */
  public static async raiseRightHand(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      {
        bone: 'RightArm',
        rotation: { x: -35, y: -20, z: -55, isDegrees: true },
        durationMs: 400
      },
      {
        bone: 'RightForeArm',
        rotation: { x: 0, y: 30, z: -65, isDegrees: true },
        durationMs: 400
      }
    ]);
  }

  /**
   * Lower Right Hand:
   * Smoothly returns right arm and forearm to resting idle position.
   */
  public static async lowerRightHand(ctrl: AvatarController): Promise<void> {
    await ctrl.returnToNeutral(350);
  }

  /**
   * Wave Right Hand:
   * 1. Raise hand
   * 2. Oscillate forearm left/right 2 cycles
   * 3. Return to neutral idle
   */
  public static async waveRightHand(ctrl: AvatarController): Promise<void> {
    // 1. Raise arm
    await ctrl.rotateBones([
      {
        bone: 'RightArm',
        rotation: { x: -40, y: -15, z: -65, isDegrees: true },
        durationMs: 350
      },
      {
        bone: 'RightForeArm',
        rotation: { x: -10, y: 35, z: -70, isDegrees: true },
        durationMs: 350
      }
    ]);

    // 2. Wave cycles (forearm/hand tilt)
    for (let i = 0; i < 2; i++) {
      await ctrl.rotateBone('RightForeArm', { x: -20, y: 15, z: -50, isDegrees: true }, 200);
      await ctrl.rotateBone('RightForeArm', { x: -5, y: 45, z: -85, isDegrees: true }, 200);
    }

    // 3. Smooth blend back to neutral idle
    await ctrl.returnToNeutral(400);
  }

  /**
   * Nod Head:
   * Head pitches down ~20 degrees and returns, repeated twice.
   */
  public static async nod(ctrl: AvatarController): Promise<void> {
    for (let i = 0; i < 2; i++) {
      await ctrl.rotateBone('Head', { x: 22, y: 0, z: 0, isDegrees: true }, 220);
      await ctrl.rotateBone('Head', { x: -4, y: 0, z: 0, isDegrees: true }, 200);
    }
    await ctrl.returnToNeutral(250);
  }

  /**
   * Shake Head:
   * Head yaws left, then right, then returns to center.
   */
  public static async shakeHead(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBone('Head', { x: 0, y: 26, z: 0, isDegrees: true }, 200);
    await ctrl.rotateBone('Head', { x: 0, y: -26, z: 0, isDegrees: true }, 260);
    await ctrl.rotateBone('Head', { x: 0, y: 18, z: 0, isDegrees: true }, 220);
    await ctrl.rotateBone('Head', { x: 0, y: -12, z: 0, isDegrees: true }, 180);
    await ctrl.returnToNeutral(250);
  }

  /**
   * Thumbs Up:
   * Right forearm bends upward 90°, hand tilts with thumb pointing up, holds, returns to idle.
   */
  public static async thumbsUp(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      {
        bone: 'RightArm',
        rotation: { x: -20, y: 0, z: -40, isDegrees: true },
        durationMs: 300
      },
      {
        bone: 'RightForeArm',
        rotation: { x: 0, y: 40, z: -75, isDegrees: true },
        durationMs: 300
      },
      {
        bone: 'RightHand',
        rotation: { x: 10, y: 15, z: 10, isDegrees: true },
        durationMs: 250
      }
    ]);

    // Hold gesture briefly
    await ctrl.wait(600);

    await ctrl.returnToNeutral(350);
  }

  /**
   * Point Right / Forward:
   * Right arm extends forward pointing directly at target.
   */
  public static async pointRight(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      {
        bone: 'RightArm',
        rotation: { x: -80, y: -10, z: -15, isDegrees: true },
        durationMs: 350
      },
      {
        bone: 'RightForeArm',
        rotation: { x: 0, y: 0, z: -10, isDegrees: true },
        durationMs: 350
      },
      {
        bone: 'RightHand',
        rotation: { x: 0, y: 0, z: 0, isDegrees: true },
        durationMs: 300
      }
    ]);

    // Hold briefly
    await ctrl.wait(600);

    await ctrl.returnToNeutral(350);
  }

  /**
   * Open Right Hand
   */
  public static async openRightHand(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBone('RightHand', { x: 0, y: 10, z: 15, isDegrees: true }, 250);
  }

  /**
   * Close Right Hand
   */
  public static async closeRightHand(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBone('RightHand', { x: 15, y: -10, z: -25, isDegrees: true }, 250);
  }
  /**
   * Gesture: How / Question
   * Both arms raise forward with forearms bent and palms facing up.
   */
  public static async gestureHow(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -30, y: 15, z: -35, isDegrees: true }, durationMs: 350 },
      { bone: 'LeftArm', rotation: { x: -30, y: -15, z: 35, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: 0, y: 40, z: -45, isDegrees: true }, durationMs: 350 },
      { bone: 'LeftForeArm', rotation: { x: 0, y: -40, z: 45, isDegrees: true }, durationMs: 350 },
      { bone: 'Head', rotation: { x: -5, y: 0, z: -6, isDegrees: true }, durationMs: 350 }
    ]);
    await ctrl.wait(400);
  }

  /**
   * Gesture: Are
   * Both hands sweep gently outward in front.
   */
  public static async gestureAre(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -35, y: 30, z: -45, isDegrees: true }, durationMs: 350 },
      { bone: 'LeftArm', rotation: { x: -35, y: -30, z: 45, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: 10, y: 35, z: -25, isDegrees: true }, durationMs: 350 },
      { bone: 'LeftForeArm', rotation: { x: 10, y: -35, z: 25, isDegrees: true }, durationMs: 350 }
    ]);
    await ctrl.wait(350);
  }

  /**
   * Gesture: You
   * Right arm extends directly forward pointing at the viewer.
   */
  public static async gestureYou(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -75, y: -5, z: -10, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: 5, y: 0, z: -5, isDegrees: true }, durationMs: 350 },
      { bone: 'RightHand', rotation: { x: 0, y: 0, z: 0, isDegrees: true }, durationMs: 300 }
    ]);
    await ctrl.wait(450);
  }

  /**
   * Gesture: Thank / Thank you
   * Hand touches chin/chest area, then sweeps outward and forward.
   */
  public static async gestureThank(ctrl: AvatarController): Promise<void> {
    // 1. Move hand to chin
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -45, y: -25, z: -40, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: -30, y: 80, z: -85, isDegrees: true }, durationMs: 350 },
      { bone: 'Head', rotation: { x: 12, y: 0, z: 0, isDegrees: true }, durationMs: 300 }
    ]);
    await ctrl.wait(150);

    // 2. Sweep forward & open
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -40, y: 0, z: -25, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: 10, y: 20, z: -20, isDegrees: true }, durationMs: 350 },
      { bone: 'Head', rotation: { x: 0, y: 0, z: 0, isDegrees: true }, durationMs: 300 }
    ]);
    await ctrl.wait(350);
  }

  /**
   * Gesture: Yes
   * Affirmative double head nod with subtle hand acknowledgement.
   */
  public static async gestureYes(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -25, y: 0, z: -30, isDegrees: true }, durationMs: 250 },
      { bone: 'RightForeArm', rotation: { x: 0, y: 30, z: -50, isDegrees: true }, durationMs: 250 }
    ]);
    for (let i = 0; i < 2; i++) {
      await ctrl.rotateBone('Head', { x: 20, y: 0, z: 0, isDegrees: true }, 200);
      await ctrl.rotateBone('Head', { x: -2, y: 0, z: 0, isDegrees: true }, 180);
    }
  }

  /**
   * Gesture: No
   * Head shake left/right with right hand waving side-to-side horizontally.
   */
  public static async gestureNo(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -30, y: -10, z: -35, isDegrees: true }, durationMs: 250 },
      { bone: 'RightForeArm', rotation: { x: 0, y: 45, z: -40, isDegrees: true }, durationMs: 250 }
    ]);
    for (let i = 0; i < 2; i++) {
      await Promise.all([
        ctrl.rotateBone('Head', { x: 0, y: 22, z: 0, isDegrees: true }, 180),
        ctrl.rotateBone('RightForeArm', { x: -10, y: 25, z: -25, isDegrees: true }, 180)
      ]);
      await Promise.all([
        ctrl.rotateBone('Head', { x: 0, y: -22, z: 0, isDegrees: true }, 180),
        ctrl.rotateBone('RightForeArm', { x: 10, y: 55, z: -55, isDegrees: true }, 180)
      ]);
    }
  }

  /**
   * Gesture: Please
   * Right hand placed over chest with polite head bow.
   */
  public static async gesturePlease(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -35, y: -20, z: -30, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: -15, y: 65, z: -70, isDegrees: true }, durationMs: 350 },
      { bone: 'Head', rotation: { x: 14, y: 0, z: 0, isDegrees: true }, durationMs: 300 }
    ]);
    await ctrl.wait(500);
  }

  /**
   * Gesture: Goodbye
   * Arm raised high waving side-to-side.
   */
  public static async gestureGoodbye(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -50, y: -20, z: -85, isDegrees: true }, durationMs: 350 },
      { bone: 'RightForeArm', rotation: { x: -15, y: 30, z: -60, isDegrees: true }, durationMs: 350 }
    ]);
    for (let i = 0; i < 2; i++) {
      await ctrl.rotateBone('RightForeArm', { x: -25, y: 15, z: -45, isDegrees: true }, 200);
      await ctrl.rotateBone('RightForeArm', { x: -5, y: 45, z: -75, isDegrees: true }, 200);
    }
  }

  /**
   * Gesture: Welcome
   * Both arms open wide in a welcoming embrace.
   */
  public static async gestureWelcome(ctrl: AvatarController): Promise<void> {
    await ctrl.rotateBones([
      { bone: 'RightArm', rotation: { x: -25, y: 35, z: -55, isDegrees: true }, durationMs: 400 },
      { bone: 'LeftArm', rotation: { x: -25, y: -35, z: 55, isDegrees: true }, durationMs: 400 },
      { bone: 'RightForeArm', rotation: { x: 0, y: 20, z: -25, isDegrees: true }, durationMs: 400 },
      { bone: 'LeftForeArm', rotation: { x: 0, y: -20, z: 25, isDegrees: true }, durationMs: 400 },
      { bone: 'Spine2', rotation: { x: -8, y: 0, z: 0, isDegrees: true }, durationMs: 400 }
    ]);
    await ctrl.wait(500);
  }
}

// Auto-register built-in gestures
GestureLibrary.register('raise_right_hand', GestureLibrary.raiseRightHand);
GestureLibrary.register('lower_right_hand', GestureLibrary.lowerRightHand);
GestureLibrary.register('wave_right_hand', GestureLibrary.waveRightHand);
GestureLibrary.register('wave', GestureLibrary.waveRightHand);
GestureLibrary.register('nod', GestureLibrary.nod);
GestureLibrary.register('shake_head', GestureLibrary.shakeHead);
GestureLibrary.register('thumbs_up', GestureLibrary.thumbsUp);
GestureLibrary.register('point_right', GestureLibrary.pointRight);
GestureLibrary.register('point', GestureLibrary.pointRight);
GestureLibrary.register('open_right_hand', GestureLibrary.openRightHand);
GestureLibrary.register('close_right_hand', GestureLibrary.closeRightHand);
GestureLibrary.register('return_neutral', (ctrl) => ctrl.returnToNeutral(300));

// Phase 4 Gesture Registrations
GestureLibrary.register('gesture_how', GestureLibrary.gestureHow);
GestureLibrary.register('gesture_are', GestureLibrary.gestureAre);
GestureLibrary.register('gesture_you', GestureLibrary.gestureYou);
GestureLibrary.register('gesture_thank', GestureLibrary.gestureThank);
GestureLibrary.register('gesture_yes', GestureLibrary.gestureYes);
GestureLibrary.register('gesture_no', GestureLibrary.gestureNo);
GestureLibrary.register('gesture_please', GestureLibrary.gesturePlease);
GestureLibrary.register('gesture_goodbye', GestureLibrary.gestureGoodbye);
GestureLibrary.register('gesture_welcome', GestureLibrary.gestureWelcome);

