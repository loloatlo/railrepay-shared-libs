/**
 * OpenAPI Validator Types
 *
 * Type definitions for OpenAPI validation configuration
 */

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
 * OpenAPI validator configuration
 */
export interface OpenAPIConfig {
  /** REQUIRED - Path to OpenAPI 3.0 YAML/JSON schema file */
  schemaPath: string;
  /** Validate incoming requests (default: true) */
  validateRequests?: boolean;
  /** Validate outgoing responses (default: NODE_ENV === 'development') */
  validateResponses?: boolean;
  /** Ignore paths matching these patterns (default: []) */
  ignorePaths?: (string | RegExp)[];
  /** Optional logger instance */
  logger?: Logger;
}
