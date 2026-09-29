import { MotionDefinition, MotionTimelineEntry, MotionStep } from './MotionDefinition.js';
import { SkeletonController } from '../avatar/SkeletonController.js';
import { AvatarController, BodyChannelName } from '../avatar/AvatarController.js';
import { GestureLibrary } from './GestureLibrary.js';

export type ResolvedStepAction = (controller: AvatarController) => Promise<void>;

export interface ResolvedStep {
  type: string;
  description: string;
  durationMs: number;
  atMs?: number;
  channel?: BodyChannelName;
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

  constructor(
    skeleton: SkeletonController,
    logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void
  ) {
    this.skeleton = skeleton;
    this.logger = logger;
  }

  public resolve(definition: MotionDefinition): ResolvedMotion {
    const resolvedSteps: ResolvedStep[] = [];

    // 1. Resolve timeline entries if present
    if (definition.timeline && definition.timeline.length > 0) {
      const sortedEntries = [...definition.timeline].sort((a, b) => (a.atMs || 0) - (b.atMs || 0));
      for (const entry of sortedEntries) {
        const step = this.resolveEntry(entry);
        if (step) {
          resolvedSteps.push(step);
        }
      }
    }

    // 2. Resolve channels structure if present (Task 5.3 & 5.4: Parallel channel execution)
    if (definition.channels && Object.keys(definition.channels).length > 0) {
      const channelNames = Object.keys(definition.channels) as BodyChannelName[];
      const channelStepsMap: Record<string, ResolvedStep[]> = {};
      let maxChannelDuration = 0;

      for (const ch of channelNames) {
        const chSteps: ResolvedStep[] = [];
        let chDuration = 0;
        const stepsForChannel = definition.channels[ch] || [];

        for (const stepDef of stepsForChannel) {
          const resolved = this.resolveEntry(stepDef as MotionTimelineEntry, ch);
          if (resolved) {
            chSteps.push(resolved);
            chDuration += resolved.durationMs;
          }
        }

        channelStepsMap[ch] = chSteps;
        maxChannelDuration = Math.max(maxChannelDuration, chDuration);
      }

      // Add a single parallel execution step representing all channels running concurrently
      resolvedSteps.push({
        type: 'parallel',
        description: `Parallel channels: [${channelNames.join(', ')}]`,
        durationMs: maxChannelDuration,
        action: async (ctrl: AvatarController) => {
          const channelPromises = Object.entries(channelStepsMap).map(async ([ch, steps]) => {
            const chName = ch as BodyChannelName;
            ctrl.setChannelState(chName, 'Active');
            for (const step of steps) {
              await step.action(ctrl);
            }
            ctrl.setChannelState(chName, 'Ready');
          });

          await Promise.all(channelPromises);
        }
      });
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

  private resolveEntry(entry: MotionTimelineEntry | MotionStep, channelHint?: BodyChannelName): ResolvedStep | null {
    const duration = entry.durationMs || 300;

    switch (entry.type) {
      case 'gesture': {
        const gestureName = (entry as any).name || 'return_neutral';
        return {
          type: 'gesture',
          channel: channelHint,
          description: `Gesture: ${gestureName}`,
          durationMs: duration,
          atMs: (entry as any).atMs,
          action: async (ctrl: AvatarController) => {
            if (channelHint) ctrl.setChannelState(channelHint, gestureName);
            const executed = await GestureLibrary.execute(gestureName, ctrl);
            if (!executed) {
              this.logger?.(`[MotionResolver] Gesture "${gestureName}" was not found in GestureLibrary`, 'warn');
            }
          }
        };
      }

      case 'rotateBone': {
        const boneName = (entry as any).bone || '';
        const bone = this.skeleton.requireBone(boneName);
        if (!bone) {
          this.logger?.(`[MotionResolver] Cannot resolve rotateBone: Bone "${boneName}" not found`, 'warn');
          return null;
        }

        const channel = channelHint || ctrlChannelForBone(boneName);
        const rotation = (entry as any).rotation || (entry as any).to || { x: 0, y: 0, z: 0, isDegrees: true };

        return {
          type: 'rotateBone',
          channel,
          description: `Rotate: ${boneName}`,
          durationMs: duration,
          atMs: (entry as any).atMs,
          action: async (ctrl: AvatarController) => {
            await ctrl.rotateBone(boneName, rotation, duration);
          }
        };
      }

      case 'pose': {
        const poseName = (entry as any).name || 'neutral';
        const side = channelHint === 'leftHand' || channelHint === 'leftArm' ? 'left' : 'right';

        return {
          type: 'pose',
          channel: channelHint || 'fingers',
          description: `Pose: ${poseName}`,
          durationMs: duration,
          atMs: (entry as any).atMs,
          action: async (ctrl: AvatarController) => {
            if (['open', 'closed', 'point', 'thumb_up', 'peace'].includes(poseName.toLowerCase())) {
              await ctrl.applyHandPose(side, poseName.toLowerCase() as any, duration);
            } else {
              await ctrl.applyPose(poseName, duration);
            }
          }
        };
      }

      case 'morph': {
        const target = (entry as any).target || 'neutral';
        const value = (entry as any).value ?? 1.0;
        const channel: BodyChannelName = channelHint || (target.toLowerCase().includes('lip') || target.toLowerCase().includes('viseme') ? 'lips' : 'face');

        return {
          type: 'morph',
          channel,
          description: `Face Morph [Deferred]: ${target} → ${value}`,
          durationMs: duration,
          atMs: (entry as any).atMs,
          action: async (ctrl: AvatarController) => {
            ctrl.setChannelState(channel, `${target} (${value})`);
            ctrl.facial.setMorph(target, value, duration);
          }
        };
      }

      case 'delay':
      case 'hold': {
        return {
          type: entry.type,
          channel: channelHint,
          description: `Hold (${duration}ms)`,
          durationMs: duration,
          atMs: (entry as any).atMs,
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

function ctrlChannelForBone(boneName: string): BodyChannelName {
  const lower = boneName.toLowerCase();
  if (lower.includes('thumb') || lower.includes('index') || lower.includes('middle') || lower.includes('ring') || lower.includes('pinky')) {
    return 'fingers';
  }
  if (lower.includes('head') || lower.includes('neck')) {
    return 'head';
  }
  if (lower.includes('lefthand')) return 'leftHand';
  if (lower.includes('righthand')) return 'rightHand';
  if (lower.includes('leftarm') || lower.includes('leftforearm') || lower.includes('leftshoulder')) return 'leftArm';
  if (lower.includes('rightarm') || lower.includes('rightforearm') || lower.includes('rightshoulder')) return 'rightArm';
  return 'body';
}
