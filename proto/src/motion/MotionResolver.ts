import { MotionDefinition, MotionTimelineEntry } from './MotionDefinition.js';
import { SkeletonController } from '../avatar/SkeletonController.js';
import { AvatarController } from '../avatar/AvatarController.js';
import { GestureLibrary } from './GestureLibrary.js';

export type ResolvedStepAction = (controller: AvatarController) => Promise<void>;

export interface ResolvedStep {
  type: string;
  description: string;
  durationMs: number;
  atMs?: number;
  action: ResolvedStepAction;
}

export interface ResolvedMotion {
  id: string;
  durationMs: number;
  steps: ResolvedStep[];
}

export class MotionResolver {
  private skeleton: SkeletonController;
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  constructor(skeleton: SkeletonController, logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void) {
    this.skeleton = skeleton;
    this.logger = logger;
  }

  public resolve(definition: MotionDefinition): ResolvedMotion {
    const resolvedSteps: ResolvedStep[] = [];
    const entries = definition.timeline || [];

    // Sort entries by timeline time `atMs` if provided
    const sortedEntries = [...entries].sort((a, b) => (a.atMs || 0) - (b.atMs || 0));

    for (const entry of sortedEntries) {
      const step = this.resolveEntry(entry);
      if (step) {
        resolvedSteps.push(step);
      }
    }

    const calculatedDuration =
      definition.durationMs ||
      resolvedSteps.reduce((acc, s) => acc + (s.durationMs || 300), 0);

    this.logger?.(
      `[MotionResolver] Resolved motion "${definition.id}" (${resolvedSteps.length} steps, ~${calculatedDuration}ms)`,
      'info'
    );

    return {
      id: definition.id,
      durationMs: calculatedDuration,
      steps: resolvedSteps
    };
  }

  private resolveEntry(entry: MotionTimelineEntry): ResolvedStep | null {
    const duration = entry.durationMs || 300;

    switch (entry.type) {
      case 'gesture': {
        const gestureName = entry.name || 'return_neutral';
        return {
          type: 'gesture',
          description: `Gesture: ${gestureName}`,
          durationMs: duration,
          atMs: entry.atMs,
          action: async (ctrl: AvatarController) => {
            const executed = await GestureLibrary.execute(gestureName, ctrl);
            if (!executed) {
              this.logger?.(`[MotionResolver] Gesture "${gestureName}" was not found in GestureLibrary`, 'warn');
            }
          }
        };
      }

      case 'rotateBone': {
        const boneName = entry.bone || '';
        const bone = this.skeleton.requireBone(boneName);
        if (!bone) {
          this.logger?.(`[MotionResolver] Cannot resolve rotateBone: Bone "${boneName}" not found`, 'warn');
          return null;
        }

        const rotation = entry.rotation || { x: 0, y: 0, z: 0, isDegrees: true };
        return {
          type: 'rotateBone',
          description: `Rotate Bone: ${boneName}`,
          durationMs: duration,
          atMs: entry.atMs,
          action: async (ctrl: AvatarController) => {
            await ctrl.rotateBone(boneName, rotation, duration);
          }
        };
      }

      case 'pose': {
        const poseName = entry.name || 'neutral';
        return {
          type: 'pose',
          description: `Apply Pose: ${poseName}`,
          durationMs: duration,
          atMs: entry.atMs,
          action: async (ctrl: AvatarController) => {
            await ctrl.applyPose(poseName, duration);
          }
        };
      }

      case 'morph': {
        const target = entry.target || 'neutral';
        const value = entry.value ?? 1.0;
        return {
          type: 'morph',
          description: `Facial Morph (Deferred): ${target} → ${value}`,
          durationMs: duration,
          atMs: entry.atMs,
          action: async (ctrl: AvatarController) => {
            ctrl.facial.setMorph(target, value, duration);
          }
        };
      }

      case 'delay':
      case 'hold': {
        return {
          type: entry.type,
          description: `Hold/Delay (${duration}ms)`,
          durationMs: duration,
          atMs: entry.atMs,
          action: async (ctrl: AvatarController) => {
            await ctrl.wait(duration);
          }
        };
      }

      default:
        this.logger?.(`[MotionResolver] Unknown motion step type: "${(entry as any).type}"`, 'warn');
        return null;
    }
  }
}
