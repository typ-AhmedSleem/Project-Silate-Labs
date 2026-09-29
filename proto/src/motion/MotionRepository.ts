import { MotionDefinition } from './MotionDefinition.js';

/**
 * MotionRepository
 * Storage-agnostic abstraction for retrieving motion definitions by token.
 */
export interface MotionRepository {
  /**
   * Retrieves a motion definition for the given token (word).
   * @param token The normalized word token (e.g. "hello", "thank").
   * @returns Promise resolving to MotionDefinition or null if not found.
   */
  getMotion(token: string): Promise<MotionDefinition | null>;
}

/**
 * FileMotionRepository
 * Loads motion definition JSON files from the local assets directory with in-memory caching.
 */
export class FileMotionRepository implements MotionRepository {
  private cache: Map<string, MotionDefinition> = new Map();
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  constructor(logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void) {
    this.logger = logger;
  }

  /**
   * Fetches the motion definition JSON file for the given token.
   * Checks in-memory cache first, then attempts known asset paths.
   */
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

  /**
   * Clears the in-memory motion cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

/**
 * ApiMotionRepository
 * Demonstrates the storage-agnostic repository abstraction (Prompt §38).
 * Fetches motion definitions from a REST API endpoint: GET /api/motions/:word.
 */
export class ApiMotionRepository implements MotionRepository {
  private baseUrl: string;
  private cache: Map<string, MotionDefinition> = new Map();
  private logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;

  constructor(
    baseUrl: string = '/api/motions',
    logger?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.logger = logger;
  }

  public async getMotion(token: string): Promise<MotionDefinition | null> {
    const cleanToken = token.trim().toLowerCase();
    if (!cleanToken) return null;

    if (this.cache.has(cleanToken)) {
      return this.cache.get(cleanToken)!;
    }

    const endpoint = `${this.baseUrl}/${cleanToken}`;
    try {
      this.logger?.(`[ApiMotionRepository] Fetching: GET ${endpoint}`, 'info');
      const response = await fetch(endpoint);
      if (response.ok) {
        const data: MotionDefinition = await response.json();
        this.cache.set(cleanToken, data);
        this.logger?.(`[ApiMotionRepository] Retrieved "${cleanToken}" from API`, 'success');
        return data;
      }
    } catch (err: any) {
      this.logger?.(`[ApiMotionRepository] API request failed for "${cleanToken}": ${err.message}`, 'warn');
    }

    return null;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

