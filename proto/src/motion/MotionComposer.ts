import { ResolvedMotion, ResolvedStep } from './MotionResolver.js';
import { MotionSequence } from './MotionSequence.js';
import { AnimationBlender } from './AnimationBlender.js';
import { AvatarController } from '../avatar/AvatarController.js';

export interface ComposeOptions {
  transitionDurationMs?: number;
  sequenceId?: string;
}

export class MotionComposer {
  private defaultTransitionMs: number;
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  constructor(
    defaultTransitionMs: number = AnimationBlender.DEFAULT_TRANSITION_MS,
    logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void
  ) {
    this.defaultTransitionMs = defaultTransitionMs;
    this.logger = logger;
  }

  /**
   * Composes multiple ResolvedMotions into a single seamless MotionSequence with
   * fluid transition segments inserted between consecutive words.
   */
  public compose(motions: ResolvedMotion[], options?: ComposeOptions): MotionSequence {
    const transitionMs = options?.transitionDurationMs ?? this.defaultTransitionMs;
    const seqId = options?.sequenceId ?? `seq_${motions.map((m) => m.id).join('_')}`;
    const sequence = new MotionSequence(seqId);

    if (motions.length === 0) {
      return sequence;
    }

    // Process each motion
    for (let i = 0; i < motions.length; i++) {
      const currentMotion = motions[i];
      const isLastMotion = i === motions.length - 1;

      // Filter steps: if this is not the last motion in a multi-word sequence,
      // avoid a slow return_neutral at the end of the word, and replace with a fast fluid transition
      const stepsToInclude: ResolvedStep[] = [];

      for (let s = 0; s < currentMotion.steps.length; s++) {
        const step = currentMotion.steps[s];
        const isLastStepOfMotion = s === currentMotion.steps.length - 1;

        // If not last motion, and this step is return_neutral, skip it so the transition segment bridges it instead
        if (!isLastMotion && isLastStepOfMotion && (step.description.includes('return_neutral') || step.description.includes('Idle'))) {
          continue;
        }

        stepsToInclude.push(step);
      }

      // Add the motion steps
      const composedMotion: ResolvedMotion = {
        id: currentMotion.id,
        durationMs: currentMotion.durationMs,
        steps: stepsToInclude
      };

      sequence.addMotion(composedMotion);

      // If there is a subsequent motion, insert a smooth transition segment
      if (!isLastMotion) {
        const nextMotion = motions[i + 1];
        const transitionStep: ResolvedStep = {
          type: 'transition',
          description: `Blend [${currentMotion.id}] → [${nextMotion.id}] (${transitionMs}ms)`,
          durationMs: transitionMs,
          action: async (ctrl: AvatarController) => {
            // Fluid blend transition segment: quickly blend modified bones towards neutral
            // to prepare for the incoming motion without an abrupt jerk
            await ctrl.returnToNeutral(transitionMs);
          }
        };

        const transitionMotion: ResolvedMotion = {
          id: `trans_${currentMotion.id}_to_${nextMotion.id}`,
          durationMs: transitionMs,
          steps: [transitionStep]
        };

        sequence.addMotion(transitionMotion);
      }
    }

    this.logger?.(
      `[MotionComposer] Composed ${motions.length} words into sequence "${seqId}" (${sequence.getFlattenedSteps().length} total steps, ~${sequence.getTotalDuration()}ms)`,
      'success'
    );

    return sequence;
  }
}
