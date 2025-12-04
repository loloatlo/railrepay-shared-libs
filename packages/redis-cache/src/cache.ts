/**
 * Redis Cache Client
 *
 * Reusable Redis caching layer for RailRepay microservices
 *
 * Features:
 * - Generic key-value caching with JSON serialization
 * - Configurable TTL (Time To Live)
 * - Key prefixing for namespace isolation
 * - Graceful degradation when Redis is unavailable
 * - Health check support
 *
 * Usage:
 * ```typescript
 * import { RedisCache } from '@railrepay/redis-cache';
 *
 * const cache = new RedisCache({
 *   serviceName: 'my-service',
 *   keyPrefix: 'myapp:',
 * });
 *
 * await cache.connect();
 * await cache.set('user:123', { name: 'Alice' }, 3600);
 * const user = await cache.get<User>('user:123');
 * await cache.disconnect();
 * ```
 */

import { createClient, RedisClientType } from 'redis';

/**
 * Logger interface for optional dependency injection
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Console-based fallback logger
 */
const consoleLogger: Logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta || ''),
};

/**
 * Redis cache configuration
 */
export interface RedisConfig {
  /** REQUIRED - Service name for logging */
  serviceName: string;
  /** Redis connection URL (default: process.env.REDIS_URL) */
  redisUrl?: string;
  /** Default TTL in seconds (default: 3600) */
  defaultTTL?: number;
  /** Key prefix for namespace isolation (default: 'rr:') */
  keyPrefix?: string;
  /** Optional logger instance */
  logger?: Logger;
}

/**
 * Cache interface for implementations
 */
export interface CacheClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;
}

/**
 * Redis-backed cache client
 */
export class RedisCache implements CacheClient {
  private client: RedisClientType | null = null;
  private connected: boolean = false;
  private readonly config: Required<RedisConfig>;
  private readonly logger: Logger;

  constructor(config: RedisConfig) {
    if (!config.serviceName) {
      throw new Error('RedisConfig.serviceName is required');
    }

    this.config = {
      serviceName: config.serviceName,
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTTL: config.defaultTTL ?? 3600,
      keyPrefix: config.keyPrefix ?? 'rr:',
      logger: config.logger || consoleLogger,
    };

    this.logger = this.config.logger;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({ url: this.config.redisUrl });

      this.client.on('error', (err: Error) => {
        this.logger.error('Redis client error', {
          component: `${this.config.serviceName}/RedisCache`,
          error: err.message,
        });
        this.connected = false;
      });

      this.client.on('connect', () => {
        this.logger.debug('Redis client connected', {
          component: `${this.config.serviceName}/RedisCache`,
        });
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Redis client disconnected', {
          component: `${this.config.serviceName}/RedisCache`,
        });
        this.connected = false;
      });

      await this.client.connect();
      this.connected = true;

      this.logger.info('Redis cache connected', {
        component: `${this.config.serviceName}/RedisCache`,
        keyPrefix: this.config.keyPrefix,
        defaultTTL: this.config.defaultTTL,
      });
    } catch (error) {
      this.logger.error('Failed to connect to Redis', {
        component: `${this.config.serviceName}/RedisCache`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.client = null;
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.connected = false;
        this.logger.info('Redis cache disconnected', {
          component: `${this.config.serviceName}/RedisCache`,
        });
      } catch (error) {
        this.logger.error('Error disconnecting from Redis', {
          component: `${this.config.serviceName}/RedisCache`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get prefixed cache key
   */
  private getKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   *
   * @param key - Cache key (will be prefixed)
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.connected) {
      return null;
    }

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error('Redis GET error', {
        component: `${this.config.serviceName}/RedisCache`,
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return null;
    }
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key (will be prefixed)
   * @param value - Value to cache (will be JSON serialized)
   * @param ttl - TTL in seconds (default: config.defaultTTL)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    try {
      const fullKey = this.getKey(key);
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl ?? this.config.defaultTTL;

      await this.client.setEx(fullKey, effectiveTTL, serialized);

      this.logger.debug('Cached value', {
        component: `${this.config.serviceName}/RedisCache`,
        key,
        ttl: effectiveTTL,
      });
    } catch (error) {
      this.logger.error('Redis SET error', {
        component: `${this.config.serviceName}/RedisCache`,
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Delete value from cache
   *
   * @param key - Cache key (will be prefixed)
   */
  async delete(key: string): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    try {
      const fullKey = this.getKey(key);
      await this.client.del(fullKey);

      this.logger.debug('Deleted cache key', {
        component: `${this.config.serviceName}/RedisCache`,
        key,
      });
    } catch (error) {
      this.logger.error('Redis DEL error', {
        component: `${this.config.serviceName}/RedisCache`,
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
    }
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Cache key (will be prefixed)
   * @returns true if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const fullKey = this.getKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXISTS error', {
        component: `${this.config.serviceName}/RedisCache`,
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return false;
    }
  }

  /**
   * Check if connected to Redis
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Health check - verify Redis connectivity
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed', {
        component: `${this.config.serviceName}/RedisCache`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}
