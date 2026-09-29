import { ResolvedMotion, ResolvedStep } from './MotionResolver.js';

export interface FlattenedSequenceStep {
  motionId: string;
  stepIndex: number;
  step: ResolvedStep;
}

export class MotionSequence {
  public readonly id: string;
  private motions: ResolvedMotion[] = [];

  constructor(id: string = `seq_${Date.now()}`) {
    this.id = id;
  }

  public addMotion(motion: ResolvedMotion): void {
    this.motions.push(motion);
  }

  public getMotions(): ResolvedMotion[] {
    return [...this.motions];
  }

  public isEmpty(): boolean {
    return this.motions.length === 0;
  }

  public getTotalDuration(): number {
    return this.motions.reduce((acc, m) => acc + m.durationMs, 0);
  }

  public getFlattenedSteps(): FlattenedSequenceStep[] {
    const list: FlattenedSequenceStep[] = [];
    for (const motion of this.motions) {
      motion.steps.forEach((step, idx) => {
        list.push({
          motionId: motion.id,
          stepIndex: idx,
          step
        });
      });
    }
    return list;
  }
}
