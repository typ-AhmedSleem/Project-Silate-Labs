export type StateType = 'LOADING' | 'IDLE' | 'PLAYING' | 'PAUSED' | 'ERROR';

export type StateListener = (newState: StateType, prevState: StateType) => void;

export class AppStateManager {
  private currentState: StateType = 'LOADING';
  private listeners: Set<StateListener> = new Set();

  public getState(): StateType {
    return this.currentState;
  }

  public setState(newState: StateType): void {
    if (this.currentState === newState) return;
    const prevState = this.currentState;
    this.currentState = newState;
    this.notify(newState, prevState);
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify listener of current state
    listener(this.currentState, this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(newState: StateType, prevState: StateType): void {
    for (const listener of this.listeners) {
      try {
        listener(newState, prevState);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    }
  }
}

export const appState = new AppStateManager();
