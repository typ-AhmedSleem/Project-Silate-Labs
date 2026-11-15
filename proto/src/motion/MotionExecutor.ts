import { MotionSequence, FlattenedSequenceStep } from './MotionSequence.js';
import { AvatarController } from '../avatar/AvatarController.js';
import { appState } from '../state/AppState.js';

export interface MotionProgressInfo {
  elapsedMs: number;
  totalDurationMs: number;
  currentStep: number;
  totalSteps: number;
  motionId: string;
  stepDescription: string;
}

export interface MotionExecutorCallbacks {
  onMotionStart?: (motionId: string) => void;
  onStepStart?: (stepInfo: FlattenedSequenceStep, totalSteps: number, currentStepNumber: number) => void;
  onStepEnd?: (stepInfo: FlattenedSequenceStep) => void;
  onProgress?: (progress: MotionProgressInfo) => void;
  onStateChange?: (state: 'playing' | 'paused' | 'stopped' | 'completed') => void;
  onComplete?: () => void;
  onLog?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

/**
 * MotionExecutor
 * Frame-driven execution engine for sequential and blended MotionSequence execution.
 * Handles lifecycle events, pause/resume, cancellation, step advancement, and progress reporting.
 */
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

  /**
   * Sets or updates executor event callbacks.
   */
  public setCallbacks(callbacks: MotionExecutorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Executes a MotionSequence step by step with immediate interruption handling.
   * @param sequence The composed MotionSequence to execute.
   * @returns Promise resolving to true if completed successfully, or false if cancelled/interrupted.
   */
  public async execute(sequence: MotionSequence): Promise<boolean> {
    if (sequence.isEmpty()) {
      this.callbacks.onLog?.('[MotionExecutor] Sequence is empty, nothing to execute.', 'warn');
      return false;
    }

    // 4.5: Immediate interruption handling: stop current, blend to neutral fast, no queueing
    if (this.isRunning) {
      this.callbacks.onLog?.('[MotionExecutor] ⚡ Interrupted active playback for new sequence.', 'warn');
      this.isRunning = false;
      this.currentExecutionId++;
      await this.controller.returnToNeutral(150);
    }

    this.isRunning = true;
    this.isPaused = false;
    const executionId = ++this.currentExecutionId;

    this.controller.avatar.stopIdle();
    appState.setState('PLAYING');
    this.callbacks.onStateChange?.('playing');

    const steps = sequence.getFlattenedSteps();
    const totalSteps = steps.length;
    const totalDurationMs = sequence.getTotalDuration();
    let currentMotionId: string | null = null;
    let accumulatedElapsedMs = 0;

    this.callbacks.onLog?.(
      `[MotionExecutor] Executing sequence "${sequence.id}" (${totalSteps} steps, ${totalDurationMs}ms)`,
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

        // Notify motion start if word changed
        if (stepInfo.motionId !== currentMotionId) {
          currentMotionId = stepInfo.motionId;
          this.callbacks.onMotionStart?.(currentMotionId);
        }

        this.callbacks.onStepStart?.(stepInfo, totalSteps, i + 1);
        this.callbacks.onProgress?.({
          elapsedMs: accumulatedElapsedMs,
          totalDurationMs,
          currentStep: i + 1,
          totalSteps,
          motionId: stepInfo.motionId,
          stepDescription: stepInfo.step.description
        });

        this.callbacks.onLog?.(
          `[MotionExecutor] Step ${i + 1}/${totalSteps} (${stepInfo.motionId}): ${stepInfo.step.description}`,
          'info'
        );

        // Execute step action
        await stepInfo.step.action(this.controller);

        accumulatedElapsedMs += stepInfo.step.durationMs;

        this.callbacks.onStepEnd?.(stepInfo);
        this.callbacks.onProgress?.({
          elapsedMs: Math.min(accumulatedElapsedMs, totalDurationMs),
          totalDurationMs,
          currentStep: i + 1,
          totalSteps,
          motionId: stepInfo.motionId,
          stepDescription: stepInfo.step.description
        });
      }

      // Check if still current execution
      if (this.currentExecutionId === executionId) {
        // Smoothly blend back to idle
        await this.controller.returnToNeutral(300);
        this.controller.avatar.resumeIdle();
        this.callbacks.onLog?.(`[MotionExecutor] Finished sequence "${sequence.id}" → IDLE`, 'success');
        this.callbacks.onProgress?.({
          elapsedMs: totalDurationMs,
          totalDurationMs,
          currentStep: totalSteps,
          totalSteps,
          motionId: currentMotionId || '',
          stepDescription: 'Completed'
        });
        this.callbacks.onStateChange?.('completed');
        this.callbacks.onComplete?.();
        appState.setState('IDLE');
        this.isRunning = false;
        return true;
      }

      this.controller.avatar.resumeIdle();
      return false;
    } catch (err: any) {
      this.callbacks.onLog?.(`[MotionExecutor] Error during execution: ${err.message}`, 'error');
      this.controller.avatar.resumeIdle();
      appState.setState('ERROR');
      this.callbacks.onStateChange?.('stopped');
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Immediately halts execution and blends avatar smoothly back to neutral.
   */
  public stop(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = false;
      this.currentExecutionId++;
      this.controller.returnToNeutral(180);
      this.controller.avatar.resumeIdle();
      appState.setState('IDLE');
      this.callbacks.onStateChange?.('stopped');
      this.callbacks.onLog?.('[MotionExecutor] Motion stopped by user.', 'info');
    }
  }

  /**
   * Pauses active sequence execution.
   */
  public pause(): void {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      appState.setState('PAUSED');
      this.callbacks.onStateChange?.('paused');
      this.callbacks.onLog?.('[MotionExecutor] Motion paused.', 'info');
    }
  }

  /**
   * Resumes paused sequence execution.
   */
  public resume(): void {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      appState.setState('PLAYING');
      this.callbacks.onStateChange?.('playing');
      this.callbacks.onLog?.('[MotionExecutor] Motion resumed.', 'info');
    }
  }

  /**
   * Returns whether a sequence is currently active.
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Returns whether the sequence is currently paused.
   */
  public getIsPaused(): boolean {
    return this.isPaused;
  }
}

