# @railrepay/openapi-validator

OpenAPI 3.0 request/response validation middleware for RailRepay microservices.

## Features

- Request validation (path, query, body, headers)
- Response validation (enabled in development by default)
- Error formatting with detailed validation messages
- Schema loading from YAML/JSON files
- Path ignoring for health checks and metrics endpoints

## Installation

```bash
npm install @railrepay/openapi-validator
```

## Usage

### Basic Usage

```typescript
import express from 'express';
import { createOpenAPIMiddleware, createOpenAPIErrorHandler } from '@railrepay/openapi-validator';

const app = express();

// Parse JSON bodies (required for validation)
app.use(express.json());

// Apply OpenAPI validation middleware
app.use(createOpenAPIMiddleware({
  schemaPath: './openapi.yaml',  // REQUIRED
}));

// Your routes here
app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }]);
});

// Apply error handler (should be last)
app.use(createOpenAPIErrorHandler());

app.listen(3000);
```

### With Full Configuration

```typescript
import { createOpenAPIMiddleware, createOpenAPIErrorHandler } from '@railrepay/openapi-validator';
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({ serviceName: 'api-gateway' });

app.use(createOpenAPIMiddleware({
  schemaPath: './openapi.yaml',       // REQUIRED
  validateRequests: true,             // default: true
  validateResponses: true,            // default: NODE_ENV === 'development'
  ignorePaths: ['/health', '/metrics'], // default: []
  logger: logger,                     // optional
}));

app.use(createOpenAPIErrorHandler(logger));
```

### OpenAPI Schema Example

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /api/users:
    get:
      summary: List users
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUser'
      responses:
        '201':
          description: Created
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      required: [id, name]
    CreateUser:
      type: object
      properties:
        name:
          type: string
      required: [name]
```

## Configuration

### OpenAPIConfig Interface

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `schemaPath` | `string` | Yes | - | Path to OpenAPI 3.0 YAML/JSON |
| `validateRequests` | `boolean` | No | `true` | Validate incoming requests |
| `validateResponses` | `boolean` | No | `NODE_ENV === 'development'` | Validate outgoing responses |
| `ignorePaths` | `(string\|RegExp)[]` | No | `[]` | Paths to skip validation |
| `logger` | `Logger` | No | `console` | Logger instance |

## Error Response Format

When validation fails, the error handler returns a structured JSON response:

```json
{
  "status": 400,
  "message": "request/body must have required property 'name'",
  "errors": [
    {
      "path": "/body/name",
      "message": "must have required property 'name'",
      "errorCode": "required.openapi.validation"
    }
  ]
}
```

## Best Practices

1. **Apply validation early** - Add middleware before route handlers
2. **Apply error handler last** - Should be after all routes
3. **Ignore health checks** - Add `/health` and `/metrics` to `ignorePaths`
4. **Enable response validation in dev** - Catches schema drift early
5. **Keep schema in sync** - Generate schema from code or validate at build time

## Integration with RailRepay

```typescript
import express from 'express';
import { createOpenAPIMiddleware, createOpenAPIErrorHandler } from '@railrepay/openapi-validator';
import { createMetricsRouter } from '@railrepay/metrics-pusher';
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({ serviceName: 'api-gateway' });
const app = express();

app.use(express.json());

// Metrics before validation (so it's not validated)
app.use('/metrics', createMetricsRouter(logger));

// Health check before validation
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// OpenAPI validation for API routes
app.use('/api', createOpenAPIMiddleware({
  schemaPath: './openapi.yaml',
  ignorePaths: ['/health', '/metrics'],
  logger,
}));

// API routes
app.use('/api', apiRouter);

// Error handler
app.use(createOpenAPIErrorHandler(logger));

app.listen(3000);
```

## License

Private - RailRepay
