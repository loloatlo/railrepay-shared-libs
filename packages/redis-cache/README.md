# @railrepay/redis-cache

Reusable Redis caching layer for RailRepay microservices with graceful degradation.

## Features

- Generic key-value caching with JSON serialization
- Configurable TTL (Time To Live)
- Key prefixing for namespace isolation
- Graceful degradation when Redis is unavailable (NoOpCache)
- Health check support for container orchestration
- Optional logger injection

## Installation

```bash
npm install @railrepay/redis-cache
```

## Usage

### Basic Usage

```typescript
import { RedisCache } from '@railrepay/redis-cache';

const cache = new RedisCache({
  serviceName: 'my-service',  // REQUIRED
});

await cache.connect();

// Set a value (with default TTL)
await cache.set('user:123', { name: 'Alice', email: 'alice@example.com' });

// Get a value
const user = await cache.get<User>('user:123');

// Check if key exists
const exists = await cache.exists('user:123');

// Delete a key
await cache.delete('user:123');

// Health check
const isHealthy = await cache.healthCheck();

// Graceful shutdown
await cache.disconnect();
```

### With Factory Function (Graceful Degradation)

```typescript
import { createRedisCache } from '@railrepay/redis-cache';

// Returns RedisCache or NoOpCache based on environment
const cache = createRedisCache({
  serviceName: 'my-service',
});

// Works the same regardless of implementation
await cache.connect();
await cache.set('key', 'value');
const value = await cache.get('key');
```

### With Full Configuration

```typescript
import { RedisCache } from '@railrepay/redis-cache';
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({ serviceName: 'my-service' });

const cache = new RedisCache({
  serviceName: 'timetable-loader',   // REQUIRED
  redisUrl: 'redis://cache:6379',    // default: process.env.REDIS_URL
  defaultTTL: 3600,                  // default: 3600 (1 hour)
  keyPrefix: 'timetable:',           // default: 'rr:'
  logger: logger,                    // optional winston logger
});
```

### Custom TTL per Operation

```typescript
// Cache with 1 hour TTL (default)
await cache.set('user:123', userData);

// Cache with 24 hour TTL
await cache.set('config:app', config, 86400);

// Cache with 5 minute TTL
await cache.set('session:abc', session, 300);
```

## Configuration

### RedisConfig Interface

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `serviceName` | `string` | Yes | - | Service name for logging |
| `redisUrl` | `string` | No | `process.env.REDIS_URL` | Redis connection URL |
| `defaultTTL` | `number` | No | `3600` | Default TTL in seconds |
| `keyPrefix` | `string` | No | `'rr:'` | Key prefix for namespace isolation |
| `logger` | `Logger` | No | `console` | Logger instance |

### Environment Variables

- `REDIS_URL` - Redis connection URL (e.g., `redis://localhost:6379`)
- `REDIS_CACHE_ENABLED` - Set to `'true'` to enable caching (for factory function)

## Graceful Degradation

The `createRedisCache()` factory function provides automatic fallback:

1. If `REDIS_CACHE_ENABLED !== 'true'` → Returns `NoOpCache`
2. If `REDIS_URL` is not set → Returns `NoOpCache`
3. Otherwise → Returns `RedisCache`

The `NoOpCache` implements the same interface but:
- `get()` always returns `null` (cache miss)
- `set()`, `delete()` are no-ops
- `isConnected()`, `healthCheck()` return `false`

This allows your application to run without Redis while maintaining the same code paths.

## Key Prefixing

All keys are automatically prefixed with `keyPrefix` (default: `'rr:'`):

```typescript
const cache = new RedisCache({
  serviceName: 'my-service',
  keyPrefix: 'myapp:',
});

// This stores as 'myapp:user:123' in Redis
await cache.set('user:123', userData);
```

## License

Private - RailRepay
