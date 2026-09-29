/**
 * FacialController
 * Note: Facial morph targets are deferred for Phase 1-5.
 * This class provides a structured stub that logs actions instead of executing them.
 */
export class FacialController {
  private logger?: (msg: string) => void;

  constructor(logger?: (msg: string) => void) {
    this.logger = logger;
  }

  public setLogger(logger: (msg: string) => void): void {
    this.logger = logger;
  }

  public setMorph(logicalName: string, value: number, durationMs: number = 0): void {
    const message = `[FacialController] setMorph: "${logicalName}" → ${value.toFixed(2)} (duration: ${durationMs}ms) [Deferred stub]`;
    console.log(message);
    if (this.logger) {
      this.logger(message);
    }
  }
}
