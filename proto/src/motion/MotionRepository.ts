import { MotionDefinition } from './MotionDefinition.js';

export interface MotionRepository {
  getMotion(token: string): Promise<MotionDefinition | null>;
}

export class FileMotionRepository implements MotionRepository {
  private cache: Map<string, MotionDefinition> = new Map();
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  constructor(logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void) {
    this.logger = logger;
  }

  public async getMotion(token: string): Promise<MotionDefinition | null> {
    const cleanToken = token.trim().toLowerCase();
    if (!cleanToken) return null;

    // 1. Check in-memory cache
    if (this.cache.has(cleanToken)) {
      return this.cache.get(cleanToken)!;
    }

    // 2. Candidate paths in Vite
    const candidates = [
      `/motion/${cleanToken}.json`,
      `/assets/motion/${cleanToken}.json`,
      `assets/motion/${cleanToken}.json`
    ];

    for (const url of candidates) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data: MotionDefinition = await response.json();
          this.cache.set(cleanToken, data);
          this.logger?.(`[MotionRepository] Loaded motion definition for "${cleanToken}"`, 'success');
          return data;
        }
      } catch {
        // Try next candidate path
      }
    }

    this.logger?.(`[MotionRepository] No motion file found for token: "${cleanToken}"`, 'warn');
    return null;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
