/**
 * OpenAPI Validator Middleware
 *
 * Express middleware for validating requests and responses against OpenAPI 3.0 schemas
 *
 * Features:
 * - Request validation (path, query, body, headers)
 * - Response validation (in development mode)
 * - Error formatting
 * - Schema loading from YAML/JSON
 *
 * Usage:
 * ```typescript
 * import { createOpenAPIMiddleware } from '@railrepay/openapi-validator';
 *
 * const app = express();
 * app.use(createOpenAPIMiddleware({
 *   schemaPath: './openapi.yaml',
 * }));
 * ```
 */

import { RequestHandler, ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { OpenAPIConfig, Logger } from './types';

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
 * Create OpenAPI validation middleware
 *
 * Returns an array of middleware functions that should be applied to the Express app
 * before route handlers.
 *
 * @param config - OpenAPI validation configuration
 * @returns Array of Express middleware functions
 */
export function createOpenAPIMiddleware(config: OpenAPIConfig): RequestHandler[] {
  if (!config.schemaPath) {
    throw new Error('OpenAPIConfig.schemaPath is required');
  }

  const logger = config.logger || consoleLogger;
  const validateRequests = config.validateRequests !== false;
  const validateResponses = config.validateResponses ?? process.env.NODE_ENV === 'development';
  const ignorePaths = config.ignorePaths || [];

  logger.info('Initializing OpenAPI validator', {
    component: 'OpenAPIValidator',
    schemaPath: config.schemaPath,
    validateRequests,
    validateResponses,
    ignorePaths: ignorePaths.map(p => p.toString()),
  });

  // Build options object conditionally
  const options: Parameters<typeof OpenApiValidator.middleware>[0] = {
    apiSpec: config.schemaPath,
    validateRequests,
    validateResponses,
  };

  // Add ignorePaths if specified (convert to regex for the library)
  if (ignorePaths.length > 0) {
    // Create a regex that matches any of the ignored paths
    const ignorePattern = ignorePaths.map(p =>
      typeof p === 'string' ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : p.source
    ).join('|');
    options.ignorePaths = new RegExp(`^(${ignorePattern})`);
  }

  return OpenApiValidator.middleware(options);
}

/**
 * OpenAPI validation error interface
 */
export interface ValidationError {
  status: number;
  message: string;
  errors: Array<{
    path: string;
    message: string;
    errorCode: string;
  }>;
}

/**
 * Create OpenAPI validation error handler middleware
 *
 * Formats validation errors into a consistent JSON response format.
 *
 * @param logger - Optional logger instance
 * @returns Express error handler middleware
 */
export function createOpenAPIErrorHandler(logger?: Logger): ErrorRequestHandler {
  const log = logger || consoleLogger;

  return (err: any, _req: Request, res: Response, next: NextFunction) => {
    // Check if this is an OpenAPI validation error
    if (err.status && err.errors) {
      log.warn('OpenAPI validation error', {
        component: 'OpenAPIValidator',
        status: err.status,
        message: err.message,
        errors: err.errors,
      });

      const response: ValidationError = {
        status: err.status,
        message: err.message || 'Validation failed',
        errors: err.errors.map((e: any) => ({
          path: e.path,
          message: e.message,
          errorCode: e.errorCode || 'VALIDATION_ERROR',
        })),
      };

      return res.status(err.status).json(response);
    }

    // Pass other errors to next error handler
    next(err);
  };
}
