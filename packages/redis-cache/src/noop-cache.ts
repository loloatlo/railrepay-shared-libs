/**
 * No-Op Cache Client
 *
 * Fallback cache implementation when Redis is unavailable or disabled.
 * All operations are no-ops, allowing the application to run without caching.
 */

import { CacheClient } from './cache';

/**
 * No-op cache client for graceful degradation
 */
export class NoOpCache implements CacheClient {
  async connect(): Promise<void> {
    // No-op
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  async get<T>(_key: string): Promise<T | null> {
    return null; // Always cache miss
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {
    // No-op
  }

  async delete(_key: string): Promise<void> {
    // No-op
  }

  async exists(_key: string): Promise<boolean> {
    return false;
  }

  isConnected(): boolean {
    return false;
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}
