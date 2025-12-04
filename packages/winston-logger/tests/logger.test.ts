import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, LoggerConfig } from '../src';

describe('@railrepay/winston-logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createLogger', () => {
    it('should create a logger with required serviceName', () => {
      const logger = createLogger({ serviceName: 'test-service' });
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should throw error when serviceName is not provided', () => {
      expect(() => createLogger({} as LoggerConfig)).toThrow(
        'LoggerConfig.serviceName is required'
      );
    });

    it('should use default log level when not specified', () => {
      const logger = createLogger({ serviceName: 'test-service' });
      expect(logger.level).toBe('info');
    });

    it('should use custom log level when specified', () => {
      const logger = createLogger({ serviceName: 'test-service', level: 'debug' });
      expect(logger.level).toBe('debug');
    });

    it('should use LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = createLogger({ serviceName: 'test-service' });
      expect(logger.level).toBe('warn');
    });

    it('should include serviceName in default metadata', () => {
      const logger = createLogger({ serviceName: 'my-service' });
      expect(logger.defaultMeta).toEqual(
        expect.objectContaining({ app: 'my-service' })
      );
    });

    it('should include environment in default metadata', () => {
      const logger = createLogger({
        serviceName: 'test-service',
        environment: 'production'
      });
      expect(logger.defaultMeta).toEqual(
        expect.objectContaining({ environment: 'production' })
      );
    });

    it('should not enable Loki transport in test environment', () => {
      const logger = createLogger({
        serviceName: 'test-service',
        lokiEnabled: true
      });
      // In test environment, only console transport should be present
      expect(logger.transports.length).toBe(1);
    });

    it('should log messages without throwing errors', () => {
      const logger = createLogger({ serviceName: 'test-service' });

      expect(() => {
        logger.info('Test info message', { component: 'TestComponent' });
        logger.warn('Test warning', { code: 'W001' });
        logger.error('Test error', { error: 'Something went wrong' });
        logger.debug('Test debug', { data: { key: 'value' } });
      }).not.toThrow();
    });

    it('should handle metadata objects correctly', () => {
      const logger = createLogger({ serviceName: 'test-service' });
      const metadata = {
        component: 'TestComponent',
        requestId: '123-456',
        userId: 'user-789',
      };

      expect(() => {
        logger.info('Processing request', metadata);
      }).not.toThrow();
    });
  });

  describe('environment configuration', () => {
    it('should default environment to development', () => {
      delete process.env.NODE_ENV;
      delete process.env.ENVIRONMENT;
      const logger = createLogger({ serviceName: 'test-service' });
      expect(logger.defaultMeta?.environment).toBe('development');
    });

    it('should prefer ENVIRONMENT over NODE_ENV', () => {
      process.env.NODE_ENV = 'test';
      process.env.ENVIRONMENT = 'staging';
      const logger = createLogger({ serviceName: 'test-service' });
      expect(logger.defaultMeta?.environment).toBe('staging');
    });

    it('should prefer config.environment over env variables', () => {
      process.env.NODE_ENV = 'test';
      process.env.ENVIRONMENT = 'staging';
      const logger = createLogger({
        serviceName: 'test-service',
        environment: 'production'
      });
      expect(logger.defaultMeta?.environment).toBe('production');
    });
  });
});
