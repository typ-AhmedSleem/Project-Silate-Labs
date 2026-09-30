import { HolisticLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FingerData {
  thumb: Vec3[];
  index: Vec3[];
  middle: Vec3[];
  ring: Vec3[];
  pinky: Vec3[];
}

export interface HandData {
  wrist: Vec3;
  fingers: FingerData;
}

export interface ArmData {
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
}

export interface HeadData {
  rx: number;
  ry: number;
  rz: number;
}

export interface CapturedFrame {
  ts: number;
  mouth?: {
    open: number;
  };
  head?: HeadData;
  leftArm?: ArmData;
  rightArm?: ArmData;
  left_hand?: HandData;
  right_hand?: HandData;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function toVec3(lm?: NormalizedLandmark): Vec3 {
  if (!lm) return { x: 0, y: 0, z: 0 };
  return {
    x: round3(lm.x),
    y: round3(lm.y),
    z: round3(lm.z ?? 0)
  };
}

export class LandmarkExtractor {
  /**
   * Extracts only the necessary landmarks from HolisticLandmarkerResult into CapturedFrame.
   */
  public static extract(result: HolisticLandmarkerResult, timestampMs: number): CapturedFrame {
    const frame: CapturedFrame = {
      ts: Math.round(timestampMs)
    };

    // 1. Pose: Left & Right Arms
    if (result.poseLandmarks && result.poseLandmarks.length > 0) {
      const pose = result.poseLandmarks[0];
      // Left arm: 11 (shoulder), 13 (elbow), 15 (wrist)
      if (pose[11] && pose[13] && pose[15]) {
        frame.leftArm = {
          shoulder: toVec3(pose[11]),
          elbow: toVec3(pose[13]),
          wrist: toVec3(pose[15])
        };
      }
      // Right arm: 12 (shoulder), 14 (elbow), 16 (wrist)
      if (pose[12] && pose[14] && pose[16]) {
        frame.rightArm = {
          shoulder: toVec3(pose[12]),
          elbow: toVec3(pose[14]),
          wrist: toVec3(pose[16])
        };
      }
    }

    // 2. Face: Mouth & Head orientation
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const face = result.faceLandmarks[0];
      // Lips: 13 (inner upper lip), 14 (inner lower lip)
      if (face[13] && face[14]) {
        const lipDist = Math.abs(face[14].y - face[13].y);
        // Normalized openness ratio (~0.0 to 1.0)
        frame.mouth = {
          open: round3(Math.min(1.0, lipDist * 15))
        };
      }

      // Head orientation estimated from key face landmarks
      // 10: forehead, 152: chin, 234: left ear/temple, 454: right ear/temple
      if (face[10] && face[152] && face[234] && face[454]) {
        const dx = face[454].x - face[234].x;
        const dz = (face[454].z ?? 0) - (face[234].z ?? 0);

        // Yaw from left/right z delta and x
        const yaw = Math.atan2(dz, Math.max(0.001, dx));
        // Pitch from vertical tilt
        const pitch = (face[1].y - (face[10].y + face[152].y) / 2) * 2;
        // Roll from temple slope
        const roll = Math.atan2(face[454].y - face[234].y, dx);

        frame.head = {
          rx: round3(pitch),
          ry: round3(yaw),
          rz: round3(roll)
        };
      }
    }

    // 3. Left Hand
    if (result.leftHandLandmarks && result.leftHandLandmarks.length > 0) {
      frame.left_hand = this.extractHand(result.leftHandLandmarks[0]);
    }

    // 4. Right Hand
    if (result.rightHandLandmarks && result.rightHandLandmarks.length > 0) {
      frame.right_hand = this.extractHand(result.rightHandLandmarks[0]);
    }

    return frame;
  }

  private static extractHand(hand: NormalizedLandmark[]): HandData {
    return {
      wrist: toVec3(hand[0]),
      fingers: {
        thumb: [toVec3(hand[1]), toVec3(hand[2]), toVec3(hand[3]), toVec3(hand[4])],
        index: [toVec3(hand[5]), toVec3(hand[6]), toVec3(hand[7]), toVec3(hand[8])],
        middle: [toVec3(hand[9]), toVec3(hand[10]), toVec3(hand[11]), toVec3(hand[12])],
        ring: [toVec3(hand[13]), toVec3(hand[14]), toVec3(hand[15]), toVec3(hand[16])],
        pinky: [toVec3(hand[17]), toVec3(hand[18]), toVec3(hand[19]), toVec3(hand[20])]
      }
    };
  }
}
