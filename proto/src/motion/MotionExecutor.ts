import { MotionSequence, FlattenedSequenceStep } from './MotionSequence.js';
import { AvatarController } from '../avatar/AvatarController.js';
import { appState } from '../state/AppState.js';

export interface MotionExecutorCallbacks {
  onStepStart?: (stepInfo: FlattenedSequenceStep, totalSteps: number, currentStepNumber: number) => void;
  onStepEnd?: (stepInfo: FlattenedSequenceStep) => void;
  onComplete?: () => void;
  onLog?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export class MotionExecutor {
  private controller: AvatarController;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentExecutionId: number = 0;
  private callbacks: MotionExecutorCallbacks = {};

  constructor(controller: AvatarController, callbacks?: MotionExecutorCallbacks) {
    this.controller = controller;
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: MotionExecutorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async execute(sequence: MotionSequence): Promise<boolean> {
    if (sequence.isEmpty()) {
      this.callbacks.onLog?.('[MotionExecutor] Sequence is empty, nothing to execute.', 'warn');
      return false;
    }

    // Interrupt any previous running sequence
    this.stop();

    this.isRunning = true;
    this.isPaused = false;
    const executionId = ++this.currentExecutionId;

    appState.setState('PLAYING');
    const steps = sequence.getFlattenedSteps();
    const totalSteps = steps.length;

    this.callbacks.onLog?.(
      `[MotionExecutor] Executing sequence "${sequence.id}" (${totalSteps} steps)`,
      'info'
    );

    try {
      for (let i = 0; i < steps.length; i++) {
        // Check for interruption or cancellation
        if (!this.isRunning || this.currentExecutionId !== executionId) {
          this.callbacks.onLog?.('[MotionExecutor] Execution cancelled or superseded.', 'warn');
          return false;
        }

        // Handle pause state
        while (this.isPaused && this.isRunning && this.currentExecutionId === executionId) {
          await this.controller.wait(100);
        }

        const stepInfo = steps[i];
        this.callbacks.onStepStart?.(stepInfo, totalSteps, i + 1);
        this.callbacks.onLog?.(
          `[MotionExecutor] Step ${i + 1}/${totalSteps} (${stepInfo.motionId}): ${stepInfo.step.description}`,
          'info'
        );

        // Execute step action
        await stepInfo.step.action(this.controller);

        this.callbacks.onStepEnd?.(stepInfo);
      }

      // Check if still current execution
      if (this.currentExecutionId === executionId) {
        // Smoothly blend back to idle
        await this.controller.returnToNeutral(300);
        this.callbacks.onLog?.(`[MotionExecutor] Finished sequence "${sequence.id}" → IDLE`, 'success');
        this.callbacks.onComplete?.();
        appState.setState('IDLE');
        this.isRunning = false;
        return true;
      }

      return false;
    } catch (err: any) {
      this.callbacks.onLog?.(`[MotionExecutor] Error during execution: ${err.message}`, 'error');
      appState.setState('ERROR');
      this.isRunning = false;
      return false;
    }
  }

  public stop(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = false;
      this.currentExecutionId++;
      this.controller.returnToNeutral(200);
      appState.setState('IDLE');
    }
  }

  public pause(): void {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      appState.setState('PAUSED');
      this.callbacks.onLog?.('[MotionExecutor] Motion paused.', 'info');
    }
  }

  public resume(): void {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      appState.setState('PLAYING');
      this.callbacks.onLog?.('[MotionExecutor] Motion resumed.', 'info');
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }
}
