/**
 * @railrepay/postgres-client
 *
 * Reusable PostgreSQL connection pool for RailRepay microservices
 */

export {
  PostgresClient,
  PostgresConfig,
  PoolStats,
  Logger,
} from './client';

// Re-export pg types for convenience
export { Pool, PoolClient, QueryResult } from 'pg';
