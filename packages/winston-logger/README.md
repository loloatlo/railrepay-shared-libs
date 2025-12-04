# @railrepay/winston-logger

Reusable Winston logger with Loki integration for RailRepay microservices.

## Features

- Console transport for development/debugging with pretty-print formatting
- Loki HTTP transport for production log aggregation to Grafana Cloud
- Structured logging with metadata and labels
- Graceful degradation if Loki is unavailable
- Environment-based log levels
- Configurable service name for multi-service deployments

## Installation

```bash
npm install @railrepay/winston-logger
```

## Usage

### Basic Usage

```typescript
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({ serviceName: 'my-service' });

logger.info('Application started', { port: 3000 });
logger.warn('Cache miss', { key: 'user:123' });
logger.error('Database connection failed', { error: err.message });
logger.debug('Processing item', { itemId: 456, data: item });
```

### With Full Configuration

```typescript
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({
  serviceName: 'darwin-ingestor',      // REQUIRED
  level: 'debug',                       // default: 'info'
  lokiHost: 'http://loki.internal:3100', // default: process.env.LOKI_HOST
  lokiEnabled: true,                    // default: process.env.LOKI_ENABLED === 'true'
  lokiBasicAuth: 'user:pass',           // default: process.env.LOKI_BASIC_AUTH
  environment: 'production',            // default: process.env.NODE_ENV
});
```

### Structured Logging

```typescript
// Include component name for filtering
logger.info('Message processed', {
  component: 'KafkaConsumer',
  rid: 'ABC123',
  offset: 12345,
});

// Log errors with stack traces
logger.error('Processing failed', {
  component: 'MessageParser',
  error: error.message,
  stack: error.stack,
});
```

## Configuration

### LoggerConfig Interface

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `serviceName` | `string` | Yes | - | Service identifier for logs and Loki labels |
| `level` | `string` | No | `process.env.LOG_LEVEL \|\| 'info'` | Log level |
| `lokiHost` | `string` | No | `process.env.LOKI_HOST` | Loki host URL |
| `lokiEnabled` | `boolean` | No | `process.env.LOKI_ENABLED === 'true'` | Enable Loki transport |
| `lokiBasicAuth` | `string` | No | `process.env.LOKI_BASIC_AUTH` | Loki basic auth credentials |
| `environment` | `string` | No | `process.env.NODE_ENV \|\| 'development'` | Environment name |

### Environment Variables

- `LOG_LEVEL` - Default log level (info, debug, warn, error)
- `LOKI_HOST` - Loki server URL
- `LOKI_ENABLED` - Set to 'true' to enable Loki transport
- `LOKI_BASIC_AUTH` - Basic auth credentials for Loki
- `NODE_ENV` / `ENVIRONMENT` - Environment name for labels

## Log Levels

- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages (default)
- `debug` - Debug-level messages

## Loki Labels

When Loki is enabled, the following labels are automatically added:

- `app` - Service name from config
- `environment` - Environment from config

## License

Private - RailRepay
