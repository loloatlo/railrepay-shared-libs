import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresClient, PostgresConfig } from '../src';

// Mock pg module
vi.mock('pg', () => {
  const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockConnect = vi.fn().mockResolvedValue({
    release: vi.fn(),
  });
  const mockOn = vi.fn();

  const MockPool = vi.fn(() => ({
    query: mockQuery,
    end: mockEnd,
    connect: mockConnect,
    on: mockOn,
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  }));

  return {
    Pool: MockPool,
    __mockQuery: mockQuery,
    __mockEnd: mockEnd,
    __mockConnect: mockConnect,
    __mockOn: mockOn,
  };
});

describe('@railrepay/postgres-client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('PostgresClient constructor', () => {
    it('should create client with required config', () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });
      expect(client).toBeDefined();
    });

    it('should throw error when serviceName is not provided', () => {
      expect(() =>
        new PostgresClient({
          schemaName: 'test_schema',
        } as PostgresConfig)
      ).toThrow('PostgresConfig.serviceName is required');
    });

    it('should throw error when schemaName is not provided', () => {
      expect(() =>
        new PostgresClient({
          serviceName: 'test-service',
        } as PostgresConfig)
      ).toThrow('PostgresConfig.schemaName is required');
    });

    it('should accept custom pool configuration', () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
        host: 'custom-host',
        port: 5433,
        database: 'custom_db',
        user: 'custom_user',
        password: 'custom_pass',
        poolSize: 10,
        idleTimeout: 60000,
        connectionTimeout: 10000,
      });
      expect(client).toBeDefined();
    });

    it('should accept custom logger', () => {
      const customLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
        logger: customLogger,
      });
      expect(client).toBeDefined();
    });
  });

  describe('PostgresClient.connect', () => {
    it('should connect successfully', async () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      await expect(client.connect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('PostgresClient.disconnect', () => {
    it('should disconnect successfully', async () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      await client.connect();
      await expect(client.disconnect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('PostgresClient.query', () => {
    it('should execute query and return results', async () => {
      const pg = await import('pg');
      const mockQuery = (pg as any).__mockQuery;
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      });

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const results = await client.query('SELECT * FROM users');
      expect(results).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should execute parameterized query', async () => {
      const pg = await import('pg');
      const mockQuery = (pg as any).__mockQuery;
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      });

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      await client.query('SELECT * FROM users WHERE id = $1', [1]);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should throw error on query failure', async () => {
      const pg = await import('pg');
      const mockQuery = (pg as any).__mockQuery;
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      await expect(client.query('SELECT * FROM users')).rejects.toThrow('Query failed');
    });
  });

  describe('PostgresClient.queryOne', () => {
    it('should return single row', async () => {
      const pg = await import('pg');
      const mockQuery = (pg as any).__mockQuery;
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      });

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const result = await client.queryOne('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should return null when no rows found', async () => {
      const pg = await import('pg');
      const mockQuery = (pg as any).__mockQuery;
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const result = await client.queryOne('SELECT * FROM users WHERE id = $1', [999]);
      expect(result).toBeNull();
    });
  });

  describe('PostgresClient.healthCheck', () => {
    it('should return true when database is healthy', async () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      const pg = await import('pg');
      const mockQuery = (pg as any).__mockQuery;
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('PostgresClient.getStats', () => {
    it('should return pool statistics', () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const stats = client.getStats();
      expect(stats).toEqual({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
      });
    });
  });

  describe('PostgresClient.getPool', () => {
    it('should return underlying pool', () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const pool = client.getPool();
      expect(pool).toBeDefined();
      expect(pool.query).toBeDefined();
    });
  });

  describe('PostgresClient.getClient', () => {
    it('should return pool client for transactions', async () => {
      const client = new PostgresClient({
        serviceName: 'test-service',
        schemaName: 'test_schema',
      });

      const poolClient = await client.getClient();
      expect(poolClient).toBeDefined();
      expect(poolClient.release).toBeDefined();
    });
  });
});
