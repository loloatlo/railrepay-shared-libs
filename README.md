# RailRepay Shared Libraries

Shared TypeScript libraries for RailRepay MVP microservices. This monorepo contains reusable components for Kafka messaging, PostgreSQL connections, Redis caching, logging, metrics, and API validation.

## Packages

This repository contains the following packages:

### [@railrepay/kafka-client](packages/kafka-client)
Reusable Kafka consumer wrapper with automatic message handling and error recovery.

### [@railrepay/postgres-client](packages/postgres-client)
PostgreSQL connection pool manager with schema-per-service isolation support.

### [@railrepay/redis-cache](packages/redis-cache)
Redis caching layer with idempotency key management and connection pooling.

### [@railrepay/winston-logger](packages/winston-logger)
Winston logger with Loki integration, structured JSON logging, and correlation ID support.

### [@railrepay/metrics-pusher](packages/metrics-pusher)
Prometheus metrics collection with Grafana Alloy integration for push-based observability.

### [@railrepay/openapi-validator](packages/openapi-validator)
OpenAPI 3.0 request/response validation middleware for Express applications.

## Installation

Each package can be installed independently:

```bash
npm install @railrepay/kafka-client
npm install @railrepay/postgres-client
npm install @railrepay/redis-cache
npm install @railrepay/winston-logger
npm install @railrepay/metrics-pusher
npm install @railrepay/openapi-validator
```

## Development

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/loloatlo/railrepay-shared-libs.git
cd railrepay-shared-libs
npm install
```

### Building

Build all packages:

```bash
npm run build
```

Build a specific package:

```bash
npm run build -w packages/kafka-client
```

### Testing

Run tests for all packages:

```bash
npm test
```

Run tests for a specific package:

```bash
npm test -w packages/winston-logger
```

## Publishing

### Initial Setup

1. Create an npm account at https://www.npmjs.com
2. Login to npm:
   ```bash
   npm login
   ```
3. Verify the @railrepay scope is available or create it

### Manual Publishing

From the repository root:

```bash
npm run build
npm publish --workspaces --access public
```

### Automated Publishing via GitHub Actions

1. Generate an npm access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy the token

2. Add the token to GitHub Secrets:
   - Go to https://github.com/loloatlo/railrepay-shared-libs/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm token

3. Create a release tag to trigger publishing:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

The GitHub Actions workflow will automatically build and publish all packages.

## Architecture

These libraries follow RailRepay MVP architectural patterns:

- **ADR-001**: Schema-per-service isolation (postgres-client)
- **ADR-002**: Correlation ID propagation (winston-logger)
- **ADR-004**: Vitest for testing (all packages)
- **ADR-008**: Health check endpoints (metrics-pusher)
- **ADR-014**: TDD compliance (all packages)

## License

MIT

## Support

For issues and questions, please file an issue on GitHub:
https://github.com/loloatlo/railrepay-shared-libs/issues
