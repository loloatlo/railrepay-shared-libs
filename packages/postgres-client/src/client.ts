/**
 * PostgreSQL Client
 *
 * Reusable PostgreSQL connection pool for RailRepay microservices
 *
 * Features:
 * - Connection pooling with configurable pool size
 * - Schema isolation per ADR-001 (schema-per-service pattern)
 * - Automatic query logging
 * - Health check support
 * - Graceful shutdown
 *
 * Usage:
 * ```typescript
 * import { PostgresClient } from '@railrepay/postgres-client';
 *
 * const client = new PostgresClient({
 *   serviceName: 'my-service',
 *   schemaName: 'my_schema',
 * });
 *
 * await client.connect();
 * const users = await client.query<User>('SELECT * FROM users');
 * await client.disconnect();
 * ```
 */

import { Pool, PoolClient, PoolConfig } from 'pg';

/**
 * Pool statistics
 */
export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

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
 * PostgreSQL client configuration
 */
export interface PostgresConfig {
  /** REQUIRED - Service name for logging */
  serviceName: string;
  /** REQUIRED - PostgreSQL schema name (ADR-001 schema-per-service) */
  schemaName: string;
  /** Database host (default: process.env.PGHOST || 'localhost') */
  host?: string;
  /** Database port (default: process.env.PGPORT || 5432) */
  port?: number;
  /** Database name (default: process.env.PGDATABASE || 'railrepay') */
  database?: string;
  /** Database user (default: process.env.PGUSER || 'postgres') */
  user?: string;
  /** Database password (default: process.env.PGPASSWORD) */
  password?: string;
  /** Enable SSL (default: process.env.PGSSLMODE === 'require') */
  ssl?: boolean;
  /** Maximum pool size (default: 20) */
  poolSize?: number;
  /** Idle timeout in milliseconds (default: 30000) */
  idleTimeout?: number;
  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeout?: number;
  /** Optional logger instance */
  logger?: Logger;
}

/**
 * PostgreSQL connection pool client
 */
export class PostgresClient {
  private pool: Pool;
  private config: PostgresConfig;
  private logger: Logger;
  private connected: boolean = false;

  constructor(config: PostgresConfig) {
    if (!config.serviceName) {
      throw new Error('PostgresConfig.serviceName is required');
    }
    if (!config.schemaName) {
      throw new Error('PostgresConfig.schemaName is required');
    }

    this.config = config;
    this.logger = config.logger || consoleLogger;

    const poolConfig: PoolConfig = {
      host: config.host || process.env.PGHOST || 'localhost',
      port: config.port || parseInt(process.env.PGPORT || '5432', 10),
      database: config.database || process.env.PGDATABASE || 'railrepay',
      user: config.user || process.env.PGUSER || 'postgres',
      password: config.password || process.env.PGPASSWORD || 'postgres',
      ssl: (config.ssl ?? process.env.PGSSLMODE === 'require')
        ? { rejectUnauthorized: false }
        : false,
      max: config.poolSize ?? 20,
      idleTimeoutMillis: config.idleTimeout ?? 30000,
      connectionTimeoutMillis: config.connectionTimeout ?? 5000,
      // Set search_path to enforce schema isolation (ADR-001)
      options: `-c search_path=${config.schemaName},public`,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', {
        component: `${config.serviceName}/PostgresClient`,
        error: err.message,
      });
    });

    this.pool.on('connect', () => {
      this.logger.debug('PostgreSQL client connected to pool', {
        component: `${config.serviceName}/PostgresClient`,
      });
    });
  }

  /**
   * Connect to the database and verify connectivity
   */
  async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      this.connected = true;
      this.logger.info('PostgreSQL connection pool initialized', {
        component: `${this.config.serviceName}/PostgresClient`,
        host: this.config.host || process.env.PGHOST || 'localhost',
        port: this.config.port || parseInt(process.env.PGPORT || '5432', 10),
        database: this.config.database || process.env.PGDATABASE || 'railrepay',
        schema: this.config.schemaName,
        maxConnections: this.config.poolSize ?? 20,
      });
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL', {
        component: `${this.config.serviceName}/PostgresClient`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    this.logger.info('PostgreSQL connection pool closed', {
      component: `${this.config.serviceName}/PostgresClient`,
    });
  }

  /**
   * Get a client from the pool for manual transaction management
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute a query with automatic connection management
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - start;

      this.logger.debug('Executed query', {
        component: `${this.config.serviceName}/PostgresClient`,
        query: sql.substring(0, 100),
        duration,
        rows: result.rowCount,
      });

      return result.rows as T[];
    } catch (error) {
      this.logger.error('Database query error', {
        component: `${this.config.serviceName}/PostgresClient`,
        error: error instanceof Error ? error.message : 'Unknown error',
        query: sql.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Execute a query and return a single row
   */
  async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  /**
   * Test database connectivity (health check)
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', {
        component: `${this.config.serviceName}/PostgresClient`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get the underlying pool for advanced usage
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
