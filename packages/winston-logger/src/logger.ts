/**
 * Centralized Logger Configuration
 *
 * Winston logger with Loki integration for centralized log aggregation
 *
 * Features:
 * - Console transport for development/debugging
 * - Loki HTTP transport for production log aggregation
 * - Structured logging with metadata and labels
 * - Graceful degradation if Loki is unavailable
 * - Environment-based log levels
 * - Configurable service name for multi-service deployments
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@railrepay/winston-logger';
 *
 * const logger = createLogger({ serviceName: 'my-service' });
 * logger.info('Message processed', { component: 'MyComponent', id: '123' });
 * logger.error('Processing failed', { error: err.message });
 * ```
 */

import winston from 'winston';
import LokiTransport from 'winston-loki';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** REQUIRED - Service identifier for logs and Loki labels */
  serviceName: string;
  /** Log level (default: process.env.LOG_LEVEL || 'info') */
  level?: string;
  /** Loki host URL (default: process.env.LOKI_HOST || 'http://localhost:3100') */
  lokiHost?: string;
  /** Enable Loki transport (default: process.env.LOKI_ENABLED === 'true') */
  lokiEnabled?: boolean;
  /** Loki basic auth credentials (default: process.env.LOKI_BASIC_AUTH) */
  lokiBasicAuth?: string;
  /** Environment name for labels (default: process.env.NODE_ENV || 'development') */
  environment?: string;
}

/**
 * Create Winston logger with console and optional Loki transports
 *
 * @param config - Logger configuration options (serviceName is required)
 * @returns Configured Winston logger instance
 */
export function createLogger(config: LoggerConfig): winston.Logger {
  const {
    serviceName,
    level = process.env.LOG_LEVEL || 'info',
    lokiHost = process.env.LOKI_HOST || 'http://localhost:3100',
    lokiEnabled = process.env.LOKI_ENABLED === 'true',
    lokiBasicAuth = process.env.LOKI_BASIC_AUTH,
    environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  } = config;

  if (!serviceName) {
    throw new Error('LoggerConfig.serviceName is required');
  }

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  // Console format for development (pretty-print)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Filter out defaultMeta fields (app, environment) from console display
      // These are automatically added by Winston and clutter the output
      const { app, environment: env, ...relevantMeta } = meta;
      const metaStr = Object.keys(relevantMeta).length ? JSON.stringify(relevantMeta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  );

  // Create transports array
  const transports: winston.transport[] = [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: consoleFormat,
      level,
    }),
  ];

  // Add Loki transport if enabled (skip in test environment)
  if (lokiEnabled && process.env.NODE_ENV !== 'test') {
    try {
      const lokiTransport = new LokiTransport({
        host: lokiHost,
        basicAuth: lokiBasicAuth,
        labels: {
          app: serviceName,
          environment,
        },
        json: true,
        format: logFormat,
        replaceTimestamp: true,
        onConnectionError: (err: Error) => {
          // Graceful degradation: log to console if Loki fails
          console.error(`[${serviceName}] Loki connection error:`, err.message);
        },
        // Timeout and batching configuration
        // Note: batching disabled for Grafana Cloud compatibility (see winston-loki issue #76)
        timeout: 3000,
        batching: false,
      });

      transports.push(lokiTransport);
    } catch (error) {
      // If Loki transport fails to initialize, continue with console only
      console.warn(`[${serviceName}] Failed to initialize Loki transport, using console only`);
    }
  }

  // Create logger instance
  const loggerInstance = winston.createLogger({
    level,
    format: logFormat,
    defaultMeta: {
      app: serviceName,
      environment,
    },
    transports,
    // Don't exit on handled exceptions
    exitOnError: false,
  });

  return loggerInstance;
}
