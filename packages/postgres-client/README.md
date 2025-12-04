# @railrepay/postgres-client

Reusable PostgreSQL connection pool for RailRepay microservices with schema isolation support (ADR-001).

## Features

- Connection pooling with configurable pool size
- Schema isolation per ADR-001 (schema-per-service pattern)
- Automatic query logging with duration tracking
- Health check support for container orchestration
- Graceful shutdown
- Optional logger injection

## Installation

```bash
npm install @railrepay/postgres-client
```

## Usage

### Basic Usage

```typescript
import { PostgresClient } from '@railrepay/postgres-client';

const client = new PostgresClient({
  serviceName: 'my-service',   // REQUIRED
  schemaName: 'my_schema',     // REQUIRED
});

await client.connect();

// Query all rows
const users = await client.query<User>('SELECT * FROM users');

// Query single row
const user = await client.queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);

// Health check
const isHealthy = await client.healthCheck();

// Graceful shutdown
await client.disconnect();
```

### With Full Configuration

```typescript
import { PostgresClient } from '@railrepay/postgres-client';
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({ serviceName: 'my-service' });

const client = new PostgresClient({
  serviceName: 'timetable-loader',    // REQUIRED
  schemaName: 'timetable_loader',     // REQUIRED
  host: 'db.example.com',             // default: process.env.PGHOST
  port: 5432,                         // default: process.env.PGPORT
  database: 'railrepay',              // default: process.env.PGDATABASE
  user: 'postgres',                   // default: process.env.PGUSER
  password: 'secret',                 // default: process.env.PGPASSWORD
  ssl: true,                          // default: process.env.PGSSLMODE === 'require'
  poolSize: 20,                       // default: 20
  idleTimeout: 30000,                 // default: 30000ms
  connectionTimeout: 5000,            // default: 5000ms
  logger: logger,                     // optional winston logger
});
```

### Transaction Support

```typescript
const poolClient = await client.getClient();

try {
  await poolClient.query('BEGIN');
  await poolClient.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
  await poolClient.query('INSERT INTO accounts (user_id) VALUES ($1)', [1]);
  await poolClient.query('COMMIT');
} catch (error) {
  await poolClient.query('ROLLBACK');
  throw error;
} finally {
  poolClient.release();
}
```

### Pool Statistics

```typescript
const stats = client.getStats();
console.log('Pool stats:', stats);
// { totalCount: 20, idleCount: 18, waitingCount: 0 }
```

## Configuration

### PostgresConfig Interface

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `serviceName` | `string` | Yes | - | Service name for logging |
| `schemaName` | `string` | Yes | - | PostgreSQL schema (ADR-001) |
| `host` | `string` | No | `process.env.PGHOST \|\| 'localhost'` | Database host |
| `port` | `number` | No | `process.env.PGPORT \|\| 5432` | Database port |
| `database` | `string` | No | `process.env.PGDATABASE \|\| 'railrepay'` | Database name |
| `user` | `string` | No | `process.env.PGUSER \|\| 'postgres'` | Database user |
| `password` | `string` | No | `process.env.PGPASSWORD` | Database password |
| `ssl` | `boolean` | No | `process.env.PGSSLMODE === 'require'` | Enable SSL |
| `poolSize` | `number` | No | `20` | Max pool connections |
| `idleTimeout` | `number` | No | `30000` | Idle timeout (ms) |
| `connectionTimeout` | `number` | No | `5000` | Connection timeout (ms) |
| `logger` | `Logger` | No | `console` | Logger instance |

### Environment Variables

- `PGHOST` - Database host
- `PGPORT` - Database port
- `PGDATABASE` - Database name
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGSSLMODE` - Set to 'require' for SSL

## Schema Isolation (ADR-001)

This package enforces schema-per-service pattern from ADR-001. The `schemaName` config sets the PostgreSQL `search_path`, ensuring each service accesses only its own tables.

```sql
-- Automatically set by PostgresClient
SET search_path = timetable_loader, public;
```

## License

Private - RailRepay
