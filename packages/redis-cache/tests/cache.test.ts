import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisCache, RedisConfig, NoOpCache, createRedisCache } from '../src';

// Mock redis module
vi.mock('redis', () => {
  const mockGet = vi.fn().mockResolvedValue(null);
  const mockSetEx = vi.fn().mockResolvedValue('OK');
  const mockDel = vi.fn().mockResolvedValue(1);
  const mockExists = vi.fn().mockResolvedValue(0);
  const mockPing = vi.fn().mockResolvedValue('PONG');
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockQuit = vi.fn().mockResolvedValue(undefined);
  const mockOn = vi.fn();

  const createClient = vi.fn(() => ({
    get: mockGet,
    setEx: mockSetEx,
    del: mockDel,
    exists: mockExists,
    ping: mockPing,
    connect: mockConnect,
    quit: mockQuit,
    on: mockOn,
  }));

  return {
    createClient,
    __mockGet: mockGet,
    __mockSetEx: mockSetEx,
    __mockDel: mockDel,
    __mockExists: mockExists,
    __mockPing: mockPing,
    __mockConnect: mockConnect,
    __mockQuit: mockQuit,
    __mockOn: mockOn,
  };
});

describe('@railrepay/redis-cache', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('RedisCache constructor', () => {
    it('should create cache with required config', () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      expect(cache).toBeDefined();
    });

    it('should throw error when serviceName is not provided', () => {
      expect(() =>
        new RedisCache({} as RedisConfig)
      ).toThrow('RedisConfig.serviceName is required');
    });

    it('should accept custom configuration', () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
        redisUrl: 'redis://custom:6379',
        defaultTTL: 7200,
        keyPrefix: 'myapp:',
      });
      expect(cache).toBeDefined();
    });

    it('should accept custom logger', () => {
      const customLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      const cache = new RedisCache({
        serviceName: 'test-service',
        logger: customLogger,
      });
      expect(cache).toBeDefined();
    });
  });

  describe('RedisCache.connect', () => {
    it('should connect successfully', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });

      await expect(cache.connect()).resolves.not.toThrow();
      expect(cache.isConnected()).toBe(true);
    });
  });

  describe('RedisCache.disconnect', () => {
    it('should disconnect successfully', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });

      await cache.connect();
      await expect(cache.disconnect()).resolves.not.toThrow();
    });
  });

  describe('RedisCache.get', () => {
    it('should return null when key not found', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      await cache.connect();

      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return deserialized value when key found', async () => {
      const redis = await import('redis');
      const mockGet = (redis as any).__mockGet;
      mockGet.mockResolvedValueOnce(JSON.stringify({ name: 'test' }));

      const cache = new RedisCache({
        serviceName: 'test-service',
        keyPrefix: 'test:',
      });
      await cache.connect();

      const result = await cache.get<{ name: string }>('user:123');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null when not connected', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      // Not connected

      const result = await cache.get('key');
      expect(result).toBeNull();
    });
  });

  describe('RedisCache.set', () => {
    it('should set value with default TTL', async () => {
      const redis = await import('redis');
      const mockSetEx = (redis as any).__mockSetEx;

      const cache = new RedisCache({
        serviceName: 'test-service',
        keyPrefix: 'test:',
        defaultTTL: 3600,
      });
      await cache.connect();

      await cache.set('user:123', { name: 'Alice' });

      expect(mockSetEx).toHaveBeenCalledWith(
        'test:user:123',
        3600,
        JSON.stringify({ name: 'Alice' })
      );
    });

    it('should set value with custom TTL', async () => {
      const redis = await import('redis');
      const mockSetEx = (redis as any).__mockSetEx;

      const cache = new RedisCache({
        serviceName: 'test-service',
        keyPrefix: 'test:',
      });
      await cache.connect();

      await cache.set('user:123', { name: 'Alice' }, 7200);

      expect(mockSetEx).toHaveBeenCalledWith(
        'test:user:123',
        7200,
        JSON.stringify({ name: 'Alice' })
      );
    });

    it('should not throw when not connected', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      // Not connected

      await expect(cache.set('key', 'value')).resolves.not.toThrow();
    });
  });

  describe('RedisCache.delete', () => {
    it('should delete key', async () => {
      const redis = await import('redis');
      const mockDel = (redis as any).__mockDel;

      const cache = new RedisCache({
        serviceName: 'test-service',
        keyPrefix: 'test:',
      });
      await cache.connect();

      await cache.delete('user:123');

      expect(mockDel).toHaveBeenCalledWith('test:user:123');
    });
  });

  describe('RedisCache.exists', () => {
    it('should return false when key does not exist', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      await cache.connect();

      const exists = await cache.exists('nonexistent');
      expect(exists).toBe(false);
    });

    it('should return true when key exists', async () => {
      const redis = await import('redis');
      const mockExists = (redis as any).__mockExists;
      mockExists.mockResolvedValueOnce(1);

      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      await cache.connect();

      const exists = await cache.exists('user:123');
      expect(exists).toBe(true);
    });
  });

  describe('RedisCache.healthCheck', () => {
    it('should return true when Redis is healthy', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      await cache.connect();

      const isHealthy = await cache.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when not connected', async () => {
      const cache = new RedisCache({
        serviceName: 'test-service',
      });
      // Not connected

      const isHealthy = await cache.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('NoOpCache', () => {
    it('should always return null for get', async () => {
      const cache = new NoOpCache();
      const result = await cache.get('any-key');
      expect(result).toBeNull();
    });

    it('should not throw on set', async () => {
      const cache = new NoOpCache();
      await expect(cache.set('key', 'value')).resolves.not.toThrow();
    });

    it('should not throw on delete', async () => {
      const cache = new NoOpCache();
      await expect(cache.delete('key')).resolves.not.toThrow();
    });

    it('should return false for exists', async () => {
      const cache = new NoOpCache();
      const exists = await cache.exists('key');
      expect(exists).toBe(false);
    });

    it('should return false for isConnected', () => {
      const cache = new NoOpCache();
      expect(cache.isConnected()).toBe(false);
    });

    it('should return false for healthCheck', async () => {
      const cache = new NoOpCache();
      const isHealthy = await cache.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('createRedisCache', () => {
    it('should return NoOpCache when REDIS_CACHE_ENABLED is not true', () => {
      process.env.REDIS_CACHE_ENABLED = 'false';
      const cache = createRedisCache({ serviceName: 'test-service' });
      expect(cache).toBeInstanceOf(NoOpCache);
    });

    it('should return NoOpCache when REDIS_URL is not set', () => {
      process.env.REDIS_CACHE_ENABLED = 'true';
      delete process.env.REDIS_URL;
      const cache = createRedisCache({ serviceName: 'test-service' });
      expect(cache).toBeInstanceOf(NoOpCache);
    });

    it('should return RedisCache when properly configured', () => {
      process.env.REDIS_CACHE_ENABLED = 'true';
      process.env.REDIS_URL = 'redis://localhost:6379';
      const cache = createRedisCache({ serviceName: 'test-service' });
      expect(cache).toBeInstanceOf(RedisCache);
    });
  });
});
