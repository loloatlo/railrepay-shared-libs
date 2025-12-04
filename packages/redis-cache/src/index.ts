/**
 * @railrepay/redis-cache
 *
 * Reusable Redis caching layer for RailRepay microservices
 */

export {
  RedisCache,
  RedisConfig,
  CacheClient,
  Logger,
} from './cache';

export { NoOpCache } from './noop-cache';

import { RedisCache, RedisConfig, CacheClient } from './cache';
import { NoOpCache } from './noop-cache';

/**
 * Factory function to create a cache client with graceful degradation
 *
 * Returns a RedisCache if REDIS_URL is available and REDIS_CACHE_ENABLED is true,
 * otherwise returns a NoOpCache.
 *
 * @param config - Redis configuration (serviceName is required)
 * @returns CacheClient instance (Redis or NoOp)
 */
export function createRedisCache(config: RedisConfig): CacheClient {
  const cacheEnabled = process.env.REDIS_CACHE_ENABLED === 'true';
  const redisUrl = config.redisUrl || process.env.REDIS_URL;

  if (!cacheEnabled) {
    console.log(`[${config.serviceName}] Redis caching disabled (REDIS_CACHE_ENABLED=false)`);
    return new NoOpCache();
  }

  if (!redisUrl) {
    console.warn(`[${config.serviceName}] REDIS_URL not set - caching disabled`);
    return new NoOpCache();
  }

  return new RedisCache({
    ...config,
    redisUrl,
  });
}
